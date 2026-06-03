export interface CatalogSource {
	id?: string;
	name?: string;
	repository: string;
	url?: string;
	ref?: string;
}

export interface CatalogArea extends CatalogSource {
	id: string;
	name: string;
	url: string;
	packages?: string[];
}

export interface CatalogAreaPreferences {
	areas: CatalogArea[];
	selectedAreaId: string;
}