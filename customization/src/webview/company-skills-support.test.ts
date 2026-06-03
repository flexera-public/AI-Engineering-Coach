/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';

import { companySkillPackages, filterCompanyCapabilityItems, getCompanyCatalogScopeKey, humanizeCompanyCollection, matchesCompanyCapabilityGroup, updateCompanyCatalogSourceLink } from './company-skills-support';

describe('company-skills-support', () => {
  it('keeps company capability packages stable', () => {
    expect(companySkillPackages).toEqual([
      'software-engineer',
      'lead-engineer',
      'architect',
      'devops-engineer',
      'automation-qa-engineer',
    ]);
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
        title: 'CQRS',
        description: 'Skill',
        category: 'skill',
        path: 'packages/software-engineer/skills/dotnet-cqrs-backend/SKILL.md',
        url: 'https://example.test/skills/cqrs',
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
    ], '');

    expect(items).toEqual([
      expect.objectContaining({ collectionName: 'software-engineer', kind: 'skill' }),
    ]);
  });

  it('maps selected capabilities to package skills only', () => {
    const items = filterCompanyCapabilityItems([
      {
        kind: 'skill',
        id: 'skill-1',
        title: 'CQRS',
        description: 'Skill',
        category: 'skill',
        path: 'packages/software-engineer/skills/dotnet-cqrs-backend/SKILL.md',
        url: 'https://example.test/skills/cqrs',
        relevanceScore: 0,
        matchReasons: [],
        collectionName: 'software-engineer',
      },
      {
        kind: 'skill',
        id: 'skill-2',
        title: 'ADR',
        description: 'Skill',
        category: 'skill',
        path: 'packages/architect/skills/docs-adr-writing/SKILL.md',
        url: 'https://example.test/skills/adr',
        relevanceScore: 0,
        matchReasons: [],
        collectionName: 'architect',
      },
    ], 'architect');

    expect(items).toEqual([
      expect.objectContaining({ collectionName: 'architect', kind: 'skill' }),
    ]);
  });

  it('deduplicates multi-package skills when All is selected', () => {
    const items = filterCompanyCapabilityItems([
      {
        kind: 'skill', id: 'skill-1', title: 'Trace', description: 'Skill', category: 'skill',
        path: 'skills/docs-trace-to-schematic/SKILL.md', url: 'https://example.test/skills/trace', relevanceScore: 0, matchReasons: [], collectionName: 'architect',
      },
      {
        kind: 'skill', id: 'skill-2', title: 'Trace', description: 'Skill', category: 'skill',
        path: 'skills/docs-trace-to-schematic/SKILL.md', url: 'https://example.test/skills/trace', relevanceScore: 0, matchReasons: [], collectionName: 'lead-engineer',
      },
    ], '');

    expect(items).toHaveLength(1);
    expect(items[0]?.path).toBe('skills/docs-trace-to-schematic/SKILL.md');
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
});