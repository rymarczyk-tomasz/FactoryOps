import { describe, expect, it } from 'vitest';
import { calendarLookup, machineCalendar, nonWorkingPeriods } from './calendar';
import { endAfterShifts, firstWorkingShiftFrom, nearestShiftStart, shiftsForHours, shiftStartAtOrBefore } from './shifts';
import { addBlock, compactMachine, moveBlock, reflow } from './schedule';
import { Block, BlockDraft, Machine, WorkCalendar } from './types';

// 2026-10-05 to poniedziałek, 2026-10-10/11 to weekend
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();
const plant: WorkCalendar = { overrides: {} };
const weekdays = machineCalendar(plant, { id: 'm1', name: 'M1' });

const draft = (hours: number, machineId = 'm1'): BlockDraft => ({ machineId, orderNo: 'Z-1', project: 'P', operation: 'Op', hours });

describe('zmiany', () => {
	it('zaokrągla godziny w górę do pełnych zmian', () => {
		expect([0, 1, 8, 9, 16, 17].map(shiftsForHours)).toEqual([1, 1, 1, 2, 2, 3]);
	});

	it('znajduje początek bieżącej zmiany, także nocnej po północy', () => {
		expect(shiftStartAtOrBefore(at(6, 10) + 30 * 60_000)).toBe(at(6, 6));
		expect(shiftStartAtOrBefore(at(6, 22))).toBe(at(6, 22));
		expect(shiftStartAtOrBefore(at(7, 3))).toBe(at(6, 22));
	});

	it('przyciąga do najbliższej granicy zmiany', () => {
		expect(nearestShiftStart(at(6, 9))).toBe(at(6, 6));
		expect(nearestShiftStart(at(6, 11))).toBe(at(6, 14));
	});
});

describe('kalendarz maszyny', () => {
	it('maszyna pon-pt kontynuuje zlecenie z piątku dopiero w poniedziałek', () => {
		expect(firstWorkingShiftFrom(at(10, 10), weekdays)).toBe(at(12, 6));
		// pt 14-22, pt 22-6, potem dopiero pon 6-14
		expect(endAfterShifts(at(9, 14), 3, weekdays)).toBe(at(12, 14));
	});

	it('maszyna 4-brygadowa pracuje przez weekend', () => {
		const continuous = machineCalendar(plant, { id: 'm2', name: 'M2', workMode: 'continuous' });
		expect(endAfterShifts(at(9, 14), 3, continuous)).toBe(at(10, 14));
	});

	it('niedziela pracująca tylko na jednej maszynie', () => {
		const sunday: Machine = { id: 'm1', name: 'M1', overrides: { '2026-10-11': true } };
		expect(firstWorkingShiftFrom(at(10, 10), machineCalendar(plant, sunday))).toBe(at(11, 6));
		expect(firstWorkingShiftFrom(at(10, 10), machineCalendar(plant, { id: 'm2', name: 'M2' }))).toBe(at(12, 6));
	});

	it('wyjątek zakładu działa na wszystkie maszyny, a wyjątek maszyny ma pierwszeństwo', () => {
		const holiday: WorkCalendar = { overrides: { '2026-10-07': false } };
		const continuous: Machine = { id: 'm2', name: 'M2', workMode: 'continuous' };
		expect(firstWorkingShiftFrom(at(7, 6), machineCalendar(holiday, continuous))).toBe(at(8, 6));
		const exception: Machine = { ...continuous, overrides: { '2026-10-07': true } };
		expect(firstWorkingShiftFrom(at(7, 6), machineCalendar(holiday, exception))).toBe(at(7, 6));
	});

	it('wylicza wolne okresy od 6:00 do 6:00, sklejając weekend', () => {
		// niedziela 4.10 trwa do pon 6:00, więc zahacza o początek zakresu
		expect(nonWorkingPeriods(weekdays, at(5, 0), at(13, 0))).toEqual([
			[at(4, 6), at(5, 6)],
			[at(10, 6), at(12, 6)]
		]);
	});
});

describe('harmonogram', () => {
	const now = at(5, 7);
	const calendars = calendarLookup({
		calendar: plant,
		machines: [
			{ id: 'm1', name: 'M1' },
			{ id: 'm2', name: 'M2', workMode: 'continuous' }
		]
	});

	function plan(...hours: number[]): Block[] {
		return hours.reduce<Block[]>((blocks, h, i) => addBlock(blocks, draft(h), `b${i}`, calendars, now), []);
	}
	const startsById = (blocks: Block[]) => Object.fromEntries(blocks.map((b) => [b.id, b.start]));

	it('dopisuje bloczki na koniec kolejki maszyny, od najbliższej zmiany', () => {
		const blocks = plan(8, 10, 8);
		expect(blocks.map((b) => [b.start, b.end])).toEqual([
			[at(5, 14), at(5, 22)],
			[at(5, 22), at(6, 14)],
			[at(6, 14), at(6, 22)]
		]);
	});

	it('przesunięcie bloczka spycha następne', () => {
		// b0 5.10 14-22 opóźniony o jedną zmianę
		const blocks = moveBlock(plan(8, 8, 8), 'b0', at(5, 22), 'm1', calendars);
		expect(startsById(blocks)).toEqual({ b0: at(5, 22), b1: at(6, 6), b2: at(6, 14) });
	});

	it('przeciągnięcie za następny bloczek zmienia kolejność', () => {
		const blocks = moveBlock(plan(8, 8, 8), 'b0', at(6, 6), 'm1', calendars);
		expect(startsById(blocks)).toEqual({ b1: at(5, 22), b0: at(6, 6), b2: at(6, 14) });
	});

	it('wstawiony między zlecenia zachowuje długość i spycha resztę', () => {
		const blocks = moveBlock([...plan(8, 8, 8), ...plan(24).map((b) => ({ ...b, id: 'x', machineId: 'm2' }))], 'x', at(5, 22), 'm1', calendars);
		const x = blocks.find((b) => b.id === 'x')!;
		expect([x.start, x.end]).toEqual([at(5, 22), at(6, 22)]);
		expect(startsById(blocks.filter((b) => b.id !== 'x'))).toEqual({ b0: at(5, 14), b1: at(6, 22), b2: at(7, 6) });
	});

	it('przeniesienie na inną maszynę liczy czas wg jej kalendarza', () => {
		// 3 zmiany od piątku 14:00: na maszynie 24/7 kończy się w sobotę, na pon-pt w poniedziałek
		const friday = addBlock([], { ...draft(24), start: at(9, 14) }, 'f', calendars, now);
		expect(friday[0].end).toBe(at(12, 14));
		expect(moveBlock(friday, 'f', at(9, 14), 'm2', calendars)[0].end).toBe(at(10, 14));
	});

	it('kompaktowanie usuwa przerwy', () => {
		const spread = moveBlock(plan(8, 8), 'b1', at(7, 6), 'm1', calendars);
		const blocks = compactMachine(spread, 'm1', calendars);
		expect(blocks.find((b) => b.id === 'b1')?.start).toBe(at(5, 22));
	});

	it('zmiana kalendarza przesuwa bloczki z dnia wolnego', () => {
		const blocks = reflow(plan(8), calendarLookup({ calendar: { overrides: { '2026-10-05': false } }, machines: [] }));
		expect(blocks[0].start).toBe(at(6, 6));
	});
});
