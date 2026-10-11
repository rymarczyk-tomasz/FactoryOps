import { Block, PlanState } from './types';

/** Klucz projektu: numer (IMR-…), a gdy go brak - nazwa. */
export function projectKey(block: Pick<Block, 'projectNo' | 'project'>): string {
	return block.projectNo.trim() || block.project.trim();
}

/**
 * Stopnie / detale zapisane już w projekcie (bez powtórzeń, w kolejności naturalnej: „Stopień 2” przed „Stopień 10”) -
 * podpowiedzi w formularzu. Każdy stopień jest inny, więc podpowiadamy tylko z bieżącego projektu.
 */
export function projectOperations(blocks: Pick<Block, 'projectNo' | 'project' | 'operation'>[], key: string): string[] {
	const wanted = key.trim().toLowerCase();
	if (!wanted) return [];
	const names = blocks.filter((b) => projectKey(b).toLowerCase() === wanted).map((b) => b.operation.trim());
	return [...new Set(names.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl', { numeric: true }));
}

/** Zapisuje kolor projektu - zmienia wygląd wszystkich jego zleceń. Bez koloru lub klucza zwraca ten sam stan. */
export function withProjectColor(state: PlanState, key: string, color: string | undefined): PlanState {
	if (!key || !color || state.projects?.[key]?.color === color) return state;
	return { ...state, projects: { ...state.projects, [key]: { ...state.projects?.[key], color } } };
}
