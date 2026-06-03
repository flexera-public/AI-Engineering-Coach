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

import { createCustomizationCatalogProvider, discoverCustomizationCatalogItems, loadCustomizationCatalogAreaPreferences, loadCustomizationCatalogSettings } from './panel-customization';

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
        { id: 'local-area', name: 'Local Area', repository: 'org/local', ref: 'main' },
      ],
    }));

    const prefs = loadCustomizationCatalogAreaPreferences(workspace);

    expect(prefs.areas.map(area => area.id)).toEqual(['local-area']);
    expect(prefs.selectedAreaId).toBe('local-area');
  });

  it('loads packages from the configured area', () => {
    const workspace = makeTempWorkspace();
    fs.writeFileSync(path.join(workspace, 'customization', 'sensitive', 'settings.json'), JSON.stringify({
      areas: [
        { id: 'local-area', name: 'Local Area', repository: 'org/local', ref: 'main', packages: ['software-engineer', 'architect', 'devops_engineer'] },
      ],
    }));

    const settings = loadCustomizationCatalogSettings(workspace);

    expect(settings.areaPreferences.areas[0]?.packages).toEqual(['software-engineer', 'architect', 'devops-engineer']);
  });

  it('supports legacy catalogAreas in customization/sensitive/settings.json', () => {
    const workspace = makeTempWorkspace();
    fs.writeFileSync(path.join(workspace, 'customization', 'sensitive', 'settings.json'), JSON.stringify({
      catalogAreas: [
        { id: 'legacy-local-area', name: 'Legacy Local Area', repository: 'org/legacy-local', ref: 'main' },
      ],
    }));

    const prefs = loadCustomizationCatalogAreaPreferences(workspace);

    expect(prefs.areas.map(area => area.id)).toEqual(['legacy-local-area']);
    expect(prefs.selectedAreaId).toBe('legacy-local-area');
  });

  it('delegates company discovery using catalog areas from customization settings', async () => {
    const workspace = makeTempWorkspace();
    fs.writeFileSync(path.join(workspace, 'customization', 'sensitive', 'settings.json'), JSON.stringify({
      areas: [
        { id: 'local-area', name: 'Local Area', repository: 'org/local', ref: 'main' },
      ],
    }));
    discoverCompanyCatalogItemsMock.mockResolvedValue([]);

    await discoverCustomizationCatalogItems('local-area', workspace);

    expect(discoverCompanyCatalogItemsMock).toHaveBeenCalledWith(
      [expect.objectContaining({ id: 'local-area', repository: 'org/local' })],
      'local-area',
      expect.any(Function),
    );
  });

  it('returns the selected area packages from the customization provider', () => {
    const workspace = makeTempWorkspace();
    fs.writeFileSync(path.join(workspace, 'customization', 'sensitive', 'settings.json'), JSON.stringify({
      areas: [
        { id: 'local-area', name: 'Local Area', repository: 'org/local', ref: 'main', packages: ['architect'] },
        { id: 'other-area', name: 'Other Area', repository: 'org/other', ref: 'main', packages: ['software-engineer'] },
      ],
    }));

    const provider = createCustomizationCatalogProvider(() => workspace);

    expect(provider.getCatalogAreas()).toEqual({
      areas: [
        expect.objectContaining({ id: 'local-area', repository: 'org/local', packages: ['architect'] }),
        expect.objectContaining({ id: 'other-area', repository: 'org/other', packages: ['software-engineer'] }),
      ],
      packages: ['architect'],
    });
  });
});