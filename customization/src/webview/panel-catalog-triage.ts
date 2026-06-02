export interface CatalogTriageCandidate {
  id: string;
  kind: string;
  title: string;
  description: string;
  category: string;
}

export interface CatalogWorkflowCluster {
  label: string;
  occurrences: number;
  workspaces: string[];
  examples: string[];
}

export interface CatalogTriageContext {
  languages: string[];
  harnesses: string[];
  topics: string[];
  workspace?: string;
  clusters: CatalogWorkflowCluster[];
}

export interface RankedCatalogCandidate extends CatalogTriageCandidate {
  score: number;
  matchedTerms: string[];
}

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'agent', 'agents', 'analyze', 'and', 'build', 'code', 'common', 'create', 'data', 'developer',
  'does', 'each', 'exactly', 'file', 'files', 'for', 'from', 'have', 'help', 'into', 'just', 'later', 'like', 'make', 'more',
  'most', 'only', 'other', 'over', 'part', 'project', 'prompt', 'prompts', 'really', 'same', 'show', 'skill', 'skills',
  'task', 'tasks', 'that', 'their', 'them', 'they', 'this', 'those', 'tool', 'tools', 'top', 'use', 'user', 'using', 'what',
  'when', 'which', 'with', 'workflow', 'workflows', 'workspace', 'workspaces', 'your', 'you'
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9.+#-]{2,}/g) || [])
    .filter(token => token.length > 2 || ['c#', 'ai', 'ui'].includes(token))
    .filter(token => !STOP_WORDS.has(token));
}

function addWeightedTokens(weights: Map<string, number>, values: string[], weight: number): void {
  for (const value of values) {
    for (const token of tokenize(value)) {
      weights.set(token, Math.max(weights.get(token) || 0, weight));
    }
  }
}

function buildSignalWeights(context: CatalogTriageContext): Map<string, number> {
  const weights = new Map<string, number>();
  addWeightedTokens(weights, context.languages, 5);
  addWeightedTokens(weights, context.harnesses, 5);
  addWeightedTokens(weights, context.topics, 4);
  if (context.workspace) addWeightedTokens(weights, [context.workspace], 2);

  for (const cluster of context.clusters) {
    addWeightedTokens(weights, [cluster.label], Math.min(6, Math.max(2, cluster.occurrences)));
    addWeightedTokens(weights, cluster.examples, 3);
    addWeightedTokens(weights, cluster.workspaces, 1);
  }

  return weights;
}

function scoreCandidate(candidate: CatalogTriageCandidate, signalWeights: Map<string, number>): RankedCatalogCandidate {
  const title = candidate.title.toLowerCase();
  const category = candidate.category.toLowerCase();
  const description = candidate.description.toLowerCase();
  let score = 0;
  const matchedTerms: string[] = [];

  for (const [term, weight] of signalWeights) {
    let matched = false;
    if (title.includes(term)) {
      score += weight * 3;
      matched = true;
    }
    if (category.includes(term)) {
      score += weight * 2;
      matched = true;
    }
    if (description.includes(term)) {
      score += weight;
      matched = true;
    }
    if (matched) matchedTerms.push(term);
  }

  return {
    ...candidate,
    score,
    matchedTerms: matchedTerms.slice(0, 6),
  };
}

export function shortlistCatalogCandidates(
  candidates: CatalogTriageCandidate[],
  context: CatalogTriageContext,
  limit = 60,
): RankedCatalogCandidate[] {
  const signalWeights = buildSignalWeights(context);
  const ranked = candidates.map(candidate => scoreCandidate(candidate, signalWeights));
  const matched = ranked.filter(candidate => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));

  if (matched.length >= limit) return matched.slice(0, limit);

  const unmatched = ranked.filter(candidate => candidate.score === 0)
    .sort((left, right) => left.title.localeCompare(right.title));
  return [...matched, ...unmatched].slice(0, limit);
}

export function buildFallbackCatalogPicks(
  candidates: RankedCatalogCandidate[],
  maxItems = 5,
): Array<{ id: string; reason: string }> {
  return candidates
    .filter(candidate => candidate.score > 0)
    .slice(0, maxItems)
    .map(candidate => ({
      id: candidate.id,
      reason: candidate.matchedTerms.length > 0
        ? `Matched your repeated workflow signals: ${candidate.matchedTerms.slice(0, 3).join(', ')}.`
        : 'Matched the strongest repeated workflow signals found in your recent prompts.',
    }));
}