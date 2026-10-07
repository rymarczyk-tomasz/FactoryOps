import { describe, expect, it } from 'vitest';
import { capacityLookup, machineCalendar, machineDays, nonWorkingPeriods, nonWorkingSegments } from './calendar';
import { CapacityAt, endAfterWork, firstProductiveHourFrom, IsWorkingHour, nearestHourStart, nextHourStart, roundUpHours, shiftDayStart } from './shifts';
import { addBlock, compactMachine, moveBlock, previewMove, reflow, removeBlock, updateBlock } from './schedule';
import { Block, BlockDraft, Breakdown, Line, Machine, WorkCalendar } from './types';

// 2026-10-05 to poniedziałek, 2026-10-10/11 to weekend
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();
const plant: WorkCalendar = { overrides: {} };
const weekdays = machineCalendar(plant, { id: 'm1', name: 'M1' });
const weekdayDays = machineDays(plant, { id: 'm1', name: 'M1' });
/** Zwykła maszyna: pracuje (1) albo stoi (0). */
const single = (isWorkingHour: IsWorkingHour): CapacityAt => (h) => (isWorkingHour(h) ? 1 : 0);

const draft = (hours: number, machineId = 'm1'): BlockDraft => ({ machineId, orderNo: 'Z-1', projectNo: 'IMR-1', project: 'P', operation: 'Op', hours });

describe('godziny i doba', () => {
	it('zaokrągla czas w górę do pełnej godziny', () => {
		expect([0, 1, 1.5, 8, 8.2, 24].map(roundUpHours)).toEqual([1, 1, 2, 8, 9, 24]);
	});

	it('przyciąga do najbliższej pełnej godziny', () => {
		expect(nearestHourStart(at(6, 10, 29))).toBe(at(6, 10));
		expect(nearestHourStart(at(6, 10, 31))).toBe(at(6, 11));
	});

	it('następna pełna godzina - także o pełnej godzinie i przez północ', () => {
		expect(nextHourStart(at(6, 10, 1))).toBe(at(6, 11));
		expect(nextHourStart(at(6, 10))).toBe(at(6, 11));
		expect(nextHourStart(at(6, 23, 59))).toBe(at(7, 0));
	});

	it('doba zaczyna się o 6:00 - noc należy do dnia, w którym zaczęła się zmiana', () => {
		expect(shiftDayStart(at(6, 10))).toBe(at(6, 6));
		expect(shiftDayStart(at(7, 3))).toBe(at(6, 6));
		expect(shiftDayStart(at(7, 6))).toBe(at(7, 6));
	});
});

