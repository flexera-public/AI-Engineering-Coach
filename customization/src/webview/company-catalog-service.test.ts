import { describe, expect, it } from 'vitest';

import { discoverCompanyCatalogItems } from './company-catalog-service';

describe('company-catalog-service', () => {
  it('discovers top-level skills and maps them to packages from package manifests', async () => {
    const fetchGitHubJson = async <T>(url: string): Promise<T> => {
      if (url.includes('/git/trees/')) {
        return {
          tree: [
            { path: 'skills/backend-skill/SKILL.md', type: 'blob', sha: 'skill-sha' },
            { path: 'packages/software-engineer/manifest.json', type: 'blob', sha: 'manifest-sha' },
          ],
        } as T;
      }

      if (url.endsWith('/git/blobs/manifest-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({
            skills: [
              { name: 'backend-skill', path: '../../skills/backend-skill' },
            ],
          })).toString('base64'),
        } as T;
      }

      if (url.endsWith('/git/blobs/skill-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from([
            '---',
            'name: backend-skill',
            'description: Backend implementation guidance',
            '---',
          ].join('\n')).toString('base64'),
        } as T;
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const items = await discoverCompanyCatalogItems([
      { id: 'team-catalog', name: 'Team Catalog', repository: 'org/catalog', url: 'https://github.com/org/catalog/tree/main', ref: 'main' },
    ], 'team-catalog', fetchGitHubJson);

    expect(items).toEqual([
      expect.objectContaining({
        kind: 'skill',
        path: 'skills/backend-skill/SKILL.md',
        collectionName: 'software-engineer',
      }),
    ]);
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
            'name: architecture-skill',
            'description: Architecture guidance',
            '---',
          ].join('\n')).toString('base64'),
        } as T;
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const items = await discoverCompanyCatalogItems([
      { id: 'team-catalog', name: 'Team Catalog', repository: 'org/catalog', url: 'https://github.com/org/catalog/tree/main', ref: 'main' },
    ], 'team-catalog', fetchGitHubJson);

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
            { path: 'skills/shared-skill/SKILL.md', type: 'blob', sha: 'skill-sha' },
            { path: 'packages/architect/manifest.json', type: 'blob', sha: 'architect-manifest-sha' },
            { path: 'packages/lead-engineer/manifest.json', type: 'blob', sha: 'lead-manifest-sha' },
          ],
        } as T;
      }

      if (url.endsWith('/git/blobs/architect-manifest-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({
            skills: [{ name: 'shared-skill', path: '../../skills/shared-skill' }],
          })).toString('base64'),
        } as T;
      }

      if (url.endsWith('/git/blobs/lead-manifest-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from(JSON.stringify({
            skills: [{ name: 'shared-skill', path: '../../skills/shared-skill' }],
          })).toString('base64'),
        } as T;
      }

      if (url.endsWith('/git/blobs/skill-sha')) {
        return {
          encoding: 'base64',
          content: Buffer.from([
            '---',
            'name: shared-skill',
            'description: Shared guidance',
            '---',
          ].join('\n')).toString('base64'),
        } as T;
      }

      throw new Error(`Unexpected URL: ${url}`);
    };

    const items = await discoverCompanyCatalogItems([
      { id: 'team-catalog', name: 'Team Catalog', repository: 'org/catalog', url: 'https://github.com/org/catalog/tree/main', ref: 'main' },
    ], 'team-catalog', fetchGitHubJson);

    expect(items.filter(item => item.path === 'skills/shared-skill/SKILL.md')).toEqual([
      expect.objectContaining({ collectionName: 'architect' }),
      expect.objectContaining({ collectionName: 'lead-engineer' }),
    ]);
  });
});