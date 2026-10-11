import { addHours, shiftDayStart } from './shifts';

/** Jeden poziom sortowania listy; kolejne poziomy rozstrzygają remisy poprzednich. */
export interface SortLevel<K extends string = string> {
	key: K;
	direction: 1 | -1;
}

/**
 * Klik w nagłówek sortuje tylko po tej kolumnie (drugi klik odwraca kierunek). Z Shiftem kolumna dochodzi
 * jako kolejny poziom, a gdy już jest - odwraca jej kierunek, nie ruszając pozostałych poziomów.
 */
export function toggleSortLevel<K extends string>(levels: SortLevel<K>[], key: K, additive: boolean): SortLevel<K>[] {
	const index = levels.findIndex((l) => l.key === key);
	if (additive) {
		if (index < 0) return [...levels, { key, direction: 1 }];
		return levels.map((l, i) => (i === index ? { key, direction: l.direction === 1 ? -1 : 1 } : l));
	}
	if (levels.length === 1 && index === 0) return [{ key, direction: levels[0].direction === 1 ? -1 : 1 }];
	return [{ key, direction: 1 }];
}

/** Porównanie wielopoziomowe: liczby rosnąco, teksty po polsku z liczbami naturalnie („L2” przed „L10”). */
export function compareByLevels<T, K extends string>(levels: SortLevel<K>[], value: (item: T, key: K) => string | number): (a: T, b: T) => number {
	return (a, b) => {
		for (const { key, direction } of levels) {
			const x = value(a, key);
			const y = value(b, key);
			const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pl', { numeric: true });
			if (order !== 0) return order * direction;
		}
		return 0;
	};
}

/** Zakres dat startu: presety liczone od „teraz” przy każdym użyciu, żeby zapisany widok nie starzał się. */
export type StartRangePreset = 'all' | 'today' | 'week' | 'twoWeeks' | 'custom';

export interface StartRange {
	preset: StartRangePreset;
	/** Tylko dla „Własny”: pierwszy i ostatni dzień, 'YYYY-MM-DD' (dowolny może być pusty). */
	from?: string;
	to?: string;
}

const dayStartOf = (date: string) => {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(y, m - 1, d, 6).getTime();
};

/**
 * Przedział [od, do) dla startu zlecenia. „Dziś” to doba zakładu (od 6:00), „+7 dni” i „+14 dni” liczą się od teraz,
 * „Własny” - od 6:00 pierwszego dnia do 6:00 dnia po ostatnim. `undefined` - bez ograniczenia.
 */
export function startRangeBounds(range: StartRange, now: number): [number, number] | undefined {
	switch (range.preset) {
		case 'today': {
			const day = shiftDayStart(now);
			return [day, addHours(day, 24)];
		}
		case 'week':
			return [now, addHours(now, 7 * 24)];
		case 'twoWeeks':
			return [now, addHours(now, 14 * 24)];
		case 'custom':
			if (!range.from && !range.to) return undefined;
			return [range.from ? dayStartOf(range.from) : -Infinity, range.to ? addHours(dayStartOf(range.to), 24) : Infinity];
		default:
			return undefined;
	}
}
