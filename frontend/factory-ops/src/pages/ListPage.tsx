import { saveAs } from 'file-saver';
import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import BlockFormModal from '../components/BlockFormModal';
import MultiSelect, { MultiSelectOption } from '../components/MultiSelect';
import PageHeader from '../components/PageHeader';
import { READINESS } from '../components/Readiness';
import SaveViewModal from '../components/SaveViewModal';
import StartRangeFilter from '../components/StartRangeFilter';
import { NARROW_SCREEN, useMediaQuery } from '../components/useMediaQuery';
import { PlanNavigationState } from '../components/planNavigation';
import { projectColorVar } from '../components/projectColor';
import { ListFilters, ListView, loadListViews, saveListViews } from '../data/listViews';
import { usePlan } from '../data/PlanContext';
import { ARCHIVE_AFTER_DAYS } from '../domain/archive';
import { lineMachines, resourceName, standaloneMachines } from '../domain/calendar';
import { formatDateTime, formatHours, orderLabel, programmerName, STATUS_LABELS, toLocalInputValue } from '../domain/format';
import { compareByLevels, SortLevel, StartRange, startRangeBounds, toggleSortLevel } from '../domain/listView';
import { blockStatus } from '../domain/schedule';
import { ArchivedBlock, Block, BlockStatus, Id, Programmer } from '../domain/types';
import './ListPage.css';
import Segmented from '../components/Segmented';

type SortKey = 'start' | 'projectNo' | 'operation' | 'machine' | 'hours' | 'status';
const SORT_LABELS: Record<SortKey, string> = { start: 'start', projectNo: 'projekt', operation: 'zlecenie', machine: 'zasób', hours: 'czas', status: 'status' };
const DEFAULT_SORT: SortLevel<SortKey>[] = [{ key: 'start', direction: 1 }];

/** Tyle wierszy pokazujemy naraz - plan może mieć tysiące zleceń. */
const PAGE_SIZE = 200;

type ListBlock = Block & Partial<Pick<ArchivedBlock, 'machineName'>>;

/** Filtr programisty: zlecenia bez programisty. */
const UNASSIGNED = '__none__';
/** Wartość filtra maszyn dla zleceń bez maszyny. */
const NO_MACHINE = '__no_machine__';

/** Filtr gotowości: brak materiału, brak programu albo wszystko gotowe (wybrane warunki łączy „lub”). */
type ReadinessFilter = 'noMaterial' | 'noProgram' | 'ready';
const READINESS_FILTERS: MultiSelectOption[] = [
	{ value: 'noMaterial', label: 'Brak materiału' },
	{ value: 'noProgram', label: 'Brak programu' },
	{ value: 'ready', label: 'Materiał i program gotowe' }
];
/** Wbudowany widok: zlecenia bez programisty, które startują w ciągu 14 dni - po maszynach, potem po starcie. */
const BUILT_IN_VIEWS: ListView[] = [
	{
		id: 'builtin:to-program',
		name: 'Do zaprogramowania · 14 dni',
		filters: {
			statusTab: 'planned',
			machineIds: [],
			projectNos: [],
			programmerIds: [UNASSIGNED],
			readiness: [],
			startRange: { preset: 'twoWeeks' },
			sort: [
				{ key: 'machine', direction: 1 },
				{ key: 'start', direction: 1 }
			]
		}
	}
];
const DEFAULT_FILTERS: ListFilters = {
	statusTab: 'active',
	machineIds: [],
	projectNos: [],
	programmerIds: [],
	readiness: [],
	startRange: { preset: 'all' },
	sort: DEFAULT_SORT
};
const START_LABELS: Record<StartRange['preset'], string> = { all: '', today: 'start dziś', week: 'start +7 dni', twoWeeks: 'start +14 dni', custom: 'start: własny zakres' };

const matchesReadiness = (b: Block, filter: string) =>
	(filter as ReadinessFilter) === 'noMaterial' ? !b.materialReady : filter === 'noProgram' ? !b.programReady : !!b.materialReady && !!b.programReady;

