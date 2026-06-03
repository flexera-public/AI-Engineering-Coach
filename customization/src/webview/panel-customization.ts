import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { CatalogAreaPreferences } from '../core/types/catalog-types';
import type { CompanyCatalogItem } from '../core/types/company-catalog-types';
import { defaultCompanySkillPackages, normalizeCompanySkillPackages } from './company-skills-support';
import { getDefaultCatalogAreaPreferences, normalizeCatalogAreas, normalizeCatalogAreaPreferences } from './catalog-area-normalization';
import { discoverCompanyCatalogItems } from './company-catalog-service';

export interface CustomizationCatalogProvider {
  getCatalogAreas(): { areas: unknown[]; packages: string[] };
  discoverCatalogItems(params: Record<string, unknown>): Promise<unknown[] | undefined>;
}

interface CatalogAreaConfigFile {
  areas?: unknown;
  catalogAreas?: unknown;
  packages?: unknown;
  capabilityPackages?: unknown;
  companySkillPackages?: unknown;
  skillPackages?: unknown;
}

export interface CustomizationCatalogSettings {
  areaPreferences: CatalogAreaPreferences;
}

const CUSTOMIZATION_DIR = 'customization';
const SENSITIVE_DIR = 'sensitive';
const SETTINGS_FILE = 'settings.json';

function readJsonFile(filePath: string): unknown {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function readCatalogAreaEntries(filePath: string): unknown[] {
  const raw = readJsonFile(filePath);
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') {
    const record = raw as CatalogAreaConfigFile;
    if (Array.isArray(record.areas)) return record.areas;
    if (Array.isArray(record.catalogAreas)) return record.catalogAreas;
  }
  return [];
}

async function fetchCustomizationGitHubJson<T>(url: string, requestAuth: boolean): Promise<T> {
  let token: string | undefined;
  try {
    const session = await vscode.authentication.getSession('github', ['repo', 'read:org'], { createIfNone: requestAuth });
    token = session?.accessToken;
  } catch {
    token = undefined;
  }

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status})`);
  }

  return await response.json() as T;
}

export function loadCustomizationCatalogSettings(workspaceRoot?: string): CustomizationCatalogSettings {
  const defaults = getDefaultCatalogAreaPreferences();
  if (!workspaceRoot) {
    return {
      areaPreferences: defaults,
    };
  }

  const customizationRoot = path.join(workspaceRoot, CUSTOMIZATION_DIR);
  const defaultSettingsPath = path.join(customizationRoot, SETTINGS_FILE);
  const sensitiveSettingsPath = path.join(customizationRoot, SENSITIVE_DIR, SETTINGS_FILE);
  const settingsPath = fs.existsSync(sensitiveSettingsPath)
    ? sensitiveSettingsPath
    : defaultSettingsPath;
  const companyAreas = normalizeCatalogAreas(readCatalogAreaEntries(settingsPath));
  return {
    areaPreferences: normalizeCatalogAreaPreferences({
      areas: companyAreas,
      selectedAreaId: companyAreas[0]?.id || '',
    }, defaults),
  };
}

export function loadCustomizationCatalogAreaPreferences(workspaceRoot?: string): CatalogAreaPreferences {
  return loadCustomizationCatalogSettings(workspaceRoot).areaPreferences;
}

export async function discoverCustomizationCatalogItems(areaId: string, workspaceRoot?: string): Promise<CompanyCatalogItem[]> {
  const areas = loadCustomizationCatalogAreaPreferences(workspaceRoot).areas;
  return discoverCompanyCatalogItems(areas, areaId, fetchCustomizationGitHubJson);
}

export function createCustomizationCatalogProvider(
  getCustomizationRoot: () => string | undefined,
): CustomizationCatalogProvider {
  return {
    getCatalogAreas(): { areas: unknown[]; packages: string[] } {
      const settings = loadCustomizationCatalogSettings(getCustomizationRoot());
      const selectedArea = settings.areaPreferences.areas.find(area => area.id === settings.areaPreferences.selectedAreaId)
        ?? settings.areaPreferences.areas[0];
      return {
        areas: settings.areaPreferences.areas,
        packages: selectedArea?.packages ?? [...defaultCompanySkillPackages],
      };
    },
    async discoverCatalogItems(params: Record<string, unknown>): Promise<unknown[] | undefined> {
      if (params.includeCompany !== true) return undefined;
      const areaId = typeof params.areaId === 'string' ? params.areaId : '';
      return await discoverCustomizationCatalogItems(areaId, getCustomizationRoot());
    },
  };
}