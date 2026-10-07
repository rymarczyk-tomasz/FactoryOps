import { describe, expect, it } from 'vitest';
import { dailyLoad, loadPercent, loadUnits } from './load';
import { Block, Line, Machine } from './types';

// 2026-10-05 to poniedziałek
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();
const block = (id: string, machineId: string, start: number, end: number): Block => ({
	id,
	machineId,
	orderNo: id,
	projectNo: 'IMR-1',
	project: 'P',
	operation: 'O',
	hours: 1,
	start,
	end
});
const calendar = { overrides: {} };
const continuous = (ids: string[]): Machine[] => ids.map((id) => ({ id, name: id, workMode: 'continuous' }));

describe('obciążenie maszyn', () => {
	it('zlecenie na pół doby to 50% zajętości', () => {
		const resources = { calendar, machines: continuous(['m']), lines: [], breakdowns: [] };
		const blocks = [block('a', 'm', at(5, 6), at(5, 18))];
		const load = dailyLoad(loadUnits(resources, blocks, 'm', 0), at(5, 6));
		expect(load).toMatchObject({ available: 24, busy: 12 });
		expect(loadPercent(load)).toBe(50);
	});

	it('awaria maszyny linii zmniejsza dostępne maszyno-godziny linii', () => {
		const line: Line = { id: 'l', name: 'L', machineIds: ['a', 'b', 'c'] };
		const resources = { calendar, machines: continuous(line.machineIds), lines: [line], breakdowns: [{ id: 'x', machineId: 'a', start: at(5, 6), end: at(5, 12) }] };
		// 6 h po 2 maszyny + 18 h po 3 maszyny
		expect(dailyLoad(loadUnits(resources, [], 'l', 0), at(5, 6)).available).toBe(66);
	});

	it('zlecenie na maszynie linii zajmuje część linii', () => {
		const line: Line = { id: 'l', name: 'L', machineIds: ['a', 'b'] };
		const resources = { calendar, machines: continuous(line.machineIds), lines: [line], breakdowns: [] };
		const load = dailyLoad(loadUnits(resources, [block('own', 'a', at(5, 6), at(6, 6))], 'l', 0), at(5, 6));
		expect(loadPercent(load)).toBe(50);
	});

	it('dzień wolny nie ma zajętości w procentach', () => {
		const machine: Machine = { id: 'm', name: 'M', workMode: 'weekdays' };
		const resources = { calendar, machines: [machine], lines: [], breakdowns: [] };
		expect(loadPercent(dailyLoad(loadUnits(resources, [], 'm', 0), at(10, 6)))).toBeUndefined();
	});
});
