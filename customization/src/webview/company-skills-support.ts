import type { CatalogArea, CatalogAreaPreferences } from '../core/types/catalog-types';
import type { CompanyCatalogItem } from '../core/types/company-catalog-types';
import { getCatalogAreaById, saveCatalogAreaPreferences } from './catalog-area-state';

type WebviewStateApi = {
  getState(): unknown;
  setState(state: unknown): void;
};

export const defaultCompanySkillPackages = ['software-engineer', 'lead-engineer', 'architect', 'devops-engineer', 'automation-qa-engineer'];

const COMPANY_CAPABILITY_GROUP_ALLOWLIST: Record<string, { collections: string[]; categories: string[] }> = {
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
};

function normalizeCapabilityValue(value: string | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replaceAll(/[-_]+/g, ' ')
    .replaceAll(/\s+/g, ' ');
}

export function normalizeCompanySkillPackages(value: unknown): string[] {
  if (!Array.isArray(value)) return [...defaultCompanySkillPackages];

  const normalized = Array.from(new Set(value
    .filter((entry): entry is string => typeof entry === 'string')
    .map(entry => normalizeCapabilityValue(entry).replaceAll(' ', '-'))
    .filter(Boolean)));

  return normalized.length > 0 ? normalized : [...defaultCompanySkillPackages];
}

function getCapabilityTokens(capabilityGroup: string): { collections: Set<string>; categories: Set<string> } | null {
  const normalizedGroup = normalizeCapabilityValue(capabilityGroup);
  if (!normalizedGroup) return null;

  const rule = COMPANY_CAPABILITY_GROUP_ALLOWLIST[capabilityGroup]
    || COMPANY_CAPABILITY_GROUP_ALLOWLIST[normalizedGroup.replaceAll(' ', '-')];
  if (!rule) return null;

  return {
    collections: new Set(rule.collections.map(collection => normalizeCapabilityValue(collection))),
    categories: new Set(rule.categories.map(category => normalizeCapabilityValue(category))),
  };
}

function isCompanyPackageSkill(item: CompanyCatalogItem, packages: string[]): boolean {
  const packageSet = new Set(packages.map(entry => normalizeCapabilityValue(entry).replaceAll(' ', '-')));
  return item.kind === 'skill' && packageSet.has(normalizeCapabilityValue(item.collectionName).replaceAll(' ', '-'));
}

function getPageState(vscodeApi: WebviewStateApi, stateKey: string): { selectedCollection?: string } {
  const state = vscodeApi.getState() as Record<string, unknown> | null;
  const pageState = state?.[stateKey];
  return pageState && typeof pageState === 'object'
    ? pageState as { selectedCollection?: string }
    : {};
}

function savePageState(vscodeApi: WebviewStateApi, stateKey: string, next: { selectedCollection?: string }): void {
  const state = (vscodeApi.getState() as Record<string, unknown>) ?? {};
  const current = getPageState(vscodeApi, stateKey);
  vscodeApi.setState({
    ...state,
    [stateKey]: {
      ...current,
      ...next,
    },
  });
}

export function getSavedCompanyCapabilityGroup(
  vscodeApi: WebviewStateApi,
  stateKey: string,
  packages: string[] = defaultCompanySkillPackages,
): string {
  const selectedCollection = getPageState(vscodeApi, stateKey).selectedCollection || '';
  return packages.includes(selectedCollection) ? selectedCollection : '';
}

