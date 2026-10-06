import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as schedule from '../domain/schedule';
import { newId } from '../domain/ids';
import { Block, BlockDraft, Id, PlanState } from '../domain/types';
import { LocalStoragePlanRepository, PlanRepository } from './PlanRepository';

const HISTORY_LIMIT = 50;

interface PlanActions {
	addBlock(draft: BlockDraft): Id;
	updateBlock(id: Id, patch: Partial<Omit<Block, 'id' | 'end'>>): void;
	moveBlock(id: Id, start: number, machineId: Id): void;
	resizeBlock(id: Id, end: number): void;
	deleteBlock(id: Id): void;
	compactMachine(machineId: Id): void;
	addMachine(name: string): Id;
	renameMachine(id: Id, name: string): void;
	deleteMachine(id: Id): void;
	/** `undefined` przywraca domyślne ustawienie dnia (pon-pt pracujące). */
	setDayWorking(dayKey: string, working: boolean | undefined): void;
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
				withBlocks((s) => schedule.addBlock(s.blocks, draft, id, s.calendar, Date.now()));
				return id;
			},
			updateBlock: (id, patch) => withBlocks((s) => schedule.updateBlock(s.blocks, id, patch, s.calendar)),
			moveBlock: (id, start, machineId) => withBlocks((s) => schedule.moveBlock(s.blocks, id, start, machineId, s.calendar)),
			resizeBlock: (id, end) => withBlocks((s) => schedule.resizeBlock(s.blocks, id, end, s.calendar)),
			deleteBlock: (id) => withBlocks((s) => schedule.removeBlock(s.blocks, id)),
			compactMachine: (machineId) => withBlocks((s) => schedule.compactMachine(s.blocks, machineId, s.calendar)),
			addMachine(name) {
				const id = newId();
				apply((s) => ({ ...s, machines: [...s.machines, { id, name }] }));
				return id;
			},
			renameMachine: (id, name) => apply((s) => ({ ...s, machines: s.machines.map((m) => (m.id === id ? { ...m, name } : m)) })),
			deleteMachine: (id) =>
				apply((s) => ({
					...s,
					machines: s.machines.filter((m) => m.id !== id),
					blocks: s.blocks.filter((b) => b.machineId !== id)
				})),
			setDayWorking(dayKey, working) {
				apply((s) => {
					const overrides = { ...s.calendar.overrides };
					if (working === undefined) delete overrides[dayKey];
					else overrides[dayKey] = working;
					const calendar = { overrides };
					return { ...s, calendar, blocks: schedule.reflow(s.blocks, calendar) };
				});
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
