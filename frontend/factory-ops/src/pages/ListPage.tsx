import { saveAs } from 'file-saver';
import { useMemo, useState } from 'react';
import { Badge, Button, Col, Form, Row, Table } from 'react-bootstrap';
import { STATUS_VARIANTS } from '../components/BlockDetailsPanel';
import { usePlan } from '../data/PlanContext';
import { formatDateTime, formatHours, programmerName, STATUS_LABELS, toLocalInputValue } from '../domain/format';
import { blockStatus } from '../domain/schedule';
import { Block, BlockStatus } from '../domain/types';

type SortKey = 'start' | 'end' | 'orderNo' | 'project' | 'operation' | 'machine' | 'hours';
type Sort = { key: SortKey; direction: 1 | -1 };

const COLUMNS: { key: SortKey; label: string }[] = [
	{ key: 'start', label: 'Start' },
	{ key: 'end', label: 'Koniec' },
	{ key: 'orderNo', label: 'Nr zamówienia' },
	{ key: 'project', label: 'Projekt' },
	{ key: 'operation', label: 'Operacja' },
	{ key: 'machine', label: 'Maszyna' },
	{ key: 'hours', label: 'Czas' }
];

/** Filtr programisty: wszyscy, konkretna osoba albo zlecenia bez programisty. */
const UNASSIGNED = '__none__';

const ListPage = () => {
	const { state, now, updateBlock } = usePlan();
	const [query, setQuery] = useState('');
	const [machineId, setMachineId] = useState('');
	const [project, setProject] = useState('');
	const [programmerId, setProgrammerId] = useState('');
	const [status, setStatus] = useState<BlockStatus | ''>('');
	const [sort, setSort] = useState<Sort>({ key: 'start', direction: 1 });

	const machineNames = useMemo(() => new Map(state.machines.map((m) => [m.id, m.name])), [state.machines]);
	const projects = useMemo(() => [...new Set(state.blocks.map((b) => b.project))].sort((a, b) => a.localeCompare(b, 'pl')), [state.blocks]);

	const rows = useMemo(() => {
		const q = query.trim().toLowerCase();
		const sortValue = (block: Block, key: SortKey): string | number =>
			key === 'machine' ? (machineNames.get(block.machineId) ?? '') : (block[key] as string | number);
		return state.blocks
			.filter(
				(b) =>
					(!q || [b.orderNo, b.project, b.operation].some((f) => f.toLowerCase().includes(q))) &&
					(!machineId || b.machineId === machineId) &&
					(!project || b.project === project) &&
					(!programmerId || (programmerId === UNASSIGNED ? !b.programmerId : b.programmerId === programmerId)) &&
					(!status || blockStatus(b, now) === status)
			)
			.sort((a, b) => {
				const x = sortValue(a, sort.key);
				const y = sortValue(b, sort.key);
				const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pl', { numeric: true });
				return order * sort.direction || a.start - b.start;
			});
	}, [state.blocks, now, query, machineId, project, programmerId, status, sort, machineNames]);

	const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, direction: s.direction === 1 ? -1 : 1 } : { key, direction: 1 }));
	const filtersActive = query || machineId || project || programmerId || status;
	const clearFilters = () => {
		setQuery('');
		setMachineId('');
		setProject('');
		setProgrammerId('');
		setStatus('');
	};

	/** Eksport widocznych wierszy - CSV ze średnikami i BOM, który polski Excel otwiera bez importu. */
	const exportCsv = () => {
		const header = ['Start', 'Koniec', 'Nr zamówienia', 'Projekt', 'Operacja', 'Maszyna', 'Czas pracy [h]', 'Status', 'Programista', 'Uwagi'];
		const cell = (value: string) => (/[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
		const date = (ms: number) => toLocalInputValue(ms).replace('T', ' ');
		const lines = rows.map((b) =>
			[
				date(b.start),
				date(b.end),
				b.orderNo,
				b.project,
				b.operation,
				machineNames.get(b.machineId) ?? '',
				String(b.hours).replace('.', ','),
				STATUS_LABELS[blockStatus(b, now)],
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
			<Row className="g-2 align-items-end mb-3">
				<Col md={3}>
					<Form.Control type="search" placeholder="Szukaj: nr, projekt, operacja" aria-label="Szukaj" value={query} onChange={(e) => setQuery(e.target.value)} />
				</Col>
				<Col md={2}>
					<Form.Select aria-label="Maszyna" value={machineId} onChange={(e) => setMachineId(e.target.value)}>
						<option value="">Wszystkie maszyny</option>
						{state.machines.map((m) => (
							<option key={m.id} value={m.id}>
								{m.name}
							</option>
						))}
					</Form.Select>
				</Col>
				<Col md={2}>
					<Form.Select aria-label="Projekt" value={project} onChange={(e) => setProject(e.target.value)}>
						<option value="">Wszystkie projekty</option>
						{projects.map((p) => (
							<option key={p} value={p}>
								{p}
							</option>
						))}
					</Form.Select>
				</Col>
				<Col md={2}>
					<Form.Select aria-label="Programista" value={programmerId} onChange={(e) => setProgrammerId(e.target.value)}>
						<option value="">Wszyscy programiści</option>
						<option value={UNASSIGNED}>— nie przypisano —</option>
						{state.programmers.map((p) => (
							<option key={p.id} value={p.id}>
								{programmerName(p)}
							</option>
						))}
					</Form.Select>
				</Col>
				<Col md={1}>
					<Form.Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value as BlockStatus | '')}>
						<option value="">Status</option>
						{(Object.keys(STATUS_LABELS) as BlockStatus[]).map((s) => (
							<option key={s} value={s}>
								{STATUS_LABELS[s]}
							</option>
						))}
					</Form.Select>
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
			<div className="small text-secondary mb-2">
				Pokazano {rows.length} z {state.blocks.length} zleceń
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
					{rows.map((block) => {
						const blockState = blockStatus(block, now);
						return (
							<tr key={block.id}>
								<td className="text-nowrap">{formatDateTime(block.start)}</td>
								<td className="text-nowrap">{formatDateTime(block.end)}</td>
								<td className="text-nowrap">{block.orderNo}</td>
								<td>{block.project}</td>
								<td>{block.operation}</td>
								<td>{machineNames.get(block.machineId)}</td>
								<td className="text-nowrap">{formatHours(block.hours)}</td>
								<td>
									<Badge bg={STATUS_VARIANTS[blockState]}>{STATUS_LABELS[blockState]}</Badge>
								</td>
								<td>
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
		</>
	);
};

export default ListPage;