export function humanizeCompanyCollection(collection: string): string {
  return collection.replaceAll(/-/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
}

export function getSelectedCompanyCapabilityGroup(doc: Document = document): string {
  return (doc.getElementById('skCollectionSelect') as HTMLSelectElement | null)?.value || '';
}

export function getSelectedCompanyCatalogAreaId(catalogAreaPrefs: CatalogAreaPreferences, doc: Document = document): string {
  return (doc.getElementById('skAreaSelect') as HTMLSelectElement | null)?.value
    || catalogAreaPrefs.selectedAreaId
    || '';
}

export function getCompanyCatalogScopeKey(catalogAreaPrefs: CatalogAreaPreferences, doc: Document = document): string {
  return `${getSelectedCompanyCatalogAreaId(catalogAreaPrefs, doc) || '*'}|${getSelectedCompanyCapabilityGroup(doc) || '*'}`;
}

function getSelectedCatalogArea(catalogAreaPrefs: CatalogAreaPreferences, doc: Document = document): CatalogArea | undefined {
  return getCatalogAreaById(getSelectedCompanyCatalogAreaId(catalogAreaPrefs, doc), catalogAreaPrefs);
}

export function updateCompanyCatalogSourceLink(
  catalogAreaPrefs: CatalogAreaPreferences,
  defaultCatalogBase: string,
  defaultCatalogLabel: string,
  doc: Document = document,
): void {
  const linkEl = doc.getElementById('skCatalogSourceLink') as HTMLAnchorElement | null;
  if (!linkEl) return;
  const selectedArea = getSelectedCatalogArea(catalogAreaPrefs, doc);
  if (selectedArea) {
    linkEl.href = selectedArea.url;
    linkEl.textContent = selectedArea.repository;
    return;
  }

  if (catalogAreaPrefs.areas.length === 1) {
    linkEl.href = catalogAreaPrefs.areas[0].url;
    linkEl.textContent = catalogAreaPrefs.areas[0].repository;
    return;
  }

  if (catalogAreaPrefs.areas.length > 1) {
    linkEl.href = catalogAreaPrefs.areas[0].url;
    linkEl.textContent = `${catalogAreaPrefs.areas.length} configured catalogs`;
    return;
  }

  linkEl.href = defaultCatalogBase;
  linkEl.textContent = defaultCatalogLabel;
}

export function matchesCompanyCapabilityGroup(item: CompanyCatalogItem, capabilityGroup: string): boolean {
  if (!capabilityGroup) return true;

  const normalizedGroup = normalizeCapabilityValue(capabilityGroup);
  const collectionName = normalizeCapabilityValue(item.collectionName);
  if (collectionName === normalizedGroup) return true;

  const tokens = getCapabilityTokens(capabilityGroup);
  if (!tokens) return false;

  const category = normalizeCapabilityValue(item.category);
  return tokens.collections.has(collectionName) || tokens.categories.has(category);
}

export function filterCompanyCapabilityItems(
  items: CompanyCatalogItem[],
  capabilityGroup: string,
  packages: string[] = defaultCompanySkillPackages,
): CompanyCatalogItem[] {
  const packageSkills = items.filter(item => isCompanyPackageSkill(item, packages));
  if (!capabilityGroup) {
    const deduped = new Map<string, CompanyCatalogItem>();
    for (const item of packageSkills) {
      if (!deduped.has(item.path)) deduped.set(item.path, item);
    }
    return Array.from(deduped.values());
  }
  return packageSkills.filter(item => matchesCompanyCapabilityGroup(item, capabilityGroup));
}

export async function handleCompanyAreaSelectionChange(
  catalogAreaPrefs: CatalogAreaPreferences,
  onSelectionChanged: () => void,
  defaultCatalogBase: string,
  defaultCatalogLabel: string,
  doc: Document = document,
): Promise<CatalogAreaPreferences> {
  const nextPrefs = await saveCatalogAreaPreferences({
    ...catalogAreaPrefs,
    selectedAreaId: getSelectedCompanyCatalogAreaId(catalogAreaPrefs, doc),
  });
  const areaSelect = doc.getElementById('skAreaSelect') as HTMLSelectElement | null;
  if (areaSelect) areaSelect.value = nextPrefs.selectedAreaId;
  updateCompanyCatalogSourceLink(nextPrefs, defaultCatalogBase, defaultCatalogLabel, doc);
  onSelectionChanged();
  return nextPrefs;
}

export function handleCompanyCollectionSelectionChange(
  vscodeApi: WebviewStateApi,
  stateKey: string,
  onSelectionChanged: () => void,
  doc: Document = document,
): void {
  savePageState(vscodeApi, stateKey, { selectedCollection: getSelectedCompanyCapabilityGroup(doc) });
  onSelectionChanged();
}