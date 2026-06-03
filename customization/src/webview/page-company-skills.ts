import type { DateFilter, WorkflowCluster, WorkflowOptimizationData, TriagedCluster, CatalogItem, CatalogTriageResult, SkillTriageResult } from '../../../src/core/types';
import type { CompanyCatalogDiscoverResult, CompanyCatalogItem } from '../core/types/company-catalog-types';
import { rpc, COLORS, vscode } from '../../../src/webview/shared';
import { html, render } from '../../../src/webview/render';
import { consumeNavHint, updateNavBadge } from '../../../src/webview/app';
import { getCatalogAreaPreferences, loadCatalogAreaPreferences } from './catalog-area-state';
import type { CatalogArea } from '../core/types/catalog-types';
import {
  defaultCompanySkillPackages,
  filterCompanyCapabilityItems,
  getCompanyCatalogScopeKey as getSelectedCompanyCatalogScopeKey,
  getSavedCompanyCapabilityGroup,
  getSelectedCompanyCapabilityGroup,
  getSelectedCompanyCatalogAreaId,
  handleCompanyAreaSelectionChange,
  handleCompanyCollectionSelectionChange,
  humanizeCompanyCollection,
  matchesCompanyCapabilityGroup,
  updateCompanyCatalogSourceLink,
} from './company-skills-support';

const DEFAULT_CATALOG_BASE = '';
const DEFAULT_CATALOG_LABEL = 'no configured company catalogs';
const COMPANY_SKILLS_PAGE_STATE_KEY = 'companySkillsPageState';
const COMPANY_CACHE_SCOPE_PREFIX = 'company';
const COMPANY_CACHE_MAX_AGE = 10 * 60_000;
const SKILL_FINDER_BADGE_IDS = ['badge-skills', 'badge-company-skills'];

type CompanySkillCacheData = {
  clusters: WorkflowCluster[];
  triaged: TriagedCluster[];
  catalogMatches: CompanyCatalogItem[];
  timestamp: number;
};

let lastTriaged: TriagedCluster[] = [];
let lastClusters: WorkflowCluster[] = [];
let lastResultsEl: HTMLElement | null = null;
const dismissed = new Set<string>();

let activeFilter: DateFilter = {};
let catalogAreaPrefs = getCatalogAreaPreferences();
let companyPackages = [...defaultCompanySkillPackages];
const companySkillCache = new Map<string, CompanySkillCacheData>();

function getPackagesForArea(areaId: string, areas: readonly (CatalogArea & { packages?: string[] })[]): string[] {
  const selectedArea = areas.find(area => area.id === areaId) ?? areas[0];
  return selectedArea?.packages && selectedArea.packages.length > 0
    ? [...selectedArea.packages]
    : [...defaultCompanySkillPackages];
}

function updateCompanyPackageSelect(selectedCollection = ''): void {
  const collectionSelect = document.getElementById('skCollectionSelect') as HTMLSelectElement | null;
  if (!collectionSelect) return;

  const nextSelected = companyPackages.includes(selectedCollection) ? selectedCollection : '';
  collectionSelect.innerHTML = [
    '<option value="">All</option>',
    ...companyPackages.map(collection => `<option value="${collection}"${collection === nextSelected ? ' selected' : ''}>${humanizeCompanyCollection(collection)}</option>`),
  ].join('');
}

function normalizeCompanyCatalogAreaPrefs(): void {
  if (catalogAreaPrefs.areas.length === 0) return;
  if (catalogAreaPrefs.areas.some(area => area.id === catalogAreaPrefs.selectedAreaId)) return;
  catalogAreaPrefs = {
    ...catalogAreaPrefs,
    selectedAreaId: catalogAreaPrefs.areas[0]?.id || '',
  };
}

function getCompanyCatalogScopeKey(): string {
  return `${COMPANY_CACHE_SCOPE_PREFIX}|${getSelectedCompanyCatalogScopeKey(catalogAreaPrefs)}`;
}

function getCompanyCacheKey(filter: DateFilter): string {
  return `${filter.workspaceId || '*'}|${filter.harness || '*'}|${getCompanyCatalogScopeKey()}`;
}

