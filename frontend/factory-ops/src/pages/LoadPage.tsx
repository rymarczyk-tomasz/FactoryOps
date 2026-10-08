import { CSSProperties, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import BreakdownModal from '../components/BreakdownModal';
import PageHeader from '../components/PageHeader';
import { PlanNavigationState } from '../components/planNavigation';
import { breakdownImpact, loadByDay, ordersLabel, totalPercent } from '../components/planSelectors';
import { usePlan } from '../data/PlanContext';
import { breakdownEnd, findLine, isOngoing, lineMachines, lineOfMachine, resourceName, standaloneMachines, workMode } from '../domain/calendar';
import { formatDateTime } from '../domain/format';
import { DayLoad, loadPercent } from '../domain/load';
import { addHours, shiftDayStart } from '../domain/shifts';
import { Breakdown, Id, PlanState } from '../domain/types';
import './LoadPage.css';

const HOUR = 3600_000;
/** Zakresy mapy cieplnej w dobach. */
const RANGES = [7, 14, 30];
const HEATMAP_HINT = 'Procent dostępnych maszyno-godzin zajętych przez zlecenia w dobie (6:00–6:00); dostępny czas uwzględnia dni wolne, godziny pracy i awarie';
/** Przy dłuższym zakresie komórki są za wąskie na procent - zostaje kolor i podpowiedź. */
const DENSE_FROM_DAYS = 30;

const weekdayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
const pad = (n: number) => String(n).padStart(2, '0');
const shortDate = (ms: number) => {
	const d = new Date(ms);
	return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}`;
};

/** Kolor komórki: od tła (wolna) do akcentu (pełna). */
const heat = (percent: number): CSSProperties => ({
	background: `color-mix(in oklch, #2563eb ${Math.round(8 + percent * 0.82)}%, oklch(0.975 0.004 255))`,
	color: percent > 55 ? '#fff' : 'oklch(0.3 0.02 260)'
});

interface ResourceRow {
	id: Id;
	name: string;
	meta: string;
	days: DayLoad[];
	/** Koniec ostatniego zlecenia w kolejce, jeśli jest po „teraz”. */
	freeFrom?: number;
	queued: number;
	down: boolean;
}

/** „Linia 2 pracuje na 2 z 3 maszyn · 4 zlecenia” albo „kolejka: 2 zlecenia”. */
function impactText(state: PlanState, breakdown: Breakdown, now: number): string {
	const count = breakdownImpact(state, breakdown, now).length;
	const line = lineOfMachine(state.lines, breakdown.machineId);
	if (line && isOngoing(breakdown)) {
		const down = state.breakdowns.filter((b) => isOngoing(b) && line.machineIds.includes(b.machineId)).length;
		const working = line.machineIds.length - down;
		return `${line.name} pracuje na ${working} z ${line.machineIds.length} maszyn${count ? ` · ${ordersLabel(count)}` : ''}`;
	}
	return count ? ordersLabel(count) : '—';
}

