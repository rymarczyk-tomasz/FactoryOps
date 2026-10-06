import React, { useEffect, useRef } from 'react';
import { usePlan } from '../data/PlanContext';
import { machineCalendar, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { dayKey } from '../domain/shifts';
import { Id } from '../domain/types';

export interface DayMenuTarget {
	x: number;
	y: number;
	machineId: Id;
	/** Początek doby (6:00), której dotyczy menu. */
	day: number;
}

interface DayContextMenuProps {
	target: DayMenuTarget;
	onAddBlock: () => void;
	onClose: () => void;
}

const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const DayContextMenu = ({ target, onAddBlock, onClose }: DayContextMenuProps) => {
	const { state, setDayWorking } = usePlan();
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const onMouseDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && onClose();
		const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
		document.addEventListener('mousedown', onMouseDown);
		document.addEventListener('keydown', onKey);
		window.addEventListener('wheel', onClose, { passive: true });
		return () => {
			document.removeEventListener('mousedown', onMouseDown);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('wheel', onClose);
		};
	}, [onClose]);

	const machine = state.machines.find((m) => m.id === target.machineId);
	if (!machine) return null;

	const date = new Date(target.day);
	const key = dayKey(date);
	const working = machineCalendar(state.calendar, machine)(date);
	const machineOverride = machine.overrides?.[key];
	const plantOverride = state.calendar.overrides[key];
	// jak byłoby bez wyjątku maszyny - wtedy zamiast zapisywać wyjątek, po prostu go usuwamy
	const withoutMachineOverride = machineCalendar(state.calendar, { ...machine, overrides: {} })(date);

	const run = (action: () => void) => () => {
		action();
		onClose();
	};
	const setForMachine = (value: boolean) => setDayWorking(key, value === withoutMachineOverride ? undefined : value, machine.id);

	return (
		<div ref={ref} className="dropdown-menu show shadow day-menu" style={{ position: 'fixed', left: target.x, top: target.y }}>
			<h6 className="dropdown-header">
				{capitalize(dayFormat.format(date))} · {machine.name}
				<div className="fw-normal small">
					{working ? 'Dzień pracujący' : 'Dzień wolny'} · {WORK_MODE_LABELS[workMode(machine)]}
				</div>
			</h6>
			<button className="dropdown-item" onClick={run(onAddBlock)}>
				Dodaj zlecenie od tej zmiany
			</button>
			<div className="dropdown-divider" />
			<button className="dropdown-item" onClick={run(() => setForMachine(!working))}>
				{working ? 'Wolne' : 'Pracujący'} na {machine.name}
			</button>
			{plantOverride !== true && (
				<button className="dropdown-item" onClick={run(() => setDayWorking(key, true))}>
					Pracujący dla całego zakładu
				</button>
			)}
			{plantOverride !== false && (
				<button className="dropdown-item" onClick={run(() => setDayWorking(key, false))}>
					Wolne dla całego zakładu (np. święto)
				</button>
			)}
			{(machineOverride !== undefined || plantOverride !== undefined) && <div className="dropdown-divider" />}
			{machineOverride !== undefined && (
				<button className="dropdown-item" onClick={run(() => setDayWorking(key, undefined, machine.id))}>
					Przywróć domyślne dla {machine.name}
				</button>
			)}
			{plantOverride !== undefined && (
				<button className="dropdown-item" onClick={run(() => setDayWorking(key, undefined))}>
					Przywróć domyślne dla zakładu
				</button>
			)}
		</div>
	);
};

export default DayContextMenu;