describe('kalendarz maszyny', () => {
	it('maszyna pon-pt kontynuuje zlecenie z piątku dopiero w poniedziałek', () => {
		expect(firstProductiveHourFrom(at(10, 10), single(weekdays))).toBe(at(12, 6));
		// pt 20:00 - sob 6:00 to 10 h (noc z piątku to jeszcze piątek), pozostałe 2 h w poniedziałek
		expect(endAfterWork(at(9, 20), 12, single(weekdays))).toBe(at(12, 8));
	});

	it('maszyna 4-brygadowa pracuje przez weekend', () => {
		const continuous = machineCalendar(plant, { id: 'm2', name: 'M2', workMode: 'continuous' });
		expect(endAfterWork(at(9, 20), 12, single(continuous))).toBe(at(10, 8));
	});

	it('niedziela pracująca tylko na jednej maszynie', () => {
		const sunday: Machine = { id: 'm1', name: 'M1', overrides: { '2026-10-11': true } };
		expect(firstProductiveHourFrom(at(10, 10), single(machineCalendar(plant, sunday)))).toBe(at(11, 6));
		expect(firstProductiveHourFrom(at(10, 10), single(machineCalendar(plant, { id: 'm2', name: 'M2' })))).toBe(at(12, 6));
	});

	it('wyjątek zakładu działa na wszystkie maszyny, a wyjątek maszyny ma pierwszeństwo', () => {
		const holiday: WorkCalendar = { overrides: { '2026-10-07': false } };
		const continuous: Machine = { id: 'm2', name: 'M2', workMode: 'continuous' };
		expect(firstProductiveHourFrom(at(7, 6), single(machineCalendar(holiday, continuous)))).toBe(at(8, 6));
		const exception: Machine = { ...continuous, overrides: { '2026-10-07': true } };
		expect(firstProductiveHourFrom(at(7, 6), single(machineCalendar(holiday, exception)))).toBe(at(7, 6));
	});

	it('sobota pracująca w wybranych godzinach na jednej maszynie', () => {
		const saturdayMachine: Machine = { id: 'm1', name: 'M1', overrides: { '2026-10-10': { from: 6, to: 18 } } };
		const saturday = machineCalendar(plant, saturdayMachine);
		// pt 20:00 - sob 6:00 = 10 h, sob 6:00-18:00 = 12 h, pozostałe 2 h w poniedziałek
		expect(endAfterWork(at(9, 20), 24, single(saturday))).toBe(at(12, 8));
		expect(firstProductiveHourFrom(at(10, 18), single(saturday))).toBe(at(12, 6));
		// zakreskowana tylko reszta soboty i niedziela
		expect(nonWorkingSegments(machineDays(plant, saturdayMachine), at(9, 20), at(12, 8))).toEqual([[at(10, 18), at(12, 6)]]);
	});

	it('godziny pracy przez północ (22:00-6:00) należą do doby, w której się zaczynają', () => {
		const night = machineCalendar(plant, { id: 'm1', name: 'M1', overrides: { '2026-10-10': { from: 22, to: 6 } } });
		expect(firstProductiveHourFrom(at(10, 7), single(night))).toBe(at(10, 22));
		expect(endAfterWork(at(10, 22), 8, single(night))).toBe(at(11, 6));
	});

	it('wycina wolny weekend z zakresu zlecenia', () => {
		// zlecenie pt 22:00 -> pon 14:00 na maszynie pon-pt: wolne od sob 6:00 do pon 6:00
		expect(nonWorkingSegments(weekdayDays, at(9, 22), at(12, 14))).toEqual([[at(10, 6), at(12, 6)]]);
		expect(nonWorkingSegments(weekdayDays, at(6, 6), at(8, 6))).toEqual([]);
	});

	it('wylicza wolne okresy z dokładnością do godziny, sklejając weekend', () => {
		// niedziela 4.10 trwa do pon 6:00, więc zahacza o początek zakresu (od 0:00)
		expect(nonWorkingPeriods(weekdayDays, at(5, 0), at(13, 0))).toEqual([
			[at(5, 0), at(5, 6)],
			[at(10, 6), at(12, 6)]
		]);
	});
});

