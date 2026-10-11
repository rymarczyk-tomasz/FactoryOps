import { useMemo } from 'react';
import { usePlan } from '../data/PlanContext';
import { LineConflict, lineConflicts } from '../domain/conflicts';

/** Niezakończone konflikty zleceń linii ze zleceniami jej maszyn (menu boczne i plan). */
export function useLineConflicts(): LineConflict[] {
	const { state, now } = usePlan();
	return useMemo(() => lineConflicts(state.blocks, state.lines, now), [state.blocks, state.lines, now]);
}
