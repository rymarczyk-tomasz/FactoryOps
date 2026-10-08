import React, { useMemo, useState } from 'react';
import { Badge, Button, Form, Table } from 'react-bootstrap';
import BreakdownModal from '../components/BreakdownModal';
import PageHeader from '../components/PageHeader';
import { usePlan } from '../data/PlanContext';
import { breakdownEnd, isOngoing, lineOfMachine, resourceName, standaloneMachines } from '../domain/calendar';
import { formatDateTime } from '../domain/format';
import { dailyLoad, DayLoad, loadPercent, loadUnits } from '../domain/load';
import { addHours, shiftDayStart } from '../domain/shifts';
import { Id } from '../domain/types';

const DAYS = 7;
const HOUR = 3600_000;
const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric' });

/** Kolor komórki: od jasnego (wolna) do mocnego niebieskiego (pełna). */
function loadStyle(percent: number | undefined): React.CSSProperties {
	if (percent === undefined) return {};
	const alpha = 0.08 + (percent / 100) * 0.82;
	return { background: `rgba(37, 99, 235, ${alpha.toFixed(2)})`, color: percent > 55 ? '#fff' : '#1e293b' };
}

interface ResourceRow {
	id: Id;
	name: string;
	/** Liczba maszyn linii (brak = zwykła maszyna). */
	units?: number;
	days: DayLoad[];
	/** Koniec ostatniego zlecenia w kolejce, jeśli jest po „teraz”. */
	freeFrom?: number;
	queued: number;
}

