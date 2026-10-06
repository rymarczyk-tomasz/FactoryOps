import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePlan } from '../data/PlanContext';
import { effectiveDay, formatWorkingHours, isValidWorkingHours, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { dayKey, SHIFT_START_HOURS } from '../domain/shifts';
import { DayOverride, Id, WorkingHours } from '../domain/types';

export interface DayMenuTarget {
	x: number;
	y: number;
	machineId: Id;
	/** Początek doby (6:00), której dotyczy menu. */
	day: number;
	/** Pełna godzina w klikniętym miejscu - od niej można dodać zlecenie. */
	hour: number;
}

interface DayContextMenuProps {
	target: DayMenuTarget;
	onAddBlock: () => void;
	onClose: () => void;
}

const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
const hourFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** Pełne godziny w kolejności doby zakładu: 6, 7, ..., 23, 0, ..., 5. */
const DAY_HOURS = Array.from({ length: 24 }, (_, i) => (SHIFT_START_HOURS[0] + i) % 24);
const DEFAULT_HOURS: WorkingHours = { from: 6, to: 14 };

const sameOverride = (a: DayOverride, b: DayOverride) => JSON.stringify(a) === JSON.stringify(b);

function describeDay(day: DayOverride): string {
	if (day === true) return 'Dzień pracujący';
	if (day === false) return 'Dzień wolny';
	return `Pracuje ${formatWorkingHours(day)}`;
}

const DayContextMenu = ({ target, onAddBlock, onClose }: DayContextMenuProps) => {
	const { state, setDayWorking } = usePlan();
	const ref = useRef<HTMLDivElement>(null);
	const machine = state.machines.find((m) => m.id === target.machineId);
	const key = dayKey(new Date(target.day));
	const current = effectiveDay(state.calendar, machine, target.day);
	const [hoursForm, setHoursForm] = useState<WorkingHours>();
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
	}, [target.x, target.y, hoursForm !== undefined]);

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

	if (!machine) return null;

	const machineOverride = machine.overrides?.[key];
	const plantOverride = state.calendar.overrides[key];
	// jak byłoby bez wyjątku maszyny - wtedy zamiast zapisywać wyjątek, po prostu go usuwamy
	const withoutMachineOverride = effectiveDay(state.calendar, { ...machine, overrides: {} }, target.day);

	const run = (action: () => void) => () => {
		action();
		onClose();
	};
	const setForMachine = (value: DayOverride) => setDayWorking(key, sameOverride(value, withoutMachineOverride) ? undefined : value, machine.id);

	const openHoursForm = () => setHoursForm(typeof current === 'object' ? current : DEFAULT_HOURS);
	const changeFrom = (from: number) =>
		setHoursForm((h) => {
			const next = { from, to: h?.to ?? DEFAULT_HOURS.to };
			// "do" musi wypadać po "od" w tej samej dobie - jeśli nie, przesuwamy na godzinę później
			return isValidWorkingHours(next) ? next : { from, to: (from + 1) % 24 };
		});

	return (
		<div ref={ref} className="dropdown-menu show shadow day-menu" style={{ position: 'fixed', ...position }}>
			<h6 className="dropdown-header">
				{capitalize(dayFormat.format(target.day))} · {machine.name}
				<div className="fw-normal small">
					{describeDay(current)} · {WORK_MODE_LABELS[workMode(machine)]}
				</div>
			</h6>
			<button className="dropdown-item" onClick={run(onAddBlock)}>
				Dodaj zlecenie od {hourFormat.format(target.hour)}
			</button>
			<div className="dropdown-divider" />
			{current !== true && (
				<button className="dropdown-item" onClick={run(() => setForMachine(true))}>
					Cały dzień pracujący na {machine.name}
				</button>
			)}
			{current !== false && (
				<button className="dropdown-item" onClick={run(() => setForMachine(false))}>
					Wolne na {machine.name}
				</button>
			)}
			{hoursForm === undefined ? (
				<button className="dropdown-item" onClick={openHoursForm}>
					Godziny pracy na {machine.name}…
				</button>
			) : (
				<form
					className="px-3 py-2 day-hours-form"
					onSubmit={(e) => {
						e.preventDefault();
						run(() => setForMachine(hoursForm))();
					}}>
					<div className="small text-secondary mb-1">Godziny pracy na {machine.name}</div>
					<div className="d-flex align-items-center gap-2">
						<label className="small" htmlFor="hoursFrom">
							od
						</label>
						<select id="hoursFrom" className="form-select form-select-sm" value={hoursForm.from} onChange={(e) => changeFrom(Number(e.target.value))}>
							{DAY_HOURS.map((h) => (
								<option key={h} value={h}>
									{h}:00
								</option>
							))}
						</select>
						<label className="small" htmlFor="hoursTo">
							do
						</label>
						<select
							id="hoursTo"
							className="form-select form-select-sm"
							value={hoursForm.to}
							onChange={(e) => setHoursForm({ ...hoursForm, to: Number(e.target.value) })}>
							{[...DAY_HOURS.slice(1), SHIFT_START_HOURS[0]]
								.filter((to) => isValidWorkingHours({ from: hoursForm.from, to }))
								.map((h) => (
									<option key={h} value={h}>
										{h}:00
									</option>
								))}
						</select>
						<button type="submit" className="btn btn-primary btn-sm">
							Ustaw
						</button>
					</div>
				</form>
			)}
			<div className="dropdown-divider" />
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