describe('linie i awarie', () => {
	const members: Machine[] = ['a', 'b', 'c'].map((id) => ({ id, name: id.toUpperCase(), workMode: 'continuous' }));
	const line: Line = { id: 'l1', name: 'Linia 1', machineIds: ['a', 'b', 'c'] };
	const resources = (breakdowns: Breakdown[] = []) => ({ calendar: plant, machines: [...members, { id: 'm1', name: 'M1' }], lines: [line], breakdowns });
	const lineCapacity = (breakdowns: Breakdown[] = [], now = 0, blocks: Block[] = []) => capacityLookup(resources(breakdowns), now, blocks)('l1');
	const breakdown = (machineId: string, start: number, end?: number, id = machineId): Breakdown => ({ id, machineId, start, end });

	it('linia z 3 maszynami robi zlecenie 3 razy szybciej, z dokładnością do pełnej godziny', () => {
		expect(endAfterWork(at(5, 6), 30, lineCapacity())).toBe(at(5, 16));
		// 10 h pracy: 3 + 3 + 3 + 1 - czwarta godzina zaczęta, więc liczy się w całości
		expect(endAfterWork(at(5, 6), 10, lineCapacity())).toBe(at(5, 10));
	});

	it('awaria jednej maszyny linii spowalnia zlecenie na czas awarii', () => {
		// 6 h na 2 maszynach = 12 h pracy, pozostałe 18 h na 3 maszynach = 6 h
		expect(endAfterWork(at(5, 6), 30, lineCapacity([breakdown('b', at(5, 6), at(5, 12))]))).toBe(at(5, 18));
	});

	it('awaria dwóch maszyn linii - pracuje jedna', () => {
		// 6 h na 1 maszynie = 6 h pracy, pozostałe 24 h na 3 maszynach = 8 h
		expect(endAfterWork(at(5, 6), 30, lineCapacity([breakdown('a', at(5, 6), at(5, 12)), breakdown('c', at(5, 6), at(5, 12))]))).toBe(at(5, 20));
	});

	it('nakładające się awarie tej samej maszyny nie liczą się podwójnie', () => {
		const overlapping = [breakdown('b', at(5, 6), at(5, 12)), breakdown('b', at(5, 8), at(5, 10), 'b2')];
		expect(endAfterWork(at(5, 6), 30, lineCapacity(overlapping))).toBe(at(5, 18));
	});

	it('awaria wszystkich maszyn linii zatrzymuje zlecenie', () => {
		const all = ['a', 'b', 'c'].map((id) => breakdown(id, at(5, 8), at(5, 12)));
		expect(endAfterWork(at(5, 6), 30, lineCapacity(all))).toBe(at(5, 20));
	});

	it('awaria zwykłej maszyny przesuwa koniec zlecenia', () => {
		const capacity = capacityLookup(resources([breakdown('m1', at(5, 9), at(5, 12))]), 0)('m1');
		// 7-9 (2 h), postój 9-12, 12-18 (6 h)
		expect(endAfterWork(at(5, 7), 8, capacity)).toBe(at(5, 18));
	});

	it('trwająca awaria kończy się z bieżącą godziną i rośnie z upływem czasu', () => {
		const ongoing = [breakdown('m1', at(5, 9))];
		// o 10:30 maszyna stoi do 11:00, o 13:10 - do 14:00
		expect(endAfterWork(at(5, 7), 8, capacityLookup(resources(ongoing), at(5, 10, 30))('m1'))).toBe(at(5, 17));
		expect(endAfterWork(at(5, 7), 8, capacityLookup(resources(ongoing), at(5, 13, 10))('m1'))).toBe(at(5, 20));
	});

	it('maszyna linii zajęta własnym zleceniem nie pracuje na zlecenie linii', () => {
		const own: Block = { id: 'x', machineId: 'a', orderNo: 'X', projectNo: 'IMR-1', project: 'P', operation: 'Op', hours: 6, start: at(5, 6), end: at(5, 12) };
		// jak awaria jednej maszyny przez 6 h
		expect(endAfterWork(at(5, 6), 30, lineCapacity([], 0, [own]))).toBe(at(5, 18));
	});

	it('harmonogram układa najpierw zlecenia maszyn, potem linii na tym, co zostało', () => {
		const planned = addBlock([], { ...draft(30, 'l1'), start: at(5, 6) }, 'line', resources(), at(5, 6));
		expect(planned[0].end).toBe(at(5, 16));
		// zlecenie wstawione na maszynę linii wydłuża zlecenie linii
		const withOwn = addBlock(planned, { ...draft(6, 'a'), start: at(5, 6) }, 'own', resources(), at(5, 6));
		expect(withOwn.find((b) => b.id === 'line')!.end).toBe(at(5, 18));
		expect(withOwn.find((b) => b.id === 'own')).toMatchObject({ start: at(5, 6), end: at(5, 12) });
		// po usunięciu zlecenia maszyny linia znowu kończy wcześniej
		expect(removeBlock(withOwn, 'own', resources(), at(5, 6))[0].end).toBe(at(5, 16));
	});

	it('podgląd przeniesienia na linię uwzględnia zlecenia jej maszyn', () => {
		const blocks = [
			...addBlock([], { ...draft(6, 'a'), start: at(5, 6) }, 'own', resources(), at(5, 6)),
			...addBlock([], { ...draft(30, 'm1'), start: at(5, 6) }, 'moved', resources(), at(5, 6))
		];
		expect(previewMove(blocks, 'moved', at(5, 6), 'l1', resources(), at(5, 6))).toMatchObject({ start: at(5, 6), end: at(5, 18) });
	});
});