const LoadPage = () => {
	const { state, now, endBreakdown, removeBreakdown } = usePlan();
	const [showDone, setShowDone] = useState(false);
	const [reporting, setReporting] = useState(false);
	// tydzień od bieżącej doby - o 6:00 przesuwa się o dzień
	const today = shiftDayStart(now);
	const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addHours(today, 24 * i)), [today]);

	const rows = useMemo(() => {
		const row = (id: Id, units?: number): ResourceRow => {
			// zlecenia linii liczą się razem ze zleceniami jej maszyn
			const ids = new Set([id, ...(state.lines.find((l) => l.id === id)?.machineIds ?? [])]);
			const pending = state.blocks.filter((b) => ids.has(b.machineId) && b.end > now);
			const lastEnd = Math.max(-Infinity, ...pending.map((b) => b.end));
			const unitsOfRow = loadUnits(state, state.blocks, id, now);
			return {
				id,
				name: resourceName(state, id),
				units,
				days: days.map((day) => dailyLoad(unitsOfRow, day)),
				freeFrom: lastEnd > now ? lastEnd : undefined,
				queued: pending.length
			};
		};
		return {
			lines: state.lines.map((l) => row(l.id, l.machineIds.length)),
			machines: standaloneMachines(state).map((m) => row(m.id))
		};
	}, [state, now, days]);

	const average = (subset: ResourceRow[]) => {
		const totals = subset.flatMap((r) => r.days).reduce((sum, d) => ({ available: sum.available + d.available, busy: sum.busy + d.busy }), { available: 0, busy: 0 });
		return loadPercent({ dayStart: 0, ...totals });
	};
	const { lines, machines } = rows;
	const breakdowns = [...state.breakdowns].filter((b) => showDone || isOngoing(b)).sort((a, b) => Number(isOngoing(b)) - Number(isOngoing(a)) || b.start - a.start);
	const activeCount = state.breakdowns.filter(isOngoing).length;

	const renderRows = (title: string, subset: ResourceRow[]) =>
		subset.length > 0 && (
			<>
				<tr className="table-group-row">
					<th colSpan={DAYS + 3}>
						{title} <span className="fw-normal text-secondary">· średnio {average(subset) ?? 0}% przez {DAYS} dni</span>
					</th>
				</tr>
				{subset.map(({ id, name, units, days: loads, freeFrom, queued }) => (
					<tr key={id}>
						<td className="text-nowrap fw-medium">
							{name}
							{units !== undefined && (
								<Badge bg="primary" pill className="ms-2">
									{units}×
								</Badge>
							)}
						</td>
						{loads.map((load) => {
							const percent = loadPercent(load);
							return (
								<td
									key={load.dayStart}
									className="load-cell text-center"
									style={loadStyle(percent)}
									title={percent === undefined ? 'Dzień wolny' : `${load.busy} z ${load.available} maszyno-godzin zajęte`}>
									{percent === undefined ? <span className="text-secondary small">wolne</span> : `${percent}%`}
								</td>
							);
						})}
						<td className="text-nowrap">{freeFrom ? formatDateTime(freeFrom) : <span className="text-success">wolna teraz</span>}</td>
						<td className="text-center">{queued}</td>
					</tr>
				))}
			</>
		);

	return (
		<>
			<PageHeader title="Obciążenie" />
			<div className="page-body d-flex flex-column gap-4">
				<div className="d-flex flex-wrap gap-3">
					<div className="stat-tile">
						<div className="stat-label">Linie · zajętość {DAYS} dni</div>
						<div className="stat-value">{average(lines) ?? 0}%</div>
					</div>
					<div className="stat-tile">
						<div className="stat-label">Maszyny · zajętość {DAYS} dni</div>
						<div className="stat-value">{average(machines) ?? 0}%</div>
					</div>
					<div className="stat-tile">
						<div className="stat-label">Awarie trwające teraz</div>
						<div className={`stat-value ${activeCount ? 'text-danger' : ''}`}>{activeCount}</div>
					</div>
				</div>

				<div>
					<h2 className="h5 mb-2">Obciążenie</h2>
					<p className="text-secondary small mb-2">
						Procent dostępnych maszyno-godzin zajętych przez zlecenia w danej dobie (6:00–6:00). Dostępny czas uwzględnia dni wolne, godziny pracy i awarie.
					</p>
					<Table bordered responsive size="sm" className="align-middle load-table mb-0">
						<thead>
							<tr>
								<th>Maszyna / linia</th>
								{days.map((day) => (
									<th key={day} className="text-center text-nowrap">
										{dayFormat.format(day)}
									</th>
								))}
								<th>Wolna od</th>
								<th className="text-center">W kolejce</th>
							</tr>
						</thead>
						<tbody>
							{renderRows('Linie produkcyjne', lines)}
							{renderRows('Maszyny', machines)}
						</tbody>
					</Table>
				</div>

				<div>
					<div className="d-flex align-items-center justify-content-between gap-3 mb-2">
						<h2 className="h5 mb-0">Awarie</h2>
						<div className="d-flex align-items-center gap-3">
							<Form.Check type="switch" id="showDoneBreakdowns" label="Pokaż zakończone" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
							<Button size="sm" variant="outline-danger" onClick={() => setReporting(true)}>
								Zgłoś awarię
							</Button>
						</div>
					</div>
					{breakdowns.length === 0 ? (
						<p className="text-secondary mb-0">Brak trwających awarii.</p>
					) : (
						<Table hover size="sm" className="align-middle mb-0">
							<thead>
								<tr>
									<th>Maszyna</th>
									<th>Linia</th>
									<th>Od</th>
									<th>Do</th>
									<th>Czas</th>
									<th>Status</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{breakdowns.map((breakdown) => {
									const ongoing = isOngoing(breakdown);
									const end = ongoing ? now : breakdownEnd(breakdown, now);
									return (
										<tr key={breakdown.id}>
											<td className="fw-medium">{resourceName(state, breakdown.machineId)}</td>
											<td>{lineOfMachine(state.lines, breakdown.machineId)?.name ?? <span className="text-secondary">—</span>}</td>
											<td className="text-nowrap">{formatDateTime(breakdown.start)}</td>
											<td className="text-nowrap">{ongoing ? <span className="text-danger">trwa</span> : formatDateTime(end)}</td>
											<td>{Math.max(0, Math.round((end - breakdown.start) / HOUR))} h</td>
											<td>
												<Badge bg={ongoing ? 'danger' : 'secondary'}>{ongoing ? 'Trwa' : 'Zakończona'}</Badge>
											</td>
											<td className="text-end text-nowrap">
												{ongoing && (
													<Button size="sm" variant="danger" className="me-2" onClick={() => endBreakdown(breakdown.id)}>
														Zakończ teraz
													</Button>
												)}
												<Button size="sm" variant="outline-secondary" onClick={() => removeBreakdown(breakdown.id)}>
													Usuń
												</Button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</Table>
					)}
				</div>
				<BreakdownModal show={reporting} onHide={() => setReporting(false)} />
			</div>
		</>
	);
};

export default LoadPage;
