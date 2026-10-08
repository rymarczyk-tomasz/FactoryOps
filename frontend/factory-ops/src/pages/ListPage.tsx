import { saveAs } from 'file-saver';
import { useMemo, useState } from 'react';
import { Badge, Button, Col, Form, Row, Table } from 'react-bootstrap';
import { STATUS_VARIANTS } from '../components/BlockDetailsPanel';
import MultiSelect, { MultiSelectOption } from '../components/MultiSelect';
import PageHeader from '../components/PageHeader';
import { usePlan } from '../data/PlanContext';
import { lineMachines, resourceName, standaloneMachines } from '../domain/calendar';
import { formatDateTime, formatHours, programmerName, STATUS_LABELS, toLocalInputValue } from '../domain/format';
import { blockStatus } from '../domain/schedule';
import { ARCHIVE_AFTER_DAYS } from '../domain/archive';
import { ArchivedBlock, Block, BlockStatus } from '../domain/types';

type SortKey = 'start' | 'end' | 'orderNo' | 'projectNo' | 'project' | 'operation' | 'machine' | 'hours';
type Sort = { key: SortKey; direction: 1 | -1 };

const COLUMNS: { key: SortKey; label: string }[] = [
	{ key: 'start', label: 'Start' },
	{ key: 'end', label: 'Koniec' },
	{ key: 'operation', label: 'Operacja' },
	{ key: 'projectNo', label: 'Nr projektu' },
	{ key: 'project', label: 'Projekt' },
	{ key: 'orderNo', label: 'Nr zamówienia' },
	{ key: 'machine', label: 'Linia / maszyna' },
	{ key: 'hours', label: 'Czas' }
];

/** Tyle wierszy pokazujemy naraz - plan może mieć tysiące zleceń, a każdy wiersz ma pole wyboru programisty. */
const PAGE_SIZE = 200;

type ListBlock = Block & Partial<Pick<ArchivedBlock, 'machineName'>>;

/** Filtr programisty: wszyscy, konkretna osoba albo zlecenia bez programisty. */
const UNASSIGNED = '__none__';

