import { breakdownEnd, lineOfMachine } from '../domain/calendar';
import { dailyLoad, DayLoad, loadPercent, loadUnits } from '../domain/load';
import { addHours } from '../domain/shifts';
import { Block, Breakdown, Id, PlanState } from '../domain/types';

/**
 * Obciążenie zasobów (linie i wszystkie maszyny) w kolejnych dobach od `from` (6:00).
 * Liczymy tylko na zleceniach z tego okresu - plan ma ich tysiące.
 */
export function loadByDay(state: PlanState, now: number, from: number, days: number): Map<Id, DayLoad[]> {
	const to = addHours(from, 24 * days);
	const blocks = state.blocks.filter((b) => b.end > from && b.start < to);
	const dayStarts = Array.from({ length: days }, (_, i) => addHours(from, 24 * i));
	const result = new Map<Id, DayLoad[]>();
	for (const id of [...state.lines.map((l) => l.id), ...state.machines.map((m) => m.id)]) {
		const units = loadUnits(state, blocks, id, now);
		result.set(
			id,
			dayStarts.map((day) => dailyLoad(units, day))
		);
	}
	return result;
}

/** Zajętość w procentach z kilku dób razem; `undefined`, gdy w tym czasie nic nie pracuje. */
export function totalPercent(days: DayLoad[]): number | undefined {
	const total = days.reduce((sum, d) => ({ available: sum.available + d.available, busy: sum.busy + d.busy }), { available: 0, busy: 0 });
	return loadPercent({ dayStart: 0, ...total });
}

/**
 * Zlecenia, które awaria wydłuża: na jej maszynie albo na całej linii tej maszyny,
 * których czas [start, koniec] nachodzi na czas awarii (trwająca - do teraz).
 */
export function breakdownImpact(state: Pick<PlanState, 'blocks' | 'lines'>, breakdown: Breakdown, now: number): Block[] {
	const line = lineOfMachine(state.lines, breakdown.machineId);
	const end = breakdownEnd(breakdown, now);
	return state.blocks.filter((b) => (b.machineId === breakdown.machineId || b.machineId === line?.id) && b.start < end && b.end > breakdown.start);
}

/** „1 zlecenie”, „2 zlecenia”, „5 zleceń”. */
export function ordersLabel(n: number): string {
	if (n === 1) return '1 zlecenie';
	const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
	return `${n} ${few ? 'zlecenia' : 'zleceń'}`;
}
