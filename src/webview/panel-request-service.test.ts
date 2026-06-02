/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCatalogItemsMock, callLlmJsonMock } = vi.hoisted(() => ({
  getCatalogItemsMock: vi.fn(),
  callLlmJsonMock: vi.fn(),
}));

vi.mock('vscode', () => ({
  authentication: {
    getSession: vi.fn(),
  },
  LanguageModelChatMessage: {
    User: (content: string) => ({ content }),
  },
}));

vi.mock('./panel-llm', () => ({
  callLlm: vi.fn(),
  callLlmJson: callLlmJsonMock,
  SCHEMA_CATALOG_PICKS: {},
  SCHEMA_CODE_REVIEW: {},
  SCHEMA_CONTEXT_REVIEW: {},
  SCHEMA_DID_YOU_KNOW: {},
  SCHEMA_QUIZ: {},
  SCHEMA_RESOURCES: {},
  SCHEMA_TRIAGE: {},
}));

vi.mock('./panel-catalog', () => ({
  getCatalogItems: getCatalogItemsMock,
}));

import { PanelRequestService } from './panel-request-service';

type PostedMessage = {
  type: string;
  id?: string;
  data?: unknown;
};

function createService(
  catalogProvider?: {
    getCatalogAreas(): unknown[];
    discoverCatalogItems(params: Record<string, unknown>): Promise<unknown[] | undefined>;
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
    getCatalogItemsMock.mockReset();
    callLlmJsonMock.mockReset();
  });

  it('returns configured catalog areas from the injected provider', async () => {
    const areas = [{ id: 'area-1', name: 'Area 1', repository: 'org/repo', url: 'https://github.com/org/repo/tree/main', ref: 'main' }];
    const { service, messages } = createService({
      getCatalogAreas: () => areas,
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
      data: { areas },
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
      getCatalogAreas: () => [],
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
    expect(getCatalogItemsMock).not.toHaveBeenCalled();
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

  it('returns public catalog items when includeCompany is not requested', async () => {
    getCatalogItemsMock.mockResolvedValue([{
      kind: 'skill',
      id: 'skill:demo',
      title: 'Demo',
      description: 'Public catalog item',
      category: 'General',
      path: 'skills/demo/SKILL.md',
      url: 'https://awesome-copilot.github.com/skills/#demo',
    }]);

    const { service, messages } = createService();
    service.tryHandle({
      type: 'request',
      id: 'public-1',
      method: 'discoverCatalog',
      params: {},
    } as never);

    await flushMessages();

    expect(getCatalogItemsMock).toHaveBeenCalledOnce();
    expect(messages[0]).toEqual({
      type: 'response',
      id: 'public-1',
      data: {
        items: [{
          kind: 'skill',
          id: 'skill:demo',
          title: 'Demo',
          description: 'Public catalog item',
          category: 'General',
          path: 'skills/demo/SKILL.md',
          url: 'https://awesome-copilot.github.com/skills/#demo',
          relevanceScore: 0,
          matchReasons: [],
        }],
        totalScanned: 1,
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