import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { discoverCompanyCatalogItemsMock, getSessionMock } = vi.hoisted(() => ({
  discoverCompanyCatalogItemsMock: vi.fn(),
  getSessionMock: vi.fn(),
}));

vi.mock('vscode', () => ({
  authentication: {
    getSession: getSessionMock,
  },
}));

vi.mock('./company-catalog-service', () => ({
  discoverCompanyCatalogItems: discoverCompanyCatalogItemsMock,
}));

import { discoverCustomizationCatalogItems, loadCustomizationCatalogAreaPreferences } from './panel-customization';

const tempDirs: string[] = [];

function makeTempWorkspace(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aec-customization-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'customization'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'customization', 'sensitive'), { recursive: true });
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('panel-customization', () => {
  beforeEach(() => {
    discoverCompanyCatalogItemsMock.mockReset();
    getSessionMock.mockReset();
  });

  it('loads company catalog areas from customization/settings.json when no sensitive override exists', () => {
    const workspace = makeTempWorkspace();
    fs.writeFileSync(path.join(workspace, 'customization', 'settings.json'), JSON.stringify({
      areas: [
        { id: 'default-area', name: 'Default Area', repository: 'org/default', ref: 'main' },
      ],
    }));

    const prefs = loadCustomizationCatalogAreaPreferences(workspace);

    expect(prefs.areas).toHaveLength(1);
    expect(prefs.areas[0]?.repository).toBe('org/default');
    expect(prefs.selectedAreaId).toBe('default-area');
  });

  it('uses customization/sensitive/settings.json when it exists', () => {
    const workspace = makeTempWorkspace();
    fs.writeFileSync(path.join(workspace, 'customization', 'settings.json'), JSON.stringify({
      areas: [
        { id: 'default-area', name: 'Default Area', repository: 'org/default', ref: 'main' },
      ],
    }));
    fs.writeFileSync(path.join(workspace, 'customization', 'sensitive', 'settings.json'), JSON.stringify({
      areas: [
        { id: 'sensitive-area', name: 'Sensitive Area', repository: 'org/sensitive', ref: 'main' },
      ],
    }));

    const prefs = loadCustomizationCatalogAreaPreferences(workspace);

    expect(prefs.areas.map(area => area.id)).toEqual(['sensitive-area']);
    expect(prefs.selectedAreaId).toBe('sensitive-area');
  });

  it('supports legacy catalogAreas in customization/sensitive/settings.json', () => {
    const workspace = makeTempWorkspace();
    fs.writeFileSync(path.join(workspace, 'customization', 'sensitive', 'settings.json'), JSON.stringify({
      catalogAreas: [
        { id: 'legacy-sensitive-area', name: 'Legacy Sensitive Area', repository: 'org/legacy-sensitive', ref: 'main' },
      ],
    }));

    const prefs = loadCustomizationCatalogAreaPreferences(workspace);

    expect(prefs.areas.map(area => area.id)).toEqual(['legacy-sensitive-area']);
    expect(prefs.selectedAreaId).toBe('legacy-sensitive-area');
  });

  it('delegates company discovery using catalog areas from customization settings', async () => {
    const workspace = makeTempWorkspace();
    fs.writeFileSync(path.join(workspace, 'customization', 'sensitive', 'settings.json'), JSON.stringify({
      areas: [
        { id: 'sensitive-area', name: 'Sensitive Area', repository: 'org/sensitive', ref: 'main' },
      ],
    }));
    discoverCompanyCatalogItemsMock.mockResolvedValue([]);

    await discoverCustomizationCatalogItems('sensitive-area', workspace);

    expect(discoverCompanyCatalogItemsMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'sensitive-area', repository: 'org/sensitive' })],
      'sensitive-area',
      expect.any(Function),
    );
  });
});