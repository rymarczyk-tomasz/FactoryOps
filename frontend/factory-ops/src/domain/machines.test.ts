import { describe, expect, it } from 'vitest';
import { applyMachineDraft } from './machines';
import { Breakdown, Machine } from './types';

const line: Machine = { id: 'l1', name: 'Linia 1', workMode: 'continuous', lineMachines: ['A', 'B', 'C'] };
const breakdown = (id: string, units: number[]): Breakdown => ({ id, machineId: 'l1', units, start: 0, end: 1 });

describe('zapis maszyny/linii', () => {
	it('dodaje nową linię z nazwanymi maszynami', () => {
		const { machines } = applyMachineDraft([], [], { name: 'Linia 9', workMode: 'continuous', lineMachines: [{ name: 'X' }, { name: 'Y' }] }, 'n');
		expect(machines).toEqual([{ id: 'n', name: 'Linia 9', workMode: 'continuous', lineMachines: ['X', 'Y'] }]);
	});

	it('nowa linia trafia za ostatnią linią, nowa maszyna na koniec', () => {
		const existing: Machine[] = [line, { id: 'm1', name: 'DMU 65', workMode: 'weekdays' }];
		const withLine = applyMachineDraft(existing, [], { name: 'Linia 2', workMode: 'continuous', lineMachines: [{ name: 'X' }, { name: 'Y' }] }, 'l2');
		expect(withLine.machines.map((m) => m.id)).toEqual(['l1', 'l2', 'm1']);
		const withMachine = applyMachineDraft(existing, [], { name: 'Haas', workMode: 'weekdays' }, 'm2');
		expect(withMachine.machines.map((m) => m.id)).toEqual(['l1', 'm1', 'm2']);
	});

	it('pojedyncza maszyna nie ma listy maszyn linii', () => {
		const { machines } = applyMachineDraft([], [], { name: 'DMU 65', workMode: 'weekdays' }, 'n');
		expect(machines[0]).toEqual({ id: 'n', name: 'DMU 65', workMode: 'weekdays' });
	});

	it('usunięcie maszyny z linii usuwa jej awarie i przenumerowuje pozostałe', () => {
		// usuwamy B (numer 1), dodajemy D
		const draft = { name: 'Linia 1', workMode: 'continuous' as const, lineMachines: [{ name: 'A', previousIndex: 0 }, { name: 'C', previousIndex: 2 }, { name: 'D' }] };
		const result = applyMachineDraft([line], [breakdown('b', [1]), breakdown('c', [2]), breakdown('ab', [0, 1])], draft, 'l1');
		expect(result.machines[0].lineMachines).toEqual(['A', 'C', 'D']);
		expect(result.breakdowns.map((b) => [b.id, b.units])).toEqual([
			['c', [1]],
			['ab', [0]]
		]);
	});

	it('zamiana linii na zwykłą maszynę zostawia awarie jako awarie całej maszyny', () => {
		const result = applyMachineDraft([line], [breakdown('ab', [0, 1])], { name: 'Linia 1', workMode: 'weekdays' }, 'l1');
		expect(result.machines[0].lineMachines).toBeUndefined();
		expect(result.breakdowns[0].units).toEqual([0]);
	});
});
