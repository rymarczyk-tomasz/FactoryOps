import { addHours, dayKey, hourOfShiftDay, hourStartAtOrBefore, isWeekend, IsWorkingHour, SHIFT_START_HOURS, shiftDayStart } from './shifts';
import { DayOverride, Id, Machine, PlanState, WorkCalendar, WorkingHours, WorkMode } from './types';

export const WORK_MODE_LABELS: Record<WorkMode, string> = {
	weekdays: 'Pon–pt, 3 zmiany',
	continuous: '4-brygadowy, 24/7'
};

export function workMode(machine: Machine | undefined): WorkMode {
	return machine?.workMode ?? 'weekdays';
}

/** Zakres godzin jako przesunięcia od 6:00: [od, do), do w przedziale 1..24 (24 = 6:00 następnego dnia). */
function hoursRange({ from, to }: WorkingHours): [number, number] {
	const start = (from - SHIFT_START_HOURS[0] + 24) % 24;
	const end = (to - SHIFT_START_HOURS[0] + 24) % 24 || 24;
	return [start, end];
}

export function isValidWorkingHours(hours: WorkingHours): boolean {
	const [start, end] = hoursRange(hours);
	return end > start;
}

function overrideCoversHour(override: DayOverride, hourStart: number): boolean {
	if (typeof override === 'boolean') return override;
	const [start, end] = hoursRange(override);
	const hour = hourOfShiftDay(hourStart);
	return hour >= start && hour < end;
}

/**
 * Ustawienie dnia dla maszyny: wyjątek maszyny > wyjątek zakładu > system pracy maszyny.
 * `day` to dowolny moment doby (doba trwa od 6:00 do 6:00).
 */
export function effectiveDay(plant: WorkCalendar, machine: Machine | undefined, day: number): DayOverride {
	const date = new Date(shiftDayStart(day));
	const key = dayKey(date);
	return machine?.overrides?.[key] ?? plant.overrides[key] ?? (workMode(machine) === 'continuous' || !isWeekend(date));
}

export function machineCalendar(plant: WorkCalendar, machine: Machine | undefined): IsWorkingHour {
	return (hourStart) => overrideCoversHour(effectiveDay(plant, machine, hourStart), hourStart);
}

export type CalendarLookup = (machineId: Id) => IsWorkingHour;

export function calendarLookup({ calendar, machines }: Pick<PlanState, 'calendar' | 'machines'>): CalendarLookup {
	const byId = new Map(machines.map((m) => [m.id, machineCalendar(calendar, m)]));
	const fallback = machineCalendar(calendar, undefined);
	return (machineId) => byId.get(machineId) ?? fallback;
}

/** Wolne okresy maszyny w zakresie [from, to), z dokładnością do godziny; sąsiednie wolne godziny są sklejane. */
export function nonWorkingPeriods(isWorkingHour: IsWorkingHour, from: number, to: number): [number, number][] {
	const periods: [number, number][] = [];
	for (let hour = hourStartAtOrBefore(from); hour < to; ) {
		const next = addHours(hour, 1);
		if (!isWorkingHour(hour)) {
			const last = periods[periods.length - 1];
			if (last && last[1] === hour) last[1] = next;
			else periods.push([hour, next]);
		}
		hour = next;
	}
	return periods;
}

/** Wolne fragmenty wewnątrz [start, end) - np. weekend, przez który przechodzi zlecenie na maszynie pon-pt. */
export function nonWorkingSegments(isWorkingHour: IsWorkingHour, start: number, end: number): [number, number][] {
	return nonWorkingPeriods(isWorkingHour, start, end)
		.map(([from, to]): [number, number] => [Math.max(from, start), Math.min(to, end)])
		.filter(([from, to]) => from < to);
}

export function formatWorkingHours({ from, to }: WorkingHours): string {
	return `${from}:00–${to}:00`;
}
