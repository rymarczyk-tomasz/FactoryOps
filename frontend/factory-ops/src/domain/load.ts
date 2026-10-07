import { capacityLookup, findLine, PlanResources } from './calendar';
import { addHours } from './shifts';
import { Block, Id } from './types';

/** Obciążenie maszyny lub linii w jednej dobie (6:00-6:00), w maszyno-godzinach. */
export interface DayLoad {
	dayStart: number;
	/** Ile maszyno-godzin było do dyspozycji (bez czasu wolnego i awarii). */
	available: number;
	/** Ile z nich zajmują zlecenia. */
	busy: number;
}

/** Jedna fizyczna maszyna: czy pracuje w danej godzinie i czy ma wtedy zlecenie. */
interface LoadUnit {
	works: (hourStart: number) => boolean;
	busy: (hourStart: number) => boolean;
}

const covers = (blocks: Block[]) => (hourStart: number) => blocks.some((b) => b.start <= hourStart && hourStart < b.end);

/**
 * Maszyny, z których liczymy obciążenie zasobu: zwykła maszyna to ona sama, linia - jej maszyny.
 * Maszyna linii jest zajęta, gdy ma własne zlecenie albo trwa zlecenie linii.
 */
export function loadUnits(resources: PlanResources, blocks: Block[], resourceId: Id, now: number): LoadUnit[] {
	const capacities = capacityLookup(resources, now);
	const line = findLine(resources.lines, resourceId);
	const lineBlocks = line ? blocks.filter((b) => b.machineId === line.id) : [];
	return (line ? line.machineIds : [resourceId]).map((machineId) => {
		const capacity = capacities(machineId);
		return { works: (h) => capacity(h) > 0, busy: covers([...lineBlocks, ...blocks.filter((b) => b.machineId === machineId)]) };
	});
}

export function dailyLoad(units: LoadUnit[], dayStart: number): DayLoad {
	const dayEnd = addHours(dayStart, 24);
	let available = 0;
	let busy = 0;
	for (let hour = dayStart; hour < dayEnd; hour = addHours(hour, 1)) {
		for (const unit of units) {
			if (!unit.works(hour)) continue;
			available += 1;
			if (unit.busy(hour)) busy += 1;
		}
	}
	return { dayStart, available, busy };
}

/** Zajętość w procentach; `undefined`, gdy maszyna w tej dobie w ogóle nie pracuje. */
export function loadPercent({ available, busy }: DayLoad): number | undefined {
	return available > 0 ? Math.round((busy / available) * 100) : undefined;
}
