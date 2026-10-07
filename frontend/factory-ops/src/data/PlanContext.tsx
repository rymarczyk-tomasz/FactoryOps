import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { archiveOld } from '../domain/archive';
import { isOngoing, resourceName } from '../domain/calendar';
import { formatDateTime } from '../domain/format';
import * as schedule from '../domain/schedule';
import { newId } from '../domain/ids';
import { applyLineDraft, applyMachineDraft, removeLine, removeMachine } from '../domain/machines';
import { addHours, nearestHourStart } from '../domain/shifts';
import { Block, BlockDraft, DayOverride, Id, LineDraft, MachineDraft, PlanState } from '../domain/types';
import { LocalStoragePlanRepository, PlanRepository } from './PlanRepository';
import { useHourClock } from './useHourClock';

const HISTORY_LIMIT = 50;

/** Po zmianie kalendarza, awarii lub liczby maszyn zlecenia trzeba ułożyć od nowa. */
/** `scope` - maszyny, których dotyczy zmiana (bez niej cały plan). */
const withReflow = (s: PlanState, scope?: Id[]): PlanState => ({ ...s, blocks: schedule.reflow(s.blocks, s, undefined, Date.now(), scope) });

/** Harmonogram zwraca te same obiekty dla zleceń, które się nie zmieniły (kolejność może być inna). */
const sameBlocks = (a: Block[], b: Block[]) => {
	if (a.length !== b.length) return false;
	const previous = new Set(a);
	return b.every((block) => previous.has(block));
};

const machineName = (s: PlanState, id: Id | undefined) => resourceName(s, id);
const breakdownMachine = (s: PlanState, id: Id) => s.breakdowns.filter((b) => b.id === id).map((b) => b.machineId);
const orderNo = (s: PlanState, id: Id) => s.blocks.find((b) => b.id === id)?.orderNo ?? '';

/** Zmiana ustawienia dnia: `value` undefined usuwa wyjątek. */
export interface DayChange {
	machineId?: Id;
	value: DayOverride | undefined;
}

/** Ustawia wyjątki dnia w kalendarzu zakładu i maszyn. */
function withDayChanges(s: PlanState, dayKey: string, changes: DayChange[]): PlanState {
	const apply = (overrides: Record<string, DayOverride> = {}, value: DayOverride | undefined) => {
		const next = { ...overrides };
		if (value === undefined) delete next[dayKey];
		else next[dayKey] = value;
		return next;
	};
	const plant = changes.find((c) => c.machineId === undefined);
	const byMachine = new Map(changes.filter((c) => c.machineId !== undefined).map((c) => [c.machineId, c.value]));
	return {
		...s,
		calendar: plant ? { overrides: apply(s.calendar.overrides, plant.value) } : s.calendar,
		machines: s.machines.map((m) => (byMachine.has(m.id) ? { ...m, overrides: apply(m.overrides, byMachine.get(m.id)) } : m))
	};
}

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
	/** Dodaje (bez `id`) albo zapisuje istniejącą maszynę. */
	saveMachine(draft: MachineDraft, id?: Id): Id;
	deleteMachine(id: Id): void;
	/** Dodaje (bez `id`) albo zapisuje istniejącą linię. */
	saveLine(draft: LineDraft, id?: Id): Id;
	deleteLine(id: Id): void;
	/** Zgłasza awarię maszyny trwającą od `start` (pełna godzina) - bez końca, dopóki ktoś jej nie zakończy. */
	reportBreakdown(machineId: Id, start: number): Id;
	/** Kończy trwającą awarię o najbliższej pełnej godzinie (albo o `end`). */
	endBreakdown(id: Id, end?: number): void;
	removeBreakdown(id: Id): void;
	/**
	 * Wyjątek w kalendarzu maszyny (`machineId`) albo całego zakładu (bez `machineId`).
	 * `undefined` usuwa wyjątek - dzień wraca do ustawienia domyślnego.
	 */
	setDayWorking(dayKey: string, working: DayOverride | undefined, machineId?: Id): void;
	/** Kilka zmian kalendarza jednego dnia naraz (jeden krok cofania). Bez `machineId` - cały zakład. */
	saveDay(dayKey: string, changes: DayChange[]): void;
	undo(): void;
	resetDemo(): Promise<void>;
	dismissNotice(): void;
}

interface PlanContextValue extends PlanActions {
	state: PlanState;
	/** „Teraz” dla statusów i widoków, odświeżane co pełną godzinę. Akcje liczą plan od bieżącej chwili. */
	now: number;
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
	const now = useHourClock();

	useEffect(() => {
		repo.load().then(setState);
	}, [repo]);

	useEffect(() => {
		if (state) repo.save(state);
	}, [repo, state]);

