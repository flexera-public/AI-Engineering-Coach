/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { callLlmJsonMock, createDirectoryMock, writeFileMock } = vi.hoisted(() => ({
  callLlmJsonMock: vi.fn(),
  createDirectoryMock: vi.fn<(uri: { fsPath: string }) => Promise<void>>(),
  writeFileMock: vi.fn<(uri: { fsPath: string }, content: Uint8Array) => Promise<void>>(),
}));

vi.mock('vscode', () => ({
  authentication: {
    getSession: vi.fn(),
  },
  Uri: {
    file: (fsPath: string) => ({ fsPath }),
  },
  workspace: {
    fs: {
      createDirectory: createDirectoryMock,
      writeFile: writeFileMock,
    },
  },
  LanguageModelChatMessage: {
    User: (content: string) => ({ content }),
  },
}));

vi.mock('./panel-llm', () => ({
  callLlm: vi.fn(),
  callLlmJson: callLlmJsonMock,
  UNTRUSTED_DATA_GUARD: '',
  SCHEMA_CATALOG_PICKS: {},
  SCHEMA_CODE_REVIEW: {},
  SCHEMA_CONTEXT_REVIEW: {},
  SCHEMA_DID_YOU_KNOW: {},
  SCHEMA_QUIZ: {},
  SCHEMA_RESOURCES: {},
  SCHEMA_TRIAGE: {},
}));

import { PanelRequestService } from './panel-request-service';

type PostedMessage = {
  type: string;
  id?: string;
  data?: unknown;
};

function createService(
  catalogProvider?: {
    getCatalogAreas(): { areas: unknown[]; packages?: string[] };
    discoverCatalogItems(params: Record<string, unknown>): Promise<unknown[] | undefined>;
    fetchCatalogItemContent?(params: Record<string, unknown>): Promise<string | undefined>;
  },
): { service: PanelRequestService; messages: PostedMessage[] } {
  const messages: PostedMessage[] = [];
  const webview = {
    postMessage: vi.fn((message: PostedMessage) => {
      messages.push(message);
      return true;
    }),
  };

  return {
    service: new PanelRequestService(
      webview as never,
      () => undefined,
      () => undefined,
      catalogProvider as never,
    ),
    messages,
  };
}

