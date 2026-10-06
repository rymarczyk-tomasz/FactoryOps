import { CalendarLookup } from './calendar';
import { endAfterShifts, firstWorkingShiftFrom, IsWorkingDay, nearestShiftStart, shiftsForHours } from './shifts';
import { Block, BlockDraft, BlockStatus, Id } from './types';

/**
 * Układa bloczki jednej maszyny jeden za drugim: każdy zaczyna się na pierwszej pracującej zmianie
 * nie wcześniej niż jego własny start i koniec poprzedniego. Bloczki są tylko spychane do przodu,
 * nigdy cofane. `priorityId` wygrywa remis (bloczek upuszczony na miejsce innego wchodzi przed niego).
 */
function reflowMachine(blocks: Block[], isWorkingDay: IsWorkingDay, priorityId?: Id): Block[] {
	const sorted = [...blocks].sort((a, b) => a.start - b.start || Number(b.id === priorityId) - Number(a.id === priorityId));
	let cursor = -Infinity;
	return sorted.map((block) => {
		const start = firstWorkingShiftFrom(Math.max(block.start, cursor), isWorkingDay);
		const end = endAfterShifts(start, shiftsForHours(block.hours), isWorkingDay);
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
	return firstWorkingShiftFrom(Math.max(lastEnd, now), calendars(machineId));
}

export function addBlock(blocks: Block[], draft: BlockDraft, id: Id, calendars: CalendarLookup, now: number): Block[] {
	const start = draft.start !== undefined ? nearestShiftStart(draft.start) : queueEnd(blocks, draft.machineId, calendars, now);
	const block: Block = { ...draft, id, start, end: start };
	return reflow([...blocks, block], calendars, id);
}

export function updateBlock(blocks: Block[], id: Id, patch: Partial<Omit<Block, 'id' | 'end'>>, calendars: CalendarLookup): Block[] {
	const updated = blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
	return reflow(updated, calendars, id);
}

export function moveBlock(blocks: Block[], id: Id, start: number, machineId: Id, calendars: CalendarLookup): Block[] {
	return updateBlock(blocks, id, { start: nearestShiftStart(start), machineId }, calendars);
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