function getCompanySkillCache(filter: DateFilter): CompanySkillCacheData | null {
  const entry = companySkillCache.get(getCompanyCacheKey(filter));
  if (!entry) return null;
  if (Date.now() - entry.timestamp > COMPANY_CACHE_MAX_AGE) {
    companySkillCache.delete(getCompanyCacheKey(filter));
    return null;
  }
  return entry;
}

function setCompanySkillCache(data: CompanySkillCacheData, filter: DateFilter): void {
  companySkillCache.set(getCompanyCacheKey(filter), data);
}

function hasConfiguredCompanyCatalogAreas(): boolean {
  return catalogAreaPrefs.areas.length > 0;
}

function getCompanyCatalogEmptyStateMessage(): string {
  return hasConfiguredCompanyCatalogAreas()
    ? 'Run the analysis to get personalized company catalog recommendations.'
    : 'No company catalogs are configured. Add areas or catalogAreas to customization/sensitive/settings.json.';
}

function getCompanyCatalogStatusMessage(clusters: WorkflowCluster[], catalogMatches: CatalogItem[]): string {
  if (catalogMatches.length === 0) {
    return `Found ${clusters.length} patterns.`;
  }

  return `Found ${clusters.length} patterns and ${catalogMatches.length} company catalog ${catalogMatches.length === 1 ? 'match' : 'matches'}.`;
}

function updateSkillFinderBadge(value: number): void {
  for (const badgeId of SKILL_FINDER_BADGE_IDS) {
    updateNavBadge(badgeId, value);
  }
}

