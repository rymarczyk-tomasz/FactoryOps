import { describe, expect, it } from 'vitest';
import { compareByLevels, SortLevel, startRangeBounds, toggleSortLevel } from './listView';

const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();

describe('sortowanie wielopoziomowe', () => {
	it('klik sortuje po jednej kolumnie i odwraca kierunek', () => {
		const byStart: SortLevel[] = [{ key: 'start', direction: 1 }];
		expect(toggleSortLevel(byStart, 'start', false)).toEqual([{ key: 'start', direction: -1 }]);
		expect(toggleSortLevel([...byStart, { key: 'machine', direction: 1 }], 'machine', false)).toEqual([{ key: 'machine', direction: 1 }]);
	});

	it('Shift+klik dodaje poziom albo odwraca istniejący', () => {
		const levels = toggleSortLevel<string>([{ key: 'machine', direction: 1 }], 'start', true);
		expect(levels).toEqual([
			{ key: 'machine', direction: 1 },
			{ key: 'start', direction: 1 }
		]);
		expect(toggleSortLevel(levels, 'machine', true)).toEqual([
			{ key: 'machine', direction: -1 },
			{ key: 'start', direction: 1 }
		]);
	});

	it('kolejny poziom rozstrzyga remisy poprzedniego', () => {
		const rows = [
			{ machine: 'L10', start: 1 },
			{ machine: 'L2', start: 5 },
			{ machine: 'L2', start: 3 }
		];
		const compare = compareByLevels<(typeof rows)[number], 'machine' | 'start'>(
			[
				{ key: 'machine', direction: 1 },
				{ key: 'start', direction: -1 }
			],
		(row, key) => row[key]
		);
		expect([...rows].sort(compare)).toEqual([rows[1], rows[2], rows[0]]);
	});
});

describe('zakres dat startu', () => {
	const now = at(12, 10);

	it('„Dziś” to doba zakładu od 6:00, „+14 dni” liczy się od teraz', () => {
		expect(startRangeBounds({ preset: 'today' }, now)).toEqual([at(12, 6), at(13, 6)]);
		expect(startRangeBounds({ preset: 'twoWeeks' }, now)).toEqual([now, at(26, 10)]);
		expect(startRangeBounds({ preset: 'all' }, now)).toBeUndefined();
	});

	it('„Własny” obejmuje cały ostatni dzień', () => {
		expect(startRangeBounds({ preset: 'custom', from: '2026-10-14', to: '2026-10-15' }, now)).toEqual([at(14, 6), at(16, 6)]);
		expect(startRangeBounds({ preset: 'custom', to: '2026-10-15' }, now)).toEqual([-Infinity, at(16, 6)]);
		expect(startRangeBounds({ preset: 'custom' }, now)).toBeUndefined();
	});
});
