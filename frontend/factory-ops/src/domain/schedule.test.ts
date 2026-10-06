import { describe, expect, it } from 'vitest';
import { endAfterShifts, firstWorkingShiftFrom, nearestShiftStart, shiftsForHours, shiftStartAtOrBefore } from './shifts';
import { addBlock, compactMachine, moveBlock, reflow, resizeBlock } from './schedule';
import { Block, BlockDraft, WorkCalendar } from './types';

// 2026-10-05 to poniedziałek, 2026-10-10/11 to weekend
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();
const noOverrides: WorkCalendar = { overrides: {} };

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

	it('pomija weekend, jeśli nie jest pracujący', () => {
		expect(firstWorkingShiftFrom(at(10, 10), noOverrides)).toBe(at(12, 6));
		// pt 14-22, pt 22-6, potem dopiero pon 6-14
		expect(endAfterShifts(at(9, 14), 3, noOverrides)).toBe(at(12, 14));
	});

	it('uwzględnia pracującą sobotę', () => {
		const calendar: WorkCalendar = { overrides: { '2026-10-10': true } };
		expect(endAfterShifts(at(9, 14), 3, calendar)).toBe(at(10, 14));
	});

	it('uwzględnia wolny dzień w tygodniu', () => {
		const calendar: WorkCalendar = { overrides: { '2026-10-07': false } };
		expect(firstWorkingShiftFrom(at(7, 6), calendar)).toBe(at(8, 6));
	});
});

describe('harmonogram', () => {
	const now = at(5, 7);

	function plan(...hours: number[]): Block[] {
		return hours.reduce<Block[]>((blocks, h, i) => addBlock(blocks, draft(h), `b${i}`, noOverrides, now), []);
	}

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
		const blocks = moveBlock(plan(8, 8, 8), 'b0', at(5, 22), 'm1', noOverrides);
		const byId = Object.fromEntries(blocks.map((b) => [b.id, b.start]));
		expect(byId).toEqual({ b0: at(5, 22), b1: at(6, 6), b2: at(6, 14) });
	});

	it('przeciągnięcie za następny bloczek zmienia kolejność', () => {
		const blocks = moveBlock(plan(8, 8, 8), 'b0', at(6, 6), 'm1', noOverrides);
		const byId = Object.fromEntries(blocks.map((b) => [b.id, b.start]));
		expect(byId).toEqual({ b1: at(5, 22), b0: at(6, 6), b2: at(6, 14) });
	});

	it('upuszczony na miejsce innego bloczka wchodzi przed niego', () => {
		const blocks = moveBlock(plan(8, 8, 8), 'b2', at(5, 14), 'm1', noOverrides);
		const order = [...blocks].sort((a, b) => a.start - b.start).map((b) => b.id);
		expect(order).toEqual(['b2', 'b0', 'b1']);
	});

	it('przeniesienie na inną maszynę nie rusza starej kolejki', () => {
		const blocks = moveBlock(plan(8, 8), 'b0', at(5, 14), 'm2', noOverrides);
		expect(blocks.find((b) => b.id === 'b0')).toMatchObject({ machineId: 'm2', start: at(5, 14) });
		expect(blocks.find((b) => b.id === 'b1')?.start).toBe(at(5, 22));
	});

	it('rozciągnięcie zmienia długość na pełne zmiany i spycha następne', () => {
		const blocks = resizeBlock(plan(8, 8), 'b0', at(6, 5), noOverrides);
		expect(blocks.find((b) => b.id === 'b0')).toMatchObject({ hours: 16, end: at(5, 22) + 8 * 3600_000 });
		expect(blocks.find((b) => b.id === 'b1')?.start).toBe(at(6, 6));
	});

	it('kompaktowanie usuwa przerwy', () => {
		const spread = moveBlock(plan(8, 8), 'b1', at(7, 6), 'm1', noOverrides);
		const blocks = compactMachine(spread, 'm1', noOverrides);
		expect(blocks.find((b) => b.id === 'b1')?.start).toBe(at(5, 22));
	});

	it('zmiana kalendarza przesuwa bloczki z dnia wolnego', () => {
		const blocks = reflow(plan(8), { overrides: { '2026-10-05': false } });
		expect(blocks[0].start).toBe(at(6, 6));
	});
});
