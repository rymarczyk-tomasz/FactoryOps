import { Id } from './types';

interface Span {
	id: Id;
	start: number;
	end: number;
}

/** Nakładające się zlecenia, które nie mieszczą się w podwierszach - pokazywane razem jako „+N”. */
export interface LaneOverflow {
	ids: Id[];
	start: number;
	end: number;
}

export interface LaneLayout {
	/** Podwiersz (0…maxLanes-1) każdego pokazywanego zlecenia. */
	lanes: Map<Id, number>;
	overflow: LaneOverflow[];
	/** Ile podwierszy faktycznie potrzeba (najwyżej maxLanes). */
	laneCount: number;
}

/**
 * Rozkłada nakładające się zlecenia na podwiersze (bez zmiany ich dat). Gdy w jakimś czasie potrzeba więcej niż
 * `maxLanes` podwierszy, zlecenia z ostatniego i dalszych podwierszy w tym czasie łączą się w jedno „+N”.
 */
export function layoutLanes(spans: Span[], maxLanes = 3): LaneLayout {
	const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
	const laneEnds: number[] = [];
	const assigned = new Map<Id, number>();
	for (const span of sorted) {
		let lane = laneEnds.findIndex((end) => end <= span.start);
		if (lane < 0) lane = laneEnds.length;
		laneEnds[lane] = span.end;
		assigned.set(span.id, lane);
	}
	const last = maxLanes - 1;
	const lanes = new Map<Id, number>();
	const tail: Span[] = [];
	for (const span of sorted) {
		const lane = assigned.get(span.id)!;
		if (lane < last) lanes.set(span.id, lane);
		else tail.push(span);
	}
	// ostatni podwiersz: grupy nakładających się zleceń; grupa z nadmiarem staje się jednym „+N”
	const overflow: LaneOverflow[] = [];
	let group: Span[] = [];
	let groupEnd = -Infinity;
	const flush = () => {
		if (group.length === 0) return;
		if (group.every((s) => assigned.get(s.id) === last)) group.forEach((s) => lanes.set(s.id, last));
		else overflow.push({ ids: group.map((s) => s.id), start: group[0].start, end: groupEnd });
		group = [];
	};
	for (const span of tail) {
		if (span.start >= groupEnd) flush();
		group.push(span);
		groupEnd = group.length === 1 ? span.end : Math.max(groupEnd, span.end);
	}
	flush();
	return { lanes, overflow, laneCount: Math.min(maxLanes, laneEnds.length) };
}