export async function renderCompanySkills(container: HTMLElement, currentFilter: DateFilter): Promise<void> {
  activeFilter = currentFilter;
  const [workspaces, catalogAreasResult] = await Promise.all([
    rpc<{ id: string; name: string }[]>('getWorkspaces'),
    rpc<{ areas: (CatalogArea & { packages?: string[] })[]; packages?: string[] }>('getCatalogAreas'),
  ]);
  catalogAreaPrefs = await loadCatalogAreaPreferences(catalogAreasResult.areas);
  normalizeCompanyCatalogAreaPrefs();
  companyPackages = getPackagesForArea(catalogAreaPrefs.selectedAreaId, catalogAreaPrefs.areas);
  const selectedCollection = getSavedCompanyCapabilityGroup(vscode, COMPANY_SKILLS_PAGE_STATE_KEY, companyPackages);

  const filterWsId = currentFilter.workspaceId
    ? (workspaces.find(w => w.id === currentFilter.workspaceId)?.id || '')
    : '';

  render(html`
    <div class="sk-header">
      <h1>Flexera Skill Finder</h1>
      <p class="sk-subtitle">Analyze your repeated prompts to discover custom skill opportunities and matching company catalog skills.</p>
    </div>

    <div class="sk-toolbar">
      <div class="sk-toolbar-row">
        <label class="sk-lookback">
          <span>Workspace</span>
          <select id="skWorkspaceSelect" class="sk-select">
            <option value="">All workspaces</option>
            ${workspaces.map(ws => html`<option value="${ws.id}" selected="${ws.id === filterWsId || undefined}">${ws.name}</option>`)}
          </select>
        </label>
      </div>
      <div class="sk-toolbar-row">
        <label class="sk-lookback">
          <span>Look back</span>
          <select id="lookbackSelect" class="sk-select">
            <option value="1">1 month</option>
            <option value="3">3 months</option>
            <option value="6" selected>6 months</option>
            <option value="12">12 months</option>
            <option value="0">All time</option>
          </select>
        </label>
      </div>
      <div class="sk-toolbar-row">
        <label class="sk-lookback">
          <span>Area</span>
          <select id="skAreaSelect" class="sk-select" ${catalogAreaPrefs.areas.length === 0 ? 'disabled' : ''}>
            ${catalogAreaPrefs.areas.length > 0
              ? catalogAreaPrefs.areas.map(area => html`<option value="${area.id}" selected="${area.id === catalogAreaPrefs.selectedAreaId || undefined}">${area.name}</option>`)
              : html`<option value="" selected>No configured areas</option>`}
          </select>
        </label>
      </div>
      <div class="sk-toolbar-row">
        <label class="sk-lookback">
          <span>Skill Group</span>
          <select id="skCollectionSelect" class="sk-select">
            <option value="">All</option>
            ${companyPackages.map(collection => html`<option value="${collection}" selected="${collection === selectedCollection || undefined}">${humanizeCompanyCollection(collection)}</option>`)}
          </select>
        </label>
      </div>
      <div class="sk-toolbar-row">
        <button id="analyzeBtn" class="sk-btn sk-btn-primary">Analyze</button>
        <span id="analyzeStatus" class="sk-status"></span>
      </div>
    </div>

    <section class="sk-section" id="customSection">
      <h2 class="sk-section-title">Custom Skill Opportunities</h2>
      <div id="customResults">
        <p class="sk-empty">Select a workspace and click Analyze to find repeated patterns that could become skills.</p>
      </div>
    </section>

    <section class="sk-section" id="catalogSection">
      <h2 class="sk-section-title">Company Skills Catalog</h2>
      <p class="sk-section-desc">
        Recommended matches from${' '}
        <a id="skCatalogSourceLink" href="${DEFAULT_CATALOG_BASE}">${DEFAULT_CATALOG_LABEL}</a>
        ${' '}based on your repeated activities.
      </p>
      <div id="catalogResults">
        <p class="sk-empty">${getCompanyCatalogEmptyStateMessage()}</p>
      </div>
    </section>
  `, container);

  const areaSelect = document.getElementById('skAreaSelect') as HTMLSelectElement | null;
  if (areaSelect) {
    areaSelect.value = catalogAreaPrefs.selectedAreaId || catalogAreaPrefs.areas[0]?.id || '';
    if (!areaSelect.value && catalogAreaPrefs.areas[0]) {
      areaSelect.value = catalogAreaPrefs.areas[0].id;
    }
  }

  document.getElementById('analyzeBtn')?.addEventListener('click', triggerRunAnalysis);
  document.getElementById('skAreaSelect')?.addEventListener('change', () => {
    void (async () => {
      catalogAreaPrefs = await handleCompanyAreaSelectionChange(
        catalogAreaPrefs,
        () => {
          companyPackages = getPackagesForArea(catalogAreaPrefs.selectedAreaId, catalogAreaPrefs.areas);
          updateCompanyPackageSelect(getSavedCompanyCapabilityGroup(vscode, COMPANY_SKILLS_PAGE_STATE_KEY, companyPackages));
          const cachedResults = getCompanySkillCache(activeFilter);
          if (cachedResults) {
            renderCachedResults(cachedResults.clusters, cachedResults.triaged, cachedResults.catalogMatches);
            return;
          }
          const catalogEl = document.getElementById('catalogResults');
          if (catalogEl) {
            render(html`<p class="sk-empty">${getCompanyCatalogEmptyStateMessage()}</p>`, catalogEl);
          }
        },
        DEFAULT_CATALOG_BASE,
        DEFAULT_CATALOG_LABEL,
      );
    })();
  });
  document.getElementById('skCollectionSelect')?.addEventListener('change', () => {
    handleCompanyCollectionSelectionChange(vscode, COMPANY_SKILLS_PAGE_STATE_KEY, () => {
      const cachedResults = getCompanySkillCache(activeFilter);
      if (cachedResults) {
        renderCachedResults(cachedResults.clusters, cachedResults.triaged, cachedResults.catalogMatches);
        return;
      }
      const catalogEl = document.getElementById('catalogResults');
      if (catalogEl) {
        render(html`<p class="sk-empty">${getCompanyCatalogEmptyStateMessage()}</p>`, catalogEl);
      }
    });
  });
  updateCompanyCatalogSourceLink(catalogAreaPrefs, DEFAULT_CATALOG_BASE, DEFAULT_CATALOG_LABEL);
  updateCompanyPackageSelect(selectedCollection);

  const cached = getCompanySkillCache(currentFilter);
  if (cached && cached.clusters.length > 0) {
    renderCachedResults(cached.clusters, cached.triaged, cached.catalogMatches);
    return;
  }

  if (consumeNavHint() === 'auto-run') {
    setTimeout(triggerRunAnalysis, 100);
  }
}