async function flushMessages(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('PanelRequestService discoverCatalog', () => {
  beforeEach(() => {
    callLlmJsonMock.mockReset();
  });

  it('returns configured catalog areas from the injected provider', async () => {
    const areas = [{ id: 'area-1', name: 'Area 1', repository: 'org/repo', url: 'https://github.com/org/repo/tree/main', ref: 'main', packages: ['architect'] }];
    const packages = ['architect'];
    const { service, messages } = createService({
      getCatalogAreas: () => ({ areas, packages }),
      discoverCatalogItems: vi.fn().mockResolvedValue(undefined),
    });
    service.tryHandle({
      type: 'request',
      id: 'areas-1',
      method: 'getCatalogAreas',
      params: {},
    } as never);

    await flushMessages();

    expect(messages[0]).toEqual({
      type: 'response',
      id: 'areas-1',
      data: { areas, packages },
    });
  });

  it('returns company catalog items when the injected provider handles the request', async () => {
    const discoverCatalogItems = vi.fn().mockResolvedValue([{
      kind: 'skill',
      id: 'area-1:skill:.github/skills/demo/SKILL.md',
      title: 'Demo Skill',
      description: 'Company catalog item',
      category: 'skill',
      path: '.github/skills/demo/SKILL.md',
      url: 'https://github.com/org/repo/blob/main/.github/skills/demo/SKILL.md',
      relevanceScore: 0,
      matchReasons: [],
      source: 'github-repository',
      repository: 'org/repo',
      owner: 'org',
      repo: 'repo',
      ref: 'main',
      areaName: 'Area 1',
      collectionName: 'architect',
    }]);
    const { service, messages } = createService({
      getCatalogAreas: () => ({ areas: [] }),
      discoverCatalogItems,
    });

    service.tryHandle({
      type: 'request',
      id: 'company-1',
      method: 'discoverCatalog',
      params: { includeCompany: true, areaId: 'area-1' },
    } as never);

    await flushMessages();

    expect(discoverCatalogItems).toHaveBeenCalledWith({ includeCompany: true, areaId: 'area-1' });
    expect(messages[0]).toEqual({
      type: 'response',
      id: 'company-1',
      data: {
        items: [{
          kind: 'skill',
          id: 'area-1:skill:.github/skills/demo/SKILL.md',
          title: 'Demo Skill',
          description: 'Company catalog item',
          category: 'skill',
          path: '.github/skills/demo/SKILL.md',
          url: 'https://github.com/org/repo/blob/main/.github/skills/demo/SKILL.md',
          relevanceScore: 0,
          matchReasons: [],
          source: 'github-repository',
          repository: 'org/repo',
          owner: 'org',
          repo: 'repo',
          ref: 'main',
          areaName: 'Area 1',
          collectionName: 'architect',
        }],
        totalScanned: 1,
      },
    });
  });

  it('returns an empty catalog when no configured provider handles the request', async () => {
    const { service, messages } = createService();
    service.tryHandle({
      type: 'request',
      id: 'public-1',
      method: 'discoverCatalog',
      params: {},
    } as never);

    await flushMessages();

    expect(messages[0]).toEqual({
      type: 'response',
      id: 'public-1',
      data: {
        items: [],
        totalScanned: 0,
      },
    });
  });

  it('returns deterministic catalog picks when AI catalog triage fails', async () => {
    callLlmJsonMock.mockRejectedValue(new Error('model unavailable'));

    const { service, messages } = createService();
    service.tryHandle({
      type: 'request',
      id: 'triage-1',
      method: 'triageCatalog',
      params: {
        items: [
          {
            id: 'skill:release',
            kind: 'skill',
            title: 'Release Automation',
            description: 'Automate release packaging and publishing flows.',
            category: 'automation',
            path: 'skills/release/SKILL.md',
            url: 'https://example.test/release',
          },
          {
            id: 'skill:python',
            kind: 'skill',
            title: 'Python Basics',
            description: 'Introductory Python snippets.',
            category: 'python',
            path: 'skills/python/SKILL.md',
            url: 'https://example.test/python',
          },
        ],
        clusters: [
          {
            label: 'release packaging automation',
            occurrences: 12,
            workspaces: ['AI-Engineering-Coach-Flexera'],
            examples: ['package release build and publish artifacts'],
          },
        ],
        workspace: 'AI-Engineering-Coach-Flexera',
      },
    } as never);

    await flushMessages();

    expect(messages[0]).toEqual({
      type: 'response',
      id: 'triage-1',
      data: {
        items: [{
          id: 'skill:release',
          kind: 'skill',
          title: 'Release Automation',
          description: 'Automate release packaging and publishing flows.',
          category: 'automation',
          path: 'skills/release/SKILL.md',
          url: 'https://example.test/release',
          relevanceScore: 100,
          matchReasons: ['Matched your repeated workflow signals: release, packaging, automation.'],
        }],
      },
    });
  });
});

describe('PanelRequestService installCatalogItem', () => {
  beforeEach(() => {
    createDirectoryMock.mockReset();
    writeFileMock.mockReset();
  });

  it('uses the customization provider for company catalog items', async () => {
    const fetchCatalogItemContent = vi.fn().mockResolvedValue('# Company Skill');
    const { service, messages } = createService({
      getCatalogAreas: () => ({ areas: [] }),
      discoverCatalogItems: vi.fn().mockResolvedValue(undefined),
      fetchCatalogItemContent,
    });
    const params = {
      path: 'packages/architect/.apm/skills/company-skill/SKILL.md',
      kind: 'skill',
      title: 'Company Skill',
      source: 'github-repository',
      repository: 'company/skills',
      owner: 'company',
      repo: 'skills',
      ref: 'presentation',
    };

    service.tryHandle({
      type: 'request',
      id: 'install-company-1',
      method: 'installCatalogItem',
      params,
    } as never);

    await vi.waitFor(() => expect(messages).toHaveLength(1));

    expect(fetchCatalogItemContent).toHaveBeenCalledWith(params);
    const writeCall = writeFileMock.mock.calls[0];
    expect(writeCall?.[0].fsPath).toContain('company-skill');
    expect(writeCall?.[1]).toEqual(Buffer.from('# Company Skill', 'utf8'));
    expect(messages[0]).toEqual({
      type: 'response',
      id: 'install-company-1',
      data: {
        content: '# Company Skill',
        filename: 'company-skill/SKILL.md',
      },
    });
  });
});