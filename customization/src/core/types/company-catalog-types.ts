import type { CatalogDiscoverResult, CatalogItem, CatalogItemKind } from '../../../../src/core/types';

export interface CompanyCatalogItem extends CatalogItem {
  kind: CatalogItemKind;
  source?: string;
  repository?: string;
  owner?: string;
  repo?: string;
  ref?: string;
  areaName?: string;
  collectionName?: string;
}

export interface CompanyCatalogDiscoverResult extends Omit<CatalogDiscoverResult, 'items'> {
  items: CompanyCatalogItem[];
}