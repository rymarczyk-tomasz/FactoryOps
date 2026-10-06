import { CapacityLookup } from './calendar';
import { CapacityAt, endAfterWork, firstProductiveHourFrom, nearestHourStart } from './shifts';
import { Block, BlockDraft, BlockStatus, Id } from './types';

const HOUR = 3600_000;
/** Upuszczone tak blisko końca poprzedniego zlecenia „przykleja się” do niego zamiast zostawiać przerwę. */
export const ATTACH_WITHIN_HOURS = 3;

/** Zlecenie postawione w nowym miejscu (dodane, przeniesione, ze zmienionym startem). */
interface Placement {
	id: Id;
	/** Przerwa krótsza niż tyle godzin nie jest traktowana jako celowa. */
	attachWithin?: number;
}

/**
 * Układa zlecenia jednej maszyny jedno za drugim. Zlecenie bez terminu (`pinnedStart`) zaczyna się zaraz
 * po poprzednim - przesuwa się z kolejką w obie strony. Zlecenie z terminem nie startuje przed nim, ale jest
 * spychane, gdy poprzednie się wydłuży. Pierwsze zlecenie maszyny trzyma swój start.
 * Z `now`: zlecenie, które się jeszcze nie zaczęło, nie trafi przed `now`, a rozpoczęte nie cofa się.
 */
function reflowMachine(blocks: Block[], capacityAt: CapacityAt, placement?: Placement, now?: number): Block[] {
	const placedId = placement?.id;
	const sorted = [...blocks].sort((a, b) => a.start - b.start || Number(b.id === placedId) - Number(a.id === placedId));
	let cursor: number | undefined;
	return sorted.map((block) => {
		let pinnedStart = block.pinnedStart;
		if (block.id === placedId) {
			// przerwa przed upuszczonym zleceniem jest celowa tylko wtedy, gdy jest wyraźna
			const gap = cursor === undefined ? Infinity : block.start - cursor;
			pinnedStart = gap > (placement?.attachWithin ?? 0) * HOUR ? block.start : undefined;
		}
		const started = now !== undefined && block.id !== placedId && block.start < now;
		const anchor = started ? block.start : (pinnedStart ?? cursor ?? block.start);
		const notBefore = now === undefined || started ? -Infinity : now;
		const start = firstProductiveHourFrom(Math.max(anchor, cursor ?? -Infinity, notBefore), capacityAt);
		const end = endAfterWork(start, block.hours, capacityAt);
		cursor = end;
		if (block.start === start && block.end === end && block.pinnedStart === pinnedStart) return block;
		const next = { ...block, start, end, pinnedStart };
		if (pinnedStart === undefined) delete next.pinnedStart;
		return next;
	});
}

export function reflow(blocks: Block[], capacities: CapacityLookup, placement?: Placement, now?: number): Block[] {
	const byMachine = new Map<Id, Block[]>();
	for (const block of blocks) {
		byMachine.set(block.machineId, [...(byMachine.get(block.machineId) ?? []), block]);
	}
	return [...byMachine.entries()].flatMap(([machineId, machineBlocks]) => reflowMachine(machineBlocks, capacities(machineId), placement, now));
}

/** Moment, od którego można dopisać nowe zlecenie na koniec kolejki maszyny. */
export function queueEnd(blocks: Block[], machineId: Id, capacities: CapacityLookup, now: number): number {
	const lastEnd = Math.max(-Infinity, ...blocks.filter((b) => b.machineId === machineId).map((b) => b.end));
	return firstProductiveHourFrom(Math.max(lastEnd, now), capacities(machineId));
}

export function addBlock(blocks: Block[], draft: BlockDraft, id: Id, capacities: CapacityLookup, now: number): Block[] {
	const start = draft.start !== undefined ? nearestHourStart(draft.start) : queueEnd(blocks, draft.machineId, capacities, now);
	const block: Block = { ...draft, id, start, end: start };
	return reflow([...blocks, block], capacities, { id }, now);
}

