import { addHours, CapacityAt } from './shifts';
import { Block } from './types';

/** Obciążenie maszyny w jednej dobie (6:00-6:00), w maszyno-godzinach. */
export interface DayLoad {
	dayStart: number;
	/** Ile maszyno-godzin było do dyspozycji (bez czasu wolnego i awarii). */
	available: number;
	/** Ile z nich zajmują zlecenia. */
	busy: number;
}

/** `blocks` - zlecenia jednej maszyny. Zlecenie zajmuje całą wydajność maszyny w godzinach, w których trwa. */
export function dailyLoad(blocks: Block[], capacityAt: CapacityAt, dayStart: number): DayLoad {
	const dayEnd = addHours(dayStart, 24);
	const overlapping = blocks.filter((b) => b.start < dayEnd && b.end > dayStart);
	let available = 0;
	let busy = 0;
	for (let hour = dayStart; hour < dayEnd; hour = addHours(hour, 1)) {
		const capacity = capacityAt(hour);
		available += capacity;
		if (overlapping.some((b) => b.start <= hour && hour < b.end)) busy += capacity;
	}
	return { dayStart, available, busy };
}

/** Zajętość w procentach; `undefined`, gdy maszyna w tej dobie w ogóle nie pracuje. */
export function loadPercent({ available, busy }: DayLoad): number | undefined {
	return available > 0 ? Math.round((busy / available) * 100) : undefined;
}