const ListPage = () => {
	const { state, now, updateBlock } = usePlan();
	const [query, setQuery] = useState('');
	const [machineIds, setMachineIds] = useState<string[]>([]);
	const [projectNos, setProjectNos] = useState<string[]>([]);
	const [programmerIds, setProgrammerIds] = useState<string[]>([]);
	const [statuses, setStatuses] = useState<string[]>([]);
	const [sort, setSort] = useState<Sort>({ key: 'start', direction: 1 });
	const [archived, setArchived] = useState(false);

	const machineNames = useMemo(() => new Map([...state.lines, ...state.machines].map((m) => [m.id, resourceName(state, m.id)])), [state]);

	// opcje filtrów: linie z ich maszynami, samodzielne maszyny, projekty po numerze
	const machineOptions = useMemo<MultiSelectOption[]>(
		() => [
			...state.lines.flatMap((line) => [
				{ value: line.id, label: `${line.name} (cała linia)`, group: 'Linie produkcyjne' },
				...lineMachines(line, state.machines).map((m) => ({ value: m.id, label: m.name, group: 'Linie produkcyjne', indent: true }))
			]),
			...standaloneMachines(state).map((m) => ({ value: m.id, label: m.name, group: 'Maszyny' }))
		],
		[state]
	);
	const projectOptions = useMemo<MultiSelectOption[]>(() => {
		const names = new Map([...state.archive, ...state.blocks].map((b) => [b.projectNo, b.project]));
		return [...names.entries()].sort(([a], [b]) => a.localeCompare(b, 'pl', { numeric: true })).map(([no, name]) => ({ value: no, label: `${no} · ${name}` }));
	}, [state.blocks, state.archive]);

	// archiwum: zlecenia zakończone ponad 30 dni temu, tylko do wglądu
	const source: ListBlock[] = archived ? state.archive : state.blocks;
	const statusOf = (b: Block): BlockStatus => (archived ? 'done' : blockStatus(b, now));
	const nameOf = (b: ListBlock) => b.machineName ?? machineNames.get(b.machineId) ?? '';
	const statusOptions = (Object.keys(STATUS_LABELS) as BlockStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }));
	const programmerOptions = [{ value: UNASSIGNED, label: '— nie przypisano —' }, ...state.programmers.map((p) => ({ value: p.id, label: programmerName(p) }))];

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		const sortValue = (block: ListBlock, key: SortKey): string | number => (key === 'machine' ? nameOf(block) : (block[key] as string | number));
		return source
			.filter(
				(b) =>
					(!q || [b.orderNo, b.projectNo, b.project, b.operation].some((f) => f.toLowerCase().includes(q))) &&
					(machineIds.length === 0 || machineIds.includes(b.machineId)) &&
					(projectNos.length === 0 || projectNos.includes(b.projectNo)) &&
					(programmerIds.length === 0 || programmerIds.includes(b.programmerId ?? UNASSIGNED)) &&
					(statuses.length === 0 || statuses.includes(statusOf(b)))
			)
			.sort((a, b) => {
				const x = sortValue(a, sort.key);
				const y = sortValue(b, sort.key);
				const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pl', { numeric: true });
				return order * sort.direction || a.start - b.start;
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [source, archived, now, query, machineIds, projectNos, programmerIds, statuses, sort, machineNames]);

	// po zmianie filtrów lub sortowania znowu pokazujemy pierwszą porcję wierszy
	const pageKey = JSON.stringify([archived, query, machineIds, projectNos, programmerIds, statuses, sort]);
	const [page, setPage] = useState({ key: pageKey, limit: PAGE_SIZE });
	const limit = page.key === pageKey ? page.limit : PAGE_SIZE;
	const shown = rows.slice(0, limit);

	const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, direction: s.direction === 1 ? -1 : 1 } : { key, direction: 1 }));
	const filtersActive = query !== '' || machineIds.length + projectNos.length + programmerIds.length + statuses.length > 0;
	const clearFilters = () => {
		setQuery('');
		setMachineIds([]);
		setProjectNos([]);
		setProgrammerIds([]);
		setStatuses([]);
	};

	/** Eksport widocznych wierszy - CSV ze średnikami i BOM, który polski Excel otwiera bez importu. */
	const exportCsv = () => {
		const header = ['Start', 'Koniec', 'Operacja', 'Nr projektu', 'Projekt', 'Nr zamówienia', 'Linia / maszyna', 'Czas pracy [h]', 'Status', 'Programista', 'Uwagi'];
		const cell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
		const date = (ms: number) => toLocalInputValue(ms).replace('T', ' ');
		const lines = rows.map((b) =>
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
				programmerName(state.programmers.find((p) => p.id === b.programmerId)),
				b.note ?? ''
			]
				.map(cell)
				.join(';')
		);
		const csv = '﻿' + [header.join(';'), ...lines].join('\r\n');
		saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `zlecenia-${toLocalInputValue(now).slice(0, 10)}.csv`);
	};

	return (
		<>
			<PageHeader title="Lista zleceń" />
			<div className="page-body">
				<Row className="g-2 align-items-end mb-3">
					<Col md={2}>
						<Form.Control type="search" placeholder="Szukaj: nr, projekt, operacja" aria-label="Szukaj" value={query} onChange={(e) => setQuery(e.target.value)} />
					</Col>
					<Col md={2}>
						<MultiSelect id="filterStatus" label="Status" allLabel="Wszystkie statusy" options={statusOptions} selected={statuses} onChange={setStatuses} />
					</Col>
					<Col md={2}>
						<MultiSelect id="filterMachine" label="Maszyny" allLabel="Wszystkie maszyny" options={machineOptions} selected={machineIds} onChange={setMachineIds} />
					</Col>
					<Col md={2}>
						<MultiSelect id="filterProject" label="Projekty" allLabel="Wszystkie projekty" options={projectOptions} selected={projectNos} onChange={setProjectNos} />
					</Col>
					<Col md={2}>
						<MultiSelect
							id="filterProgrammer"
							label="Programiści"
							allLabel="Wszyscy programiści"
							options={programmerOptions}
							selected={programmerIds}
							onChange={setProgrammerIds}
						/>
					</Col>
					<Col md={2} className="d-flex gap-2 justify-content-end">
						{filtersActive && (
							<Button variant="link" className="text-nowrap px-1" onClick={clearFilters}>
								Wyczyść
							</Button>
						)}
						<Button variant="outline-success" className="text-nowrap" disabled={rows.length === 0} onClick={exportCsv}>
							Eksport do Excela
						</Button>
					</Col>
				</Row>
				<div className="d-flex align-items-center justify-content-between mb-2">
					<span className="small text-secondary">
						{archived ? 'Archiwum: ' : ''}
						{rows.length} z {source.length} zleceń{rows.length > shown.length ? ` · na ekranie pierwsze ${shown.length}` : ''}
					</span>
					<Form.Check
						type="switch"
						id="showArchive"
						label={`Archiwum (${state.archive.length}) · zakończone ponad ${ARCHIVE_AFTER_DAYS} dni temu`}
						checked={archived}
						onChange={(e) => setArchived(e.target.checked)}
					/>
				</div>
				<Table hover responsive className="align-middle mb-0 list-table">
					<thead>
						<tr>
							{COLUMNS.map((column) => (
								<th key={column.key} className="sortable" aria-sort={sort.key === column.key ? (sort.direction === 1 ? 'ascending' : 'descending') : 'none'}>
									<button type="button" onClick={() => toggleSort(column.key)}>
										{column.label}
										<span className="sort-arrow">{sort.key === column.key ? (sort.direction === 1 ? '▲' : '▼') : ''}</span>
									</button>
								</th>
							))}
							<th>Status</th>
							<th>Programista</th>
						</tr>
					</thead>
					<tbody>
						{shown.map((block) => {
							const blockState = statusOf(block);
							return (
								<tr key={block.id}>
									<td className="text-nowrap">{formatDateTime(block.start)}</td>
									<td className="text-nowrap">{formatDateTime(block.end)}</td>
									<td>{block.operation}</td>
									<td className="text-nowrap">{block.projectNo}</td>
									<td>{block.project}</td>
									<td className="text-nowrap">{block.orderNo}</td>
									<td>{nameOf(block)}</td>
									<td className="text-nowrap">{formatHours(block.hours)}</td>
									<td>
										<Badge bg={STATUS_VARIANTS[blockState]}>{STATUS_LABELS[blockState]}</Badge>
									</td>
									<td>
										{archived ? (
											programmerName(state.programmers.find((p) => p.id === block.programmerId))
										) : (
											<Form.Select
											size="sm"
											aria-label="Programista"
											value={block.programmerId ?? ''}
											onChange={(e) => updateBlock(block.id, { programmerId: e.target.value || undefined })}>
												<option value="">— nie przypisano —</option>
												{state.programmers.map((p) => (
													<option key={p.id} value={p.id}>
														{programmerName(p)}
													</option>
												))}
											</Form.Select>
										)}
									</td>
								</tr>
							);
						})}
						{rows.length === 0 && (
							<tr>
								<td colSpan={COLUMNS.length + 2} className="text-center text-secondary py-4">
									Brak zleceń dla wybranych filtrów.
								</td>
							</tr>
						)}
					</tbody>
				</Table>
				{rows.length > shown.length && (
					<div className="text-center mt-3">
						<Button variant="outline-secondary" onClick={() => setPage({ key: pageKey, limit: limit + PAGE_SIZE })}>
							Pokaż kolejne {Math.min(PAGE_SIZE, rows.length - shown.length)} (zostało {rows.length - shown.length})
						</Button>
					</div>
				)}
			</div>
		</>
	);
};

export default ListPage;
