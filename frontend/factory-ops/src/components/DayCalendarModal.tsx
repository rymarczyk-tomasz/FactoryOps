import { Fragment, useEffect, useMemo, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { DayChange, usePlan } from '../data/PlanContext';
import { effectiveDay, formatWorkingHours, isValidWorkingHours, lineMachines, standaloneMachines, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { addHours, dayKey, SHIFT_START_HOURS } from '../domain/shifts';
import { DayOverride, Id, Machine, WorkingHours } from '../domain/types';
import { machinesLabel } from './planSelectors';
import './modals.css';
import Segmented from './Segmented';

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
const weekdayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const PLANT_KINDS: [Kind, string, string][] = [
	['inherit', 'Normalnie', 'Każda maszyna pracuje wg swojego systemu: pon–pt w dni robocze, 4-brygadowe codziennie.'],
	['on', 'Pracujemy', 'Wszystkie maszyny pracują cały dzień (np. pracująca sobota), chyba że niżej ustawisz inaczej.'],
	['off', 'Wolne (np. święto)', 'Żadna maszyna nie pracuje, chyba że niżej ustawisz wyjątek.'],
	['hours', 'Tylko w godzinach', 'Wszystkie maszyny pracują w godzinach']
];

/** Wybrane ustawienie w polu (w trybie godzin obok są jeszcze dwa pola godzin). */
const CHOICE_SHORT: Record<Kind, string> = { inherit: 'Jak cały zakład', on: 'Pracuje', off: 'Wolne', hours: 'Godziny' };

/** „1 wyjątek maszyny”, „2 wyjątki maszyn”, „5 wyjątków maszyn”. */
function exceptionsLabel(n: number): string {
	if (n === 1) return '1 wyjątek maszyny';
	const few = n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14);
	return `${n} ${few ? 'wyjątki' : 'wyjątków'} maszyn`;
}

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
	<span className="day-hours">
		<Form.Select
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
		<Form.Select aria-label="Do godziny" value={value.to} onChange={(e) => onChange({ ...value, to: Number(e.target.value) })}>
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
	day === false ? (
		<span className="day-result is-off">wolne</span>
	) : day === true ? (
		<span className="day-result is-on">pracuje</span>
	) : (
		<span className="day-result is-hours mono">{formatWorkingHours(day)}</span>
	);

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
	/** Rozwinięte linie - na starcie te z wyjątkami maszyn (albo pierwsza). */
	const [open, setOpen] = useState<Set<Id>>(new Set());
	const key = day !== undefined ? dayKey(new Date(day)) : '';

	useEffect(() => {
		if (!show || day === undefined) return;
		const initial = Object.fromEntries(state.machines.map((m) => [m.id, toChoice(m.overrides?.[key])]));
		setPlant(toChoice(state.calendar.overrides[key]));
		setMachines(initial);
		setFilter('');
		const withExceptions = state.lines.filter((l) => l.machineIds.some((id) => initial[id] && initial[id].kind !== 'inherit')).map((l) => l.id);
		setOpen(new Set(withExceptions.length ? withExceptions : state.lines.slice(0, 1).map((l) => l.id)));
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
	const exceptions = state.machines.filter((m) => (machines[m.id]?.kind ?? 'inherit') !== 'inherit').length;

	const setChoice = (ids: Id[], choice: Partial<Choice>) =>
		setMachines((current) => ({ ...current, ...Object.fromEntries(ids.map((id) => [id, { ...(current[id] ?? toChoice(undefined)), ...choice }])) }));
	const toggleLine = (id: Id) =>
		setOpen((current) => {
			const next = new Set(current);
			if (!next.delete(id)) next.add(id);
			return next;
		});

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
		<span className="day-row-control">
			{/* w trybie godzin pole jest wąskie - pokazuje krótką etykietę, pełne nazwy zostają na liście */}
			<span className="select-display is-compact">
				<Form.Select
					className={choice && choice.kind !== 'inherit' ? 'is-exception' : ''}
					aria-label={`Ustawienie dnia: ${label}`}
					value={choice?.kind ?? ''}
					onChange={(e) => e.target.value && setChoice(ids, { kind: e.target.value as Kind })}>
					{choice === undefined && <option value="">— różne —</option>}
					<option value="inherit">Jak cały zakład</option>
					<option value="on">Pracuje</option>
					<option value="off">Wolne</option>
					<option value="hours">Tylko w godzinach…</option>
				</Form.Select>
				<span className="select-display-value">{choice ? CHOICE_SHORT[choice.kind] : '— różne —'}</span>
			</span>
			{choice?.kind === 'hours' && <HoursRange id={`hours-${ids[0]}`} value={choice.hours} onChange={(hours) => setChoice(ids, { hours })} />}
		</span>
	);

	/** Wspólne ustawienie maszyn linii albo `undefined`, gdy się różnią. */
	const commonChoice = (ids: Id[]): Choice | undefined => {
		const choices = ids.map((id) => machines[id] ?? toChoice(undefined));
		return choices.every((c) => same(toOverride(c), toOverride(choices[0]))) ? choices[0] : undefined;
	};

	const machineRow = (machine: Machine, inLine: boolean) => {
		const own = machines[machine.id];
		return (
			<div key={machine.id} className={`day-row ${inLine ? 'is-member' : ''}`}>
				<span className="day-row-name">
					{own && own.kind !== 'inherit' && <span className="day-row-dot" title="Własny wyjątek tej maszyny" />}
					<span className="day-row-label">{machine.name}</span>
					<span className="day-row-mode">{WORK_MODE_LABELS[workMode(machine)].replace('Pon–pt', 'pon–pt')}</span>
				</span>
				{choiceSelect([machine.id], own, machine.name)}
				<DayResult day={effective(machine)} />
			</div>
		);
	};

	const nextDay = day !== undefined ? weekdayFormat.format(addHours(day, 24)).replace('.', '') : '';

	return (
		<Modal show={show} onHide={onHide} centered size="lg" dialogClassName="day-modal">
			<Modal.Header closeButton closeLabel="Zamknij">
				<Modal.Title>
					{day !== undefined && capitalize(dayFormat.format(day))}
					<span className="modal-title-sub">doba 6:00 → {nextDay} 6:00</span>
				</Modal.Title>
			</Modal.Header>
			<Modal.Body className="modal-stack">
				<div className="day-section">
					<span className="day-section-title">Cały zakład</span>
					<Segmented
						block
						label="Cały zakład"
						value={plant.kind}
						onChange={(kind) => setPlant({ ...plant, kind })}
						options={PLANT_KINDS.map(([kind, label]) => ({ value: kind, label }))}
					/>
					<div className="day-kind-text">
						<span>{PLANT_KINDS.find(([kind]) => kind === plant.kind)?.[2]}</span>
						{plant.kind === 'hours' && <HoursRange id="plant" value={plant.hours} onChange={(hours) => setPlant({ ...plant, hours })} />}
					</div>
				</div>

				<div className="day-section">
					<div className="day-section-head">
						<span className="day-section-title">Wyjątki dla linii i maszyn</span>
						<span className="day-working">
							pracuje <b>{working}</b> z {state.machines.length} maszyn
						</span>
						<div className="search-field day-search">
							<input type="search" placeholder="Szukaj maszyny" aria-label="Szukaj maszyny" value={filter} onChange={(e) => setFilter(e.target.value)} />
						</div>
					</div>
					<div className="day-table">
						{lineGroups.map(({ line, members }) => {
							const ids = members.map((m) => m.id);
							// przy wyszukiwaniu linie z trafieniami są zawsze rozwinięte
							const expanded = q !== '' || open.has(line.id);
							const shown = q && !matches(line.name) ? members.filter((m) => matches(m.name)) : members;
							return (
								<Fragment key={line.id}>
									<div className="day-row is-group">
										<button
											type="button"
											className="day-row-toggle"
											aria-expanded={expanded}
											title={expanded ? 'Zwiń maszyny linii' : 'Pokaż maszyny linii'}
											onClick={() => toggleLine(line.id)}>
											<span className={`day-row-chevron ${expanded ? 'is-open' : ''}`}>▸</span>
											<span className="day-row-label">{line.name}</span>
											<span className="day-row-mode">{machinesLabel(members.length)}</span>
										</button>
										{choiceSelect(ids, commonChoice(ids), line.name)}
										<span className="day-result is-muted">cała linia</span>
									</div>
									{expanded && shown.map((m) => machineRow(m, true))}
								</Fragment>
							);
						})}
						{standalone.length > 0 && (
							<div className="day-row is-group">
								<span className="day-row-label">Maszyny</span>
							</div>
						)}
						{standalone.map((m) => machineRow(m, false))}
						{lineGroups.length === 0 && standalone.length === 0 && <div className="member-empty">Brak maszyn pasujących do wyszukiwania.</div>}
					</div>
				</div>
			</Modal.Body>
			<Modal.Footer>
				<span className="modal-footer-hint">{exceptions > 0 ? `${exceptionsLabel(exceptions)} · ` : ''}zmiany przesuną zlecenia po zapisie</span>
				<Button variant="light" onClick={onHide}>
					Anuluj
				</Button>
				<Button onClick={save}>Zapisz</Button>
			</Modal.Footer>
		</Modal>
	);
};

export default DayCalendarModal;
