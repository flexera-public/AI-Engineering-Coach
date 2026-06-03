import type { CatalogArea } from '../core/types/catalog-types';
import type { CompanyCatalogItem } from '../core/types/company-catalog-types';

type GitHubTreeEntry = {
  path?: string;
  type?: string;
  sha?: string;
};

type GitHubTreeResponse = {
  tree?: GitHubTreeEntry[];
};

type GitHubBlobResponse = {
  content?: string;
  encoding?: string;
};

type PackageManifestSkill = {
  name?: unknown;
  path?: unknown;
};

type PackageManifest = {
  skills?: PackageManifestSkill[];
};

type FetchGitHubJson = <T>(url: string, requestAuth: boolean) => Promise<T>;

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function toText(value: unknown): string {
  return isString(value) || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}

function splitRepository(repository: string): { owner: string; repo: string } | undefined {
  const parts = repository.trim().split('/').filter(Boolean);
  if (parts.length !== 2) return undefined;
  return { owner: parts[0], repo: parts[1] };
}

function stripMarkup(text: string): string {
  return text
    .replaceAll(/```[\s\S]*?```/g, ' ')
    .replaceAll(/`([^`]*)`/g, '$1')
    .replaceAll(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replaceAll(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replaceAll(/[>#*_~-]+/g, ' ')
    .replaceAll(/\s+/g, ' ')
    .trim();
}

function extractFrontmatter(content: string): string | undefined {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  return match ? match[1] : undefined;
}

function getFrontmatterValue(frontmatter: string | undefined, key: string): string | undefined {
  if (!frontmatter) return undefined;
  const match = frontmatter.match(new RegExp(`^${key}:\\s*["']?(.+?)["']?\\s*$`, 'm'));
  return match?.[1]?.trim();
}

function getBodyText(content: string): string {
  const body = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '').trim();
  const lines = body
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#') && !line.startsWith('```'));
  return stripMarkup(lines.slice(0, 4).join(' '));
}

function getFirstHeading(content: string): string | undefined {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim();
}