/** Zakładki statusów: „Wszystkie” to zlecenia niezakończone - zakończone są pod osobną zakładką. */
type StatusTab = 'active' | BlockStatus;
const STATUS_TABS: { key: StatusTab; label: string }[] = [
	{ key: 'active', label: 'Wszystkie' },
	{ key: 'in_progress', label: 'W toku' },
	{ key: 'planned', label: 'Zaplanowane' },
	{ key: 'done', label: 'Zakończone' }
];
const STATUS_ORDER: Record<BlockStatus, number> = { unassigned: 0, in_progress: 1, planned: 2, done: 3 };
const inTab = (tab: StatusTab, status: BlockStatus) => (tab === 'active' ? status !== 'done' : status === tab);

/** Pełne imię i nazwisko; na węższym ekranie „Piotr W.” (pełne w podpowiedzi). */
const shortName = (p: Programmer) => `${p.name} ${p.surname.charAt(0)}.`;
const initials = (p: Programmer) => `${p.name.charAt(0)}${p.surname.charAt(0)}`.toUpperCase();

/** Pole tekstowe, w którym pisze użytkownik - wtedy „/” wpisuje znak zamiast przenosić do wyszukiwarki. */
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Kliknięcie w kontrolkę w wierszu (przycisk, menu) nie przełącza zaznaczenia wiersza. */
const fromControl = (e: MouseEvent) => (e.target as HTMLElement).closest('button, a, input, .dropdown-menu') !== null;

interface ProgrammerMenuProps {
	programmers: Programmer[];
	onPick: (programmerId: Id | undefined) => void;
}

const ProgrammerMenuItems = ({ programmers, onPick }: ProgrammerMenuProps) => (
	<>
		{programmers.map((p) => (
			<Dropdown.Item key={p.id} as="button" type="button" onClick={() => onPick(p.id)}>
				{programmerName(p)}
			</Dropdown.Item>
		))}
		<Dropdown.Divider />
		<Dropdown.Item as="button" type="button" className="text-warning-emphasis" onClick={() => onPick(undefined)}>
			Nie przypisano
		</Dropdown.Item>
	</>
);

