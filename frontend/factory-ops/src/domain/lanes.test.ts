import { describe, expect, it } from 'vitest';
import { layoutLanes, overflowByDay } from './lanes';

const span = (id: string, start: number, end: number) => ({ id, start, end });

describe('podwiersze zleceń bez maszyny', () => {
	it('zlecenia jedno po drugim zostają w jednym podwierszu', () => {
		const layout = layoutLanes([span('a', 0, 10), span('b', 10, 20)]);
		expect([...layout.lanes]).toEqual([
			['a', 0],
			['b', 0]
		]);
		expect(layout.laneCount).toBe(1);
	});

	it('nakładające się dostają kolejne podwiersze', () => {
		const layout = layoutLanes([span('a', 0, 10), span('b', 5, 15), span('c', 6, 8)]);
		expect(Object.fromEntries(layout.lanes)).toEqual({ a: 0, b: 1, c: 2 });
		expect(layout.overflow).toEqual([]);
		expect(layout.laneCount).toBe(3);
	});

	it('ponad 3 naraz - ostatni podwiersz pokazuje „+N” dla nadmiarowych', () => {
		const layout = layoutLanes([span('a', 0, 10), span('b', 0, 10), span('c', 0, 4), span('d', 2, 6), span('e', 20, 30)]);
		expect(Object.fromEntries(layout.lanes)).toEqual({ c: 0, a: 1, e: 0 });
		expect(layout.overflow).toEqual([{ ids: ['b', 'd'], start: 0, end: 10 }]);
		expect(layout.laneCount).toBe(3);
	});
});

describe('nadmiar po dobach', () => {
	const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();

	it('zlecenie liczy się w każdej dobie (od 6:00), w którą wchodzi', () => {
		expect(overflowByDay([span('a', at(12, 8), at(13, 10)), span('b', at(13, 7), at(13, 9)), span('c', at(14, 3), at(14, 5))])).toEqual([
			{ day: at(12, 6), ids: ['a'] },
			{ day: at(13, 6), ids: ['a', 'b', 'c'] }
		]);
	});
});
