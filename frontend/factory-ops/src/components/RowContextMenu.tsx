import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlan } from '../data/PlanContext';
import { breakdownEnd, describeDay, effectiveDay, findLine, isOngoing, lineMachines, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { formatDateTime } from '../domain/format';
import { addHours } from '../domain/shifts';
import { Id } from '../domain/types';
import { BreakdownModalTarget } from './BreakdownModal';
import { machinesLabel } from './planSelectors';
import './RowContextMenu.css';

export interface RowMenuTarget {
	x: number;
	y: number;
	/** Maszyna albo linia klikniętego wiersza. */
	resourceId: Id;
	/** Początek doby (6:00), której dotyczy menu. */
	day: number;
	/** Pełna godzina w klikniętym miejscu - od niej można dodać zlecenie. */
	hour: number;
}

interface RowContextMenuProps {
	target: RowMenuTarget;
	onAddBlock: () => void;
	onReportBreakdown: (target: BreakdownModalTarget) => void;
	onOpenDay: () => void;
	onClose: () => void;
}

const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const hourFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const weekdayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
const HOUR = 3600_000;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** Menu prawego przycisku na wierszu planu: dodanie zlecenia, awarie maszyn wiersza i kalendarz dnia. */
const RowContextMenu = ({ target, onAddBlock, onReportBreakdown, onOpenDay, onClose }: RowContextMenuProps) => {
	const { state, now, endBreakdown, removeBreakdown } = usePlan();
	const ref = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ left: target.x, top: target.y });

	// menu kliknięte nisko lub z prawej strony ekranu przesuwamy tak, żeby całe było widoczne
	useLayoutEffect(() => {
		const rect = ref.current?.getBoundingClientRect();
		if (!rect) return;
		const margin = 8;
		setPosition({
			left: Math.max(margin, Math.min(target.x, window.innerWidth - rect.width - margin)),
			top: Math.max(margin, Math.min(target.y, window.innerHeight - rect.height - margin))
		});
	}, [target.x, target.y]);

	useEffect(() => {
		const outside = (e: Event) => !ref.current?.contains(e.target as Node) && onClose();
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		document.addEventListener('mousedown', outside);
		document.addEventListener('keydown', onKey);
		window.addEventListener('wheel', outside, { passive: true });
		return () => {
			document.removeEventListener('mousedown', outside);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('wheel', outside);
		};
	}, [onClose]);

	const machine = state.machines.find((m) => m.id === target.resourceId);
	const line = findLine(state.lines, target.resourceId);
	if (!machine && !line) return null;

	const machines = machine ? [machine] : lineMachines(line!, state.machines);
	const name = machine?.name ?? line!.name;
	const names = new Map(machines.map((m) => [m.id, m.name]));
	const dayEnd = addHours(target.day, 24);
	// trwające awarie maszyn wiersza oraz zakończone, które przypadają na klikniętą dobę
	const breakdowns = state.breakdowns
		.filter((b) => names.has(b.machineId) && (isOngoing(b) || (b.start < dayEnd && breakdownEnd(b, now) > target.day)))
		.sort((a, b) => a.start - b.start);
	const machineDown = machine !== undefined && breakdowns.some((b) => isOngoing(b));

	const run = (action: () => void) => () => {
		action();
		onClose();
	};

	const dayDate = new Date(target.day);
	const dayLabel = `${weekdayFormat.format(target.day).replace('.', '')} ${dayDate.getDate()}.${dayDate.getMonth() + 1}`;
	/** Godzina, gdy awaria zaczęła się w ciągu ostatniej doby; dawniej - pełna data. */
	const since = (ms: number) => (now - ms < 24 * HOUR && ms <= now ? hourFormat.format(ms) : formatDateTime(ms));

	return (
		<div ref={ref} className="row-menu" role="menu" style={{ position: 'fixed', ...position }}>
			<div className="row-menu-head">
				<div className="row-menu-title">
					{capitalize(dayFormat.format(target.day))} · {name}
				</div>
				<div className="row-menu-sub">
					{machine
						? `${describeDay(effectiveDay(state.calendar, machine, target.day))} · ${WORK_MODE_LABELS[workMode(machine)]}`
						: `Linia: ${machinesLabel(machines.length)} pracujące równolegle`}
				</div>
			</div>
			<div className="row-menu-body">
				<button type="button" role="menuitem" className="row-menu-item" onClick={run(onAddBlock)}>
					Dodaj zlecenie od {hourFormat.format(target.hour)}
					<span className="row-menu-hint">dwuklik</span>
				</button>
				{breakdowns.map((breakdown) => (
					<div key={breakdown.id} className="row-menu-breakdown">
						<span>
							Awaria{line ? ` ${names.get(breakdown.machineId)}` : ''} od {since(breakdown.start)}
							{isOngoing(breakdown) ? (
								<>
									{' '}
									· <b>trwa</b>
								</>
							) : (
								` do ${formatDateTime(breakdownEnd(breakdown, now))}`
							)}
						</span>
						<span className="row-menu-breakdown-actions">
							{isOngoing(breakdown) && (
								<button type="button" role="menuitem" className="btn btn-danger" onClick={run(() => endBreakdown(breakdown.id))}>
									Zakończ teraz
								</button>
							)}
							<button type="button" role="menuitem" className="btn row-menu-remove" onClick={run(() => removeBreakdown(breakdown.id))}>
								Usuń
							</button>
						</span>
					</div>
				))}
				{!machineDown && (
					<button
						type="button"
						role="menuitem"
						className="row-menu-item is-danger"
						onClick={run(() => onReportBreakdown(machine ? { machineId: machine.id } : { machineIds: machines.map((m) => m.id) }))}>
						{machine ? `Zgłoś awarię ${machine.name}…` : 'Zgłoś awarię maszyny linii…'}
					</button>
				)}
				<div className="row-menu-divider" />
				<button type="button" role="menuitem" className="row-menu-item" onClick={run(onOpenDay)}>
					Dzień pracujący / wolny…
					<span className="row-menu-hint">{dayLabel}</span>
				</button>
			</div>
		</div>
	);
};

export default RowContextMenu;