export function updateBlock(
	blocks: Block[],
	id: Id,
	patch: Partial<Omit<Block, 'id' | 'end' | 'pinnedStart'>>,
	capacities: CapacityLookup,
	now?: number
): Block[] {
	const current = blocks.find((b) => b.id === id);
	// start z formularza przyciągamy do pełnej godziny tak samo jak przy dodawaniu i przeciąganiu
	const start = patch.start !== undefined ? nearestHourStart(patch.start) : undefined;
	const updated = blocks.map((b) => (b.id === id ? { ...b, ...patch, start: start ?? b.start } : b));
	// nowe miejsce tylko przy zmianie startu lub maszyny - sama zmiana godzin czy opisu nie rusza terminu
	const moved = current && ((start !== undefined && start !== current.start) || (patch.machineId !== undefined && patch.machineId !== current.machineId));
	return reflow(updated, capacities, moved ? { id } : undefined, now);
}

export function moveBlock(blocks: Block[], id: Id, start: number, machineId: Id, capacities: CapacityLookup, now?: number): Block[] {
	const updated = blocks.map((b) => (b.id === id ? { ...b, start: nearestHourStart(start), machineId } : b));
	return reflow(updated, capacities, { id, attachWithin: ATTACH_WITHIN_HOURS }, now);
}

export interface MovePreview {
	start: number;
	end: number;
	/** Zlecenie, za którym wyląduje przenoszone zlecenie. */
	after?: Block;
	/** Zlecenie, przed którym wyląduje przenoszone zlecenie. */
	before?: Block;
	/** Czy zostanie przerwa przed zleceniem (zlecenie dostanie termin). */
	pinned: boolean;
}

/** Gdzie faktycznie wyląduje zlecenie upuszczone w danym miejscu (podgląd w trakcie przeciągania). */
export function previewMove(
	blocks: Block[],
	id: Id,
	start: number,
	machineId: Id,
	capacities: CapacityLookup,
	now?: number
): MovePreview | undefined {
	const moved = blocks.find((b) => b.id === id);
	if (!moved) return undefined;
	// wystarczy przeliczyć docelową maszynę
	const machineBlocks = [...blocks.filter((b) => b.machineId === machineId && b.id !== id), moved];
	const result = moveBlock(machineBlocks, id, start, machineId, capacities, now).sort((a, b) => a.start - b.start);
	const index = result.findIndex((b) => b.id === id);
	const placed = result[index];
	return { start: placed.start, end: placed.end, after: result[index - 1], before: result[index + 1], pinned: placed.pinnedStart !== undefined && index > 0 };
}

/** Usuwa zlecenie; kolejne zlecenia bez terminu cofają się na jego miejsce. */
export function removeBlock(blocks: Block[], id: Id, capacities: CapacityLookup, now?: number): Block[] {
	return reflow(
		blocks.filter((b) => b.id !== id),
		capacities,
		undefined,
		now
	);
}

/** Usuwa przerwy między zleceniami maszyny - zdejmuje terminy, wszystko od pierwszego zlecenia idzie jedno za drugim. */
export function compactMachine(blocks: Block[], machineId: Id, capacities: CapacityLookup, now?: number): Block[] {
	const machineBlocks = blocks.filter((b) => b.machineId === machineId).sort((a, b) => a.start - b.start);
	if (machineBlocks.length === 0) return blocks;
	const unpinned = machineBlocks.map((b, i) => {
		if (i === 0 || b.pinnedStart === undefined) return b;
		const next = { ...b };
		delete next.pinnedStart;
		return next;
	});
	return [...blocks.filter((b) => b.machineId !== machineId), ...reflowMachine(unpinned, capacities(machineId), undefined, now)];
}

export function blockStatus(block: Block, now: number): BlockStatus {
	if (block.end <= now) return 'done';
	if (block.start <= now) return 'in_progress';
	return 'planned';
}
