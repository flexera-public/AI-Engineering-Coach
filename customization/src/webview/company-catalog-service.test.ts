import { describe, expect, it } from 'vitest';

import { discoverCompanyCatalogItems } from './company-catalog-service';

describe('company-catalog-service', () => {
  it('discovers top-level skills and maps them to packages from package manifests', async () => {
    const fetchGitHubJson = async <T>(url: string): Promise<T> => {
      if (url.includes('/git/trees/')) {
        return {
          tree: [
            { path: 'skills/dotnet-cqrs-backend/SKILL.md', type: 'blob', sha: 'skill-sha' },
            { path: 'packages/software-engineer/manifest.json', type: 'blob', sha: 'manifest-sha' },
            { path: '.github/agents/nexus.agent.md', type: 'blob', sha: 'agent-sha' },
          ],
        } as T;
      }

      if (url.endsWith('/git/blobs/manifest-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({
            skills: [
              { name: 'dotnet-cqrs-backend', path: '../../skills/dotnet-cqrs-backend' },
            ],
          })).toString('base64'),
        } as T;
      }

      if (url.endsWith('/git/blobs/skill-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from([
            '---',
            'name: dotnet-cqrs-backend',
            'description: CQRS handlers and validators',
            '---',
          ].join('\n')).toString('base64'),
        } as T;
      }

      if (url.endsWith('/git/blobs/agent-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from('# Nexus Agent').toString('base64'),
        } as T;
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const items = await discoverCompanyCatalogItems([
      { id: 'sam-ai-agents', name: 'sam-ai-agents', repository: 'SnowSoftwareGlobal/sam-ai-agents', url: 'https://github.com/SnowSoftwareGlobal/sam-ai-agents/tree/main', ref: 'main' },
    ], 'sam-ai-agents', fetchGitHubJson);

    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'skill',
        path: 'skills/dotnet-cqrs-backend/SKILL.md',
        collectionName: 'software-engineer',
      }),
      expect.objectContaining({
        kind: 'agent',
        path: '.github/agents/nexus.agent.md',
      }),
    ]));
  });

  it('supports generated .apm package skill folders', async () => {
    const fetchGitHubJson = async <T>(url: string): Promise<T> => {
      if (url.includes('/git/trees/')) {
        return {
          tree: [
            { path: 'packages/architect/.apm/skills/docs-adr-writing/SKILL.md', type: 'blob', sha: 'skill-sha' },
          ],
        } as T;
      }

      if (url.endsWith('/git/blobs/skill-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from([
            '---',
            'name: docs-adr-writing',
            'description: ADR authoring and review',
            '---',
          ].join('\n')).toString('base64'),
        } as T;
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const items = await discoverCompanyCatalogItems([
      { id: 'sam-ai-agents', name: 'sam-ai-agents', repository: 'SnowSoftwareGlobal/sam-ai-agents', url: 'https://github.com/SnowSoftwareGlobal/sam-ai-agents/tree/main', ref: 'main' },
    ], 'sam-ai-agents', fetchGitHubJson);

    expect(items).toEqual([
      expect.objectContaining({
        kind: 'skill',
        path: 'packages/architect/.apm/skills/docs-adr-writing/SKILL.md',
        collectionName: 'architect',
      }),
    ]);
  });

  it('duplicates skills that belong to multiple packages so each capability can match them', async () => {
    const fetchGitHubJson = async <T>(url: string): Promise<T> => {
      if (url.includes('/git/trees/')) {
        return {
          tree: [
            { path: 'skills/docs-trace-to-schematic/SKILL.md', type: 'blob', sha: 'skill-sha' },
            { path: 'packages/architect/manifest.json', type: 'blob', sha: 'architect-manifest-sha' },
            { path: 'packages/lead-engineer/manifest.json', type: 'blob', sha: 'lead-manifest-sha' },
          ],
        } as T;
      }

      if (url.endsWith('/git/blobs/architect-manifest-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({
            skills: [{ name: 'docs-trace-to-schematic', path: '../../skills/docs-trace-to-schematic' }],
          })).toString('base64'),
        } as T;
      }

      if (url.endsWith('/git/blobs/lead-manifest-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({
            skills: [{ name: 'docs-trace-to-schematic', path: '../../skills/docs-trace-to-schematic' }],
          })).toString('base64'),
        } as T;
      }

      if (url.endsWith('/git/blobs/skill-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from([
            '---',
            'name: docs-trace-to-schematic',
            'description: Trace repo topology',
            '---',
          ].join('\n')).toString('base64'),
        } as T;
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const items = await discoverCompanyCatalogItems([
      { id: 'sam-ai-agents', name: 'sam-ai-agents', repository: 'SnowSoftwareGlobal/sam-ai-agents', url: 'https://github.com/SnowSoftwareGlobal/sam-ai-agents/tree/main', ref: 'main' },
    ], 'sam-ai-agents', fetchGitHubJson);

    expect(items.filter(item => item.path === 'skills/docs-trace-to-schematic/SKILL.md')).toEqual([
      expect.objectContaining({ collectionName: 'architect' }),
      expect.objectContaining({ collectionName: 'lead-engineer' }),
    ]);
  });
});