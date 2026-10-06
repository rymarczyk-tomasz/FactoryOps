import { CalendarLookup } from './calendar';
import { endAfterHours, firstWorkingHourFrom, IsWorkingHour, nearestHourStart } from './shifts';
import { Block, BlockDraft, BlockStatus, Id } from './types';

/**
 * Układa bloczki jednej maszyny jeden za drugim: każdy zaczyna się w pierwszej pracującej godzinie
 * nie wcześniej niż jego własny start i koniec poprzedniego. Bloczki są tylko spychane do przodu,
 * nigdy cofane. `priorityId` wygrywa remis (bloczek upuszczony na miejsce innego wchodzi przed niego).
 */
function reflowMachine(blocks: Block[], isWorkingHour: IsWorkingHour, priorityId?: Id): Block[] {
	const sorted = [...blocks].sort((a, b) => a.start - b.start || Number(b.id === priorityId) - Number(a.id === priorityId));
	let cursor = -Infinity;
	return sorted.map((block) => {
		const start = firstWorkingHourFrom(Math.max(block.start, cursor), isWorkingHour);
		const end = endAfterHours(start, block.hours, isWorkingHour);
		cursor = end;
		return block.start === start && block.end === end ? block : { ...block, start, end };
	});
}

export function reflow(blocks: Block[], calendars: CalendarLookup, priorityId?: Id): Block[] {
	const byMachine = new Map<Id, Block[]>();
	for (const block of blocks) {
		byMachine.set(block.machineId, [...(byMachine.get(block.machineId) ?? []), block]);
	}
	return [...byMachine.entries()].flatMap(([machineId, machineBlocks]) => reflowMachine(machineBlocks, calendars(machineId), priorityId));
}

/** Moment, od którego można dopisać nowy bloczek na koniec kolejki maszyny. */
export function queueEnd(blocks: Block[], machineId: Id, calendars: CalendarLookup, now: number): number {
	const lastEnd = Math.max(-Infinity, ...blocks.filter((b) => b.machineId === machineId).map((b) => b.end));
	return firstWorkingHourFrom(Math.max(lastEnd, now), calendars(machineId));
}

export function addBlock(blocks: Block[], draft: BlockDraft, id: Id, calendars: CalendarLookup, now: number): Block[] {
	const start = draft.start !== undefined ? nearestHourStart(draft.start) : queueEnd(blocks, draft.machineId, calendars, now);
	const block: Block = { ...draft, id, start, end: start };
	return reflow([...blocks, block], calendars, id);
}

export function updateBlock(blocks: Block[], id: Id, patch: Partial<Omit<Block, 'id' | 'end'>>, calendars: CalendarLookup): Block[] {
	const updated = blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
	return reflow(updated, calendars, id);
}

export function moveBlock(blocks: Block[], id: Id, start: number, machineId: Id, calendars: CalendarLookup): Block[] {
	return updateBlock(blocks, id, { start: nearestHourStart(start), machineId }, calendars);
}

export interface MovePreview {
	start: number;
	end: number;
	/** Zlecenie, za którym wyląduje przenoszony bloczek. */
	after?: Block;
	/** Zlecenie, przed którym wyląduje przenoszony bloczek. */
	before?: Block;
}

/** Gdzie faktycznie wyląduje bloczek upuszczony w danym miejscu (podgląd w trakcie przeciągania). */
export function previewMove(blocks: Block[], id: Id, start: number, machineId: Id, calendars: CalendarLookup): MovePreview | undefined {
	const moved = blocks.find((b) => b.id === id);
	if (!moved) return undefined;
	// wystarczy przeliczyć docelową maszynę
	const machineBlocks = [...blocks.filter((b) => b.machineId === machineId && b.id !== id), moved];
	const result = moveBlock(machineBlocks, id, start, machineId, calendars).sort((a, b) => a.start - b.start);
	const index = result.findIndex((b) => b.id === id);
	return { start: result[index].start, end: result[index].end, after: result[index - 1], before: result[index + 1] };
}

export function removeBlock(blocks: Block[], id: Id): Block[] {
	return blocks.filter((b) => b.id !== id);
}

/** Usuwa przerwy między bloczkami maszyny - wszystko od pierwszego bloczka idzie jedno za drugim. */
export function compactMachine(blocks: Block[], machineId: Id, calendars: CalendarLookup): Block[] {
	const machineBlocks = blocks.filter((b) => b.machineId === machineId).sort((a, b) => a.start - b.start);
	if (machineBlocks.length === 0) return blocks;
	const first = machineBlocks[0].start;
	const packed = machineBlocks.map((b) => ({ ...b, start: first }));
	// sortowanie jest stabilne, więc kolejność zostaje zachowana
	return [...blocks.filter((b) => b.machineId !== machineId), ...reflowMachine(packed, calendars(machineId))];
}

export function blockStatus(block: Block, now: number): BlockStatus {
	if (block.end <= now) return 'done';
	if (block.start <= now) return 'in_progress';
	return 'planned';
}