const ListPage = () => {
	const { state, now, updateBlock, updateBlocks } = usePlan();
	const narrow = useMediaQuery(NARROW_SCREEN);
	const personLabel = (p: Programmer) => (narrow ? shortName(p) : programmerName(p));
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [statusTab, setStatusTab] = useState<StatusTab>('active');
	const [machineIds, setMachineIds] = useState<string[]>([]);
	const [projectNos, setProjectNos] = useState<string[]>([]);
	const [programmerIds, setProgrammerIds] = useState<string[]>([]);
	const [readiness, setReadiness] = useState<string[]>([]);
	const [sort, setSort] = useState<SortLevel<SortKey>[]>(DEFAULT_SORT);
	const [startRange, setStartRange] = useState<StartRange>({ preset: 'all' });
	const [views, setViews] = useState<ListView[]>(loadListViews);
	const [savingView, setSavingView] = useState(false);
	const [archived, setArchived] = useState(false);
	const [selectedIds, setSelectedIds] = useState<Set<Id>>(() => new Set());
	const [creating, setCreating] = useState(false);
	const searchRef = useRef<HTMLInputElement>(null);
	/** Ostatnio kliknięty wiersz (indeks na liście) - Shift+klik zaznacza zakres od niego. */
	const anchorRef = useRef<number>();

	// „/” przenosi do wyszukiwarki
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || document.querySelector('.modal.show')) return;
			e.preventDefault();
			searchRef.current?.focus();
			searchRef.current?.select();
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, []);

	const machineNames = useMemo(() => new Map([...state.lines, ...state.machines].map((m) => [m.id, resourceName(state, m.id)])), [state]);
	const programmers = useMemo(() => new Map(state.programmers.map((p) => [p.id, p])), [state.programmers]);

	// opcje filtrów: linie z ich maszynami, samodzielne maszyny, projekty po numerze
	const machineOptions = useMemo<MultiSelectOption[]>(
		() => [
			...(state.blocks.some((b) => b.machineId === null) ? [{ value: NO_MACHINE, label: 'Bez maszyny', group: 'Bez maszyny' }] : []),
			...state.lines.flatMap((line) => [
				{ value: line.id, label: `${line.name} (cała linia)`, group: 'Linie produkcyjne' },
				...lineMachines(line, state.machines).map((m) => ({ value: m.id, label: m.name, group: 'Linie produkcyjne', indent: true, mono: true }))
			]),
			...standaloneMachines(state).map((m) => ({ value: m.id, label: m.name, group: 'Maszyny', mono: true }))
		],
		[state]
	);
	const projectOptions = useMemo<MultiSelectOption[]>(() => {
		const names = new Map([...state.archive, ...state.blocks].map((b) => [b.projectNo, b.project]));
		return [...names.entries()].sort(([a], [b]) => a.localeCompare(b, 'pl', { numeric: true })).map(([no, name]) => ({ value: no, label: `${no} · ${name}` }));
	}, [state.blocks, state.archive]);
	const programmerOptions = useMemo<MultiSelectOption[]>(
		() => [{ value: UNASSIGNED, label: 'Nie przypisano' }, ...state.programmers.map((p) => ({ value: p.id, label: programmerName(p) }))],
		[state.programmers]
	);

	// archiwum: zlecenia zakończone ponad 30 dni temu, tylko do wglądu
	const source: ListBlock[] = archived ? state.archive : state.blocks;
	const statusOf = (b: Block): BlockStatus => (archived ? 'done' : blockStatus(b, now));
	const nameOf = (b: ListBlock) => b.machineName ?? (b.machineId === null ? 'Bez maszyny' : (machineNames.get(b.machineId) ?? ''));

	const startBounds = useMemo(() => startRangeBounds(startRange, now), [startRange, now]);
	// wszystkie filtry poza statusem i programistą - z tego liczymy liczniki zakładek i „Bez programisty”
	// filtry poza maszyną - z tego liczy się też pigułka „Bez maszyny” (z pominięciem własnego filtra)
	const filteredAnyMachine = useMemo(() => {
		const q = query.trim().toLowerCase();
		return source.filter(
			(b) =>
				(!q || [b.orderNo ?? '', b.projectNo, b.project, b.operation, orderLabel(b)].some((f) => f.toLowerCase().includes(q))) &&
				(projectNos.length === 0 || projectNos.includes(b.projectNo)) &&
				(readiness.length === 0 || readiness.some((r) => matchesReadiness(b, r))) &&
				(!startBounds || (b.start >= startBounds[0] && b.start < startBounds[1]))
		);
	}, [source, query, projectNos, readiness, startBounds]);
	const filtered = useMemo(
		() => (machineIds.length === 0 ? filteredAnyMachine : filteredAnyMachine.filter((b) => machineIds.includes(b.machineId ?? NO_MACHINE))),
		[filteredAnyMachine, machineIds]
	);

	const statuses = useMemo(() => new Map(filtered.map((b) => [b.id, statusOf(b)])), [filtered, archived, now]); // eslint-disable-line react-hooks/exhaustive-deps
	const tabCounts = useMemo(() => {
		const byProgrammer = filtered.filter((b) => programmerIds.length === 0 || programmerIds.includes(b.programmerId ?? UNASSIGNED));
		return Object.fromEntries(STATUS_TABS.map(({ key }) => [key, byProgrammer.filter((b) => inTab(key, statuses.get(b.id)!)).length])) as Record<StatusTab, number>;
	}, [filtered, programmerIds, statuses]);
	const unassignedCount = useMemo(() => filtered.filter((b) => !b.programmerId && inTab(statusTab, statuses.get(b.id)!)).length, [filtered, statuses, statusTab]);

	const rows = useMemo(() => {
		const sortValue = (block: ListBlock, key: SortKey): string | number =>
			key === 'machine'
				? nameOf(block)
				: key === 'status'
					? STATUS_ORDER[statuses.get(block.id)!]
					: key === 'operation'
						? orderLabel(block)
						: ((block[key] ?? '') as string | number);
		const compare = compareByLevels(sort, sortValue);
		return filtered
			.filter((b) => (archived || inTab(statusTab, statuses.get(b.id)!)) && (programmerIds.length === 0 || programmerIds.includes(b.programmerId ?? UNASSIGNED)))
			.sort((a, b) => compare(a, b) || a.start - b.start);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filtered, statuses, archived, statusTab, programmerIds, sort, machineNames]);

	// po zmianie filtrów lub sortowania znowu pokazujemy pierwszą porcję wierszy
	const pageKey = JSON.stringify([archived, query, statusTab, machineIds, projectNos, programmerIds, readiness, startRange, sort]);
	const [page, setPage] = useState({ key: pageKey, limit: PAGE_SIZE });
	const limit = page.key === pageKey ? page.limit : PAGE_SIZE;
	const shown = rows.slice(0, limit);

	// zaznaczenie dotyczy zleceń, które wciąż są w źródle (np. po przełączeniu archiwum - czyścimy)
	const sourceIds = useMemo(() => new Set(source.map((b) => b.id)), [source]);
	const selected = [...selectedIds].filter((id) => sourceIds.has(id));
	const selectedBlocks = source.filter((b) => selectedIds.has(b.id));
	const shownSelected = shown.filter((b) => selectedIds.has(b.id)).length;
	const allShownSelected = shown.length > 0 && shownSelected === shown.length;
	const someShownSelected = shownSelected > 0 && !allShownSelected;
	/** Klik przełącza wiersz; z Shiftem ustawia cały zakres od ostatnio klikniętego na stan klikniętego po zmianie. */
	const toggleRow = (index: number, shift: boolean) => {
		const id = shown[index].id;
		const checked = !selectedIds.has(id);
		const anchor = anchorRef.current;
		const [from, to] = shift && anchor !== undefined && anchor < shown.length ? [Math.min(anchor, index), Math.max(anchor, index)] : [index, index];
		setSelectedIds((current) => {
			const next = new Set(current);
			shown.slice(from, to + 1).forEach((b) => (checked ? next.add(b.id) : next.delete(b.id)));
			return next;
		});
		anchorRef.current = index;
	};
	// tylko wiersze na ekranie (pierwsze 200), nie wszystkie pasujące do filtrów
	const toggleAllShown = () =>
		setSelectedIds((current) => {
			const next = new Set(current);
			shown.forEach((b) => (allShownSelected ? next.delete(b.id) : next.add(b.id)));
			return next;
		});
	const clearSelection = () => setSelectedIds(new Set());

	// klik - sortowanie po jednej kolumnie, Shift+klik - kolejny poziom (numer poziomu widać przy strzałce)
	const sortHeader = (key: SortKey, label: string, className = '') => {
		const index = sort.findIndex((l) => l.key === key);
		const level = sort[index];
		return (
			<button
				type="button"
				className={`list-sort ${level ? 'is-sorted' : ''} ${className}`}
				aria-sort={level ? (level.direction === 1 ? 'ascending' : 'descending') : 'none'}
				title="Klik: sortuj · Shift+klik: dodaj kolejny poziom sortowania"
				onMouseDown={(e) => e.shiftKey && e.preventDefault()}
				onClick={(e) => setSort((current) => toggleSortLevel(current, key, e.shiftKey))}>
				{label}
				{level && (
					<span className="sort-arrow">
						{sort.length > 1 && <span className="sort-level">{index + 1}</span>}
						{level.direction === 1 ? '▲' : '▼'}
					</span>
				)}
			</button>
		);
	};

	// --- zapisane widoki: filtry i sortowanie pod nazwą, w tej przeglądarce ---
	const currentFilters: ListFilters = { statusTab, machineIds, projectNos, programmerIds, readiness, startRange, sort };
	const sameFilters = (a: ListFilters, b: ListFilters) => JSON.stringify(a) === JSON.stringify(b);
	const allViews = [...BUILT_IN_VIEWS, ...views];
	const activeView = allViews.find((v) => sameFilters(v.filters, currentFilters));
	const isDefault = sameFilters(currentFilters, DEFAULT_FILTERS);
	const applyView = (filters: ListFilters) => {
		setStatusTab(filters.statusTab as StatusTab);
		setMachineIds(filters.machineIds);
		setProjectNos(filters.projectNos);
		setProgrammerIds(filters.programmerIds);
		setReadiness(filters.readiness);
		setStartRange(filters.startRange);
		setSort(filters.sort as SortLevel<SortKey>[]);
		clearSelection();
	};
	const storeViews = (next: ListView[]) => {
		setViews(next);
		saveListViews(next);
	};
	/** Opis zapisywanego widoku: „Zaplanowane · bez programisty · start +14 dni · sortuj: zasób, start”. */
	const filtersSummary = () =>
		[
			STATUS_TABS.find((t) => t.key === statusTab)?.label,
			machineIds.length > 0 && `maszyny: ${machineIds.length}`,
			projectNos.length > 0 && `projekty: ${projectNos.join(', ')}`,
			unassignedOnly ? 'bez programisty' : programmerIds.length > 0 && `programiści: ${programmerIds.length}`,
			readiness.length > 0 && READINESS_FILTERS.filter((r) => readiness.includes(r.value)).map((r) => r.label.toLowerCase()).join(' lub '),
			START_LABELS[startRange.preset],
			`sortuj: ${sort.map((l) => SORT_LABELS[l.key]).join(', ')}`
		]
			.filter(Boolean)
			.join(' · ');

	const unassignedOnly = programmerIds.length === 1 && programmerIds[0] === UNASSIGNED;
	const noMachineOnly = machineIds.length === 1 && machineIds[0] === NO_MACHINE;
	// w ramach bieżących filtrów (status, programista, projekt…), bez filtra maszyn - jak „Bez programisty”
	const noMachineCount = useMemo(
		() =>
			filteredAnyMachine.filter(
				(b) =>
					b.machineId === null &&
					(archived || inTab(statusTab, statusOf(b))) &&
					(programmerIds.length === 0 || programmerIds.includes(b.programmerId ?? UNASSIGNED))
			).length,
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[filteredAnyMachine, archived, statusTab, programmerIds, now]
	);
	const showOnPlan = (id: Id) => navigate('/', { state: { showBlock: id } satisfies PlanNavigationState });
	// kilka zleceń: plan wyróżnia je jak wyniki wyszukiwania i przeskakuje między nimi strzałkami
	const showManyOnPlan = (ids: Id[]) => navigate('/', { state: (ids.length === 1 ? { showBlock: ids[0] } : { showBlocks: ids }) satisfies PlanNavigationState });

	/** Eksport wierszy do CSV ze średnikami i BOM, który polski Excel otwiera bez importu. */
	const exportCsv = (blocks: ListBlock[], suffix = '') => {
		const header = [
			'Start',
			'Koniec',
			'Stopień / detal',
			'Nr projektu',
			'Projekt',
			'Nr zamówienia',
			'Linia / maszyna',
			'Czas pracy [h]',
			'Status',
			'Programista',
			'Materiał gotowy',
			'Program gotowy',
			'Uwagi'
		];
		const cell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
		const date = (ms: number) => toLocalInputValue(ms).replace('T', ' ');
		const lines = blocks.map((b) =>
			[
				date(b.start),
				date(b.end),
				b.operation,
				b.projectNo,
				b.project,
				b.orderNo ?? '',
				nameOf(b),
				String(b.hours).replace('.', ','),
				STATUS_LABELS[statusOf(b)],
				programmerName(programmers.get(b.programmerId ?? '')),
				b.materialReady ? 'tak' : 'nie',
				b.programReady ? 'tak' : 'nie',
				b.note ?? ''
			]
				.map(cell)
				.join(';')
		);
		const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
		saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `zlecenia-${toLocalInputValue(now).slice(0, 10)}${suffix}.csv`);
	};

	const activeCount = state.blocks.filter((b) => blockStatus(b, now) !== 'done').length;

	return (
		<>
			<PageHeader title="Lista zleceń" context={`${activeCount} aktywnych · ${state.archive.length} w archiwum`}>
				<div className="search-field list-search">
					<input
						ref={searchRef}
						type="search"
						placeholder="Szukaj: IMR, stopień, projekt…"
						aria-label="Szukaj zleceń"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Escape') {
								setQuery('');
								e.currentTarget.blur();
							}
						}}
					/>
					<span className="kbd-hint" aria-hidden="true">
						/
					</span>
				</div>
				<Button variant="outline-secondary" disabled={rows.length === 0} onClick={() => exportCsv(rows)}>
					Eksport do Excela
				</Button>
				<Button onClick={() => setCreating(true)}>Nowe zlecenie</Button>
			</PageHeader>

			<div className="list-views" role="group" aria-label="Zapisane widoki">
				<span className={`view-pill ${isDefault ? 'active' : ''}`}>
					<button type="button" className="view-pill-name" aria-pressed={isDefault} onClick={() => applyView(DEFAULT_FILTERS)}>
						Wszystkie zlecenia
					</button>
				</span>
				{allViews.map((view) => {
					const builtIn = view.id.startsWith('builtin:');
					const active = view === activeView;
					return (
						<span key={view.id} className={`view-pill ${active ? 'active' : ''} ${builtIn ? '' : 'is-removable'}`}>
							<button type="button" className="view-pill-name" aria-pressed={active} onClick={() => applyView(view.filters)}>
								{view.name}
							</button>
							{!builtIn && (
								<button
									type="button"
									className="view-pill-remove"
									aria-label={`Usuń widok ${view.name}`}
									title="Usuń widok"
									onClick={() => storeViews(views.filter((v) => v.id !== view.id))}>
									×
								</button>
							)}
						</span>
					);
				})}
				<button type="button" className="view-save" disabled={activeView !== undefined || isDefault} onClick={() => setSavingView(true)}>
					+ Zapisz widok
				</button>
			</div>

			<div className="list-filters">
				{archived ? (
					<span className="list-archive-note">Archiwum · zlecenia zakończone ponad {ARCHIVE_AFTER_DAYS} dni temu, tylko do wglądu</span>
				) : (
					<Segmented
						label="Status"
						value={statusTab}
						onChange={setStatusTab}
						options={STATUS_TABS.map((tab) => ({
							value: tab.key,
							label: (
								<>
									{tab.label}
									<span className="segmented-count mono">{tabCounts[tab.key]}</span>
								</>
							)
						}))}
					/>
				)}
				<MultiSelect id="filterMachine" label="Maszyna" allLabel="wszystkie" options={machineOptions} selected={machineIds} onChange={setMachineIds} />
				<MultiSelect id="filterProject" label="Projekt" allLabel="wszystkie" options={projectOptions} selected={projectNos} onChange={setProjectNos} />
				<MultiSelect id="filterProgrammer" label="Programista" allLabel="wszyscy" options={programmerOptions} selected={programmerIds} onChange={setProgrammerIds} />
				<MultiSelect id="filterReadiness" label="Gotowość" allLabel="wszystkie" options={READINESS_FILTERS} selected={readiness} onChange={setReadiness} />
				<StartRangeFilter value={startRange} onChange={setStartRange} />
				<span className="list-filters-extra">
					{!archived && (noMachineCount > 0 || noMachineOnly) && (
						<button
							type="button"
							className={`filter-pill-danger ${noMachineOnly ? 'active' : ''}`}
							aria-pressed={noMachineOnly}
							title="Zlecenia, których maszynę lub linię usunięto - przypisz je na planie"
							onClick={() => setMachineIds(noMachineOnly ? [] : [NO_MACHINE])}>
							Bez maszyny · <span className="mono">{noMachineCount}</span>
						</button>
					)}
					{!archived && (
						<button
						type="button"
						className={`filter-pill-warn ${unassignedOnly ? 'active' : ''}`}
						aria-pressed={unassignedOnly}
						onClick={() => setProgrammerIds(unassignedOnly ? [] : [UNASSIGNED])}>
						Bez programisty <span className="mono">{unassignedCount}</span>
						</button>
					)}
					<Form.Check
					type="switch"
					id="showArchive"
					className="list-archive-switch"
					label="Archiwum"
					title={`Zlecenia zakończone ponad ${ARCHIVE_AFTER_DAYS} dni temu (${state.archive.length})`}
					checked={archived}
					onChange={(e) => {
						setArchived(e.target.checked);
						clearSelection();
					}}
					/>
				</span>
			</div>

			<div className="list-panel">
				<div className="list-grid list-head" role="row">
					<span className="list-check">
						<button
							type="button"
							className="check-button"
							aria-label={`Zaznacz widoczne wiersze (${shown.length})`}
							title={`${allShownSelected ? 'Odznacz' : 'Zaznacz'} widoczne wiersze (${shown.length}) - nie wszystkie ${rows.length} pasujące do filtrów`}
							aria-pressed={someShownSelected ? 'mixed' : allShownSelected}
							onClick={toggleAllShown}>
							<span className={`check-box ${allShownSelected ? 'is-checked' : someShownSelected ? 'is-mixed' : ''}`}>
								{allShownSelected ? '✓' : someShownSelected ? '–' : ''}
							</span>
						</button>
					</span>
					{sortHeader('status', 'Status')}
					{sortHeader('operation', 'Zlecenie')}
					{sortHeader('projectNo', 'Projekt')}
					{sortHeader('machine', 'Zasób')}
					{sortHeader('start', 'Start → koniec')}
					{sortHeader('hours', 'Czas', 'text-end')}
					<span className="list-readiness-head" title="Gotowość: materiał i program">
						{READINESS.map(({ flag, label, Icon }) => (
							<Icon key={flag} size={12} aria-label={label} />
						))}
					</span>
					<span>Programista</span>
				</div>
				<div className="list-rows">
					{shown.map((block, index) => {
						const status = statuses.get(block.id)!;
						const programmer = programmers.get(block.programmerId ?? '');
						const checked = selectedIds.has(block.id);
						return (
							<div
								key={block.id}
								role="row"
								aria-selected={checked}
								className={`list-grid list-row ${checked ? 'is-selected' : ''}`}
								onMouseDown={(e) => e.shiftKey && e.preventDefault()}
								onClick={(e) => !fromControl(e) && toggleRow(index, e.shiftKey)}>
								<span className="list-check">
									<button
										type="button"
										className="check-button"
										aria-label={`Zaznacz ${orderLabel(block)}`}
										aria-pressed={checked}
										onClick={(e) => toggleRow(index, e.shiftKey)}>
										<span className={`check-box ${checked ? 'is-checked' : ''}`}>{checked ? '✓' : ''}</span>
									</button>
								</span>
								<span className={`list-status status-${status}`}>
									<span className="status-dot" />
									{STATUS_LABELS[status]}
								</span>
								<span className="list-order">
									{archived ? (
										<span className="list-title">{orderLabel(block)}</span>
									) : (
										<button type="button" className="list-title" title="Pokaż na planie" onClick={() => showOnPlan(block.id)}>
											{orderLabel(block)}
										</button>
									)}
								</span>
								<span className="list-project">
									<span className="project-chip mono" style={projectColorVar(block, state.projects)}>
										{block.projectNo}
									</span>
									<span className="list-ellipsis">{block.project}</span>
								</span>
								<span className="list-resource mono" title={nameOf(block)}>
									{nameOf(block)}
								</span>
								<span className="list-dates mono">
									<span>{formatDateTime(block.start)}</span>
									<span className="list-dates-end">→ {formatDateTime(block.end)}</span>
									{block.machineId === null && !archived && <span className="last-plan">ostatni plan</span>}
								</span>
								<span className="list-hours mono">{formatHours(block.hours)}</span>
								<span className="list-readiness">
									{READINESS.map(({ flag, label, missing, Icon }) => (
										<button
											key={flag}
											type="button"
											className={`readiness-toggle ${block[flag] ? 'is-on' : 'is-off'}`}
											aria-pressed={!!block[flag]}
											aria-label={`${label} · ${orderLabel(block)}`}
											title={`${block[flag] ? label : missing}${archived ? '' : ' - kliknij, żeby zmienić'}`}
											disabled={archived}
											onClick={() => updateBlock(block.id, { [flag]: !block[flag] })}>
											<Icon size={14} aria-hidden="true" />
										</button>
									))}
								</span>
								<span className="list-programmer">
									{archived ? (
										programmer && (
											<>
												<span className="avatar">{initials(programmer)}</span>
												<span className="list-ellipsis" title={programmerName(programmer)}>
													{personLabel(programmer)}
												</span>
											</>
										)
									) : (
										<Dropdown>
											<Dropdown.Toggle
												as="button"
												bsPrefix={programmer ? 'programmer-toggle' : 'assign-toggle'}
												aria-label={`Programista ${orderLabel(block)}`}>
												{programmer ? (
													<>
														<span className="avatar">{initials(programmer)}</span>
														<span className="list-ellipsis" title={programmerName(programmer)}>
															{personLabel(programmer)}
														</span>
													</>
												) : (
													'Przypisz ▾'
												)}
											</Dropdown.Toggle>
											<Dropdown.Menu>
												<ProgrammerMenuItems programmers={state.programmers} onPick={(id) => updateBlock(block.id, { programmerId: id })} />
											</Dropdown.Menu>
										</Dropdown>
									)}
								</span>
							</div>
						);
					})}
					{rows.length === 0 && <div className="list-empty">Brak zleceń dla wybranych filtrów.</div>}
				</div>
			</div>

			<div className={`list-bar ${selected.length ? 'has-selection' : ''}`}>
				{selected.length ? (
					<>
						<span className="list-bar-count">{selected.length === 1 ? '1 zaznaczone' : `${selected.length} zaznaczone`}</span>
						{!archived && (
							<Dropdown drop="up">
								<Dropdown.Toggle variant="light" className="list-bar-primary">
									Przypisz programistę
								</Dropdown.Toggle>
								<Dropdown.Menu>
									<ProgrammerMenuItems programmers={state.programmers} onPick={(id) => updateBlocks(selected, { programmerId: id })} />
								</Dropdown.Menu>
							</Dropdown>
						)}
						{!archived &&
							READINESS.map(({ flag, label }) => {
								// wszystkie zaznaczone mają flagę - przycisk ją zdejmuje, inaczej ustawia wszystkim
								const all = selectedBlocks.every((b) => b[flag]);
								return (
									<button
										key={flag}
										type="button"
										className="list-bar-button"
										aria-pressed={all}
										onClick={() => updateBlocks(selected, { [flag]: !all })}>
										{all ? `✓ ${label}` : label}
									</button>
								);
							})}
						{!archived && (
							<button type="button" className="list-bar-button" onClick={() => showManyOnPlan(selected)}>
								Pokaż na planie
							</button>
						)}
						<button type="button" className="list-bar-button" onClick={() => exportCsv(selectedBlocks, '-zaznaczone')}>
							Eksportuj zaznaczone
						</button>
						<button type="button" className="list-bar-clear" onClick={clearSelection}>
							Wyczyść zaznaczenie
						</button>
					</>
				) : (
					<>
						<span>
							Pokazano {shown.length} z {rows.length}
							{!archived && statusTab === 'active' ? ' · zakończone ukryte' : ''}
						</span>
						{rows.length > shown.length && (
							<button type="button" className="list-bar-more" onClick={() => setPage({ key: pageKey, limit: limit + PAGE_SIZE })}>
								Załaduj kolejne {Math.min(PAGE_SIZE, rows.length - shown.length)}
							</button>
						)}
					</>
				)}
			</div>

			<BlockFormModal show={creating} onHide={() => setCreating(false)} />
			<SaveViewModal
				show={savingView}
				summary={filtersSummary()}
				onSave={(name) => storeViews([...views, { id: `view:${Date.now()}`, name, filters: currentFilters }])}
				onHide={() => setSavingView(false)}
			/>
		</>
	);
};

export default ListPage;