const LoadPage = () => {
	const { state, now, endBreakdown } = usePlan();
	const navigate = useNavigate();
	const [days, setDays] = useState(RANGES[0]);
	const [showDone, setShowDone] = useState(false);
	const [reporting, setReporting] = useState(false);
	// zakres od bieżącej doby - o 6:00 przesuwa się o dzień
	const today = shiftDayStart(now);
	const dayStarts = useMemo(() => Array.from({ length: days }, (_, i) => addHours(today, 24 * i)), [today, days]);

	const loads = useMemo(() => loadByDay(state, now, today, days), [state, now, today, days]);
	const ongoingMachines = useMemo(() => new Set(state.breakdowns.filter(isOngoing).map((b) => b.machineId)), [state.breakdowns]);

	const rows = useMemo(() => {
		const row = (id: Id, meta: string, down: boolean): ResourceRow => {
			// zlecenia linii liczą się razem ze zleceniami jej maszyn
			const ids = new Set([id, ...(findLine(state.lines, id)?.machineIds ?? [])]);
			const pending = state.blocks.filter((b) => ids.has(b.machineId) && b.end > now);
			const lastEnd = Math.max(-Infinity, ...pending.map((b) => b.end));
			return { id, name: resourceName(state, id), meta, days: loads.get(id) ?? [], freeFrom: lastEnd > now ? lastEnd : undefined, queued: pending.length, down };
		};
		return {
			lines: state.lines.map((l) => {
				const members = lineMachines(l, state.machines);
				const continuous = members.length > 0 && members.every((m) => workMode(m) === 'continuous');
				return row(l.id, `${members.length}×${continuous ? ' · 24/7' : ''}`, members.some((m) => ongoingMachines.has(m.id)));
			}),
			machines: standaloneMachines(state).map((m) => row(m.id, workMode(m) === 'continuous' ? '24/7' : 'pon–pt', ongoingMachines.has(m.id)))
		};
	}, [state, now, loads, ongoingMachines]);

	const average = (subset: ResourceRow[]) => totalPercent(subset.flatMap((r) => r.days)) ?? 0;
	const ongoing = state.breakdowns.filter(isOngoing);
	const extended = new Set(ongoing.flatMap((b) => breakdownImpact(state, b, now).map((block) => block.id))).size;
	const breakdowns = [...state.breakdowns].filter((b) => showDone || isOngoing(b)).sort((a, b) => Number(isOngoing(b)) - Number(isOngoing(a)) || b.start - a.start);
	const doneCount = state.breakdowns.length - ongoing.length;
	const dense = days >= DENSE_FROM_DAYS;
	const tileNote = ongoing.length === 0 ? 'wszystkie maszyny pracują' : extended ? `wydłużają ${ordersLabel(extended)}` : 'nie wydłużają zleceń';
	const gridStyle = { '--days': days } as CSSProperties;

	const renderGroup = (title: string, subset: ResourceRow[]) =>
		subset.length > 0 && (
			<>
				<div className="heat-group">
					<span className="fw-semibold">{title}</span>
					<span className="heat-group-avg">średnio {average(subset)}%</span>
				</div>
				{subset.map((r) => (
					<div key={r.id} className="heat-grid heat-row" style={gridStyle}>
						<span className="heat-name">
							<span className={`status-dot ${r.down ? 'danger' : ''}`} />
							<span className="mono heat-resource" title={r.name}>
								{r.name}
							</span>
							<span className="heat-meta">{r.meta}</span>
						</span>
						{r.days.map((load, index) => {
							const percent = loadPercent(load);
							const ring = index === 0 ? (r.down ? 'is-today is-down' : 'is-today') : '';
							return percent === undefined ? (
								<span key={load.dayStart} className={`heat-cell is-off ${ring}`} title={`${shortDate(load.dayStart)} · dzień wolny`}>
									{!dense && 'wolne'}
								</span>
							) : (
								<span
									key={load.dayStart}
									className={`heat-cell mono ${ring}`}
									style={heat(percent)}
									title={`${shortDate(load.dayStart)} · ${percent}% · ${load.busy} z ${load.available} maszyno-godzin zajęte`}>
									{!dense && `${percent}%`}
								</span>
							);
						})}
						<span className="heat-free mono">{r.freeFrom ? formatDateTime(r.freeFrom) : <span className="text-success">wolna teraz</span>}</span>
						<span className="heat-queue mono">{r.queued}</span>
					</div>
				))}
			</>
		);

	return (
		<>
			<PageHeader title="Obciążenie" context={`${shortDate(dayStarts[0])}–${shortDate(dayStarts[dayStarts.length - 1])} · doby 6:00–6:00`}>
				<div className="segmented" role="group" aria-label="Zakres">
					{RANGES.map((n) => (
						<button key={n} type="button" className={`segmented-item ${days === n ? 'active' : ''}`} onClick={() => setDays(n)}>
							{n} dni
						</button>
					))}
				</div>
			</PageHeader>

			<div className="page-body load-layout">
				<div className="load-main">
					<div className="load-tiles">
						<div className="load-tile">
							<span className="load-tile-label">Linie · zajętość {days} dni</span>
							<span className="load-tile-value">{average(rows.lines)}%</span>
							<span className="load-tile-bar">
								<span style={{ width: `${average(rows.lines)}%` }} />
							</span>
						</div>
						<div className="load-tile">
							<span className="load-tile-label">Maszyny · zajętość {days} dni</span>
							<span className="load-tile-value">{average(rows.machines)}%</span>
							<span className="load-tile-bar">
								<span style={{ width: `${average(rows.machines)}%` }} />
							</span>
						</div>
						<div className={`load-tile ${ongoing.length ? 'is-danger' : ''}`}>
							<span className="load-tile-label">Awarie trwające teraz</span>
							<span className="load-tile-value">{ongoing.length}</span>
							<span className="load-tile-note">{tileNote}</span>
						</div>
					</div>

					<div className={`heatmap ${dense ? 'is-dense' : ''}`} title={HEATMAP_HINT}>
						<div className="heat-grid heat-head" style={gridStyle}>
							<span className="section-label">Zasób</span>
							{dayStarts.map((day, index) => (
								<span key={day} className={`heat-day ${index === 0 ? 'is-today' : ''}`}>
									{!dense && <span className="heat-day-sub">{index === 0 ? 'dziś' : weekdayFormat.format(day).replace('.', '')}</span>}
									<span className="heat-day-date mono">{dense ? new Date(day).getDate() : shortDate(day)}</span>
								</span>
							))}
							<span className="section-label">Wolna od</span>
							<span className="section-label text-end">Kolejka</span>
						</div>
						{renderGroup('Linie produkcyjne', rows.lines)}
						{renderGroup('Maszyny', rows.machines)}
					</div>
				</div>

				<aside className="load-side" aria-label="Awarie">
					<div className="load-side-head">
						<span className="load-side-title">Awarie</span>
						<span className="mono load-side-count">
							{ongoing.length} {ongoing.length === 1 ? 'trwa' : 'trwają'}
							{doneCount > 0 && ` · ${doneCount} ${doneCount === 1 ? 'zakończona' : 'zakończone'}`}
						</span>
						<Button size="sm" variant="outline-danger" className="ms-auto" onClick={() => setReporting(true)}>
							Zgłoś awarię
						</Button>
					</div>
					{doneCount > 0 && (
						<Form.Check
							type="switch"
							id="showDoneBreakdowns"
							className="load-side-switch"
							label="Pokaż zakończone"
							checked={showDone}
							onChange={(e) => setShowDone(e.target.checked)}
						/>
					)}
					{breakdowns.length === 0 && <p className="load-side-empty">Wszystkie maszyny pracują - brak trwających awarii.</p>}
					{breakdowns.map((breakdown) => {
						const active = isOngoing(breakdown);
						const end = active ? now : breakdownEnd(breakdown, now);
						const hours = Math.max(0, Math.round((end - breakdown.start) / HOUR));
						const line = lineOfMachine(state.lines, breakdown.machineId);
						return (
							<div key={breakdown.id} className={`breakdown-card ${active ? 'is-active' : 'is-done'}`}>
								<div className="breakdown-card-head">
									<span className={`status-dot ${active ? 'danger' : ''}`} />
									<span className="mono breakdown-card-name">{resourceName(state, breakdown.machineId)}</span>
									<span className="breakdown-card-where">{line ? line.name : 'maszyna'}</span>
									<span className={`pill ms-auto ${active ? 'pill-danger' : 'pill-neutral'}`}>{active ? 'Trwa' : 'Zakończona'}</span>
								</div>
								<dl className="breakdown-card-list">
									<dt>Od</dt>
									<dd className="mono">{formatDateTime(breakdown.start)}</dd>
									<dt>Do</dt>
									<dd className={`mono ${active ? 'text-danger' : ''}`}>{active ? 'trwa' : formatDateTime(end)}</dd>
									<dt>Czas</dt>
									<dd>{active ? `${hours} h · rośnie` : `${hours} h`}</dd>
									<dt>Wpływ</dt>
									<dd>{impactText(state, breakdown, now)}</dd>
								</dl>
								{active && (
									<div className="breakdown-card-actions">
										<Button variant="danger" className="flex-grow-1" onClick={() => endBreakdown(breakdown.id)}>
											Zakończ teraz
										</Button>
										<Button
											variant="outline-secondary"
											onClick={() => navigate('/', { state: { revealBreakdown: breakdown.id } satisfies PlanNavigationState })}>
											Pokaż na planie
										</Button>
									</div>
								)}
							</div>
						);
					})}
					<div className="heat-scale">
						<span className="section-label">Skala</span>
						<span className="heat-scale-row">
							{[0, 20, 40, 60, 80, 100].map((p) => (
								<span key={p} className="mono" style={heat(p)}>
									{p}%
								</span>
							))}
						</span>
					</div>
				</aside>
			</div>
			<BreakdownModal show={reporting} onHide={() => setReporting(false)} />
		</>
	);
};

export default LoadPage;
