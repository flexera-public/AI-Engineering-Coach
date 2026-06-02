import type { CatalogArea, CatalogAreaPreferences } from '../core/types/catalog-types';
import { getDefaultCatalogAreaPreferences, normalizeCatalogAreaPreferences } from './catalog-area-normalization';

let cachedPrefs: CatalogAreaPreferences = {
  ...getDefaultCatalogAreaPreferences(),
  selectedAreaId: '',
};

function setCachedPrefs(prefs: CatalogAreaPreferences, defaults = cachedPrefs): CatalogAreaPreferences {
  const normalized = normalizeCatalogAreaPreferences(prefs, defaults);
  cachedPrefs = prefs.selectedAreaId === ''
    ? { ...normalized, selectedAreaId: '' }
    : normalized;
  return cachedPrefs;
}

export function getCatalogAreaPreferences(): CatalogAreaPreferences {
  return cachedPrefs;
}

export function loadCatalogAreaPreferences(areas: ReadonlyArray<CatalogArea> = cachedPrefs.areas): Promise<CatalogAreaPreferences> {
  const defaults = getDefaultCatalogAreaPreferences(areas);
  return Promise.resolve(setCachedPrefs({
    areas: defaults.areas,
    selectedAreaId: cachedPrefs.selectedAreaId,
  }, defaults));
}

export function saveCatalogAreaPreferences(prefs: CatalogAreaPreferences): Promise<CatalogAreaPreferences> {
  const defaults = prefs.areas.length > 0
    ? getDefaultCatalogAreaPreferences(prefs.areas)
    : cachedPrefs;
  return Promise.resolve(setCachedPrefs(prefs, defaults));
}

export function getCatalogAreaById(areaId: string, prefs = getCatalogAreaPreferences()): CatalogArea | undefined {
  if (!areaId) return undefined;
  return prefs.areas.find(area => area.id === areaId) || prefs.areas[0];
}