function renderCachedResults(clusters: WorkflowCluster[], triaged: TriagedCluster[], catalogMatches: CatalogItem[]): void {
  const statusEl = document.getElementById('analyzeStatus');
  const customEl = document.getElementById('customResults');
  const catalogEl = document.getElementById('catalogResults');
  if (!statusEl || !customEl || !catalogEl) return;

  const strong = triaged.filter(item => item.verdict === 'strong').slice(0, 10);
  lastTriaged = strong;
  lastClusters = clusters;
  lastResultsEl = customEl;

  if (strong.length === 0) {
    statusEl.textContent = getCompanyCatalogStatusMessage(clusters, catalogMatches);
    render(html`<p class="sk-empty">No repeating agent tasks detected.</p>`, customEl);
  } else {
    statusEl.textContent = `${strong.length} custom skill ${strong.length === 1 ? 'opportunity' : 'opportunities'} found (from dashboard scan)`;
    renderTriageResults(customEl, strong, clusters);
  }

  if (catalogMatches.length > 0) {
    renderCatalogList(catalogEl, catalogMatches as CompanyCatalogItem[], catalogMatches.length);
  } else {
    render(html`<p class="sk-empty">No company catalog matches were found in the dashboard scan. Click Analyze to refresh from your configured catalogs.</p>`, catalogEl);
  }

  updateSkillFinderBadge(strong.length + catalogMatches.length);
}

async function runAnalysis(): Promise<void> {
  const analyzeButton = document.getElementById('analyzeBtn') as HTMLButtonElement | null;
  const statusEl = document.getElementById('analyzeStatus');
  const customEl = document.getElementById('customResults');
  const catalogEl = document.getElementById('catalogResults');
  const workspaceSelect = document.getElementById('skWorkspaceSelect') as HTMLSelectElement | null;
  const lookbackSelect = document.getElementById('lookbackSelect') as HTMLSelectElement | null;
  if (!analyzeButton || !statusEl || !customEl || !catalogEl || !workspaceSelect || !lookbackSelect) return;

  const workspaceId = workspaceSelect.value;
  const selectedCollection = getSelectedCompanyCapabilityGroup();
  const workspaceName = workspaceId ? (workspaceSelect.selectedOptions[0]?.textContent || workspaceId) : undefined;
  const lookback = Number.parseInt(lookbackSelect.value, 10);

  analyzeButton.disabled = true;
  analyzeButton.textContent = 'Analyzing...';
  statusEl.textContent = '';
  render(html`<p class="sk-loading">Scanning for repeated prompts...</p>`, customEl);
  render(html`<p class="sk-loading">Loading company catalogs...</p>`, catalogEl);
  dismissed.clear();

  const filter: Record<string, unknown> = {};
  if (lookback > 0) {
    const fromDate = new Date();
    fromDate.setMonth(fromDate.getMonth() - lookback);
    filter.fromDate = fromDate.toISOString().slice(0, 10);
  }
  if (workspaceId) filter.workspaceId = workspaceId;

  let clusters: WorkflowCluster[] = [];
  try {
    const workflowData = await rpc<WorkflowOptimizationData>('getWorkflowOptimization', filter);
    clusters = workflowData.clusters || [];
    lastClusters = clusters;
    lastResultsEl = customEl;

    if (clusters.length === 0) {
      statusEl.textContent = 'No repeated patterns found.';
      render(html`<p class="sk-empty">No repeated patterns found. Try extending the lookback period or selecting a different workspace.</p>`, customEl);
      render(html`<p class="sk-empty">No patterns to match against.</p>`, catalogEl);
      return;
    }

    const top20 = clusters.slice(0, 20);
    statusEl.textContent = `Found ${clusters.length} patterns — sending top ${top20.length} to AI triage...`;

    const triageResult = await rpc<SkillTriageResult>('triageSkills', {
      clusters: top20.map(cluster => ({
        id: cluster.id,
        label: cluster.label,
        occurrences: cluster.occurrences,
        sessions: cluster.sessions,
        cancelRate: cluster.cancelRate,
        avgCorrectionTurns: cluster.avgCorrectionTurns,
        workspaces: cluster.workspaces,
        examples: cluster.examples.slice(0, 5),
      })),
      workspace: workspaceName,
    } as Record<string, unknown>);

    const strong = (triageResult.triaged || []).filter(item => item.verdict === 'strong').slice(0, 10);
    lastTriaged = strong;

    if (strong.length === 0) {
      render(html`<p class="sk-empty">No repeating agent tasks detected. Your prompts may already be well-served or too diverse.</p>`, customEl);
    } else {
      renderTriageResults(customEl, strong, clusters);
    }
  } catch (error: unknown) {
    lastTriaged = [];
    const message = error instanceof Error ? error.message : 'Analysis failed';
    render(html`<p class="sk-error">Error: ${message}</p>`, customEl);
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = 'Analyze';
  }

  const catalogMatches = await loadCatalog(catalogEl, clusters, workspaceName, selectedCollection);
  statusEl.textContent = `${lastTriaged.length} custom skill ${lastTriaged.length === 1 ? 'opportunity' : 'opportunities'} found${catalogMatches.length > 0 ? ` and ${catalogMatches.length} company catalog ${catalogMatches.length === 1 ? 'match' : 'matches'}` : ''}`;
  setCompanySkillCache({ clusters, triaged: lastTriaged, catalogMatches: catalogMatches as CompanyCatalogItem[], timestamp: Date.now() }, activeFilter);
  updateSkillFinderBadge(lastTriaged.length + catalogMatches.length);
}

