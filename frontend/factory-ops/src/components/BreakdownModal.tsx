import { FormEvent, useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { isOngoing, lineMachines, lineOfMachine, resourceName, standaloneMachines } from '../domain/calendar';
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from '../domain/format';
import { blockStatus } from '../domain/schedule';
import { addHours, hourStartAtOrBefore, nearestHourStart } from '../domain/shifts';
import { Id } from '../domain/types';
import './modals.css';

/** Dla kogo zgłaszamy awarię: konkretna maszyna albo wybór spośród `machineIds` (np. maszyn linii); pusty - wszystkie. */
export interface BreakdownModalTarget {
	machineId?: Id;
	machineIds?: Id[];
}

interface BreakdownModalProps {
	show: boolean;
	target?: BreakdownModalTarget;
	onHide: () => void;
}

/** Szybki wybór „stoi od”: tyle godzin przed bieżącą pełną godziną. */
const SINCE_HOURS = [0, 1, 2, 4, 8];
/** Ile wydłużonych zleceń wymienić z nazwy. */
const LISTED_ORDERS = 3;

/**
 * Zgłoszenie awarii: maszyna stoi od teraz (albo od podanej godziny w przeszłości) do odwołania.
 * Awarii nie planuje się naprzód - nie wiadomo, ile potrwa naprawa.
 */
const BreakdownModal = ({ show, target, onHide }: BreakdownModalProps) => {
	const { state, now, reportBreakdown } = usePlan();
	const [machineId, setMachineId] = useState<Id>('');
	const [from, setFrom] = useState('');
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		if (!show) return;
		setMachineId(target?.machineId ?? (target?.machineIds?.length === 1 ? target.machineIds[0] : ''));
		setFrom(toLocalInputValue(hourStartAtOrBefore(Date.now())));
		setSubmitted(false);
		// formularz ustawiamy tylko przy otwarciu
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [show]);

	const allowed = target?.machineIds ? new Set(target.machineIds) : undefined;
	const isAllowed = (id: Id) => !allowed || allowed.has(id);
	const lineGroups = state.lines.map((line) => ({ line, machines: lineMachines(line, state.machines).filter((m) => isAllowed(m.id)) })).filter((g) => g.machines.length > 0);
	const standalone = standaloneMachines(state).filter((m) => isAllowed(m.id));
	const ongoing = state.breakdowns.find((b) => b.machineId === machineId && isOngoing(b));
	const line = machineId ? lineOfMachine(state.lines, machineId) : undefined;
	const name = resourceName(state, machineId);

	const hourNow = hourStartAtOrBefore(Date.now());
	const start = from ? nearestHourStart(fromLocalInputValue(from)) : NaN;
	const fromError = !from ? 'Podaj godzinę' : start > Date.now() ? 'Awarii nie planuje się naprzód - podaj godzinę, która już minęła' : undefined;
	const machineError = !machineId ? 'Wybierz maszynę' : ongoing ? `Ta maszyna ma już trwającą awarię (od ${formatDateTime(ongoing.start)})` : undefined;

	/** Co awaria wydłuży: zlecenia maszyny i jej linii, które jeszcze pracują po początku awarii. */
	const affected = machineId
		? state.blocks
			.filter((b) => (b.machineId === machineId || b.machineId === line?.id) && b.end > (Number.isNaN(start) ? now : start))
			.sort((a, b) => a.start - b.start)
		: [];
	// w toku od początku awarii; gdy nic nie pracuje - najbliższe w kolejce. Reszta tylko się przesunie.
	const running = affected.filter((b) => b.start <= hourNow);
	const extended = (running.length ? running : affected.slice(0, 1)).slice(0, LISTED_ORDERS);
	const shifted = affected.length - extended.length;
	const consequence = () => {
		if (!machineId) return 'Wybierz maszynę, żeby zobaczyć, które zlecenia się wydłużą.';
		const text = `${name} stoi do odwołania, czas awarii rośnie co godzinę.`;
		if (!line) return `${text} Jej zlecenia przesuną się o czas postoju.`;
		const down = state.breakdowns.filter((b) => isOngoing(b) && b.machineId !== machineId && line.machineIds.includes(b.machineId)).length;
		const working = line.machineIds.length - down - 1;
		return working > 0
			? `${text} ${line.name} nie staje - pracuje na ${working} z ${line.machineIds.length} maszyn, więc jej zlecenia się wydłużą.`
			: `${text} To ostatnia pracująca maszyna ${line.name} - linia stanie.`;
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		setSubmitted(true);
		if (fromError || machineError) return;
		reportBreakdown(machineId, start);
		onHide();
	};

	return (
		<Modal show={show} onHide={onHide} centered>
			<Form noValidate onSubmit={onSubmit}>
				<Modal.Header closeButton>
					<Modal.Title>
						<span className="modal-title-dot" />
						Zgłoś awarię
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="modal-stack">
					<Form.Group controlId="breakdownMachine">
						<Form.Label>Maszyna</Form.Label>
						<div className="select-display">
							<Form.Select autoFocus value={machineId} onChange={(e) => setMachineId(e.target.value)} isInvalid={(submitted && !machineId) || !!ongoing}>
								<option value="">— wybierz —</option>
								{lineGroups.map(({ line: group, machines }) => (
									<optgroup key={group.id} label={group.name}>
										{machines.map((m) => (
											<option key={m.id} value={m.id}>
												{m.name}
											</option>
										))}
									</optgroup>
								))}
								{standalone.length > 0 && (
									<optgroup label="Maszyny">
										{standalone.map((m) => (
											<option key={m.id} value={m.id}>
												{m.name}
											</option>
										))}
									</optgroup>
								)}
							</Form.Select>
							<span className="select-display-value">
								{machineId ? (
									<>
										<span className="select-display-name">{name}</span>
										<span className="select-display-desc">{line ? line.name : 'maszyna samodzielna'}</span>
									</>
								) : (
									<span className="select-display-placeholder">— wybierz —</span>
								)}
							</span>
						</div>
						{((submitted && !machineId) || ongoing) && (
							<Form.Control.Feedback type="invalid" className="d-block">
								{machineError}
							</Form.Control.Feedback>
						)}
					</Form.Group>
					<Form.Group controlId="breakdownFrom">
						<Form.Label>Stoi od</Form.Label>
						<div className="since-chips" role="group" aria-label="Stoi od">
							{SINCE_HOURS.map((h) => {
								const value = addHours(hourNow, -h);
								return (
									<button key={h} type="button" className={`since-chip ${start === value ? 'active' : ''}`} onClick={() => setFrom(toLocalInputValue(value))}>
										{h === 0 ? 'teraz' : `−${h} h`}
									</button>
								);
							})}
						</div>
						<Form.Control
							type="datetime-local"
							step={3600}
							className="mono"
							max={toLocalInputValue(Date.now())}
							value={from}
							onChange={(e) => setFrom(e.target.value)}
							isInvalid={submitted && !!fromError}
						/>
						<Form.Control.Feedback type="invalid">{fromError}</Form.Control.Feedback>
						<Form.Text as="div">Awarii nie planuje się naprzód - tylko godzina, która już minęła.</Form.Text>
					</Form.Group>
					<div className="consequence-box">
						<span className="consequence-title">Co się stanie</span>
						<span className="consequence-text">{consequence()}</span>
						{machineId && (
							<span className="consequence-orders">
								{affected.length === 0
									? 'Wydłuży: nic - brak zleceń w kolejce'
									: `Wydłuży: ${extended.map((b) => `${b.operation} · ${b.projectNo}${blockStatus(b, now) === 'in_progress' ? ' (w toku)' : ''}`).join(', ')}${
										shifted > 0 ? ` · przesunie ${shifted} kolejnych` : ''
									}`}
							</span>
						)}
					</div>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={onHide}>
						Anuluj
					</Button>
					<Button type="submit" variant="danger">
						Zgłoś awarię
					</Button>
				</Modal.Footer>
			</Form>
		</Modal>
	);
};

export default BreakdownModal;
