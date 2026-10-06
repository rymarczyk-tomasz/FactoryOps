import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { capacityLookup } from '../domain/calendar';
import * as schedule from '../domain/schedule';
import { newId } from '../domain/ids';
import { applyMachineDraft } from '../domain/machines';
import { Block, BlockDraft, Breakdown, DayOverride, Id, MachineDraft, PlanState } from '../domain/types';
import { LocalStoragePlanRepository, PlanRepository } from './PlanRepository';

const HISTORY_LIMIT = 50;

/** Po zmianie kalendarza, awarii lub liczby maszyn zlecenia trzeba ułożyć od nowa. */
const withReflow = (s: PlanState): PlanState => ({ ...s, blocks: schedule.reflow(s.blocks, capacityLookup(s), undefined, Date.now()) });

interface PlanActions {
	addBlock(draft: BlockDraft): Id;
	updateBlock(id: Id, patch: Partial<Omit<Block, 'id' | 'end'>>): void;
	moveBlock(id: Id, start: number, machineId: Id): void;
	deleteBlock(id: Id): void;
	compactMachine(machineId: Id): void;
	/** Dodaje (bez `id`) albo zapisuje istniejącą maszynę lub linię. */
	saveMachine(draft: MachineDraft, id?: Id): Id;
	deleteMachine(id: Id): void;
	addBreakdown(breakdown: Omit<Breakdown, 'id'>): Id;
	removeBreakdown(id: Id): void;
	/**
	 * Wyjątek w kalendarzu maszyny (`machineId`) albo całego zakładu (bez `machineId`).
	 * `undefined` usuwa wyjątek - dzień wraca do ustawienia domyślnego.
	 */
	setDayWorking(dayKey: string, working: DayOverride | undefined, machineId?: Id): void;
	undo(): void;
	resetDemo(): Promise<void>;
}

interface PlanContextValue extends PlanActions {
	state: PlanState;
	canUndo: boolean;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function PlanProvider({ children, repository }: { children: ReactNode; repository?: PlanRepository }) {
	const repo = useMemo(() => repository ?? new LocalStoragePlanRepository(), [repository]);
	const [state, setState] = useState<PlanState>();
	const [history, setHistory] = useState<PlanState[]>([]);
	// aktualny stan dla akcji, które muszą zwrócić wynik synchronicznie (np. id nowego bloczka)
	const stateRef = useRef<PlanState>();
	stateRef.current = state;

	useEffect(() => {
		repo.load().then(setState);
	}, [repo]);

	useEffect(() => {
		if (state) repo.save(state);
	}, [repo, state]);

	const apply = useCallback((change: (current: PlanState) => PlanState) => {
		const current = stateRef.current;
		if (!current) return;
		const next = change(current);
		if (next === current) return;
		stateRef.current = next;
		setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), current]);
		setState(next);
	}, []);

	const withBlocks = useCallback(
		(change: (s: PlanState) => Block[]) => apply((s) => ({ ...s, blocks: change(s) })),
		[apply]
	);

	const undo = useCallback(() => {
		const previous = history[history.length - 1];
		if (!previous) return;
		stateRef.current = previous;
		setState(previous);
		setHistory(history.slice(0, -1));
	}, [history]);

	const actions = useMemo<Omit<PlanActions, 'undo'>>(
		() => ({
			addBlock(draft) {
				const id = newId();
				withBlocks((s) => schedule.addBlock(s.blocks, draft, id, capacityLookup(s), Date.now()));
				return id;
			},
			updateBlock: (id, patch) => withBlocks((s) => schedule.updateBlock(s.blocks, id, patch, capacityLookup(s), Date.now())),
			moveBlock: (id, start, machineId) => withBlocks((s) => schedule.moveBlock(s.blocks, id, start, machineId, capacityLookup(s), Date.now())),
			deleteBlock: (id) => withBlocks((s) => schedule.removeBlock(s.blocks, id, capacityLookup(s), Date.now())),
			compactMachine: (machineId) => withBlocks((s) => schedule.compactMachine(s.blocks, machineId, capacityLookup(s), Date.now())),
			saveMachine(draft, existingId) {
				const id = existingId ?? newId();
				// system pracy i liczba maszyn w linii zmieniają czas zleceń
				apply((s) => withReflow({ ...s, ...applyMachineDraft(s.machines, s.breakdowns, draft, id) }));
				return id;
			},
			deleteMachine: (id) =>
				apply((s) => ({
					...s,
					machines: s.machines.filter((m) => m.id !== id),
					blocks: s.blocks.filter((b) => b.machineId !== id),
					breakdowns: s.breakdowns.filter((b) => b.machineId !== id)
				})),
			addBreakdown(breakdown) {
				const id = newId();
				apply((s) => withReflow({ ...s, breakdowns: [...s.breakdowns, { ...breakdown, id }] }));
				return id;
			},
			removeBreakdown: (id) => apply((s) => withReflow({ ...s, breakdowns: s.breakdowns.filter((b) => b.id !== id) })),
			setDayWorking(dayKey, working, machineId) {
				const withOverride = (overrides: Record<string, DayOverride> = {}) => {
					const next = { ...overrides };
					if (working === undefined) delete next[dayKey];
					else next[dayKey] = working;
					return next;
				};
				apply((s) =>
					withReflow(
						machineId === undefined
							? { ...s, calendar: { overrides: withOverride(s.calendar.overrides) } }
							: { ...s, machines: s.machines.map((m) => (m.id === machineId ? { ...m, overrides: withOverride(m.overrides) } : m)) }
					)
				);
			},
			async resetDemo() {
				const fresh = await repo.reset();
				stateRef.current = fresh;
				setHistory([]);
				setState(fresh);
			}
		}),
		[apply, withBlocks, repo]
	);

	if (!state) {
		return <div className="d-flex justify-content-center align-items-center vh-100 text-secondary">Wczytywanie planu…</div>;
	}

	return <PlanContext.Provider value={{ state, canUndo: history.length > 0, undo, ...actions }}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
	const context = useContext(PlanContext);
	if (!context) throw new Error('usePlan musi być użyty wewnątrz <PlanProvider>');
	return context;
}
