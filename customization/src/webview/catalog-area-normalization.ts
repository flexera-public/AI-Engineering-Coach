import type { CatalogArea, CatalogAreaPreferences, CatalogSource } from '../core/types/catalog-types';
import { defaultCompanySkillPackages, normalizeCompanySkillPackages } from './company-skills-support';

const DEFAULT_CATALOG_REF = 'main';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function slugifyCatalogAreaId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildCatalogAreaUrl(repository: string, ref: string): string {
  return `https://github.com/${repository}/tree/${ref}`;
}

function normalizeCatalogArea(value: unknown): CatalogArea | undefined {
  if (!isRecord(value) || typeof value.repository !== 'string') return undefined;

  const repository = value.repository.trim();
  if (!repository) return undefined;

  const ref = typeof value.ref === 'string' && value.ref.trim() ? value.ref.trim() : DEFAULT_CATALOG_REF;
  const idSource = typeof value.id === 'string' && value.id.trim() ? value.id : repository;
  const id = slugifyCatalogAreaId(idSource);
  if (!id) return undefined;

  const name = typeof value.name === 'string' && value.name.trim() ? value.name.trim() : id;
  const url = typeof value.url === 'string' && value.url.trim() ? value.url.trim() : buildCatalogAreaUrl(repository, ref);
  const packages = Array.isArray(value.packages)
    ? normalizeCompanySkillPackages(value.packages)
    : undefined;

  return { id, name, repository, url, ref, packages: packages && packages.length > 0 ? packages : [...defaultCompanySkillPackages] };
}

export function normalizeCatalogAreas(values: ReadonlyArray<unknown>): CatalogArea[] {
  const areas: CatalogArea[] = [];
  const indexes = new Map<string, number>();

  for (const value of values) {
    const area = normalizeCatalogArea(value);
    if (!area) continue;

    const existingIndex = indexes.get(area.id);
    if (existingIndex === undefined) {
      indexes.set(area.id, areas.length);
      areas.push(area);
      continue;
    }

    areas[existingIndex] = area;
  }

  return areas;
}

export function getDefaultCatalogAreaPreferences(
  areas: ReadonlyArray<CatalogSource | CatalogArea> = [],
): CatalogAreaPreferences {
  const normalizedAreas = normalizeCatalogAreas(areas);
  return {
    areas: normalizedAreas,
    selectedAreaId: normalizedAreas[0]?.id || '',
  };
}

export function normalizeCatalogAreaPreferences(
  prefs: CatalogAreaPreferences,
  defaults = getDefaultCatalogAreaPreferences(),
): CatalogAreaPreferences {
  const areas = prefs.areas.length > 0 ? normalizeCatalogAreas(prefs.areas) : defaults.areas;
  const selectedAreaId = areas.some(area => area.id === prefs.selectedAreaId)
    ? prefs.selectedAreaId
    : areas[0]?.id || '';

  return {
    areas,
    selectedAreaId,
  };
}