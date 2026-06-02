import type { CompanyCatalogItem } from '../core/types/company-catalog-types';

export const skillPackages = ['software-engineer', 'lead-engineer', 'architect', 'devops-engineer', 'automation-qa-engineer'];

export const CAPABILITY_GROUP_ALLOWLIST: Record<string, { collections: string[]; categories: string[] }> = {
  'software-engineer': {
    collections: ['software-engineer'],
    categories: ['Software Engineer'],
  },
  'lead-engineer': {
    collections: ['lead-engineer'],
    categories: ['Lead Engineer'],
  },
  architect: {
    collections: ['architect'],
    categories: ['Architect'],
  },
  'devops-engineer': {
    collections: ['devops-engineer'],
    categories: ['Devops Engineer'],
  },
  'automation-qa-engineer': {
    collections: ['automation-qa-engineer'],
    categories: ['Automation Qa Engineer'],
  },
};

function normalizeCapabilityValue(value: string | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replaceAll(/[-_]+/g, ' ')
    .replaceAll(/\s+/g, ' ');
}

function getCapabilityTokens(capabilityGroup: string): { collections: Set<string>; categories: Set<string> } | null {
  const normalizedGroup = normalizeCapabilityValue(capabilityGroup);
  if (!normalizedGroup) return null;

  const rule = CAPABILITY_GROUP_ALLOWLIST[capabilityGroup] || CAPABILITY_GROUP_ALLOWLIST[normalizedGroup.replaceAll(' ', '-')];
  if (!rule) return null;

  return {
    collections: new Set(rule.collections.map(collection => normalizeCapabilityValue(collection))),
    categories: new Set(rule.categories.map(category => normalizeCapabilityValue(category))),
  };
}

export function matchesCapabilityGroup(item: CompanyCatalogItem, capabilityGroup: string): boolean {
  if (!capabilityGroup) return true;

  const tokens = getCapabilityTokens(capabilityGroup);
  if (!tokens) return false;

  const collectionName = normalizeCapabilityValue(item.collectionName);
  const category = normalizeCapabilityValue(item.category);

  return tokens.collections.has(collectionName) || tokens.categories.has(category);
}