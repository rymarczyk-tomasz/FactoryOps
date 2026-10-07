import { addHours, CapacityAt, dayKey, hourOfShiftDay, isWeekend, IsWorkingHour, nextHourStart, SHIFT_START_HOURS, shiftDayStart } from './shifts';
import { Block, Breakdown, DayOverride, Id, Line, Machine, PlanState, WorkCalendar, WorkingHours, WorkMode } from './types';

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

/** Zasoby planu, od których zależy czas zleceń. */
export type PlanResources = Pick<PlanState, 'calendar' | 'machines' | 'lines' | 'breakdowns'>;

export function findLine(lines: Line[], id: Id | undefined): Line | undefined {
	return lines.find((l) => l.id === id);
}

/** Linia, do której należy maszyna. */
export function lineOfMachine(lines: Line[], machineId: Id): Line | undefined {
	return lines.find((l) => l.machineIds.includes(machineId));
}

/** Maszyny linii w jej kolejności (pomija nieistniejące). */
export function lineMachines(line: Line, machines: Machine[]): Machine[] {
	const byId = new Map(machines.map((m) => [m.id, m]));
	return line.machineIds.map((id) => byId.get(id)).filter((m): m is Machine => m !== undefined);
}

/** Maszyny bez linii. */
export function standaloneMachines({ machines, lines }: Pick<PlanState, 'machines' | 'lines'>): Machine[] {
	const inLines = new Set(lines.flatMap((l) => l.machineIds));
	return machines.filter((m) => !inLines.has(m.id));
}

/** Nazwa maszyny lub linii. */
export function resourceName({ machines, lines }: Pick<PlanState, 'machines' | 'lines'>, id: Id | undefined): string {
	return machines.find((m) => m.id === id)?.name ?? findLine(lines, id)?.name ?? '';
}

/** Koniec awarii; trwająca kończy się z końcem bieżącej godziny i rośnie razem z upływem czasu. */
export function breakdownEnd(breakdown: Breakdown, now: number): number {
	return breakdown.end ?? Math.max(nextHourStart(now), addHours(breakdown.start, 1));
}

export function isOngoing(breakdown: Breakdown): boolean {
	return breakdown.end === undefined;
}

/** Czy maszyna pracuje w danej godzinie (1) czy stoi przez czas wolny lub awarię (0). */
export function machineCapacity(plant: WorkCalendar, machine: Machine, breakdowns: Breakdown[], now: number): CapacityAt {
	const isWorkingHour = machineCalendar(plant, machine);
	const own = breakdowns.filter((b) => b.machineId === machine.id).map((b): [number, number] => [b.start, breakdownEnd(b, now)]);
	return (hourStart) => (isWorkingHour(hourStart) && !own.some(([start, end]) => start <= hourStart && hourStart < end) ? 1 : 0);
}

export type CapacityLookup = (resourceId: Id) => CapacityAt;

/**
 * Wydajność maszyny (0/1) albo linii (ile jej maszyn pracuje). `blocks` - już ułożone zlecenia przypisane
 * bezpośrednio do maszyn: maszyna linii zajęta własnym zleceniem nie pracuje wtedy na zlecenia linii.
 */
export function capacityLookup(resources: PlanResources, now: number, blocks: Block[] = []): CapacityLookup {
	const byMachine = new Map(resources.machines.map((m) => [m.id, machineCapacity(resources.calendar, m, resources.breakdowns, now)]));
	const busy = new Map<Id, [number, number][]>();
	for (const block of blocks) busy.set(block.machineId, [...(busy.get(block.machineId) ?? []), [block.start, block.end]]);
	const byLine = new Map(
		resources.lines.map((line): [Id, CapacityAt] => {
			const members = line.machineIds
				.filter((id) => byMachine.has(id))
				.map((id) => ({ capacity: byMachine.get(id)!, busy: busy.get(id) ?? [] }));
			return [
				line.id,
				(hourStart) => members.reduce((sum, m) => sum + (m.capacity(hourStart) > 0 && !m.busy.some(([s, e]) => s <= hourStart && hourStart < e) ? 1 : 0), 0)
			];
		})
	);
	const fallback = machineCalendar(resources.calendar, undefined);
	return (id) => byMachine.get(id) ?? byLine.get(id) ?? ((hourStart) => (fallback(hourStart) ? 1 : 0));
}

