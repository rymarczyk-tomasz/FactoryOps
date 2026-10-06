import { describe, expect, it } from 'vitest';
import { capacityLookup } from './calendar';
import { dailyLoad, loadPercent } from './load';
import { Block, Machine } from './types';

// 2026-10-05 to poniedziałek
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();
const block = (id: string, machineId: string, start: number, end: number): Block => ({ id, machineId, orderNo: id, project: 'P', operation: 'O', hours: 1, start, end });

describe('obciążenie maszyn', () => {
	it('zlecenie na pół doby to 50% zajętości', () => {
		const machine: Machine = { id: 'm', name: 'M', workMode: 'continuous' };
		const capacity = capacityLookup({ calendar: { overrides: {} }, machines: [machine], breakdowns: [] })('m');
		const load = dailyLoad([block('a', 'm', at(5, 6), at(5, 18))], capacity, at(5, 6));
		expect(load).toMatchObject({ available: 24, busy: 12 });
		expect(loadPercent(load)).toBe(50);
	});

	it('awaria części linii zmniejsza dostępne maszyno-godziny', () => {
		const line: Machine = { id: 'l', name: 'L', workMode: 'continuous', lineMachines: ['A', 'B', 'C'] };
		const capacity = capacityLookup({
			calendar: { overrides: {} },
			machines: [line],
			breakdowns: [{ id: 'x', machineId: 'l', units: [0], start: at(5, 6), end: at(5, 12) }]
		})('l');
		// 6 h po 2 maszyny + 18 h po 3 maszyny
		expect(dailyLoad([], capacity, at(5, 6)).available).toBe(66);
	});

	it('dzień wolny nie ma zajętości w procentach', () => {
		const machine: Machine = { id: 'm', name: 'M', workMode: 'weekdays' };
		const capacity = capacityLookup({ calendar: { overrides: {} }, machines: [machine], breakdowns: [] })('m');
		expect(loadPercent(dailyLoad([], capacity, at(10, 6)))).toBeUndefined();
	});
});
