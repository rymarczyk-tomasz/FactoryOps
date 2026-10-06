import { dayKey, isWeekend, IsWorkingDay, SHIFT_START_HOURS } from './shifts';
import { Id, Machine, PlanState, WorkCalendar, WorkMode } from './types';

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
	weekdays: 'Pon–pt, 3 zmiany',
	continuous: '4-brygadowy, 24/7'
};

export function workMode(machine: Machine | undefined): WorkMode {
	return machine?.workMode ?? 'weekdays';
}

/** Kolejność: wyjątek maszyny > wyjątek zakładu > system pracy maszyny. */
export function machineCalendar(plant: WorkCalendar, machine: Machine | undefined): IsWorkingDay {
	const mode = workMode(machine);
	return (date) => {
		const key = dayKey(date);
		return machine?.overrides?.[key] ?? plant.overrides[key] ?? (mode === 'continuous' || !isWeekend(date));
	};
}

export type CalendarLookup = (machineId: Id) => IsWorkingDay;

export function calendarLookup({ calendar, machines }: Pick<PlanState, 'calendar' | 'machines'>): CalendarLookup {
	const byId = new Map(machines.map((m) => [m.id, machineCalendar(calendar, m)]));
	const fallback = machineCalendar(calendar, undefined);
	return (machineId) => byId.get(machineId) ?? fallback;
}

/**
 * Wolne okresy maszyny w zakresie [from, to) jako [start, end] - doba liczona od 6:00 do 6:00,
 * kolejne wolne dni (np. sobota i niedziela) są sklejane w jeden okres.
 */
export function nonWorkingPeriods(isWorkingDay: IsWorkingDay, from: number, to: number): [number, number][] {
	const periods: [number, number][] = [];
	const first = new Date(from);
	const day = new Date(first.getFullYear(), first.getMonth(), first.getDate(), SHIFT_START_HOURS[0]);
	day.setDate(day.getDate() - 1);
	while (day.getTime() < to) {
		const start = day.getTime();
		const working = isWorkingDay(day);
		day.setDate(day.getDate() + 1);
		if (working) continue;
		const last = periods[periods.length - 1];
		if (last && last[1] === start) last[1] = day.getTime();
		else periods.push([start, day.getTime()]);
	}
	return periods;
}

/** Wolne fragmenty wewnątrz [start, end) - np. weekend, przez który przechodzi zlecenie na maszynie pon-pt. */
export function nonWorkingSegments(isWorkingDay: IsWorkingDay, start: number, end: number): [number, number][] {
	return nonWorkingPeriods(isWorkingDay, start, end)
		.map(([from, to]): [number, number] => [Math.max(from, start), Math.min(to, end)])
		.filter(([from, to]) => from < to);
}
