import { addHours, CapacityAt, dayKey, hourOfShiftDay, hourStartAtOrBefore, isWeekend, IsWorkingHour, SHIFT_START_HOURS, shiftDayStart } from './shifts';
import { Breakdown, DayOverride, Id, Machine, PlanState, WorkCalendar, WorkingHours, WorkMode } from './types';

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
	// ustawienie dnia liczymy raz na dobę - plan sprawdza dziesiątki tysięcy godzin
	const days = new Map<number, DayOverride>();
	return (hourStart) => {
		const day = shiftDayStart(hourStart);
		let override = days.get(day);
		if (override === undefined) {
			override = effectiveDay(plant, machine, day);
			days.set(day, override);
		}
		return overrideCoversHour(override, hourStart);
	};
}

export function unitCount(machine: Machine | undefined): number {
	return machine?.lineMachines?.length || 1;
}

export function isLine(machine: Machine | undefined): boolean {
	return unitCount(machine) > 1;
}

/** Nazwa maszyny linii (np. przy awarii); bez nazwy - M1, M2, M3. */
export function unitLabel(machine: Machine | undefined, unit: number): string {
	return machine?.lineMachines?.[unit] || `M${unit + 1}`;
}

/** Awarie maszyny trwające w danej godzinie. */
export function breakdownsAt(breakdowns: Breakdown[], machineId: Id, hourStart: number): Breakdown[] {
	return breakdowns.filter((b) => b.machineId === machineId && b.start <= hourStart && hourStart < b.end);
}

/** Ile maszyn pracuje w danej godzinie: 0 w czasie wolnym, mniej niż komplet podczas awarii części linii. */
export function machineCapacity(plant: WorkCalendar, machine: Machine, breakdowns: Breakdown[]): CapacityAt {
	const isWorkingHour = machineCalendar(plant, machine);
	const units = unitCount(machine);
	const own = breakdowns.filter((b) => b.machineId === machine.id);
	return (hourStart) => {
		if (!isWorkingHour(hourStart)) return 0;
		if (own.length === 0) return units;
		const down = new Set(own.filter((b) => b.start <= hourStart && hourStart < b.end).flatMap((b) => b.units));
		return Math.max(0, units - down.size);
	};
}

export type CapacityLookup = (machineId: Id) => CapacityAt;

export function capacityLookup({ calendar, machines, breakdowns }: Pick<PlanState, 'calendar' | 'machines' | 'breakdowns'>): CapacityLookup {
	const byId = new Map(machines.map((m) => [m.id, machineCapacity(calendar, m, breakdowns)]));
	const fallback = machineCalendar(calendar, undefined);
	return (machineId) => byId.get(machineId) ?? ((hourStart) => (fallback(hourStart) ? 1 : 0));
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
