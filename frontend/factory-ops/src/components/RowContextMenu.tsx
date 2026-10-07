import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlan } from '../data/PlanContext';
import { breakdownEnd, describeDay, effectiveDay, findLine, isOngoing, lineMachines, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { formatDateTime } from '../domain/format';
import { addHours } from '../domain/shifts';
import { Id } from '../domain/types';
import { BreakdownModalTarget } from './BreakdownModal';

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

	return (
		<div ref={ref} className="dropdown-menu show shadow day-menu" style={{ position: 'fixed', ...position }}>
			<h6 className="dropdown-header">
				{capitalize(dayFormat.format(target.day))} · {name}
				<div className="fw-normal small">
					{machine
						? `${describeDay(effectiveDay(state.calendar, machine, target.day))} · ${WORK_MODE_LABELS[workMode(machine)]}`
						: `Linia: ${machines.length} maszyny pracujące równolegle`}
				</div>
			</h6>
			<button className="dropdown-item" onClick={run(onAddBlock)}>
				Dodaj zlecenie od {hourFormat.format(target.hour)}
			</button>
			<div className="dropdown-divider" />
			{breakdowns.map((breakdown) => (
				<div key={breakdown.id} className="d-flex align-items-center justify-content-between gap-3 px-3 py-1 small">
					<span className="text-danger">
						Awaria{line ? ` ${names.get(breakdown.machineId)}` : ''} od {formatDateTime(breakdown.start)}
						{isOngoing(breakdown) ? <strong> · trwa</strong> : ` do ${formatDateTime(breakdownEnd(breakdown, now))}`}
					</span>
					<span className="d-flex gap-2 text-nowrap">
						{isOngoing(breakdown) && (
							<button type="button" className="btn btn-danger btn-sm py-0" onClick={run(() => endBreakdown(breakdown.id))}>
								Zakończ teraz
							</button>
						)}
						<button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={run(() => removeBreakdown(breakdown.id))}>
							Usuń
						</button>
					</span>
				</div>
			))}
			{!machineDown && (
				<button
					className="dropdown-item text-danger"
					onClick={run(() => onReportBreakdown(machine ? { machineId: machine.id } : { machineIds: machines.map((m) => m.id) }))}>
					{machine ? `Zgłoś awarię ${machine.name}…` : 'Zgłoś awarię maszyny linii…'}
				</button>
			)}
			<div className="dropdown-divider" />
			<button className="dropdown-item" onClick={run(onOpenDay)}>
				Dzień pracujący / wolny: {dayFormat.format(target.day)}…
			</button>
		</div>
	);
};

export default RowContextMenu;
