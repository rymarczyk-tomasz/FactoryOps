import { SortLevel, StartRange } from '../domain/listView';

/** Filtry i sortowanie listy zleceń zapisane pod nazwą (bez wyszukiwanego tekstu i archiwum). */
export interface ListFilters {
	statusTab: string;
	machineIds: string[];
	projectNos: string[];
	programmerIds: string[];
	readiness: string[];
	startRange: StartRange;
	sort: SortLevel[];
}

export interface ListView {
	id: string;
	name: string;
	filters: ListFilters;
}

const STORAGE_KEY = 'factoryops.listViews.v1';

/**
 * Widoki są ustawieniem tej przeglądarki - nie należą do planu, więc reset demo ich nie kasuje.
 * Uszkodzone lub niedostępne dane = brak zapisanych widoków.
 */
export function loadListViews(): ListView[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const views = raw ? (JSON.parse(raw) as ListView[]) : [];
		return Array.isArray(views) ? views : [];
	} catch {
		return [];
	}
}

export function saveListViews(views: ListView[]): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
	} catch {
		// np. tryb prywatny - widoki działają do odświeżenia strony
	}
}
