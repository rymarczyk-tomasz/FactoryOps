import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { capacityLookup } from '../domain/calendar';
import { formatDateTime } from '../domain/format';
import * as schedule from '../domain/schedule';
import { newId } from '../domain/ids';
import { applyMachineDraft } from '../domain/machines';
import { Block, BlockDraft, Breakdown, DayOverride, Id, MachineDraft, PlanState } from '../domain/types';
import { LocalStoragePlanRepository, PlanRepository } from './PlanRepository';

const HISTORY_LIMIT = 50;

/** Po zmianie kalendarza, awarii lub liczby maszyn zlecenia trzeba ułożyć od nowa. */
const withReflow = (s: PlanState): PlanState => ({ ...s, blocks: schedule.reflow(s.blocks, capacityLookup(s), undefined, Date.now()) });

const machineName = (s: PlanState, id: Id | undefined) => s.machines.find((m) => m.id === id)?.name ?? '';
const orderNo = (s: PlanState, id: Id) => s.blocks.find((b) => b.id === id)?.orderNo ?? '';

/** Komunikat po zmianie planu (z możliwością cofnięcia). `id` rośnie, żeby ten sam tekst pokazał się ponownie. */
export interface Notice {
	id: number;
	text: string;
	undoable: boolean;
}

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
	dismissNotice(): void;
}

interface PlanContextValue extends PlanActions {
	state: PlanState;
	canUndo: boolean;
	notice?: Notice;
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined);

