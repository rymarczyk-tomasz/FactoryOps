import { Block, BlockDraft, BlockStatus, Id, WorkCalendar } from './types';
import { endAfterShifts, firstWorkingShiftFrom, nearestShiftStart, shiftsForHours, SHIFT_HOURS, workingShiftsBetween } from './shifts';

/**
 * Układa bloczki jednej maszyny jeden za drugim: każdy zaczyna się na pierwszej pracującej zmianie
 * nie wcześniej niż jego własny start i koniec poprzedniego. Bloczki są tylko spychane do przodu,
 * nigdy cofane. `priorityId` wygrywa remis (bloczek upuszczony na miejsce innego wchodzi przed niego).
 */
function reflowMachine(blocks: Block[], calendar: WorkCalendar, priorityId?: Id): Block[] {
	const sorted = [...blocks].sort((a, b) => a.start - b.start || Number(b.id === priorityId) - Number(a.id === priorityId));
	let cursor = -Infinity;
	return sorted.map((block) => {
		const start = firstWorkingShiftFrom(Math.max(block.start, cursor), calendar);
		const end = endAfterShifts(start, shiftsForHours(block.hours), calendar);
		cursor = end;
		return block.start === start && block.end === end ? block : { ...block, start, end };
	});
}

export function reflow(blocks: Block[], calendar: WorkCalendar, priorityId?: Id): Block[] {
	const byMachine = new Map<Id, Block[]>();
	for (const block of blocks) {
		byMachine.set(block.machineId, [...(byMachine.get(block.machineId) ?? []), block]);
	}
	return [...byMachine.values()].flatMap((machineBlocks) => reflowMachine(machineBlocks, calendar, priorityId));
}

/** Moment, od którego można dopisać nowy bloczek na koniec kolejki maszyny. */
export function queueEnd(blocks: Block[], machineId: Id, calendar: WorkCalendar, now: number): number {
	const lastEnd = Math.max(-Infinity, ...blocks.filter((b) => b.machineId === machineId).map((b) => b.end));
	return firstWorkingShiftFrom(Math.max(lastEnd, now), calendar);
}

export function addBlock(blocks: Block[], draft: BlockDraft, id: Id, calendar: WorkCalendar, now: number): Block[] {
	const start = draft.start !== undefined ? nearestShiftStart(draft.start) : queueEnd(blocks, draft.machineId, calendar, now);
	const block: Block = { ...draft, id, start, end: start };
	return reflow([...blocks, block], calendar, id);
}

export function updateBlock(blocks: Block[], id: Id, patch: Partial<Omit<Block, 'id' | 'end'>>, calendar: WorkCalendar): Block[] {
	const updated = blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
	return reflow(updated, calendar, id);
}

export function moveBlock(blocks: Block[], id: Id, start: number, machineId: Id, calendar: WorkCalendar): Block[] {
	return updateBlock(blocks, id, { start: nearestShiftStart(start), machineId }, calendar);
}

/** Zmiana długości przez rozciągnięcie bloczka - długość ustawiana na pełne zmiany. */
export function resizeBlock(blocks: Block[], id: Id, end: number, calendar: WorkCalendar): Block[] {
	const block = blocks.find((b) => b.id === id);
	if (!block) return blocks;
	const shifts = Math.max(1, workingShiftsBetween(block.start, nearestShiftStart(end), calendar));
	return updateBlock(blocks, id, { hours: shifts * SHIFT_HOURS }, calendar);
}

export function removeBlock(blocks: Block[], id: Id): Block[] {
	return blocks.filter((b) => b.id !== id);
}

/** Usuwa przerwy między bloczkami maszyny - wszystko od pierwszego bloczka idzie jedno za drugim. */
export function compactMachine(blocks: Block[], machineId: Id, calendar: WorkCalendar): Block[] {
	const machineBlocks = blocks.filter((b) => b.machineId === machineId).sort((a, b) => a.start - b.start);
	if (machineBlocks.length === 0) return blocks;
	const first = machineBlocks[0].start;
	const packed = machineBlocks.map((b) => ({ ...b, start: first }));
	// sortowanie jest stabilne, więc kolejność zostaje zachowana
	return [...blocks.filter((b) => b.machineId !== machineId), ...reflowMachine(packed, calendar)];
}

export function blockStatus(block: Block, now: number): BlockStatus {
	if (block.end <= now) return 'done';
	if (block.start <= now) return 'in_progress';
	return 'planned';
}
