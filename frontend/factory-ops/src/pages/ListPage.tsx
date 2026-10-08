import { saveAs } from 'file-saver';
import { MouseEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Dropdown, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import BlockFormModal from '../components/BlockFormModal';
import MultiSelect, { MultiSelectOption } from '../components/MultiSelect';
import PageHeader from '../components/PageHeader';
import { PlanNavigationState } from '../components/planNavigation';
import { projectColorVar } from '../components/projectColor';
import { usePlan } from '../data/PlanContext';
import { ARCHIVE_AFTER_DAYS } from '../domain/archive';
import { lineMachines, resourceName, standaloneMachines } from '../domain/calendar';
import { formatDateTime, formatHours, programmerName, STATUS_LABELS, toLocalInputValue } from '../domain/format';
import { blockStatus } from '../domain/schedule';
import { ArchivedBlock, Block, BlockStatus, Id, Programmer } from '../domain/types';
import './ListPage.css';
import Segmented from '../components/Segmented';

type SortKey = 'start' | 'orderNo' | 'projectNo' | 'operation' | 'machine' | 'hours' | 'status';
type Sort = { key: SortKey; direction: 1 | -1 };

/** Tyle wierszy pokazujemy naraz - plan może mieć tysiące zleceń. */
const PAGE_SIZE = 200;

type ListBlock = Block & Partial<Pick<ArchivedBlock, 'machineName'>>;

/** Filtr programisty: zlecenia bez programisty. */
const UNASSIGNED = '__none__';

/** Zakładki statusów: „Wszystkie” to zlecenia niezakończone - zakończone są pod osobną zakładką. */
type StatusTab = 'active' | BlockStatus;
const STATUS_TABS: { key: StatusTab; label: string }[] = [
	{ key: 'active', label: 'Wszystkie' },
	{ key: 'in_progress', label: 'W toku' },
	{ key: 'planned', label: 'Zaplanowane' },
	{ key: 'done', label: 'Zakończone' }
];
const STATUS_ORDER: Record<BlockStatus, number> = { in_progress: 0, planned: 1, done: 2 };
const inTab = (tab: StatusTab, status: BlockStatus) => (tab === 'active' ? status !== 'done' : status === tab);

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
	const navigate = useNavigate();
	const [query, setQuery] = useState('');
	const [statusTab, setStatusTab] = useState<StatusTab>('active');
	const [machineIds, setMachineIds] = useState<string[]>([]);
	const [projectNos, setProjectNos] = useState<string[]>([]);
	const [programmerIds, setProgrammerIds] = useState<string[]>([]);
	const [sort, setSort] = useState<Sort>({ key: 'start', direction: 1 });
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
	const nameOf = (b: ListBlock) => b.machineName ?? machineNames.get(b.machineId) ?? '';

	// wszystkie filtry poza statusem i programistą - z tego liczymy liczniki zakładek i „Bez programisty”
	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return source.filter(
			(b) =>
				(!q || [b.orderNo, b.projectNo, b.project, b.operation].some((f) => f.toLowerCase().includes(q))) &&
				(machineIds.length === 0 || machineIds.includes(b.machineId)) &&
				(projectNos.length === 0 || projectNos.includes(b.projectNo))
		);
	}, [source, query, machineIds, projectNos]);

	const statuses = useMemo(() => new Map(filtered.map((b) => [b.id, statusOf(b)])), [filtered, archived, now]); // eslint-disable-line react-hooks/exhaustive-deps
	const tabCounts = useMemo(() => {
		const byProgrammer = filtered.filter((b) => programmerIds.length === 0 || programmerIds.includes(b.programmerId ?? UNASSIGNED));
		return Object.fromEntries(STATUS_TABS.map(({ key }) => [key, byProgrammer.filter((b) => inTab(key, statuses.get(b.id)!)).length])) as Record<StatusTab, number>;
	}, [filtered, programmerIds, statuses]);
	const unassignedCount = useMemo(() => filtered.filter((b) => !b.programmerId && inTab(statusTab, statuses.get(b.id)!)).length, [filtered, statuses, statusTab]);

	const rows = useMemo(() => {
		const sortValue = (block: ListBlock, key: SortKey): string | number =>
			key === 'machine' ? nameOf(block) : key === 'status' ? STATUS_ORDER[statuses.get(block.id)!] : (block[key] as string | number);
		return filtered
			.filter((b) => (archived || inTab(statusTab, statuses.get(b.id)!)) && (programmerIds.length === 0 || programmerIds.includes(b.programmerId ?? UNASSIGNED)))
			.sort((a, b) => {
				const x = sortValue(a, sort.key);
				const y = sortValue(b, sort.key);
				const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pl', { numeric: true });
				return order * sort.direction || a.start - b.start;
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [filtered, statuses, archived, statusTab, programmerIds, sort, machineNames]);

	// po zmianie filtrów lub sortowania znowu pokazujemy pierwszą porcję wierszy
	const pageKey = JSON.stringify([archived, query, statusTab, machineIds, projectNos, programmerIds, sort]);
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

	const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, direction: s.direction === 1 ? -1 : 1 } : { key, direction: 1 }));
	const sortHeader = (key: SortKey, label: string, className = '') => (
		<button
			type="button"
			className={`list-sort ${sort.key === key ? 'is-sorted' : ''} ${className}`}
			aria-sort={sort.key === key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}
			onClick={() => toggleSort(key)}>
			{label}
			{sort.key === key && <span className="sort-arrow">{sort.direction === 1 ? '▲' : '▼'}</span>}
		</button>
	);

	const unassignedOnly = programmerIds.length === 1 && programmerIds[0] === UNASSIGNED;
	const showOnPlan = (id: Id) => navigate('/', { state: { showBlock: id } satisfies PlanNavigationState });
	// kilka zleceń: plan wyróżnia je jak wyniki wyszukiwania i przeskakuje między nimi strzałkami
	const showManyOnPlan = (ids: Id[]) => navigate('/', { state: (ids.length === 1 ? { showBlock: ids[0] } : { showBlocks: ids }) satisfies PlanNavigationState });

	/** Eksport wierszy do CSV ze średnikami i BOM, który polski Excel otwiera bez importu. */
	const exportCsv = (blocks: ListBlock[], suffix = '') => {
		const header = ['Start', 'Koniec', 'Operacja', 'Nr projektu', 'Projekt', 'Nr zamówienia', 'Linia / maszyna', 'Czas pracy [h]', 'Status', 'Programista', 'Uwagi'];
		const cell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
		const date = (ms: number) => toLocalInputValue(ms).replace('T', ' ');
		const lines = blocks.map((b) =>
			[
				date(b.start),
				date(b.end),
				b.operation,
				b.projectNo,
				b.project,
				b.orderNo,
				nameOf(b),
				String(b.hours).replace('.', ','),
				STATUS_LABELS[statusOf(b)],
				programmerName(programmers.get(b.programmerId ?? '')),
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
						placeholder="Szukaj: nr zamówienia, projekt, operacja…"
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
										aria-label={`Zaznacz ${block.orderNo}`}
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
									<span className="list-title">
										{block.operation} · {block.projectNo}
									</span>
									{archived ? (
										<span className="list-order-no mono">{block.orderNo}</span>
									) : (
										<button type="button" className="list-order-no mono" title="Pokaż na planie" onClick={() => showOnPlan(block.id)}>
											{block.orderNo}
										</button>
									)}
								</span>
								<span className="list-project">
									<span className="project-chip mono" style={projectColorVar(block.projectNo || block.project)}>
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
								</span>
								<span className="list-hours mono">{formatHours(block.hours)}</span>
								<span className="list-programmer">
									{archived ? (
										programmer && (
											<>
												<span className="avatar">{initials(programmer)}</span>
												<span className="list-ellipsis">{programmerName(programmer)}</span>
											</>
										)
									) : (
										<Dropdown>
											<Dropdown.Toggle as="button" bsPrefix={programmer ? 'programmer-toggle' : 'assign-toggle'} aria-label={`Programista ${block.orderNo}`}>
												{programmer ? (
													<>
														<span className="avatar">{initials(programmer)}</span>
														<span className="list-ellipsis">{programmerName(programmer)}</span>
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
		</>
	);
};

export default ListPage;
