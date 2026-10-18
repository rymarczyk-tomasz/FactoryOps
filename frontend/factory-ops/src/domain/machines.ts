import { resourceName } from './calendar';
import { ArchivedBlock, Block, Id, Line, LineDraft, Machine, MachineDraft, PlanState } from './types';

/** Linia musi mieć co najmniej 2 maszyny - jedna to zwykła maszyna. */
export const MIN_LINE_MACHINES = 2;

type MachinesAndLines = Pick<PlanState, 'machines' | 'lines'>;

/** Maszyna należy do co najwyżej jednej linii - dopisanie do linii zdejmuje ją z pozostałych. */
function withoutMachines(lines: Line[], machineIds: Id[], exceptLineId?: Id): Line[] {
	const ids = new Set(machineIds);
	return lines.map((l) => (l.id === exceptLineId || !l.machineIds.some((id) => ids.has(id)) ? l : { ...l, machineIds: l.machineIds.filter((id) => !ids.has(id)) }));
}

/** Zapisuje maszynę z formularza (nową albo istniejącą) i jej przynależność do linii. */
export function applyMachineDraft({ machines, lines }: MachinesAndLines, draft: MachineDraft, id: Id): MachinesAndLines {
	const existing = machines.find((m) => m.id === id);
	const machine: Machine = { ...existing, id, name: draft.name, workMode: draft.workMode };
	const currentLine = lines.find((l) => l.machineIds.includes(id));
	let nextLines = lines;
	if (currentLine?.id !== draft.lineId) {
		nextLines = withoutMachines(lines, [id]).map((l) => (l.id === draft.lineId ? { ...l, machineIds: [...l.machineIds, id] } : l));
	}
	return {
		machines: existing ? machines.map((m) => (m.id === id ? machine : m)) : [...machines, machine],
		lines: nextLines
	};
}

/**
 * Zapisuje linię z formularza. Nowe maszyny z formularza dostają id z `newId` i trafiają na koniec linii;
 * system pracy z formularza (jeśli podany) dostają wszystkie maszyny linii.
 */
export function applyLineDraft({ machines, lines }: MachinesAndLines, draft: LineDraft, id: Id, newId: () => Id): MachinesAndLines {
	const created = (draft.newMachines ?? []).map((m): Machine => ({ id: newId(), name: m.name, workMode: m.workMode }));
	const machineIds = [...draft.machineIds, ...created.map((m) => m.id)];
	const members = new Set(machineIds);
	const nextMachines = [...machines, ...created].map((m) => (draft.workMode && members.has(m.id) && m.workMode !== draft.workMode ? { ...m, workMode: draft.workMode } : m));
	const line: Line = { id, name: draft.name, machineIds };
	const others = withoutMachines(lines, machineIds, id);
	return {
		machines: nextMachines,
		lines: others.some((l) => l.id === id) ? others.map((l) => (l.id === id ? line : l)) : [...others, line]
	};
}

/** Zlecenia zasobu, które jeszcze się nie zakończyły - po usunięciu zasobu trafią do grupy „Bez maszyny”. */
export function pendingBlocks(blocks: Block[], resourceId: Id, now: number): Block[] {
	return blocks.filter((b) => b.machineId === resourceId && b.end > now);
}

/**
 * Zlecenia usuwanego zasobu nie giną: niezakończone tracą przypisanie (`machineId = null`, bez terminu) i czekają
 * na planistę, a zakończone idą do archiwum z nazwą zasobu - inaczej przepadłaby historia.
 */
function detachBlocks(state: PlanState, resourceId: Id, now: number): Pick<PlanState, 'blocks' | 'archive'> {
	const machineName = resourceName(state, resourceId);
	const done = state.blocks.filter((b) => b.machineId === resourceId && b.end <= now);
	const doneIds = new Set(done.map((b) => b.id));
	return {
		blocks: state.blocks
			.filter((b) => !doneIds.has(b.id))
			.map((b) => {
				if (b.machineId !== resourceId) return b;
				const detached: Block = { ...b, machineId: null };
				delete detached.pinnedStart;
				return detached;
			}),
		archive: [...state.archive, ...done.map((b): ArchivedBlock => ({ ...b, machineName, archivedAt: now }))]
	};
}

/** Usuwa maszynę i jej awarie; znika też z linii. Jej zlecenia zostają bez maszyny. */
export function removeMachine(state: PlanState, id: Id, now: number): PlanState {
	return {
		...state,
		...detachBlocks(state, id, now),
		machines: state.machines.filter((m) => m.id !== id),
		lines: withoutMachines(state.lines, [id]),
		breakdowns: state.breakdowns.filter((b) => b.machineId !== id)
	};
}

/** Usuwa linię; jej maszyny zostają jako samodzielne, a zlecenia linii - bez maszyny. */
export function removeLine(state: PlanState, id: Id, now: number): PlanState {
	return {
		...state,
		...detachBlocks(state, id, now),
		lines: state.lines.filter((l) => l.id !== id)
	};
}