export function PlanProvider({ children, repository }: { children: ReactNode; repository?: PlanRepository }) {
	const repo = useMemo(() => repository ?? new LocalStoragePlanRepository(), [repository]);
	const [state, setState] = useState<PlanState>();
	const [history, setHistory] = useState<PlanState[]>([]);
	const [notice, setNotice] = useState<Notice>();
	// aktualny stan dla akcji, które muszą zwrócić wynik synchronicznie (np. id nowego bloczka)
	const stateRef = useRef<PlanState>();
	stateRef.current = state;
	const noticeId = useRef(0);

	useEffect(() => {
		repo.load().then(setState);
	}, [repo]);

	useEffect(() => {
		if (state) repo.save(state);
	}, [repo, state]);

	const notify = useCallback((text: string, undoable: boolean) => setNotice({ id: ++noticeId.current, text, undoable }), []);

	/** Zmienia plan, zapamiętuje poprzedni stan do cofnięcia i pokazuje komunikat opisany przez `describe`. */
	const apply = useCallback(
		(change: (current: PlanState) => PlanState, describe?: (before: PlanState, after: PlanState) => string) => {
			const current = stateRef.current;
			if (!current) return;
			const next = change(current);
			if (next === current) return;
			stateRef.current = next;
			setHistory((h) => [...h.slice(-(HISTORY_LIMIT - 1)), current]);
			setState(next);
			if (describe) notify(describe(current, next), true);
		},
		[notify]
	);

	const withBlocks = useCallback(
		(change: (s: PlanState) => Block[], describe?: (before: PlanState, after: PlanState) => string) =>
			apply((s) => ({ ...s, blocks: change(s) }), describe),
		[apply]
	);

	const undo = useCallback(() => {
		const previous = history[history.length - 1];
		if (!previous) return;
		stateRef.current = previous;
		setState(previous);
		setHistory(history.slice(0, -1));
		notify('Cofnięto ostatnią zmianę', false);
	}, [history, notify]);

	const actions = useMemo<Omit<PlanActions, 'undo'>>(
		() => ({
			addBlock(draft) {
				const id = newId();
				withBlocks(
					(s) => schedule.addBlock(s.blocks, draft, id, capacityLookup(s), Date.now()),
					(_, after) => `Dodano ${draft.orderNo} na ${machineName(after, draft.machineId)}`
				);
				return id;
			},
			updateBlock: (id, patch) =>
				withBlocks(
					(s) => schedule.updateBlock(s.blocks, id, patch, capacityLookup(s), Date.now()),
					(before) => `Zapisano ${orderNo(before, id)}`
				),
			moveBlock: (id, start, machineId) =>
				withBlocks(
					(s) => schedule.moveBlock(s.blocks, id, start, machineId, capacityLookup(s), Date.now()),
					(_, after) => {
						const block = after.blocks.find((b) => b.id === id);
						return `Przeniesiono ${block?.orderNo} na ${machineName(after, machineId)} · start ${block ? formatDateTime(block.start) : ''}`;
					}
				),
			deleteBlock: (id) =>
				withBlocks(
					(s) => schedule.removeBlock(s.blocks, id, capacityLookup(s), Date.now()),
					(before) => `Usunięto ${orderNo(before, id)}`
				),
			compactMachine: (machineId) =>
				withBlocks(
					(s) => schedule.compactMachine(s.blocks, machineId, capacityLookup(s), Date.now()),
					(before) => `Domknięto przerwy na ${machineName(before, machineId)}`
				),
			saveMachine(draft, existingId) {
				const id = existingId ?? newId();
				// system pracy i liczba maszyn w linii zmieniają czas zleceń
				apply(
					(s) => withReflow({ ...s, ...applyMachineDraft(s.machines, s.breakdowns, draft, id) }),
					() => `${existingId ? 'Zapisano' : 'Dodano'} ${draft.name}`
				);
				return id;
			},
			deleteMachine: (id) =>
				apply(
					(s) => ({
						...s,
						machines: s.machines.filter((m) => m.id !== id),
						blocks: s.blocks.filter((b) => b.machineId !== id),
						breakdowns: s.breakdowns.filter((b) => b.machineId !== id)
					}),
					(before) => `Usunięto ${machineName(before, id)}`
				),
			addBreakdown(breakdown) {
				const id = newId();
				apply(
					(s) => withReflow({ ...s, breakdowns: [...s.breakdowns, { ...breakdown, id }] }),
					(before) => `Zgłoszono awarię na ${machineName(before, breakdown.machineId)} · plan przeliczony`
				);
				return id;
			},
			removeBreakdown: (id) =>
				apply(
					(s) => withReflow({ ...s, breakdowns: s.breakdowns.filter((b) => b.id !== id) }),
					(before) => `Usunięto awarię na ${machineName(before, before.breakdowns.find((b) => b.id === id)?.machineId)}`
				),
			setDayWorking(dayKey, working, machineId) {
				const withOverride = (overrides: Record<string, DayOverride> = {}) => {
					const next = { ...overrides };
					if (working === undefined) delete next[dayKey];
					else next[dayKey] = working;
					return next;
				};
				apply(
					(s) =>
						withReflow(
							machineId === undefined
								? { ...s, calendar: { overrides: withOverride(s.calendar.overrides) } }
								: { ...s, machines: s.machines.map((m) => (m.id === machineId ? { ...m, overrides: withOverride(m.overrides) } : m)) }
						),
					(before) => `Zmieniono kalendarz ${machineId ? machineName(before, machineId) : 'całego zakładu'} na ${dayKey}`
				);
			},
			async resetDemo() {
				const fresh = await repo.reset();
				stateRef.current = fresh;
				setHistory([]);
				setState(fresh);
				notify('Przywrócono dane przykładowe', false);
			},
			dismissNotice: () => setNotice(undefined)
		}),
		[apply, withBlocks, repo, notify]
	);

	if (!state) {
		return <div className="d-flex justify-content-center align-items-center vh-100 text-secondary">Wczytywanie planu…</div>;
	}

	return <PlanContext.Provider value={{ state, canUndo: history.length > 0, notice, undo, ...actions }}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
	const context = useContext(PlanContext);
	if (!context) throw new Error('usePlan musi być użyty wewnątrz <PlanProvider>');
	return context;
}
