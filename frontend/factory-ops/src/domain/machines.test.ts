import { describe, expect, it } from 'vitest';
import { applyLineDraft, applyMachineDraft, pendingBlocks, removeLine, removeMachine } from './machines';
import { reflow } from './schedule';
import { Line, Machine, PlanState } from './types';

const machines: Machine[] = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id.toUpperCase(), workMode: 'weekdays' }));
const line: Line = { id: 'l1', name: 'Linia 1', machineIds: ['a', 'b'] };

describe('maszyny i linie', () => {
	it('nowa linia z istniejących i nowych maszyn, z systemem pracy dla wszystkich', () => {
		let counter = 0;
		const result = applyLineDraft(
			{ machines, lines: [] },
			{ name: 'Linia 2', machineIds: ['c'], newMachines: [{ name: 'X', workMode: 'continuous' }], workMode: 'continuous' },
			'l2',
			() => `n${++counter}`
		);
		expect(result.lines).toEqual([{ id: 'l2', name: 'Linia 2', machineIds: ['c', 'n1'] }]);
		expect(result.machines.find((m) => m.id === 'c')?.workMode).toBe('continuous');
		expect(result.machines.find((m) => m.id === 'n1')).toMatchObject({ name: 'X', workMode: 'continuous' });
		expect(result.machines.find((m) => m.id === 'd')?.workMode).toBe('weekdays');
	});

	it('maszyna przeniesiona do innej linii znika z poprzedniej', () => {
		const result = applyLineDraft({ machines, lines: [line] }, { name: 'Linia 2', machineIds: ['b', 'c'] }, 'l2', () => 'x');
		expect(result.lines.map((l) => [l.id, l.machineIds])).toEqual([
			['l1', ['a']],
			['l2', ['b', 'c']]
		]);
	});

	it('zapis maszyny zmienia jej linię', () => {
		const toLine = applyMachineDraft({ machines, lines: [line] }, { name: 'D', workMode: 'weekdays', lineId: 'l1' }, 'd');
		expect(toLine.lines[0].machineIds).toEqual(['a', 'b', 'd']);
		const standalone = applyMachineDraft({ machines, lines: [line] }, { name: 'A', workMode: 'continuous' }, 'a');
		expect(standalone.lines[0].machineIds).toEqual(['b']);
		expect(standalone.machines[0].workMode).toBe('continuous');
	});

	it('nowa maszyna trafia na koniec listy', () => {
		const { machines: next } = applyMachineDraft({ machines, lines: [] }, { name: 'Haas', workMode: 'weekdays' }, 'h');
		expect(next.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'h']);
	});

	const state: PlanState = {
		machines,
		lines: [line],
		programmers: [],
		archive: [],
		calendar: { overrides: {} },
		breakdowns: [{ id: 'x', machineId: 'a', start: 0 }],
		blocks: [
			{ id: 'onLine', machineId: 'l1', orderNo: '1', projectNo: 'IMR', project: 'P', operation: 'O', hours: 1, start: 0, end: 1 },
			{ id: 'onA', machineId: 'a', orderNo: '2', projectNo: 'IMR', project: 'P', operation: 'O', hours: 1, start: 0, end: 1 }
		]
	};

	it('usunięcie maszyny usuwa jej awarie i miejsce w linii, a zlecenia zostają bez maszyny', () => {
		const next = removeMachine(state, 'a', 0);
		expect(next.lines[0].machineIds).toEqual(['b']);
		expect(next.blocks.map((b) => [b.id, b.machineId])).toEqual([
			['onLine', 'l1'],
			['onA', null]
		]);
		expect(next.breakdowns).toEqual([]);
	});

	it('usunięcie linii zostawia jej maszyny i ich zlecenia, a zlecenia linii zostają bez maszyny', () => {
		const next = removeLine(state, 'l1', 0);
		expect(next.lines).toEqual([]);
		expect(next.machines).toHaveLength(4);
		expect(next.blocks.map((b) => [b.id, b.machineId])).toEqual([
			['onLine', null],
			['onA', 'a']
		]);
	});

	it('zlecenia bez maszyny zachowują ostatnie zaplanowane daty - plan ich nie przelicza', () => {
		const planned: PlanState = {
			...state,
			breakdowns: [],
			blocks: [
				{ ...state.blocks[0], id: 'x', start: 10, end: 50, pinnedStart: 10 },
				{ ...state.blocks[0], id: 'y', start: 30, end: 90 }
			]
		};
		const next = removeLine(planned, 'l1', 0);
		const replanned = reflow(next.blocks, next, undefined, 0);
		expect(replanned.map((b) => [b.id, b.machineId, b.start, b.end])).toEqual([
			['x', null, 10, 50],
			['y', null, 30, 90]
		]);
	});

	it('zlecenie bez maszyny traci termin, a zakończone zlecenia usuwanego zasobu idą do archiwum', () => {
		const withPinned: PlanState = {
			...state,
			blocks: [
				{ ...state.blocks[0], id: 'done', start: 0, end: 5 },
				{ ...state.blocks[0], id: 'pinned', start: 20, end: 30, pinnedStart: 20 }
			]
		};
		const next = removeLine(withPinned, 'l1', 10);
		expect(next.blocks).toHaveLength(1);
		expect(next.blocks[0]).toMatchObject({ id: 'pinned', machineId: null });
		expect(next.blocks[0].pinnedStart).toBeUndefined();
		expect(next.archive).toEqual([expect.objectContaining({ id: 'done', machineName: 'Linia 1', archivedAt: 10 })]);
		expect(pendingBlocks(withPinned.blocks, 'l1', 10).map((b) => b.id)).toEqual(['pinned']);
	});
});
