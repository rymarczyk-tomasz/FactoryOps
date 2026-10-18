import { Block, Id, Line } from './types';

/**
 * Zlecenie linii i własne zlecenie jednej z jej maszyn w tym samym czasie. Harmonogram wtedy liczy linię
 * na mniejszej liczbie maszyn, ale planista powinien to widzieć - zwykle to pomyłka albo świadome wyjęcie maszyny z linii.
 */
export interface LineConflict {
	lineId: Id;
	machineId: Id;
	lineBlockId: Id;
	machineBlockId: Id;
	/** Wspólny czas obu zleceń [from, to). */
	from: number;
	to: number;
}

const byStart = (a: Block, b: Block) => a.start - b.start;

/** Konflikty kończące się po `since` (domyślnie wszystkie), posortowane od najwcześniejszego. */
export function lineConflicts(blocks: Block[], lines: Line[], since = -Infinity): LineConflict[] {
	const byResource = new Map<Id, Block[]>();
	for (const block of blocks) {
		if (block.machineId === null || block.end <= since) continue;
		const list = byResource.get(block.machineId);
		if (list) list.push(block);
		else byResource.set(block.machineId, [block]);
	}
	const conflicts: LineConflict[] = [];
	for (const line of lines) {
		const lineBlocks = (byResource.get(line.id) ?? []).sort(byStart);
		if (lineBlocks.length === 0) continue;
		for (const machineId of line.machineIds) {
			const machineBlocks = (byResource.get(machineId) ?? []).sort(byStart);
			// oba ciągi są posortowane i w każdym zlecenia nie nachodzą na siebie - wystarczy jeden przebieg
			let i = 0;
			let j = 0;
			while (i < lineBlocks.length && j < machineBlocks.length) {
				const l = lineBlocks[i];
				const m = machineBlocks[j];
				const from = Math.max(l.start, m.start);
				const to = Math.min(l.end, m.end);
				if (from < to && to > since) conflicts.push({ lineId: line.id, machineId, lineBlockId: l.id, machineBlockId: m.id, from, to });
				if (l.end <= m.end) i++;
				else j++;
			}
		}
	}
	return conflicts.sort((a, b) => a.from - b.from);
}

/** Odejmuje przedziały `cuts` od [start, end) - zostają kawałki, w których nic ich nie zajmuje. */
export function subtractIntervals(start: number, end: number, cuts: [number, number][]): [number, number][] {
	const result: [number, number][] = [];
	let cursor = start;
	for (const [from, to] of [...cuts].sort((a, b) => a[0] - b[0])) {
		if (to <= cursor || from >= end) continue;
		if (from > cursor) result.push([cursor, from]);
		cursor = Math.max(cursor, to);
		if (cursor >= end) break;
	}
	if (cursor < end) result.push([cursor, end]);
	return result;
}