function triggerRunAnalysis(): void {
  void runAnalysis();
}

function renderTriageResults(container: HTMLElement, triaged: TriagedCluster[], clusters: WorkflowCluster[]): void {
  const visible = triaged.filter(item => !dismissed.has(item.id));
  if (visible.length === 0) {
    render(html`<p class="sk-empty">All suggestions dismissed. Run analysis again to refresh.</p>`, container);
    return;
  }

  render(html`<div class="sk-grid">${visible.map((item, index) => {
    const cluster = clusters.find(entry => entry.id === item.id);
    return html`
      <div class="sk-card" data-idx="${index}" data-id="${item.id}">
        <div class="sk-card-header">
          <span class="sk-rank">${index + 1}</span>
          <div class="sk-card-title">${item.suggestedSkillName || item.label}</div>
          <button class="sk-btn-dismiss" data-dismiss-id="${item.id}" title="Dismiss">\u00d7</button>
        </div>
        <div class="sk-card-body">
          <p class="sk-card-reason">${item.reason}</p>
          ${cluster ? html`
            <div class="sk-card-meta">
              <span>${cluster.occurrences} repetitions</span>
              <span>${cluster.sessions} sessions</span>
              ${cluster.cancelRate > 0 ? html`<span>${cluster.cancelRate}% cancelled</span>` : null}
            </div>
            ${cluster.examples.length > 0 ? html`<div class="sk-card-examples">${cluster.examples.slice(0, 3).map(example => html`<div class="sk-card-example">${example.length > 120 ? example.slice(0, 117) + '...' : example}</div>`)}</div>` : null}
            <div class="sk-card-actions">
              <button class="sk-btn sk-btn-install" data-cluster-idx="${index}">Install Skill</button>
              <div class="sk-card-preview" data-cluster-idx="${index}"></div>
            </div>` : null}
        </div>
      </div>`;
  })}</div>`, container);

  for (const button of container.querySelectorAll('.sk-btn-install')) {
    button.addEventListener('click', event => {
      void (async () => {
        const trigger = event.currentTarget as HTMLButtonElement;
        const index = Number.parseInt(trigger.dataset.clusterIdx || '0', 10);
        const triagedItem = visible[index];
        if (!triagedItem) return;
        const cluster = clusters.find(entry => entry.id === triagedItem.id);
        if (!cluster) return;

        trigger.disabled = true;
        trigger.textContent = 'Generating...';

        try {
          const result = await rpc<{ content: string; filename: string }>('generateSkillContent', {
            label: triagedItem.suggestedSkillName || triagedItem.label,
            pattern: cluster.label,
            occurrences: cluster.occurrences,
            sessions: cluster.sessions,
            examples: cluster.examples.slice(0, 5),
            skillDraft: cluster.skillDraft,
          } as Record<string, unknown>);

          const previewEl = trigger.parentElement?.querySelector<HTMLElement>('.sk-card-preview');
          if (previewEl) {
            render(html`
              <details class="sk-preview-details" open>
                <summary>Preview: ${result.filename}</summary>
                <pre class="sk-preview-code">${result.content}</pre>
                <div class="sk-preview-actions">
                  <button class="sk-btn sk-btn-confirm">Save & Install</button>
                  <button class="sk-btn sk-btn-secondary sk-btn-cancel">Cancel</button>
                </div>
              </details>`, previewEl);

            previewEl.querySelector<HTMLElement>('.sk-btn-confirm')?.addEventListener('click', () => {
              void (async () => {
                try {
                  await rpc<{ ok: boolean }>('installSkill', { filename: result.filename, content: result.content } as Record<string, unknown>);
                  trigger.textContent = 'Installed';
                  trigger.classList.add('sk-btn-done');
                  render(html`<span class="sk-installed-msg">Skill installed to ~/.agents/skills/</span>`, previewEl);
                } catch (error: unknown) {
                  const message = error instanceof Error ? error.message : 'Install failed';
                  render(html`<span class="sk-error">${message}</span>`, previewEl);
                }
              })();
            });

            previewEl.querySelector<HTMLElement>('.sk-btn-cancel')?.addEventListener('click', () => {
              render(null, previewEl);
              trigger.disabled = false;
              trigger.textContent = 'Install Skill';
            });
          }

          trigger.textContent = 'Review Below';
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Generation failed';
          trigger.textContent = 'Install Skill';
          trigger.disabled = false;
          const previewEl = trigger.parentElement?.querySelector<HTMLElement>('.sk-card-preview');
          if (previewEl) render(html`<span class="sk-error">${message}</span>`, previewEl);
        }
      })();
    });
  }

  for (const button of container.querySelectorAll('.sk-btn-dismiss')) {
    button.addEventListener('click', event => {
      const id = (event.currentTarget as HTMLElement).dataset.dismissId || '';
      if (!id) return;
      dismissed.add(id);
      if (lastResultsEl) renderTriageResults(lastResultsEl, lastTriaged, lastClusters);
    });
  }
}

