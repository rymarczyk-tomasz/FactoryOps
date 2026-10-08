import { breakdownEnd, findLine, lineOfMachine, resourceName } from '../domain/calendar';
import { dailyLoad, DayLoad, loadPercent, loadUnits } from '../domain/load';
import { addBlock, removeBlock, updateBlock } from '../domain/schedule';
import { addHours } from '../domain/shifts';
import { Block, BlockDraft, Breakdown, Id, PlanState } from '../domain/types';

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

const HOUR = 3600_000;

/** „1 maszyna”, „3 maszyny”, „5 maszyn”. */
export function machinesLabel(n: number): string {
	if (n === 1) return '1 maszyna';
	const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
	return `${n} ${few ? 'maszyny' : 'maszyn'}`;
}

/** „1 kolejne zlecenie startuje”, „3 kolejne zlecenia startują”, „5 kolejnych zleceń startuje”. */
function nextOrdersLabel(n: number): string {
	if (n === 1) return '1 kolejne zlecenie startuje';
	const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
	return few ? `${n} kolejne zlecenia startują` : `${n} kolejnych zleceń startuje`;
}

/**
 * Skutek usunięcia zlecenia: które zlecenia i o ile ruszą się na każdym zasobie
 * („Linia 1 · 3 kolejne zlecenia startują 20 h wcześniej”). Liczone z różnicy przeliczenia planu przed i po.
 */
export function removalImpact(state: PlanState, id: Id, now: number): string[] {
	const after = new Map(removeBlock(state.blocks, id, state, now).map((b) => [b.id, b]));
	const shifts = new Map<Id, number[]>();
	for (const b of state.blocks) {
		const moved = after.get(b.id);
		if (!moved || moved.start === b.start) continue;
		shifts.set(b.machineId, [...(shifts.get(b.machineId) ?? []), (b.start - moved.start) / HOUR]);
	}
	return [...shifts].map(([resource, hours]) => {
		const max = Math.max(...hours.map(Math.abs));
		const direction = hours.every((h) => h > 0) ? 'wcześniej' : hours.every((h) => h < 0) ? 'później' : 'inaczej';
		const amount = `${hours.every((h) => Math.abs(h) === max) ? '' : 'do '}${Math.round(max)} h ${direction}`;
		return `${resourceName(state, resource)} · ${nextOrdersLabel(hours.length)} ${amount}`;
	});
}

export interface PlacementPreview {
	start: number;
	end: number;
	/** Zlecenie, po którym wyląduje szkic. */
	after?: Block;
	/** Zlecenie, przed którym wyląduje szkic. */
	before?: Block;
}

const PREVIEW_ID = '__preview__';

/**
 * Gdzie wyląduje zlecenie z formularza (bez zapisu): ta sama logika co przy dodawaniu/zapisie,
 * liczona tylko na zasobie docelowym (a dla linii - także na jej maszynach), jak podgląd przeciągania.
 */
export function previewPlacement(state: PlanState, draft: BlockDraft, now: number, editedId?: Id): PlacementPreview | undefined {
	const affecting = new Set([draft.machineId, ...(findLine(state.lines, draft.machineId)?.machineIds ?? [])]);
	const subset = state.blocks.filter((b) => affecting.has(b.machineId) || b.id === editedId);
	const id = editedId ?? PREVIEW_ID;
	const result = editedId ? updateBlock(subset, editedId, draft, state, now) : addBlock(subset, draft, id, state, now);
	const placed = result.filter((b) => b.machineId === draft.machineId).sort((a, b) => a.start - b.start);
	const index = placed.findIndex((b) => b.id === id);
	if (index < 0) return undefined;
	return { start: placed[index].start, end: placed[index].end, after: placed[index - 1], before: placed[index + 1] };
}
