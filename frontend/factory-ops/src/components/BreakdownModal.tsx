import { FormEvent, useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { isOngoing, lineMachines, standaloneMachines } from '../domain/calendar';
import { formatDateTime, fromLocalInputValue, toLocalInputValue } from '../domain/format';
import { hourStartAtOrBefore, nearestHourStart } from '../domain/shifts';
import { Id } from '../domain/types';

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

/**
 * Zgłoszenie awarii: maszyna stoi od teraz (albo od podanej godziny w przeszłości) do odwołania.
 * Awarii nie planuje się naprzód - nie wiadomo, ile potrwa naprawa.
 */
const BreakdownModal = ({ show, target, onHide }: BreakdownModalProps) => {
	const { state, reportBreakdown } = usePlan();
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

	const start = from ? nearestHourStart(fromLocalInputValue(from)) : NaN;
	const fromError = !from ? 'Podaj godzinę' : start > Date.now() ? 'Awarii nie planuje się naprzód - podaj godzinę, która już minęła' : undefined;
	const machineError = !machineId ? 'Wybierz maszynę' : ongoing ? `Ta maszyna ma już trwającą awarię (od ${formatDateTime(ongoing.start)})` : undefined;

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
					<Modal.Title>Zgłoś awarię</Modal.Title>
				</Modal.Header>
				<Modal.Body className="d-flex flex-column gap-3">
					<Form.Group controlId="breakdownMachine">
						<Form.Label>Maszyna</Form.Label>
						<Form.Select autoFocus value={machineId} onChange={(e) => setMachineId(e.target.value)} isInvalid={(submitted && !machineId) || !!ongoing}>
							<option value="">— wybierz —</option>
							{lineGroups.map(({ line, machines }) => (
								<optgroup key={line.id} label={line.name}>
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
						<Form.Control.Feedback type="invalid">{machineError}</Form.Control.Feedback>
					</Form.Group>
					<Form.Group controlId="breakdownFrom">
						<Form.Label>Stoi od</Form.Label>
						<Form.Control
							type="datetime-local"
							step={3600}
							max={toLocalInputValue(Date.now())}
							value={from}
							onChange={(e) => setFrom(e.target.value)}
							isInvalid={submitted && !!fromError}
						/>
						<Form.Control.Feedback type="invalid">{fromError}</Form.Control.Feedback>
						<Form.Text muted>Domyślnie bieżąca godzina. Jeśli maszyna stanęła wcześniej, cofnij godzinę.</Form.Text>
					</Form.Group>
					<div className="alert alert-light border small mb-0">
						Awaria trwa, dopóki jej nie zakończysz (prawy klik na awarii albo zakładka Obciążenie). Do tego czasu rośnie co godzinę i przesuwa zlecenia
						na tej maszynie. Jeśli maszyna jest w linii, linia nie staje - pracuje wolniej na pozostałych maszynach.
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