const kindIcons: Record<string, string> = {
  skill: 'S',
  agent: 'A',
  instruction: 'I',
  hook: 'H',
};

const kindColors: Record<string, string> = {
  skill: COLORS.green,
  agent: COLORS.purple,
  instruction: COLORS.blue,
  hook: COLORS.yellow,
};

async function loadCatalog(container: HTMLElement, clusters: WorkflowCluster[], workspace?: string, selectedCollection?: string): Promise<CatalogItem[]> {
  if (!hasConfiguredCompanyCatalogAreas()) {
    render(html`<p class="sk-empty">${getCompanyCatalogEmptyStateMessage()}</p>`, container);
    return [];
  }

  try {
    const result = await rpc<CompanyCatalogDiscoverResult>('discoverCatalog', {
      includeCompany: true,
      areaId: getSelectedCompanyCatalogAreaId(catalogAreaPrefs),
    } as Record<string, unknown>);

    const itemsInScope = result.items;
    const availableItems = filterCompanyCapabilityItems(itemsInScope, selectedCollection || '', companyPackages);

    if (!availableItems || availableItems.length === 0) {
      render(html`<p class="sk-empty">No items found in the selected catalogs.</p>`, container);
      return [];
    }

    render(html`<p class="sk-loading">AI is reviewing all ${availableItems.length} catalog items against your patterns...</p>`, container);

    const topClusters = clusters
      .sort((left, right) => right.occurrences - left.occurrences)
      .slice(0, 20)
      .map(cluster => ({
        label: cluster.label,
        occurrences: cluster.occurrences,
        workspaces: cluster.workspaces,
        examples: cluster.examples.slice(0, 3),
      }));

    try {
      const triaged = await rpc<CatalogTriageResult>('triageCatalog', {
        items: availableItems,
        clusters: topClusters,
        workspace: workspace || undefined,
      } as Record<string, unknown>);

      const items = triaged.items && triaged.items.length > 0 ? triaged.items : [];
      if (items.length === 0) {
        render(html`<p class="sk-empty">No company catalog items matched your workflow patterns (${availableItems.length} reviewed).</p>`, container);
      } else {
        renderCatalogList(container, items as CompanyCatalogItem[], availableItems.length);
      }
      return items;
    } catch {
      render(html`<p class="sk-empty">AI triage failed. Try again later.</p>`, container);
      return [];
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load catalog';
    render(html`<p class="sk-error">Catalog error: ${message}</p>`, container);
    return [];
  }
}

function renderCatalogList(container: HTMLElement, items: CompanyCatalogItem[], totalScanned: number): void {
  render(html`
    <p class="sk-section-count">${items.length} curated from ${totalScanned} catalog items</p>
    <div class="sk-grid">${items.map(item => renderCatalogCard(item))}</div>
  `, container);

  for (const button of container.querySelectorAll('.sk-btn-install-catalog')) {
    button.addEventListener('click', event => {
      void (async () => {
        const trigger = event.currentTarget as HTMLButtonElement;
        const path = trigger.dataset.path || '';
        const kind = trigger.dataset.kind || 'skill';
        const title = trigger.dataset.title || '';
        if (!path) return;

        trigger.disabled = true;
        trigger.textContent = 'Fetching...';

        try {
          const result = await rpc<{ content: string; filename: string }>('installCatalogItem', {
            path,
            kind,
            title,
            source: trigger.dataset.source || '',
            repository: trigger.dataset.repository || '',
            owner: trigger.dataset.owner || '',
            repo: trigger.dataset.repo || '',
            ref: trigger.dataset.ref || '',
          } as Record<string, unknown>);

          trigger.textContent = 'Installed';
          trigger.classList.add('sk-btn-done');
          const parent = trigger.closest('.sk-card');
          const message = parent?.querySelector<HTMLElement>('.sk-install-msg');
          if (message) message.textContent = `Installed as ${result.filename}`;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : 'Install failed';
          trigger.textContent = 'Install';
          trigger.disabled = false;
          const parent = trigger.closest('.sk-card');
          const messageEl = parent?.querySelector<HTMLElement>('.sk-install-msg');
          if (messageEl) {
            messageEl.textContent = message;
            messageEl.classList.add('sk-error');
          }
        }
      })();
    });
  }
}

function renderCatalogCard(item: CompanyCatalogItem): ReturnType<typeof html> {
  const color = kindColors[item.kind] || COLORS.blue;
  const icon = kindIcons[item.kind] || '?';
  const kindLabel = item.kind.charAt(0).toUpperCase() + item.kind.slice(1);
  const githubUrl = item.url;

  return html`
    <div class="sk-card sk-card-catalog">
      <div class="sk-card-header">
        <span class="sk-kind-icon" style="background:${color}">${icon}</span>
        <div>
          <div class="sk-card-title">
            <a href="${githubUrl}" target="_blank">${item.title}</a>
          </div>
          <div class="sk-card-badges">
            <span class="sk-badge" style="color:${color}">${kindLabel}</span>
            ${item.areaName ? html`<span class="sk-badge">${item.areaName}</span>` : null}
            ${item.category ? html`<span class="sk-badge">${item.category}</span>` : null}
            ${item.collectionName ? html`<span class="sk-badge">${humanizeCompanyCollection(item.collectionName)}</span>` : null}
          </div>
        </div>
      </div>
      <div class="sk-card-body">
        <p class="sk-card-desc">${item.description.length > 200 ? item.description.slice(0, 200) + '...' : item.description}</p>
        ${item.matchReasons.length > 0 ? html`
          <div class="sk-card-reasons">
            ${item.matchReasons.map(reason => html`<span class="sk-reason">${reason}</span>`)}
          </div>` : null}
        <div class="sk-card-actions">
          <button class="sk-btn sk-btn-install-catalog" data-path="${item.path}" data-kind="${item.kind}" data-title="${item.title}" data-source="${item.source || ''}" data-repository="${item.repository || ''}" data-owner="${item.owner || ''}" data-repo="${item.repo || ''}" data-ref="${item.ref || ''}">Install</button>
          <span class="sk-install-msg"></span>
        </div>
      </div>
    </div>`;
}