function humanizePathName(filePath: string): string {
  const parts = filePath.split('/').filter(Boolean);
  const preferred = parts.at(-2) || parts.at(-1) || 'catalog-item';
  return preferred
    .replace(/\.[^.]+$/, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

function inferCollectionNameFromPath(filePath: string): string | undefined {
  const match = filePath.match(/^packages\/([^/]+)\/(?:\.apm\/)?skills\/[^/]+\/SKILL\.md$/i);
  return match?.[1]?.trim().toLowerCase();
}

function getSkillSlugFromPath(filePath: string): string | undefined {
  const match = filePath.match(/(?:^|\/)skills\/([^/]+)\/SKILL\.md$/i);
  return match?.[1]?.trim().toLowerCase();
}

function getPackageNameFromManifestPath(filePath: string): string | undefined {
  const match = filePath.match(/^packages\/([^/]+)\/manifest\.json$/i);
  return match?.[1]?.trim().toLowerCase();
}

function isPackageManifestPath(filePath: string): boolean {
  return /^packages\/[^/]+\/manifest\.json$/i.test(filePath);
}

function addPackageToSkillMap(skillPackages: Map<string, Set<string>>, skillSlug: string | undefined, packageName: string | undefined): void {
  if (!skillSlug || !packageName) return;

  const existing = skillPackages.get(skillSlug) || new Set<string>();
  existing.add(packageName);
  skillPackages.set(skillSlug, existing);
}

async function buildSkillPackageMap(
  files: GitHubTreeEntry[],
  repository: { owner: string; repo: string },
  fetchGitHubJson: FetchGitHubJson,
): Promise<Map<string, Set<string>>> {
  const manifestEntries = files.filter(entry => entry.type === 'blob' && isString(entry.path) && isString(entry.sha) && isPackageManifestPath(entry.path));
  const skillPackages = new Map<string, Set<string>>();

  await Promise.all(manifestEntries.map(async entry => {
    const manifestPath = entry.path as string;
    const packageName = getPackageNameFromManifestPath(manifestPath);
    if (!packageName) return;

    const blobUrl = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/git/blobs/${encodeURIComponent(entry.sha as string)}`;
    const blob = await fetchGitHubJson<GitHubBlobResponse>(blobUrl, true);
    if (blob.encoding !== 'base64' || !isString(blob.content)) return;

    const content = Buffer.from(blob.content.replaceAll(/\s+/g, ''), 'base64').toString('utf8');

    let parsed: PackageManifest;
    try {
      parsed = JSON.parse(content) as PackageManifest;
    } catch {
      return;
    }

    const skills = Array.isArray(parsed.skills) ? parsed.skills : [];
    for (const skill of skills) {
      const skillName = isString(skill.name) ? skill.name.trim().toLowerCase() : undefined;
      const skillPath = isString(skill.path) ? skill.path.trim() : undefined;
      const skillSlug = skillName || (skillPath ? getSkillSlugFromPath(`${skillPath.replace(/^\.\.\/\.\.\//, '')}/SKILL.md`) : undefined);
      addPackageToSkillMap(skillPackages, skillSlug, packageName);
    }
  }));

  return skillPackages;
}

function detectCatalogKind(filePath: string): CompanyCatalogItem['kind'] | undefined {
  if (/^packages\/[^/]+\/(?:\.apm\/)?skills\/[^/]+\/SKILL\.md$/i.test(filePath)) return 'skill';
  if (/^skills\/[^/]+\/SKILL\.md$/i.test(filePath)) return 'skill';
  
  return undefined;
}

function parseCatalogMetadata(filePath: string, kind: CompanyCatalogItem['kind'], content: string): Pick<CompanyCatalogItem, 'title' | 'description' | 'category'> & { collectionName?: string } {
  if (kind === 'hook') {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return {
      title: toText(parsed.name) || humanizePathName(filePath),
      description: toText(parsed.description) || 'GitHub Copilot hook',
      category: toText(parsed.type) || 'hook',
    };
  }

  const frontmatter = extractFrontmatter(content);
  const title = getFrontmatterValue(frontmatter, 'title')
    || getFrontmatterValue(frontmatter, 'name')
    || getFirstHeading(content)
    || humanizePathName(filePath);
  const description = getFrontmatterValue(frontmatter, 'description') || getBodyText(content) || `${title} ${kind}`;
  const category = getFrontmatterValue(frontmatter, 'category') || kind;
  const collectionName = getFrontmatterValue(frontmatter, 'collection')
    || getFrontmatterValue(frontmatter, 'capabilityGroup')
    || inferCollectionNameFromPath(filePath);

  return { title, description, category, collectionName };
}

export function isCompanyCatalogInstallRequest(params: Record<string, unknown>): boolean {
  return typeof params.repository === 'string' && params.repository.trim().length > 0;
}

export async function fetchCompanyCatalogItemContent(
  input: { repository: string; owner?: string; repo?: string; ref?: string; path: string },
  fetchGitHubJson: FetchGitHubJson,
): Promise<string> {
  const repository = splitRepository(input.repository) || (input.owner && input.repo
    ? { owner: input.owner, repo: input.repo }
    : undefined);
  if (!repository) throw new Error('Invalid repository');

  const ref = input.ref || 'main';
  const encodedPath = input.path.split('/').map(part => encodeURIComponent(part)).join('/');
  const url = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(ref)}`;
  const result = await fetchGitHubJson<GitHubBlobResponse>(url, true);
  if (result.encoding !== 'base64' || !isString(result.content)) {
    throw new Error('Unsupported GitHub content encoding');
  }
  return Buffer.from(result.content.replaceAll(/\s+/g, ''), 'base64').toString('utf8');
}

export async function discoverCompanyCatalogItems(
  areas: readonly CatalogArea[],
  areaId: string,
  fetchGitHubJson: FetchGitHubJson,
): Promise<CompanyCatalogItem[]> {
  const selectedAreas = areaId
    ? areas.filter(area => area.id === areaId)
    : areas;
  if (selectedAreas.length === 0) return [];

  const groups = await Promise.all(selectedAreas.map(async area => {
    const repository = splitRepository(area.repository);
    if (!repository) return [];

    const ref = area.ref || 'main';
    const treeUrl = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
    const tree = await fetchGitHubJson<GitHubTreeResponse>(treeUrl, true);
    const files = Array.isArray(tree.tree) ? tree.tree : [];
    const skillPackages = await buildSkillPackageMap(files, repository, fetchGitHubJson);
    const candidates = files.filter(entry => entry.type === 'blob' && isString(entry.path) && isString(entry.sha) && detectCatalogKind(entry.path));

    const items = await Promise.all(candidates.map(async entry => {
      const filePath = entry.path as string;
      const kind = detectCatalogKind(filePath);
      if (!kind) return [];

      const blobUrl = `https://api.github.com/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/git/blobs/${encodeURIComponent(entry.sha as string)}`;
      const blob = await fetchGitHubJson<GitHubBlobResponse>(blobUrl, true);
      if (blob.encoding !== 'base64' || !isString(blob.content)) return [];

      const content = Buffer.from(blob.content.replaceAll(/\s+/g, ''), 'base64').toString('utf8');
      const metadata = parseCatalogMetadata(filePath, kind, content);

      const inferredCollectionNames = metadata.collectionName
        ? [metadata.collectionName]
        : kind === 'skill'
          ? [
              ...new Set([
                inferCollectionNameFromPath(filePath),
                ...(getSkillSlugFromPath(filePath)
                  ? Array.from(skillPackages.get(getSkillSlugFromPath(filePath) as string) || [])
                  : []),
              ].filter(isString)),
            ]
          : [];

      const baseItem: Omit<CompanyCatalogItem, 'id'> = {
        kind,
        title: metadata.title,
        description: metadata.description,
        category: metadata.category,
        path: filePath,
        url: `https://github.com/${area.repository}/blob/${encodeURIComponent(ref)}/${filePath.split('/').map(part => encodeURIComponent(part)).join('/')}`,
        relevanceScore: 0,
        matchReasons: [],
        source: 'github-repository',
        repository: area.repository,
        owner: repository.owner,
        repo: repository.repo,
        ref,
        areaName: area.name,
      };

      if (inferredCollectionNames.length === 0) {
        return [{
          ...baseItem,
          id: `${area.id}:${kind}:${filePath}`,
          ...(metadata.collectionName ? { collectionName: metadata.collectionName } : {}),
        } satisfies CompanyCatalogItem];
      }

      return inferredCollectionNames.map(collectionName => ({
        ...baseItem,
        id: `${area.id}:${kind}:${collectionName}:${filePath}`,
        collectionName,
      } satisfies CompanyCatalogItem));
    }));

    return items.flat();
  }));

  return groups.flat();
}