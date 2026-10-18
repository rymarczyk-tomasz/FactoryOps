import { describe, expect, it } from 'vitest';
import { lineConflicts, subtractIntervals } from './conflicts';
import { Block, Line } from './types';

const block = (id: string, machineId: string, start: number, end: number): Block => ({
	id,
	machineId,
	orderNo: id,
	projectNo: 'IMR-1',
	project: 'P',
	operation: 'Op',
	hours: end - start,
	start,
	end
});
const line: Line = { id: 'l1', name: 'Linia 1', machineIds: ['a', 'b', 'c'] };

describe('konflikty linii', () => {
	it('znajduje zlecenia maszyn linii w czasie zleceń całej linii', () => {
		const blocks = [block('L1', 'l1', 0, 10), block('L2', 'l1', 10, 20), block('A1', 'a', 5, 12), block('B1', 'b', 20, 25), block('X', 'x', 0, 30)];
		expect(lineConflicts(blocks, [line])).toEqual([
			{ lineId: 'l1', machineId: 'a', lineBlockId: 'L1', machineBlockId: 'A1', from: 5, to: 10 },
			{ lineId: 'l1', machineId: 'a', lineBlockId: 'L2', machineBlockId: 'A1', from: 10, to: 12 }
		]);
	});

	it('pomija konflikty zakończone przed `since` i zlecenia bez maszyny', () => {
		const blocks = [block('L1', 'l1', 0, 10), block('L2', 'l1', 10, 20), block('A1', 'a', 2, 4), block('C1', 'c', 15, 30), { ...block('N', 'a', 0, 30), machineId: null }];
		expect(lineConflicts(blocks, [line], 5).map((c) => c.machineBlockId)).toEqual(['C1']);
	});
});

describe('odejmowanie przedziałów', () => {
	it('zostawia wolne kawałki', () => {
		expect(subtractIntervals(0, 10, [[2, 4], [3, 5], [8, 12]])).toEqual([
			[0, 2],
			[5, 8]
		]);
		expect(subtractIntervals(0, 10, [])).toEqual([[0, 10]]);
		expect(subtractIntervals(0, 10, [[-5, 20]])).toEqual([]);
	});
});
