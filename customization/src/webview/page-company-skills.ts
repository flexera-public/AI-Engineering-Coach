import type { DateFilter, WorkflowCluster, WorkflowOptimizationData, TriagedCluster, CatalogItem, CatalogTriageResult } from '../../../src/core/types';
import type { CompanyCatalogDiscoverResult, CompanyCatalogItem } from '../core/types/company-catalog-types';
import { rpc, COLORS, vscode } from '../../../src/webview/shared';
import { html, render } from '../../../src/webview/render';
import { consumeNavHint, updateNavBadge } from '../../../src/webview/app';
import { getCatalogAreaPreferences, loadCatalogAreaPreferences } from './catalog-area-state';
import {
  companySkillPackages,
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
const COMPANY_BADGE_ID = 'badge-company-skills';
const COMPANY_CACHE_MAX_AGE = 10 * 60_000;

type CompanySkillCacheData = {
  clusters: WorkflowCluster[];
  triaged: TriagedCluster[];
  catalogMatches: CompanyCatalogItem[];
  timestamp: number;
};

let lastTriaged: TriagedCluster[] = [];

let activeFilter: DateFilter = {};
let catalogAreaPrefs = getCatalogAreaPreferences();
const companySkillCache = new Map<string, CompanySkillCacheData>();

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

export async function renderCompanySkills(container: HTMLElement, currentFilter: DateFilter): Promise<void> {
  activeFilter = currentFilter;
  const [workspaces, catalogAreasResult] = await Promise.all([
    rpc<{ id: string; name: string }[]>('getWorkspaces'),
    rpc<{ areas: { id: string; name: string; repository: string; url: string; ref?: string }[] }>('getCatalogAreas'),
  ]);
  catalogAreaPrefs = await loadCatalogAreaPreferences(catalogAreasResult.areas);
  normalizeCompanyCatalogAreaPrefs();
  const selectedCollection = getSavedCompanyCapabilityGroup(vscode, COMPANY_SKILLS_PAGE_STATE_KEY);

  const filterWsId = currentFilter.workspaceId
    ? (workspaces.find(w => w.id === currentFilter.workspaceId)?.id || '')
    : '';

  render(html`
    <div class="sk-header">
      <h1>Company Skill Finder</h1>
      <p class="sk-subtitle">Analyze your repeated prompts to discover custom company skill opportunities and matching company catalog skills.</p>
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
          <span>Skills</span>
          <select id="skCollectionSelect" class="sk-select">
            <option value="">All</option>
            ${companySkillPackages.map(collection => html`<option value="${collection}" selected="${collection === selectedCollection || undefined}">${humanizeCompanyCollection(collection)}</option>`)}
          </select>
        </label>
      </div>
      <div class="sk-toolbar-row">
        <button id="analyzeBtn" class="sk-btn sk-btn-primary">Analyze</button>
        <span id="analyzeStatus" class="sk-status"></span>
      </div>
    </div>

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
  const catalogEl = document.getElementById('catalogResults');
  if (!statusEl || !catalogEl) return;

  const strong = triaged.filter(item => item.verdict === 'strong').slice(0, 10);
  lastTriaged = strong;

  if (strong.length === 0) {
    statusEl.textContent = `Found ${clusters.length} patterns.`;
  } else {
    statusEl.textContent = `${strong.length} custom skill ${strong.length === 1 ? 'opportunity' : 'opportunities'} found (from dashboard scan)`;
  }

  if (catalogMatches.length > 0) {
    renderCatalogList(catalogEl, catalogMatches as CompanyCatalogItem[], catalogMatches.length);
  } else {
    render(html`<p class="sk-empty">No company catalog matches were found in the dashboard scan. Click Analyze to refresh from your configured catalogs.</p>`, catalogEl);
  }

  updateNavBadge(COMPANY_BADGE_ID, strong.length + catalogMatches.length);
}

async function runAnalysis(): Promise<void> {
  const analyzeButton = document.getElementById('analyzeBtn') as HTMLButtonElement | null;
  const statusEl = document.getElementById('analyzeStatus');
  const catalogEl = document.getElementById('catalogResults');
  const workspaceSelect = document.getElementById('skWorkspaceSelect') as HTMLSelectElement | null;
  const lookbackSelect = document.getElementById('lookbackSelect') as HTMLSelectElement | null;
  if (!analyzeButton || !statusEl || !catalogEl || !workspaceSelect || !lookbackSelect) return;

  const workspaceId = workspaceSelect.value;
  const selectedCollection = getSelectedCompanyCapabilityGroup();
  const workspaceName = workspaceId ? (workspaceSelect.selectedOptions[0]?.textContent || workspaceId) : undefined;
  const lookback = Number.parseInt(lookbackSelect.value, 10);

  analyzeButton.disabled = true;
  analyzeButton.textContent = 'Analyzing...';
  statusEl.textContent = '';
  render(html`<p class="sk-loading">Loading company catalogs...</p>`, catalogEl);

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

    if (clusters.length === 0) {
      statusEl.textContent = 'No repeated patterns found.';
      render(html`<p class="sk-empty">No patterns to match against.</p>`, catalogEl);
      return;
    }

    lastTriaged = [];
    statusEl.textContent = `Found ${clusters.length} patterns. Matching them against company catalogs...`;
  } catch {
    lastTriaged = [];
  } finally {
    analyzeButton.disabled = false;
    analyzeButton.textContent = 'Analyze';
  }

  const catalogMatches = await loadCatalog(catalogEl, clusters, workspaceName, selectedCollection);
  statusEl.textContent = getCompanyCatalogStatusMessage(clusters, catalogMatches);
  setCompanySkillCache({ clusters, triaged: lastTriaged, catalogMatches: catalogMatches as CompanyCatalogItem[], timestamp: Date.now() }, activeFilter);
  updateNavBadge(COMPANY_BADGE_ID, lastTriaged.length + catalogMatches.length);
}

function triggerRunAnalysis(): void {
  void runAnalysis();
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
    const filteredItems = selectedCollection
      ? itemsInScope.filter(item => matchesCompanyCapabilityGroup(item, selectedCollection))
      : itemsInScope;
    const availableItems = filteredItems.length > 0 || !selectedCollection
      ? filteredItems
      : itemsInScope;

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
