import { describe, expect, it } from 'vitest';
import { applyLineDraft, applyMachineDraft, removeLine, removeMachine } from './machines';
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

	it('usunięcie maszyny usuwa jej zlecenia, awarie i miejsce w linii', () => {
		const next = removeMachine(state, 'a');
		expect(next.lines[0].machineIds).toEqual(['b']);
		expect(next.blocks.map((b) => b.id)).toEqual(['onLine']);
		expect(next.breakdowns).toEqual([]);
	});

	it('usunięcie linii zostawia jej maszyny i ich zlecenia', () => {
		const next = removeLine(state, 'l1');
		expect(next.lines).toEqual([]);
		expect(next.machines).toHaveLength(4);
		expect(next.blocks.map((b) => b.id)).toEqual(['onA']);
	});
});
