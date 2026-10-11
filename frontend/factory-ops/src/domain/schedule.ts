import { capacityLookup, CapacityLookup, PlanResources } from './calendar';
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

function reflowEach(blocks: Block[], capacities: CapacityLookup, placement?: Placement, now?: number): Block[] {
	const byMachine = new Map<Id, Block[]>();
	for (const block of blocks) {
		if (block.machineId === null) continue;
		const queue = byMachine.get(block.machineId);
		if (queue) queue.push(block);
		else byMachine.set(block.machineId, [block]);
	}
	return [...byMachine.entries()].flatMap(([machineId, machineBlocks]) => reflowMachine(machineBlocks, capacities(machineId), placement, now));
}

/**
 * Układa plan. Najpierw zlecenia przypisane do maszyn, potem zlecenia linii - linia pracuje tylko
 * maszynami, które nie mają w danej godzinie własnego zlecenia, awarii ani czasu wolnego.
 * `scope` - maszyny/linie, których dotyczy zmiana: tylko ich kolejki (i linie z tymi maszynami) są liczone
 * od nowa, reszta zostaje bez zmian. Bez `scope` - cały plan. Bez `now` trwające awarie kończą się godzinę po starcie (testy).
 */
export function reflow(blocks: Block[], resources: PlanResources, placement?: Placement, now?: number, scope?: Iterable<Id>): Block[] {
	const lineIds = new Set(resources.lines.map((l) => l.id));
	const clock = now ?? 0;
	let affected: Set<Id> | undefined;
	if (scope) {
		affected = new Set(scope);
		// linia zależy od zleceń i awarii swoich maszyn
		for (const line of resources.lines) if (line.machineIds.some((id) => affected!.has(id))) affected.add(line.id);
	}
	const inScope = (b: Block) => !affected || (b.machineId !== null && affected.has(b.machineId));
	// zlecenia bez maszyny nie są planowane - czekają na przypisanie
	const unassigned = blocks.filter((b) => b.machineId === null);
	const machineBlocks = blocks.filter((b) => b.machineId !== null && !lineIds.has(b.machineId));
	const onMachines = [
		...machineBlocks.filter((b) => !inScope(b)),
		...reflowEach(machineBlocks.filter(inScope), capacityLookup(resources, clock), placement, now)
	];
	const lineBlocks = blocks.filter((b) => b.machineId !== null && lineIds.has(b.machineId));
	const onLines = [
		...lineBlocks.filter((b) => !inScope(b)),
		...reflowEach(lineBlocks.filter(inScope), capacityLookup(resources, clock, onMachines), placement, now)
	];
	return [...onMachines, ...onLines, ...unassigned];
}

/** Moment, od którego można dopisać nowe zlecenie na koniec kolejki maszyny lub linii. */
export function queueEnd(blocks: Block[], machineId: Id, resources: PlanResources, now: number): number {
	const lastEnd = Math.max(-Infinity, ...blocks.filter((b) => b.machineId === machineId).map((b) => b.end));
	return firstProductiveHourFrom(Math.max(lastEnd, now), capacityLookup(resources, now, blocks)(machineId));
}

export function addBlock(blocks: Block[], draft: BlockDraft, id: Id, resources: PlanResources, now: number): Block[] {
	const start = draft.start !== undefined ? nearestHourStart(draft.start) : queueEnd(blocks, draft.machineId, resources, now);
	const block: Block = { ...draft, id, start, end: start };
	return reflow([...blocks, block], resources, { id }, now, [draft.machineId]);
}

/**
 * Zlecenie `id` schodzi ze swojego miejsca (usunięte, przeniesione) - następne zlecenie tej samej maszyny
 * dostaje termin na swoim obecnym starcie, więc w planie zostaje przerwa. Domyka się ją przyciskiem (`closeGap`).
 */
function keepGapAfter(blocks: Block[], id: Id, now?: number): Block[] {
	const left = blocks.find((b) => b.id === id);
	if (!left || left.machineId === null) return blocks;
	const next = blocks
		.filter((b) => b.id !== id && b.machineId === left.machineId && b.start > left.start)
		.reduce<Block | undefined>((first, b) => (!first || b.start < first.start ? b : first), undefined);
	// zlecenie z terminem i rozpoczęte i tak się nie cofną
	if (!next || next.pinnedStart !== undefined || (now !== undefined && next.start < now)) return blocks;
	return blocks.map((b) => (b === next ? { ...b, pinnedStart: b.start } : b));
}

/** Przerwa (ms) przed zleceniem - od końca poprzedniego zlecenia tej samej maszyny lub linii; 0 - brak przerwy albo pierwsze w kolejce. */
export function gapBefore(blocks: Block[], id: Id): number {
	const block = blocks.find((b) => b.id === id);
	if (!block || block.machineId === null) return 0;
	const previousEnd = Math.max(-Infinity, ...blocks.filter((b) => b.machineId === block.machineId && b.start < block.start).map((b) => b.end));
	return previousEnd === -Infinity ? 0 : Math.max(0, block.start - previousEnd);
}

