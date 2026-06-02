/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';

import { companySkillPackages, getCompanyCatalogScopeKey, humanizeCompanyCollection, matchesCompanyCapabilityGroup, updateCompanyCatalogSourceLink } from './company-skills-support';

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