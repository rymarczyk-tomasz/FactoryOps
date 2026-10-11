import { Block, PlanState } from './types';

/** Klucz projektu: numer (IMR-…), a gdy go brak - nazwa. */
export function projectKey(block: Pick<Block, 'projectNo' | 'project'>): string {
	return block.projectNo.trim() || block.project.trim();
}

/** Zapisuje kolor projektu - zmienia wygląd wszystkich jego zleceń. Bez koloru lub klucza zwraca ten sam stan. */
export function withProjectColor(state: PlanState, key: string, color: string | undefined): PlanState {
	if (!key || !color || state.projects?.[key]?.color === color) return state;
	return { ...state, projects: { ...state.projects, [key]: { ...state.projects?.[key], color } } };
}
