import { describe, expect, it } from 'vitest';

import type { CompanyCatalogItem } from '../core/types/company-catalog-types';
import { CAPABILITY_GROUP_ALLOWLIST, matchesCapabilityGroup, skillPackages } from './page-skills-capabilities';

function createCatalogItem(overrides: Partial<CompanyCatalogItem> = {}): CompanyCatalogItem {
  return {
    kind: 'skill',
    id: 'skill-1',
    title: 'Sample Skill',
    description: 'Sample description',
    category: '',
    path: 'skills/sample/SKILL.md',
    url: 'https://example.test/skills/sample',
    relevanceScore: 0,
    matchReasons: [],
    ...overrides,
  };
}

describe('page-skills capability matching', () => {
  it('keeps the predefined capability groups stable', () => {
    expect(skillPackages).toEqual([
      'software-engineer',
      'lead-engineer',
      'architect',
      'devops-engineer',
      'automation-qa-engineer',
    ]);
  });

  it('keeps the capability allowlist stable', () => {
    expect(CAPABILITY_GROUP_ALLOWLIST).toEqual({
      'software-engineer': {
        collections: ['software-engineer'],
        categories: ['Software Engineer'],
      },
      'lead-engineer': {
        collections: ['lead-engineer'],
        categories: ['Lead Engineer'],
      },
      architect: {
        collections: ['architect'],
        categories: ['Architect'],
      },
      'devops-engineer': {
        collections: ['devops-engineer'],
        categories: ['Devops Engineer'],
      },
      'automation-qa-engineer': {
        collections: ['automation-qa-engineer'],
        categories: ['Automation Qa Engineer'],
      },
    });
  });

  it('matches the selected capability group by exact collection name', () => {
    const item = createCatalogItem({ collectionName: 'devops-engineer' });

    expect(matchesCapabilityGroup(item, 'devops-engineer')).toBe(true);
    expect(matchesCapabilityGroup(item, 'software-engineer')).toBe(false);
  });

  it('matches the selected capability group by normalized category label', () => {
    const item = createCatalogItem({ category: 'Automation Qa Engineer' });

    expect(matchesCapabilityGroup(item, 'automation-qa-engineer')).toBe(true);
  });

  it('does not match only because the description mentions a capability group', () => {
    const item = createCatalogItem({
      collectionName: 'architect',
      description: 'Useful for software engineer onboarding workflows.',
    });

    expect(matchesCapabilityGroup(item, 'software-engineer')).toBe(false);
  });

  it('treats the empty selection as all skills', () => {
    const item = createCatalogItem({ collectionName: 'architect' });

    expect(matchesCapabilityGroup(item, '')).toBe(true);
  });

  it('rejects unknown capability groups instead of matching broadly', () => {
    const item = createCatalogItem({ collectionName: 'architect' });

    expect(matchesCapabilityGroup(item, 'platform-engineer')).toBe(false);
  });
});