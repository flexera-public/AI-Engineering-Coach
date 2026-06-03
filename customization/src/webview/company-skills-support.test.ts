/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';

import { defaultCompanySkillPackages, filterCompanyCapabilityItems, getCompanyCatalogScopeKey, getSavedCompanyCapabilityGroup, humanizeCompanyCollection, matchesCompanyCapabilityGroup, normalizeCompanySkillPackages, updateCompanyCatalogSourceLink } from './company-skills-support';

describe('company-skills-support', () => {
  it('keeps default company capability packages stable', () => {
    expect(defaultCompanySkillPackages).toEqual([
      'software-engineer',
      'lead-engineer',
      'architect',
      'devops-engineer',
      'automation-qa-engineer',
    ]);
  });

  it('normalizes configured capability packages and falls back to defaults when empty', () => {
    expect(normalizeCompanySkillPackages([' Software Engineer ', 'architect', 'software_engineer'])).toEqual([
      'software-engineer',
      'architect',
    ]);
    expect(normalizeCompanySkillPackages([])).toEqual(defaultCompanySkillPackages);
  });

  it('matches company capability group by collection name', () => {
    expect(matchesCompanyCapabilityGroup({
      kind: 'skill',
      id: 'skill-1',
      title: 'Sample Skill',
      description: 'Sample description',
      category: '',
      path: 'skills/sample/SKILL.md',
      url: 'https://example.test/skills/sample',
      relevanceScore: 0,
      matchReasons: [],
      collectionName: 'architect',
    }, 'architect')).toBe(true);
  });

  it('returns all skills from packages when All is selected', () => {
    const items = filterCompanyCapabilityItems([
      {
        kind: 'skill',
        id: 'skill-1',
        title: 'Backend Skill',
        description: 'Skill',
        category: 'skill',
        path: 'packages/software-engineer/skills/backend-skill/SKILL.md',
        url: 'https://example.test/skills/backend-skill',
        relevanceScore: 0,
        matchReasons: [],
        collectionName: 'software-engineer',
      },
      {
        kind: 'agent',
        id: 'agent-1',
        title: 'Nexus',
        description: 'Agent',
        category: 'agent',
        path: '.github/agents/nexus.agent.md',
        url: 'https://example.test/agents/nexus',
        relevanceScore: 0,
        matchReasons: [],
      },
    ], '', ['software-engineer', 'architect']);

    expect(items).toEqual([
      expect.objectContaining({ collectionName: 'software-engineer', kind: 'skill' }),
    ]);
  });

  it('maps selected capabilities to package skills only', () => {
    const items = filterCompanyCapabilityItems([
      {
        kind: 'skill',
        id: 'skill-1',
        title: 'Backend Skill',
        description: 'Skill',
        category: 'skill',
        path: 'packages/software-engineer/skills/backend-skill/SKILL.md',
        url: 'https://example.test/skills/backend-skill',
        relevanceScore: 0,
        matchReasons: [],
        collectionName: 'software-engineer',
      },
      {
        kind: 'skill',
        id: 'skill-2',
        title: 'Architecture Skill',
        description: 'Skill',
        category: 'skill',
        path: 'packages/architect/skills/architecture-skill/SKILL.md',
        url: 'https://example.test/skills/architecture-skill',
        relevanceScore: 0,
        matchReasons: [],
        collectionName: 'architect',
      },
    ], 'architect', ['software-engineer', 'architect']);

    expect(items).toEqual([
      expect.objectContaining({ collectionName: 'architect', kind: 'skill' }),
    ]);
  });

  it('deduplicates multi-package skills when All is selected', () => {
    const items = filterCompanyCapabilityItems([
      {
        kind: 'skill', id: 'skill-1', title: 'Shared Skill', description: 'Skill', category: 'skill',
        path: 'skills/shared-skill/SKILL.md', url: 'https://example.test/skills/shared-skill', relevanceScore: 0, matchReasons: [], collectionName: 'architect',
      },
      {
        kind: 'skill', id: 'skill-2', title: 'Shared Skill', description: 'Skill', category: 'skill',
        path: 'skills/shared-skill/SKILL.md', url: 'https://example.test/skills/shared-skill', relevanceScore: 0, matchReasons: [], collectionName: 'lead-engineer',
      },
    ], '', ['architect', 'lead-engineer']);

    expect(items).toHaveLength(1);
    expect(items[0]?.path).toBe('skills/shared-skill/SKILL.md');
  });

  it('uses configured catalog count when no specific area is selected', () => {
    const doc = document.implementation.createHTMLDocument('company');
    const link = doc.createElement('a');
    link.id = 'skCatalogSourceLink';
    doc.body.appendChild(link);

    updateCompanyCatalogSourceLink({
      selectedAreaId: '',
      areas: [
        { id: 'a', name: 'A', repository: 'org/a', url: 'https://github.com/org/a/tree/main', ref: 'main' },
        { id: 'b', name: 'B', repository: 'org/b', url: 'https://github.com/org/b/tree/main', ref: 'main' },
      ],
    }, 'https://github.com', 'configured company catalogs', doc);

    expect(link.textContent).toBe('2 configured catalogs');
  });

  it('uses the provided default label when no company catalogs are configured', () => {
    const doc = document.implementation.createHTMLDocument('company');
    const link = doc.createElement('a');
    link.id = 'skCatalogSourceLink';
    doc.body.appendChild(link);

    updateCompanyCatalogSourceLink({
      selectedAreaId: '',
      areas: [],
    }, '', 'no configured company catalogs', doc);

    expect(link.textContent).toBe('no configured company catalogs');
    expect(link.getAttribute('href')).toBe('');
  });

  it('builds company scope from selected area and collection', () => {
    const doc = document.implementation.createHTMLDocument('company');
    const areaSelect = doc.createElement('select');
    areaSelect.id = 'skAreaSelect';
    areaSelect.innerHTML = '<option value="area-1" selected>Area 1</option>';
    doc.body.appendChild(areaSelect);
    const collectionSelect = doc.createElement('select');
    collectionSelect.id = 'skCollectionSelect';
    collectionSelect.innerHTML = '<option value="architect" selected>Architect</option>';
    doc.body.appendChild(collectionSelect);

    expect(getCompanyCatalogScopeKey({ selectedAreaId: '', areas: [] }, doc)).toBe('area-1|architect');
    expect(humanizeCompanyCollection('devops-engineer')).toBe('Devops Engineer');
  });

  it('clears saved capability selection when it is not configured', () => {
    const vscodeApi = {
      getState: () => ({ page: { selectedCollection: 'architect' } }),
      setState: () => undefined,
    };

    expect(getSavedCompanyCapabilityGroup(vscodeApi, 'page', ['software-engineer'])).toBe('');
    expect(getSavedCompanyCapabilityGroup(vscodeApi, 'page', ['architect'])).toBe('architect');
  });
});