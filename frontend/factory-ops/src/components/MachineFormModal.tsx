import { FormEvent, useEffect, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { lineOfMachine, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { Id, Machine, WorkMode } from '../domain/types';

interface MachineFormModalProps {
	show: boolean;
	/** Edytowana maszyna; brak = dodawanie nowej. */
	machine?: Machine;
	onHide: () => void;
}

/** Czy nazwa jest już zajęta przez inną maszynę lub linię. */
export function nameTaken(names: { id: Id; name: string }[], name: string, ownId?: Id): boolean {
	const normalized = name.trim().toLowerCase();
	return names.some((n) => n.id !== ownId && n.name.trim().toLowerCase() === normalized);
}

const MachineFormModal = ({ show, machine, onHide }: MachineFormModalProps) => {
	const { state, saveMachine } = usePlan();
	const isEdit = machine !== undefined;
	const [name, setName] = useState('');
	const [mode, setMode] = useState<WorkMode>('weekdays');
	const [lineId, setLineId] = useState<Id>('');
	const [submitted, setSubmitted] = useState(false);

	useEffect(() => {
		if (!show) return;
		setName(machine?.name ?? '');
		setMode(machine ? workMode(machine) : 'weekdays');
		setLineId(machine ? (lineOfMachine(state.lines, machine.id)?.id ?? '') : '');
		setSubmitted(false);
		// formularz ustawiamy tylko przy otwarciu
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [show]);

	const trimmedName = name.trim();
	const taken = nameTaken([...state.machines, ...state.lines], trimmedName, machine?.id);
	const valid = trimmedName !== '' && !taken;
	const currentLine = machine ? lineOfMachine(state.lines, machine.id) : undefined;
	const leavesLineTooSmall = currentLine !== undefined && currentLine.id !== lineId && currentLine.machineIds.length <= 2;

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		setSubmitted(true);
		if (!valid) return;
		saveMachine({ name: trimmedName, workMode: mode, lineId: lineId || undefined }, machine?.id);
		onHide();
	};

	return (
		<Modal show={show} onHide={onHide} centered>
			<Form noValidate onSubmit={onSubmit}>
				<Modal.Header closeButton>
					<Modal.Title>{isEdit ? `Edytuj: ${machine.name}` : 'Nowa maszyna'}</Modal.Title>
				</Modal.Header>
				<Modal.Body className="d-flex flex-column gap-3">
					<Form.Group controlId="machineName">
						<Form.Label>Nazwa maszyny</Form.Label>
						<Form.Control autoFocus value={name} onChange={(e) => setName(e.target.value)} isInvalid={submitted && !valid} placeholder="np. DMU 65" />
						<Form.Control.Feedback type="invalid">{taken ? 'Maszyna lub linia o tej nazwie już istnieje' : 'Podaj nazwę'}</Form.Control.Feedback>
					</Form.Group>

					<Form.Group controlId="workMode">
						<Form.Label>System pracy</Form.Label>
						<Form.Select value={mode} onChange={(e) => setMode(e.target.value as WorkMode)}>
							{Object.entries(WORK_MODE_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</Form.Select>
					</Form.Group>

					<Form.Group controlId="machineLine">
						<Form.Label>Linia produkcyjna</Form.Label>
						<Form.Select value={lineId} onChange={(e) => setLineId(e.target.value)}>
							<option value="">— maszyna samodzielna —</option>
							{state.lines.map((line) => (
								<option key={line.id} value={line.id}>
									{line.name}
								</option>
							))}
						</Form.Select>
						<Form.Text muted>Maszyny linii pracują równolegle na zlecenia linii. Można też dać zlecenie bezpośrednio na tę maszynę.</Form.Text>
						{leavesLineTooSmall && <div className="small text-warning-emphasis mt-1">W linii {currentLine.name} zostanie tylko jedna maszyna.</div>}
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={onHide}>
						Anuluj
					</Button>
					<Button type="submit" variant="primary">
						{isEdit ? 'Zapisz' : 'Dodaj'}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal>
	);
};

export default MachineFormModal;
