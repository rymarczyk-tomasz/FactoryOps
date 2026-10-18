import { describe, expect, it } from 'vitest';
import { archiveOld } from './archive';
import { reflow } from './schedule';
import { Block, Line, Machine, PlanState } from './types';

const DAY = 24 * 3600_000;
// 2026-10-05 to poniedziałek
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).getTime();
const block = (id: string, machineId: string, start: number, end: number): Block => ({
	id,
	machineId,
	orderNo: id,
	projectNo: 'IMR-1',
	project: 'P',
	operation: 'O',
	hours: (end - start) / 3600_000,
	start,
	end
});

const machines: Machine[] = ['a', 'b', 'm'].map((id) => ({ id, name: id.toUpperCase(), workMode: 'continuous' }));
const line: Line = { id: 'l', name: 'Linia', machineIds: ['a', 'b'] };
const state = (blocks: Block[]): PlanState => ({ machines, lines: [line], programmers: [], blocks, archive: [], calendar: { overrides: {} }, breakdowns: [] });

describe('archiwum', () => {
	const now = at(5, 6) + 40 * DAY;

	it('przenosi zlecenia zakończone ponad 30 dni temu i zapamiętuje nazwę maszyny', () => {
		const old = block('old', 'm', at(5, 6), at(5, 10));
		const recent = block('recent', 'm', now - 10 * DAY, now - 9 * DAY);
		const result = archiveOld(state([old, recent]), now);
		expect(result.blocks.map((b) => b.id)).toEqual(['recent']);
		expect(result.archive).toMatchObject([{ id: 'old', machineName: 'M', archivedAt: now }]);
	});

	it('bez starych zleceń zwraca ten sam stan', () => {
		const current = state([block('recent', 'm', now - DAY, now)]);
		expect(archiveOld(current, now)).toBe(current);
	});
});

describe('przeliczanie tylko zmienionych maszyn', () => {
	it('linia jest liczona od nowa, gdy zmieni się zlecenie jej maszyny', () => {
		const resources = state([]);
		const onLine = block('line', 'l', at(5, 6), at(5, 6));
		const own = block('own', 'a', at(5, 6), at(5, 12));
		const other = block('other', 'm', at(5, 6), at(5, 7));
		const result = reflow([onLine, own, other], resources, undefined, undefined, ['a']);
		// 'line' przeliczone (linia zależy od 'a'), 'other' bez zmian
		expect(result.find((b) => b.id === 'line')!.end).not.toBe(at(5, 6));
		expect(result.find((b) => b.id === 'other')).toBe(other);
	});

	it('wynik jest taki sam jak przy przeliczeniu całego planu', () => {
		const blocks = [block('x', 'a', at(5, 6), at(5, 12)), { ...block('y', 'l', at(5, 6), at(5, 6)), hours: 30 }, block('z', 'm', at(5, 8), at(5, 9))];
		const scoped = reflow(blocks, state([]), undefined, undefined, ['a']);
		const full = reflow(scoped, state([]));
		expect(full.map((b) => [b.id, b.start, b.end]).sort()).toEqual(scoped.map((b) => [b.id, b.start, b.end]).sort());
	});
});
