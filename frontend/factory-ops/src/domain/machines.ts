import { Breakdown, Id, Machine, MachineDraft } from './types';

/** Linia musi mieć co najmniej 2 maszyny - jedna to zwykła maszyna. */
export const MIN_LINE_MACHINES = 2;

/**
 * Zapisuje maszynę lub linię z formularza (nową albo istniejącą). Awarie maszyn linii idą za maszynami:
 * po usunięciu maszyny z linii jej awarie znikają, a numery pozostałych są przeliczane.
 */
export function applyMachineDraft(
	machines: Machine[],
	breakdowns: Breakdown[],
	draft: MachineDraft,
	id: Id
): { machines: Machine[]; breakdowns: Breakdown[] } {
	const existing = machines.find((m) => m.id === id);
	const lineRows = draft.lineMachines && draft.lineMachines.length >= MIN_LINE_MACHINES ? draft.lineMachines : undefined;
	const machine: Machine = { ...existing, id, name: draft.name, workMode: draft.workMode };
	if (lineRows) machine.lineMachines = lineRows.map((row) => row.name);
	else delete machine.lineMachines;

	// stary numer maszyny -> nowy; zwykła maszyna to zawsze numer 0
	const newIndex = (oldIndex: number): number | undefined => {
		if (!lineRows) return 0;
		const found = lineRows.findIndex((row) => row.previousIndex === oldIndex);
		return found < 0 ? undefined : found;
	};
	const updatedBreakdowns = breakdowns
		.map((b) => {
			if (b.machineId !== id) return b;
			const units = [...new Set(b.units.map(newIndex).filter((u): u is number => u !== undefined))].sort();
			return { ...b, units };
		})
		.filter((b) => b.units.length > 0);

	return {
		machines: existing ? machines.map((m) => (m.id === id ? machine : m)) : insertNew(machines, machine),
		breakdowns: updatedBreakdowns
	};
}

/** Nowa linia trafia za ostatnią linią (linie są na górze planu), nowa maszyna - na koniec. */
function insertNew(machines: Machine[], machine: Machine): Machine[] {
	if (!machine.lineMachines) return [...machines, machine];
	const lastLine = machines.reduce((last, m, index) => (m.lineMachines ? index : last), -1);
	return [...machines.slice(0, lastLine + 1), machine, ...machines.slice(lastLine + 1)];
}
