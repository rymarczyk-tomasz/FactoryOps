import React, { useMemo, useState } from 'react';
import { Badge, Button, Form, Table } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { capacityLookup, isLine, unitCount, unitLabel } from '../domain/calendar';
import { formatDateTime } from '../domain/format';
import { dailyLoad, DayLoad, loadPercent } from '../domain/load';
import { addHours, shiftDayStart } from '../domain/shifts';
import { Breakdown, Machine } from '../domain/types';

const DAYS = 7;
const HOUR = 3600_000;
const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'numeric' });

/** Kolor komórki: od jasnego (wolna) do mocnego niebieskiego (pełna). */
function loadStyle(percent: number | undefined): React.CSSProperties {
	if (percent === undefined) return {};
	const alpha = 0.08 + (percent / 100) * 0.82;
	return { background: `rgba(37, 99, 235, ${alpha.toFixed(2)})`, color: percent > 55 ? '#fff' : '#1e293b' };
}

type BreakdownStatus = 'active' | 'planned' | 'done';
const BREAKDOWN_STATUS: Record<BreakdownStatus, { label: string; variant: string }> = {
	active: { label: 'Trwa', variant: 'danger' },
	planned: { label: 'Zaplanowana', variant: 'warning' },
	done: { label: 'Zakończona', variant: 'secondary' }
};

function breakdownStatus(breakdown: Breakdown, now: number): BreakdownStatus {
	if (breakdown.end <= now) return 'done';
	return breakdown.start <= now ? 'active' : 'planned';
}

interface MachineRow {
	machine: Machine;
	days: DayLoad[];
	/** Koniec ostatniego zlecenia w kolejce, jeśli jest po „teraz”. */
	freeFrom?: number;
	queued: number;
}

const LoadPage = () => {
	const { state, removeBreakdown } = usePlan();
	const [showDone, setShowDone] = useState(false);
	const now = Date.now();
	const today = shiftDayStart(now);
	const days = Array.from({ length: DAYS }, (_, i) => addHours(today, 24 * i));

	const rows = useMemo<MachineRow[]>(() => {
		const capacities = capacityLookup(state);
		return state.machines.map((machine) => {
			const blocks = state.blocks.filter((b) => b.machineId === machine.id);
			const pending = blocks.filter((b) => b.end > now);
			const lastEnd = Math.max(-Infinity, ...pending.map((b) => b.end));
			return {
				machine,
				days: days.map((day) => dailyLoad(blocks, capacities(machine.id), day)),
				freeFrom: lastEnd > now ? lastEnd : undefined,
				queued: pending.length
			};
		});
		// dni i „teraz” wyznaczamy przy wejściu na stronę; przeliczamy przy zmianie planu
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state]);

	const average = (subset: MachineRow[]) => {
		const totals = subset.flatMap((r) => r.days).reduce((sum, d) => ({ available: sum.available + d.available, busy: sum.busy + d.busy }), { available: 0, busy: 0 });
		return loadPercent({ dayStart: 0, ...totals });
	};
	const lines = rows.filter((r) => isLine(r.machine));
	const machines = rows.filter((r) => !isLine(r.machine));
	const breakdowns = [...state.breakdowns].filter((b) => showDone || breakdownStatus(b, now) !== 'done').sort((a, b) => a.start - b.start);
	const activeCount = state.breakdowns.filter((b) => breakdownStatus(b, now) === 'active').length;

	const renderRows = (title: string, subset: MachineRow[]) =>
		subset.length > 0 && (
			<>
				<tr className="table-group-row">
					<th colSpan={DAYS + 3}>
						{title} <span className="fw-normal text-secondary">· średnio {average(subset) ?? 0}% przez {DAYS} dni</span>
					</th>
				</tr>
				{subset.map(({ machine, days: loads, freeFrom, queued }) => (
					<tr key={machine.id}>
						<td className="text-nowrap fw-medium">
							{machine.name}
							{isLine(machine) && (
								<Badge bg="primary" pill className="ms-2">
									{unitCount(machine)}×
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
		<div className="d-flex flex-column gap-4">
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
				<div className="d-flex align-items-center justify-content-between mb-2">
					<h2 className="h5 mb-0">Awarie</h2>
					<Form.Check type="switch" id="showDoneBreakdowns" label="Pokaż zakończone" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
				</div>
				{breakdowns.length === 0 ? (
					<p className="text-secondary mb-0">Brak awarii. Awarię zgłasza się prawym kliknięciem na planie.</p>
				) : (
					<Table hover size="sm" className="align-middle mb-0">
						<thead>
							<tr>
								<th>Maszyna / linia</th>
								<th>Stoją</th>
								<th>Od</th>
								<th>Do</th>
								<th>Czas</th>
								<th>Status</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{breakdowns.map((breakdown) => {
								const machine = state.machines.find((m) => m.id === breakdown.machineId);
								const status = BREAKDOWN_STATUS[breakdownStatus(breakdown, now)];
								return (
									<tr key={breakdown.id}>
										<td className="fw-medium">{machine?.name}</td>
										<td>{isLine(machine) ? breakdown.units.map((u) => unitLabel(machine, u)).join(', ') : 'cała maszyna'}</td>
										<td className="text-nowrap">{formatDateTime(breakdown.start)}</td>
										<td className="text-nowrap">{formatDateTime(breakdown.end)}</td>
										<td>{Math.round((breakdown.end - breakdown.start) / HOUR)} h</td>
										<td>
											<Badge bg={status.variant}>{status.label}</Badge>
										</td>
										<td className="text-end">
											<Button size="sm" variant="outline-danger" onClick={() => removeBreakdown(breakdown.id)}>
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
		</div>
	);
};

export default LoadPage;