describe('harmonogram', () => {
	const now = at(5, 6, 40);
	const capacities = {
		calendar: plant,
		machines: [
			{ id: 'm1', name: 'M1' },
			{ id: 'm2', name: 'M2', workMode: 'continuous' as const }
		],
		lines: [],
		breakdowns: []
	};

	function plan(...hours: number[]): Block[] {
		return hours.reduce<Block[]>((blocks, h, i) => addBlock(blocks, draft(h), `b${i}`, capacities, now), []);
	}
	const startsById = (blocks: Block[]) => Object.fromEntries(blocks.map((b) => [b.id, b.start]));
	const byId = (blocks: Block[], id: string) => blocks.find((b) => b.id === id)!;

	it('dopisuje zlecenia na koniec kolejki maszyny, od najbliższej pełnej godziny', () => {
		const blocks = plan(8, 9.5, 8);
		expect(blocks.map((b) => [b.start, b.end])).toEqual([
			[at(5, 7), at(5, 15)],
			[at(5, 15), at(6, 1)],
			[at(6, 1), at(6, 9)]
		]);
	});

	it('przesunięcie zlecenia spycha następne', () => {
		// b0 opóźniony o 2 h
		const blocks = moveBlock(plan(8, 10, 8), 'b0', at(5, 9), 'm1', capacities);
		expect(startsById(blocks)).toEqual({ b0: at(5, 9), b1: at(5, 17), b2: at(6, 3) });
	});

	it('przeciągnięcie za następne zlecenie zmienia kolejność', () => {
		const blocks = moveBlock(plan(8, 10, 8), 'b0', at(6, 1), 'm1', capacities);
		expect(startsById(blocks)).toEqual({ b1: at(5, 15), b0: at(6, 1), b2: at(6, 9) });
	});

	it('wstawione między zlecenia zachowuje długość i spycha resztę', () => {
		const other = plan(24).map((b) => ({ ...b, id: 'x', machineId: 'm2' }));
		const blocks = moveBlock([...plan(8, 8, 8), ...other], 'x', at(5, 15), 'm1', capacities);
		expect([byId(blocks, 'x').start, byId(blocks, 'x').end]).toEqual([at(5, 15), at(6, 15)]);
		expect(startsById(blocks.filter((b) => b.id !== 'x'))).toEqual({ b0: at(5, 7), b1: at(6, 15), b2: at(6, 23) });
	});

	it('skrócenie zlecenia cofa następne', () => {
		const blocks = updateBlock(plan(8, 8, 8), 'b0', { hours: 4 }, capacities);
		expect(startsById(blocks)).toEqual({ b0: at(5, 7), b1: at(5, 11), b2: at(5, 19) });
	});

	it('start wpisany przy edycji przyciąga się do najbliższej pełnej godziny, jak przy dodawaniu', () => {
		// 10:20 -> 10:00; termin też na pełnej godzinie, nie 10:20
		const blocks = updateBlock(plan(8, 8), 'b1', { start: at(6, 10, 20) }, capacities);
		expect(byId(blocks, 'b1')).toMatchObject({ start: at(6, 10), pinnedStart: at(6, 10) });
		expect(addBlock([], { ...draft(8), start: at(6, 10, 20) }, 'n', capacities, now)[0].start).toBe(at(6, 10));
	});

	it('usunięcie zlecenia cofa następne na jego miejsce', () => {
		const blocks = removeBlock(plan(8, 8, 8), 'b1', capacities);
		expect(startsById(blocks)).toEqual({ b0: at(5, 7), b2: at(5, 15) });
	});

	it('cofające się zlecenie nie trafia w przeszłość', () => {
		// o 16:00 usuwamy b1 (15-23) - b2 nie może cofnąć się na 15:00, bo ta godzina już minęła
		const blocks = removeBlock(plan(8, 8, 8), 'b1', capacities, at(5, 16));
		expect(byId(blocks, 'b2').start).toBe(at(5, 16));
	});

	it('rozpoczęte zlecenie nie cofa się po skróceniu poprzedniego', () => {
		// o 17:00 b1 (15-23) już trwa - skrócenie b0 go nie przesuwa
		const blocks = updateBlock(plan(8, 8), 'b0', { hours: 4 }, capacities, at(5, 17));
		expect(byId(blocks, 'b1').start).toBe(at(5, 15));
	});

	it('zlecenie postawione celowo z przerwą trzyma termin, ale jest spychane, gdy poprzednie się wydłuży', () => {
		// b2 przeniesiony 13 h za koniec b1 - przerwa jest celowa
		let blocks = moveBlock(plan(8, 8, 8), 'b2', at(6, 12), 'm1', capacities);
		expect(byId(blocks, 'b2').pinnedStart).toBe(at(6, 12));
		blocks = updateBlock(blocks, 'b0', { hours: 4 }, capacities);
		expect(startsById(blocks)).toEqual({ b0: at(5, 7), b1: at(5, 11), b2: at(6, 12) });
		blocks = updateBlock(blocks, 'b1', { hours: 30 }, capacities);
		expect(byId(blocks, 'b2').start).toBe(at(6, 17));
	});

	it('upuszczone blisko końca poprzedniego zlecenia przykleja się do niego', () => {
		// koniec b1 o 23:00, upuszczone o 1:00 - 2 h przerwy to raczej niedokładne upuszczenie
		const blocks = moveBlock(plan(8, 8, 8), 'b2', at(6, 1), 'm1', capacities);
		expect(byId(blocks, 'b2')).toMatchObject({ start: at(5, 23) });
		expect(byId(blocks, 'b2').pinnedStart).toBeUndefined();
	});

	it('przeniesienie na inną maszynę liczy czas wg jej kalendarza', () => {
		// 24 h od piątku 14:00: na maszynie pon-pt 16 h do sob 6:00 i 8 h w poniedziałek, na 24/7 do soboty
		const friday = addBlock([], { ...draft(24), start: at(9, 14) }, 'f', capacities, now);
		expect(friday[0].end).toBe(at(12, 14));
		expect(moveBlock(friday, 'f', at(9, 14), 'm2', capacities)[0].end).toBe(at(10, 14));
	});

	it('podgląd przeniesienia pokazuje, między którymi zleceniami wyląduje zlecenie', () => {
		const blocks = plan(8, 8, 8);
		const preview = previewMove(blocks, 'b2', at(5, 15), 'm1', capacities);
		expect(preview).toMatchObject({ start: at(5, 15), end: at(5, 23), after: { id: 'b0' }, before: { id: 'b1' }, pinned: false });
		// podgląd nie zmienia planu
		expect(byId(blocks, 'b2').start).toBe(at(5, 23));
	});

	it('domknięcie przerw zdejmuje terminy', () => {
		const spread = moveBlock(plan(8, 8), 'b1', at(7, 6), 'm1', capacities);
		const blocks = compactMachine(spread, 'm1', capacities);
		expect(byId(blocks, 'b1').start).toBe(at(5, 15));
		expect(byId(blocks, 'b1').pinnedStart).toBeUndefined();
	});

	it('zmiana kalendarza przesuwa zlecenia z dnia wolnego', () => {
		const blocks = reflow(plan(8), { calendar: { overrides: { '2026-10-05': false } }, machines: [], lines: [], breakdowns: [] });
		expect(blocks[0].start).toBe(at(6, 6));
	});
});
