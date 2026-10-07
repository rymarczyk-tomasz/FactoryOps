import { resourceName } from './calendar';
import { ArchivedBlock, PlanState } from './types';

/** Zlecenia zakończone ponad tyle dni temu znikają z planu i trafiają do archiwum. */
export const ARCHIVE_AFTER_DAYS = 30;
const DAY = 24 * 3600_000;

/**
 * Przenosi do archiwum zlecenia zakończone ponad {@link ARCHIVE_AFTER_DAYS} dni temu. Plan zostaje lżejszy,
 * a historia jest dostępna na liście zleceń. Gdy nie ma czego archiwizować, zwraca ten sam stan.
 */
export function archiveOld(state: PlanState, now: number): PlanState {
	const before = now - ARCHIVE_AFTER_DAYS * DAY;
	const old = state.blocks.filter((b) => b.end <= before);
	if (old.length === 0) return state;
	const archived = old.map((b): ArchivedBlock => ({ ...b, machineName: resourceName(state, b.machineId), archivedAt: now }));
	return {
		...state,
		blocks: state.blocks.filter((b) => b.end > before),
		archive: [...(state.archive ?? []), ...archived]
	};
}