	// po wczytaniu planu i co pełną godzinę: stare zlecenia idą do archiwum, a trwające awarie rosną, więc przeliczamy zlecenia
	const loaded = state !== undefined;
	useEffect(() => {
		const current = stateRef.current;
		if (!current) return;
		const archived = archiveOld(current, Date.now());
		// rosną tylko trwające awarie, więc wystarczy przeliczyć ich maszyny
		const ongoing = archived.breakdowns.filter(isOngoing).map((b) => b.machineId);
		const blocks = ongoing.length ? schedule.reflow(archived.blocks, archived, undefined, Date.now(), ongoing) : archived.blocks;
		if (archived === current && sameBlocks(current.blocks, blocks)) return;
		const next = { ...archived, blocks };
		stateRef.current = next;
		setState(next);
	}, [now, loaded]);

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
			apply((s) => {
				const blocks = change(s);
				// nic się nie zmieniło (np. domknięcie przerw bez przerw) - bez komunikatu i kroku do cofnięcia
				return sameBlocks(s.blocks, blocks) ? s : { ...s, blocks };
			}, describe),
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
					(s) => schedule.addBlock(s.blocks, draft, id, s, Date.now()),
					(_, after) => `Dodano ${draft.orderNo} na ${machineName(after, draft.machineId)}`
				);
				return id;
			},
			updateBlock: (id, patch) =>
				withBlocks(
					(s) => schedule.updateBlock(s.blocks, id, patch, s, Date.now()),
					(before) => `Zapisano ${orderNo(before, id)}`
				),
			moveBlock: (id, start, machineId) =>
				withBlocks(
					(s) => schedule.moveBlock(s.blocks, id, start, machineId, s, Date.now()),
					(_, after) => {
						const block = after.blocks.find((b) => b.id === id);
						return `Przeniesiono ${block?.orderNo} na ${machineName(after, machineId)} · start ${block ? formatDateTime(block.start) : ''}`;
					}
				),
			deleteBlock: (id) =>
				withBlocks(
					(s) => schedule.removeBlock(s.blocks, id, s, Date.now()),
					(before) => `Usunięto ${orderNo(before, id)}`
				),
			compactMachine(machineId) {
				const before = stateRef.current;
				withBlocks(
					(s) => schedule.compactMachine(s.blocks, machineId, s, Date.now()),
					(previous) => `Domknięto przerwy na ${machineName(previous, machineId)}`
				);
				if (before && stateRef.current === before) notify(`Brak przerw do domknięcia na ${machineName(before, machineId)}`, false);
			},
			saveMachine(draft, existingId) {
				const id = existingId ?? newId();
				// system pracy i przynależność do linii zmieniają czas zleceń
				apply(
					(s) => withReflow({ ...s, ...applyMachineDraft(s, draft, id) }),
					() => `${existingId ? 'Zapisano' : 'Dodano'} ${draft.name}`
				);
				return id;
			},
			deleteMachine: (id) =>
				apply(
					(s) => withReflow(removeMachine(s, id)),
					(before) => `Usunięto ${machineName(before, id)}`
				),
			saveLine(draft, existingId) {
				const id = existingId ?? newId();
				apply(
					(s) => withReflow({ ...s, ...applyLineDraft(s, draft, id, newId) }),
					() => `${existingId ? 'Zapisano' : 'Dodano'} ${draft.name}`
				);
				return id;
			},
			deleteLine: (id) =>
				apply(
					(s) => withReflow(removeLine(s, id)),
					(before) => `Usunięto ${machineName(before, id)}`
				),
			reportBreakdown(machineId, start) {
				const id = newId();
				apply(
					(s) => withReflow({ ...s, breakdowns: [...s.breakdowns, { id, machineId, start: nearestHourStart(start) }] }, [machineId]),
					(before) => `Zgłoszono awarię na ${machineName(before, machineId)} · plan przeliczony`
				);
				return id;
			},
			endBreakdown: (id, end) =>
				apply(
					(s) =>
						withReflow(
							{
								...s,
								breakdowns: s.breakdowns.map((b) => (b.id === id ? { ...b, end: Math.max(nearestHourStart(end ?? Date.now()), addHours(b.start, 1)) } : b))
							},
							breakdownMachine(s, id)
						),
					(before) => `Zakończono awarię na ${machineName(before, before.breakdowns.find((b) => b.id === id)?.machineId)} · plan przeliczony`
				),
			removeBreakdown: (id) =>
				apply(
					(s) => withReflow({ ...s, breakdowns: s.breakdowns.filter((b) => b.id !== id) }, breakdownMachine(s, id)),
					(before) => `Usunięto awarię na ${machineName(before, before.breakdowns.find((b) => b.id === id)?.machineId)}`
				),
			setDayWorking: (dayKey, working, machineId) =>
				apply(
					(s) => withReflow(withDayChanges(s, dayKey, [{ machineId, value: working }]), machineId ? [machineId] : undefined),
					(before) => `Zmieniono kalendarz ${machineId ? machineName(before, machineId) : 'całego zakładu'} na ${dayKey}`
				),
			saveDay: (dayKey, changes) =>
				apply(
					(s) => {
						if (!changes.length) return s;
						// zmiana dla całego zakładu dotyczy wszystkich maszyn
						const plantChanged = changes.some((c) => c.machineId === undefined);
						return withReflow(withDayChanges(s, dayKey, changes), plantChanged ? undefined : changes.map((c) => c.machineId!));
					},
					() => `Zapisano kalendarz na ${dayKey}`
				),
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

	return <PlanContext.Provider value={{ state, now, canUndo: history.length > 0, notice, undo, ...actions }}>{children}</PlanContext.Provider>;
}

export function usePlan(): PlanContextValue {
	const context = useContext(PlanContext);
	if (!context) throw new Error('usePlan musi być użyty wewnątrz <PlanProvider>');
	return context;
}
