import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, ButtonGroup, Form, Modal, Table, ToggleButton } from 'react-bootstrap';
import { DayChange, usePlan } from '../data/PlanContext';
import { effectiveDay, formatWorkingHours, isValidWorkingHours, lineMachines, standaloneMachines, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { dayKey, SHIFT_START_HOURS } from '../domain/shifts';
import { DayOverride, Id, Machine, WorkingHours } from '../domain/types';

/** Ustawienie dnia w formularzu: `inherit` = bez wyjątku (zakład: wg systemu pracy, maszyna: jak zakład). */
type Kind = 'inherit' | 'on' | 'off' | 'hours';
interface Choice {
	kind: Kind;
	hours: WorkingHours;
}

const DEFAULT_HOURS: WorkingHours = { from: 6, to: 18 };
/** Pełne godziny w kolejności doby zakładu: 6, 7, ..., 23, 0, ..., 5. */
const DAY_HOURS = Array.from({ length: 24 }, (_, i) => (SHIFT_START_HOURS[0] + i) % 24);
const dayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function toChoice(value: DayOverride | undefined): Choice {
	if (value === undefined) return { kind: 'inherit', hours: DEFAULT_HOURS };
	if (typeof value === 'object') return { kind: 'hours', hours: value };
	return { kind: value ? 'on' : 'off', hours: DEFAULT_HOURS };
}

function toOverride(choice: Choice): DayOverride | undefined {
	if (choice.kind === 'inherit') return undefined;
	if (choice.kind === 'hours') return choice.hours;
	return choice.kind === 'on';
}

const same = (a: DayOverride | undefined, b: DayOverride | undefined) => JSON.stringify(a) === JSON.stringify(b);

/** Wybór „od - do” w pełnych godzinach doby zakładu (6:00-6:00). */
const HoursRange = ({ value, onChange, id }: { value: WorkingHours; onChange: (hours: WorkingHours) => void; id: string }) => (
	<span className="d-inline-flex align-items-center gap-1">
		<Form.Select
			size="sm"
			className="hours-select"
			aria-label="Od godziny"
			id={`${id}-from`}
			value={value.from}
			onChange={(e) => {
				const from = Number(e.target.value);
				// „do” musi wypadać po „od” w tej samej dobie - jeśli nie, przesuwamy na godzinę później
				onChange(isValidWorkingHours({ from, to: value.to }) ? { from, to: value.to } : { from, to: (from + 1) % 24 });
			}}>
			{DAY_HOURS.map((h) => (
				<option key={h} value={h}>
					{h}:00
				</option>
			))}
		</Form.Select>
		–
		<Form.Select size="sm" className="hours-select" aria-label="Do godziny" value={value.to} onChange={(e) => onChange({ ...value, to: Number(e.target.value) })}>
			{[...DAY_HOURS.slice(1), SHIFT_START_HOURS[0]]
				.filter((to) => isValidWorkingHours({ from: value.from, to }))
				.map((h) => (
					<option key={h} value={h}>
						{h}:00
					</option>
				))}
		</Form.Select>
	</span>
);

/** Krótki opis, jak faktycznie pracuje maszyna w tym dniu. */
const DayResult = ({ day }: { day: DayOverride }) =>
	day === false ? <span className="day-result off">wolne</span> : <span className="day-result on">{day === true ? 'pracuje' : formatWorkingHours(day)}</span>;

interface DayCalendarModalProps {
	show: boolean;
	/** Początek doby (6:00). */
	day?: number;
	onHide: () => void;
}

/**
 * Kalendarz jednego dnia: ustawienie dla całego zakładu i wyjątki dla linii i maszyn w jednym miejscu.
 * Otwierany kliknięciem dnia w nagłówku planu.
 */
const DayCalendarModal = ({ show, day, onHide }: DayCalendarModalProps) => {
	const { state, saveDay } = usePlan();
	const [plant, setPlant] = useState<Choice>(toChoice(undefined));
	const [machines, setMachines] = useState<Record<Id, Choice>>({});
	const [filter, setFilter] = useState('');
	const key = day !== undefined ? dayKey(new Date(day)) : '';

	useEffect(() => {
		if (!show || day === undefined) return;
		setPlant(toChoice(state.calendar.overrides[key]));
		setMachines(Object.fromEntries(state.machines.map((m) => [m.id, toChoice(m.overrides?.[key])])));
		setFilter('');
		// formularz ustawiamy tylko przy otwarciu
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [show, day]);

	const plantOverride = toOverride(plant);
	/** Jak pracuje maszyna przy ustawieniach z formularza. */
	const effective = (machine: Machine): DayOverride => {
		const own = toOverride(machines[machine.id] ?? toChoice(undefined));
		const plantDraft = { overrides: plantOverride === undefined ? {} : { [key]: plantOverride } };
		return effectiveDay(plantDraft, { ...machine, overrides: own === undefined ? {} : { [key]: own } }, day ?? 0);
	};

	const q = filter.trim().toLowerCase();
	const matches = (name: string) => !q || name.toLowerCase().includes(q);
	const lineGroups = useMemo(
		() =>
			state.lines
				.map((line) => ({ line, members: lineMachines(line, state.machines) }))
				.filter(({ line, members }) => matches(line.name) || members.some((m) => matches(m.name))),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[state.lines, state.machines, q]
	);
	const standalone = standaloneMachines(state).filter((m) => matches(m.name));
	const working = state.machines.filter((m) => effective(m) !== false).length;

	const setChoice = (ids: Id[], choice: Partial<Choice>) =>
		setMachines((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, { ...(current[id] ?? toChoice(undefined)), ...choice }])) }));

	const save = () => {
		const changes: DayChange[] = [];
		if (!same(plantOverride, state.calendar.overrides[key])) changes.push({ value: plantOverride });
		for (const machine of state.machines) {
			const value = toOverride(machines[machine.id] ?? toChoice(undefined));
			if (!same(value, machine.overrides?.[key])) changes.push({ machineId: machine.id, value });
		}
		saveDay(key, changes);
		onHide();
	};

	const choiceSelect = (ids: Id[], choice: Choice | undefined, label: string) => (
		<span className="d-inline-flex align-items-center gap-2 flex-wrap">
			<Form.Select
				size="sm"
				className="day-choice-select"
				aria-label={`Ustawienie dnia: ${label}`}
				value={choice?.kind ?? ''}
				onChange={(e) => e.target.value && setChoice(ids, { kind: e.target.value as Kind })}>
				{choice === undefined && <option value="">— różne —</option>}
				<option value="inherit">Jak cały zakład</option>
				<option value="on">Pracuje</option>
				<option value="off">Wolne</option>
				<option value="hours">Tylko w godzinach…</option>
			</Form.Select>
			{choice?.kind === 'hours' && <HoursRange id={`hours-${ids[0]}`} value={choice.hours} onChange={(hours) => setChoice(ids, { hours })} />}
		</span>
	);

	/** Wspólne ustawienie maszyn linii albo `undefined`, gdy się różnią. */
	const commonChoice = (ids: Id[]): Choice | undefined => {
		const choices = ids.map((id) => machines[id] ?? toChoice(undefined));
		return choices.every((c) => same(toOverride(c), toOverride(choices[0]))) ? choices[0] : undefined;
	};

	const machineRow = (machine: Machine, inLine: boolean) => (
		<tr key={machine.id}>
			<td className={inLine ? 'ps-4' : ''}>
				{machine.name}
				<div className="small text-secondary">{WORK_MODE_LABELS[workMode(machine)]}</div>
			</td>
			<td>{choiceSelect([machine.id], machines[machine.id], machine.name)}</td>
			<td className="text-end">
				<DayResult day={effective(machine)} />
			</td>
		</tr>
	);

	return (
		<Modal show={show} onHide={onHide} centered scrollable size="lg">
			<Modal.Header closeButton>
				<Modal.Title>{day !== undefined && capitalize(dayFormat.format(day))}</Modal.Title>
			</Modal.Header>
			<Modal.Body className="d-flex flex-column gap-3">
				<div>
					<div className="fw-semibold mb-2">Cały zakład</div>
					<ButtonGroup className="d-flex flex-wrap">
						{(
							[
								['inherit', 'Normalnie'],
								['on', 'Pracujemy'],
								['off', 'Wolne (np. święto)'],
								['hours', 'Tylko w godzinach']
							] as [Kind, string][]
						).map(([kind, label]) => (
							<ToggleButton
								key={kind}
								id={`plant-${kind}`}
								type="radio"
								name="plantDay"
								value={kind}
								variant="outline-primary"
								checked={plant.kind === kind}
								onChange={() => setPlant({ ...plant, kind })}>
								{label}
							</ToggleButton>
						))}
					</ButtonGroup>
					<div className="small text-secondary mt-2">
						{plant.kind === 'inherit' && 'Każda maszyna pracuje wg swojego systemu: pon–pt w dni robocze, 4-brygadowe codziennie.'}
						{plant.kind === 'on' && 'Wszystkie maszyny pracują cały dzień (np. pracująca sobota), chyba że niżej ustawisz inaczej.'}
						{plant.kind === 'off' && 'Żadna maszyna nie pracuje, chyba że niżej ustawisz wyjątek.'}
						{plant.kind === 'hours' && (
							<span className="d-inline-flex align-items-center gap-2">
								Wszystkie maszyny pracują w godzinach <HoursRange id="plant" value={plant.hours} onChange={(hours) => setPlant({ ...plant, hours })} />
							</span>
						)}
					</div>
				</div>

				<div>
					<div className="d-flex align-items-center justify-content-between gap-3 mb-2">
						<div>
							<span className="fw-semibold">Wyjątki dla linii i maszyn</span>
							<span className="small text-secondary ms-2">
								pracuje {working} z {state.machines.length} maszyn
							</span>
						</div>
						<Form.Control size="sm" type="search" className="day-filter" placeholder="Szukaj maszyny" value={filter} onChange={(e) => setFilter(e.target.value)} />
					</div>
					<Table size="sm" className="align-middle mb-0 day-table">
						<tbody>
							{lineGroups.map(({ line, members }) => {
								const ids = members.map((m) => m.id);
								return (
									<Fragment key={line.id}>
										<tr className="table-group-row">
											<th>{line.name}</th>
											<td>{choiceSelect(ids, commonChoice(ids), line.name)}</td>
											<td className="text-end small text-secondary">cała linia</td>
										</tr>
										{members.map((m) => machineRow(m, true))}
									</Fragment>
								);
							})}
							{standalone.length > 0 && (
								<tr className="table-group-row">
									<th colSpan={3}>Maszyny</th>
								</tr>
							)}
							{standalone.map((m) => machineRow(m, false))}
						</tbody>
					</Table>
				</div>
			</Modal.Body>
			<Modal.Footer>
				<Button variant="light" onClick={onHide}>
					Anuluj
				</Button>
				<Button onClick={save}>Zapisz</Button>
			</Modal.Footer>
		</Modal>
	);
};

export default DayCalendarModal;