/** Domyka przerwę przed zleceniem - zdejmuje jego termin, zlecenie (i kolejne bez terminu) dosuwa się do poprzedniego. */
export function closeGap(blocks: Block[], id: Id, resources: PlanResources, now?: number): Block[] {
	const block = blocks.find((b) => b.id === id);
	if (!block || block.machineId === null || block.pinnedStart === undefined) return blocks;
	const unpinned = blocks.map((b) => {
		if (b !== block) return b;
		const next = { ...b };
		delete next.pinnedStart;
		return next;
	});
	return reflow(unpinned, resources, undefined, now, [block.machineId]);
}

export function updateBlock(
	blocks: Block[],
	id: Id,
	patch: Partial<Omit<Block, 'id' | 'end' | 'pinnedStart'>>,
	resources: PlanResources,
	now?: number
): Block[] {
	const current = blocks.find((b) => b.id === id);
	// start z formularza przyciągamy do pełnej godziny tak samo jak przy dodawaniu i przeciąganiu
	const start = patch.start !== undefined ? nearestHourStart(patch.start) : undefined;
	// nowe miejsce tylko przy zmianie startu lub maszyny - sama zmiana godzin czy opisu nie rusza terminu
	const moved = current && ((start !== undefined && start !== current.start) || (patch.machineId !== undefined && patch.machineId !== current.machineId));
	// miejsce po przeniesionym zleceniu zostaje puste
	const updated = (moved ? keepGapAfter(blocks, id, now) : blocks).map((b) => (b.id === id ? { ...b, ...patch, start: start ?? b.start } : b));
	const scope = [current?.machineId, patch.machineId].filter((m): m is Id => typeof m === 'string');
	return reflow(updated, resources, moved ? { id } : undefined, now, scope);
}

export function moveBlock(blocks: Block[], id: Id, start: number, machineId: Id, resources: PlanResources, now?: number): Block[] {
	const from = blocks.find((b) => b.id === id)?.machineId;
	const updated = keepGapAfter(blocks, id, now).map((b) => (b.id === id ? { ...b, start: nearestHourStart(start), machineId } : b));
	// zlecenie bez maszyny upuszczone na wiersz dostaje maszynę
	return reflow(updated, resources, { id, attachWithin: ATTACH_WITHIN_HOURS }, now, from ? [from, machineId] : [machineId]);
}

/** Przypisuje zlecenie (np. bez maszyny) do zasobu - na koniec jego kolejki, bez terminu. */
export function assignBlock(blocks: Block[], id: Id, machineId: Id, resources: PlanResources, now: number): Block[] {
	const current = blocks.find((b) => b.id === id);
	if (!current || current.machineId === machineId) return blocks;
	const others = blocks.filter((b) => b.id !== id);
	const start = queueEnd(others, machineId, resources, now);
	const updated = keepGapAfter(blocks, id, now).map((b) => (b.id === id ? { ...b, machineId, start } : b));
	return reflow(updated, resources, { id, attachWithin: Infinity }, now, [current.machineId, machineId].filter((m): m is Id => m !== null));
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
	resources: PlanResources,
	now?: number
): MovePreview | undefined {
	const moved = blocks.find((b) => b.id === id);
	if (!moved) return undefined;
	// wystarczy przeliczyć docelową maszynę, a dla linii - także zlecenia jej maszyn, które zajmują linię
	const affecting = new Set([machineId, ...(resources.lines.find((l) => l.id === machineId)?.machineIds ?? [])]);
	const subset = [...blocks.filter((b) => b.machineId !== null && affecting.has(b.machineId) && b.id !== id), moved];
	const result = moveBlock(subset, id, start, machineId, resources, now)
		.filter((b) => b.machineId === machineId)
		.sort((a, b) => a.start - b.start);
	const index = result.findIndex((b) => b.id === id);
	const placed = result[index];
	return { start: placed.start, end: placed.end, after: result[index - 1], before: result[index + 1], pinned: placed.pinnedStart !== undefined && index > 0 };
}

/** Usuwa zlecenie; na jego miejscu zostaje przerwa - kolejne zlecenia się nie cofają. */
export function removeBlock(blocks: Block[], id: Id, resources: PlanResources, now?: number): Block[] {
	const removed = blocks.find((b) => b.id === id);
	return reflow(
		keepGapAfter(blocks, id, now).filter((b) => b.id !== id),
		resources,
		undefined,
		now,
		removed?.machineId ? [removed.machineId] : []
	);
}

/** Usuwa przerwy między zleceniami maszyny - zdejmuje terminy, wszystko od pierwszego zlecenia idzie jedno za drugim. */
export function compactMachine(blocks: Block[], machineId: Id, resources: PlanResources, now?: number): Block[] {
	const machineBlocks = blocks.filter((b) => b.machineId === machineId).sort((a, b) => a.start - b.start);
	if (machineBlocks.length === 0) return blocks;
	const first = machineBlocks[0];
	const unpinned = blocks.map((b) => {
		if (b.machineId !== machineId || b === first || b.pinnedStart === undefined) return b;
		const next = { ...b };
		delete next.pinnedStart;
		return next;
	});
	return reflow(unpinned, resources, undefined, now, [machineId]);
}

export function blockStatus(block: Block, now: number): BlockStatus {
	if (block.machineId === null) return 'unassigned';
	if (block.end <= now) return 'done';
	if (block.start <= now) return 'in_progress';
	return 'planned';
}
