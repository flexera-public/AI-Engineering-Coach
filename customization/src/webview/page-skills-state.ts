import type { DateFilter, WorkflowCluster, TriagedCluster, CatalogItem } from '../../../src/core/types';
import type { CatalogArea, CatalogAreaPreferences } from '../core/types/catalog-types';
import { html, render } from '../../../src/webview/render';
import { getSkillCache } from '../../../src/webview/skill-cache';
import { getCatalogAreaById, saveCatalogAreaPreferences } from './catalog-area-state';
import { skillPackages } from './page-skills-capabilities';

type WebviewStateApi = {
  getState(): unknown;
  setState(state: unknown): void;
};

type RenderCachedResults = (clusters: WorkflowCluster[], triaged: TriagedCluster[], catalogMatches: CatalogItem[]) => void;

export function getSkillsPageState(vscodeApi: WebviewStateApi, stateKey: string): { selectedCollection?: string } {
  const state = vscodeApi.getState() as Record<string, unknown> | null;
  const pageState = state?.[stateKey];
  return pageState && typeof pageState === 'object'
    ? pageState as { selectedCollection?: string }
    : {};
}

export function saveSkillsPageState(
  vscodeApi: WebviewStateApi,
  stateKey: string,
  next: { selectedCollection?: string },
): void {
  const state = (vscodeApi.getState() as Record<string, unknown>) ?? {};
  const current = getSkillsPageState(vscodeApi, stateKey);
  vscodeApi.setState({
    ...state,
    [stateKey]: {
      ...current,
      ...next,
    },
  });
}

export function getSavedCapabilityGroup(vscodeApi: WebviewStateApi, stateKey: string): string {
  const selectedCollection = getSkillsPageState(vscodeApi, stateKey).selectedCollection || '';
  return skillPackages.includes(selectedCollection) ? selectedCollection : '';
}

export function humanizeCollection(collection: string): string {
  return collection.replaceAll(/-/g, ' ').replace(/\b\w/g, match => match.toUpperCase());
}

export function getSelectedCapabilityGroup(doc: Document = document): string {
  return (doc.getElementById('skCollectionSelect') as HTMLSelectElement | null)?.value || '';
}

export function getSelectedCatalogAreaId(
  catalogAreaPrefs: CatalogAreaPreferences,
  doc: Document = document,
): string {
  return (doc.getElementById('skAreaSelect') as HTMLSelectElement | null)?.value
    || catalogAreaPrefs.selectedAreaId
    || '';
}

export function getSelectedCatalogArea(
  catalogAreaPrefs: CatalogAreaPreferences,
  doc: Document = document,
): CatalogArea | undefined {
  return getCatalogAreaById(getSelectedCatalogAreaId(catalogAreaPrefs, doc), catalogAreaPrefs);
}

export function getCatalogScopeKey(
  catalogAreaPrefs: CatalogAreaPreferences,
  doc: Document = document,
): string {
  return `${getSelectedCatalogAreaId(catalogAreaPrefs, doc) || '*'}|${getSelectedCapabilityGroup(doc) || '*'}`;
}

export function updateCatalogSourceLink(
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

export function resetCatalogResultsMessage(doc: Document = document): void {
  const catalogEl = doc.getElementById('catalogResults');
  if (!catalogEl) return;
  render(html`<p class="sk-empty">Run the analysis to get personalized catalog skill recommendations.</p>`, catalogEl);
}

export function refreshCachedResultsForSelection(
  activeFilter: DateFilter,
  catalogAreaPrefs: CatalogAreaPreferences,
  renderCachedResults: RenderCachedResults,
  doc: Document = document,
): void {
  const cached = getSkillCache(activeFilter);
  if (cached && cached.clusters.length > 0) {
    renderCachedResults(cached.clusters, cached.triaged, cached.catalogMatches);
    return;
  }
  resetCatalogResultsMessage(doc);
}

export async function handleAreaSelectionChange(
  catalogAreaPrefs: CatalogAreaPreferences,
  activeFilter: DateFilter,
  renderCachedResults: RenderCachedResults,
  defaultCatalogBase: string,
  defaultCatalogLabel: string,
  doc: Document = document,
): Promise<CatalogAreaPreferences> {
  const nextPrefs = await saveCatalogAreaPreferences({
    ...catalogAreaPrefs,
    selectedAreaId: getSelectedCatalogAreaId(catalogAreaPrefs, doc),
  });
  const areaSelect = doc.getElementById('skAreaSelect') as HTMLSelectElement | null;
  if (areaSelect) areaSelect.value = nextPrefs.selectedAreaId;
  updateCatalogSourceLink(nextPrefs, defaultCatalogBase, defaultCatalogLabel, doc);
  refreshCachedResultsForSelection(activeFilter, nextPrefs, renderCachedResults, doc);
  return nextPrefs;
}

export function handleCollectionSelectionChange(
  vscodeApi: WebviewStateApi,
  stateKey: string,
  activeFilter: DateFilter,
  catalogAreaPrefs: CatalogAreaPreferences,
  renderCachedResults: RenderCachedResults,
  doc: Document = document,
): void {
  saveSkillsPageState(vscodeApi, stateKey, { selectedCollection: getSelectedCapabilityGroup(doc) });
  refreshCachedResultsForSelection(activeFilter, catalogAreaPrefs, renderCachedResults, doc);
}