/**
 * Godziny pracy w dobie (od 6:00 do 6:00) jako przesunięcia od 6:00, np. [[0, 12]] dla 6:00-18:00;
 * puste - dzień wolny. Liczone raz na dobę, dzięki czemu tło planu (dni wolne) rysuje się szybko.
 */
export type DayRanges = (dayStart: number) => [number, number][];

function overrideRanges(override: DayOverride): [number, number][] {
	if (override === true) return [[0, 24]];
	if (override === false) return [];
	return [hoursRange(override)];
}

export function machineDays(plant: WorkCalendar, machine: Machine | undefined): DayRanges {
	return (dayStart) => overrideRanges(effectiveDay(plant, machine, dayStart));
}

/** Sumuje przedziały godzin (np. kilku maszyn linii) w posortowane, rozłączne przedziały. */
function mergeRanges(ranges: [number, number][]): [number, number][] {
	const merged: [number, number][] = [];
	for (const [from, to] of [...ranges].sort((x, y) => x[0] - y[0])) {
		const last = merged[merged.length - 1];
		if (last && from <= last[1]) last[1] = Math.max(last[1], to);
		else merged.push([from, to]);
	}
	return merged;
}

export type CalendarLookup = (resourceId: Id) => DayRanges;

/** Godziny pracy maszyny; linia pracuje, gdy pracuje którakolwiek jej maszyna. */
export function calendarLookup({ calendar, machines, lines }: Pick<PlanState, 'calendar' | 'machines' | 'lines'>): CalendarLookup {
	const byMachine = new Map(machines.map((m) => [m.id, machineDays(calendar, m)]));
	const byLine = new Map(
		lines.map((line): [Id, DayRanges] => {
			const members = line.machineIds.map((id) => byMachine.get(id)).filter((d): d is DayRanges => d !== undefined);
			return [line.id, (dayStart) => mergeRanges(members.flatMap((days) => days(dayStart)))];
		})
	);
	const fallback = machineDays(calendar, undefined);
	return (id) => byMachine.get(id) ?? byLine.get(id) ?? fallback;
}

/** Wolne okresy w zakresie [from, to), z dokładnością do godziny; sąsiednie wolne okresy są sklejane. */
export function nonWorkingPeriods(days: DayRanges, from: number, to: number): [number, number][] {
	const periods: [number, number][] = [];
	const add = (start: number, end: number) => {
		const clippedStart = Math.max(start, from);
		const clippedEnd = Math.min(end, to);
		if (clippedStart >= clippedEnd) return;
		const last = periods[periods.length - 1];
		if (last && last[1] === clippedStart) last[1] = clippedEnd;
		else periods.push([clippedStart, clippedEnd]);
	};
	for (let day = shiftDayStart(from); day < to; day = addHours(day, 24)) {
		let cursor = 0;
		for (const [start, end] of days(day)) {
			if (start > cursor) add(addHours(day, cursor), addHours(day, start));
			cursor = Math.max(cursor, end);
		}
		if (cursor < 24) add(addHours(day, cursor), addHours(day, 24));
	}
	return periods;
}

/** Wolne fragmenty wewnątrz [start, end) - np. weekend, przez który przechodzi zlecenie na maszynie pon-pt. */
export function nonWorkingSegments(days: DayRanges, start: number, end: number): [number, number][] {
	return nonWorkingPeriods(days, start, end);
}

export function formatWorkingHours({ from, to }: WorkingHours): string {
	return `${from}:00–${to}:00`;
}

export function describeDay(day: DayOverride): string {
	if (day === true) return 'Dzień pracujący';
	if (day === false) return 'Dzień wolny';
	return `Pracuje ${formatWorkingHours(day)}`;
}
