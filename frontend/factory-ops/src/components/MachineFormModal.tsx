import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { Button, ButtonGroup, CloseButton, Form, Modal, ToggleButton } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { isLine, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { MIN_LINE_MACHINES } from '../domain/machines';
import { Machine, WorkMode } from '../domain/types';

type Kind = 'machine' | 'line';

/** Wiersz listy maszyn linii; `key` tylko dla Reacta, `previousIndex` łączy z dotychczasową maszyną (awarie). */
interface LineMachineRow {
	key: number;
	name: string;
	previousIndex?: number;
}

/** Nowa linia zwykle chodzi 24/7, pojedyncza maszyna pon-pt. */
const DEFAULT_WORK_MODE: Record<Kind, WorkMode> = { machine: 'weekdays', line: 'continuous' };
const DEFAULT_LINE_SIZE = 3;

interface MachineFormModalProps {
	show: boolean;
	/** Edytowana maszyna; brak = dodawanie nowej. */
	machine?: Machine;
	onHide: () => void;
}

const MachineFormModal = ({ show, machine, onHide }: MachineFormModalProps) => {
	const { state, saveMachine } = usePlan();
	const isEdit = machine !== undefined;
	const nextKey = useRef(0);
	const [kind, setKind] = useState<Kind>('machine');
	const [name, setName] = useState('');
	const [mode, setMode] = useState<WorkMode>('weekdays');
	const [modeTouched, setModeTouched] = useState(false);
	const [rows, setRows] = useState<LineMachineRow[]>([]);
	const [submitted, setSubmitted] = useState(false);

	const row = (rowName: string, previousIndex?: number): LineMachineRow => ({ key: nextKey.current++, name: rowName, previousIndex });
	const defaultRows = (count: number) => Array.from({ length: count }, (_, i) => row(`M${i + 1}`));
	/** Pierwsza wolna nazwa M1, M2, ... - po usunięciu maszyny z środka nie powstaje duplikat. */
	const freeRowName = () => {
		const taken = new Set(rows.map((r) => r.name.trim().toLowerCase()));
		let n = 1;
		while (taken.has(`m${n}`)) n++;
		return `M${n}`;
	};

	useEffect(() => {
		if (!show) return;
		const line = isLine(machine);
		setKind(line ? 'line' : 'machine');
		setName(machine?.name ?? '');
		setMode(machine ? workMode(machine) : DEFAULT_WORK_MODE.machine);
		setModeTouched(isEdit);
		setRows(line ? machine!.lineMachines!.map((n, i) => row(n, i)) : []);
		setSubmitted(false);
		// formularz ustawiamy tylko przy otwarciu
	}, [show]);

	const changeKind = (next: Kind) => {
		setKind(next);
		if (next === 'line' && rows.length < MIN_LINE_MACHINES) {
			// zwykła maszyna zamieniana w linię staje się jej pierwszą maszyną (z jej awariami)
			setRows(isEdit ? [row('M1', 0), ...defaultRows(DEFAULT_LINE_SIZE).slice(1)] : defaultRows(DEFAULT_LINE_SIZE));
		}
		if (!modeTouched) setMode(DEFAULT_WORK_MODE[next]);
	};

	const trimmedName = name.trim();
	const nameTaken = state.machines.some((m) => m.id !== machine?.id && m.name.trim().toLowerCase() === trimmedName.toLowerCase());
	const rowNames = rows.map((r) => r.name.trim());
	const rowError = (index: number) => {
		if (!rowNames[index]) return 'Podaj nazwę';
		if (rowNames.findIndex((n) => n.toLowerCase() === rowNames[index].toLowerCase()) !== index) return 'Nazwa się powtarza';
		return undefined;
	};
	const lineValid = kind === 'machine' || (rows.length >= MIN_LINE_MACHINES && rows.every((_, i) => !rowError(i)));
	const valid = trimmedName !== '' && !nameTaken && lineValid;

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		setSubmitted(true);
		if (!valid) return;
		saveMachine(
			{
				name: trimmedName,
				workMode: mode,
				lineMachines: kind === 'line' ? rows.map((r) => ({ name: r.name.trim(), previousIndex: r.previousIndex })) : undefined
			},
			machine?.id
		);
		onHide();
	};

	const removedWithBreakdowns =
		isEdit &&
		kind === 'line' &&
		state.breakdowns.some((b) => b.machineId === machine.id && b.units.some((unit) => !rows.some((r) => r.previousIndex === unit)));

	return (
		<Modal show={show} onHide={onHide} centered>
			<Form noValidate onSubmit={onSubmit}>
				<Modal.Header closeButton>
					<Modal.Title>{isEdit ? `Edytuj: ${machine.name}` : 'Nowa maszyna lub linia'}</Modal.Title>
				</Modal.Header>
				<Modal.Body className="d-flex flex-column gap-3">
					<ButtonGroup className="w-100">
						{(['machine', 'line'] as Kind[]).map((k) => (
							<ToggleButton
								key={k}
								id={`kind-${k}`}
								type="radio"
								name="kind"
								value={k}
								variant="outline-primary"
								checked={kind === k}
								onChange={() => changeKind(k)}>
								{k === 'machine' ? 'Maszyna' : 'Linia produkcyjna'}
							</ToggleButton>
						))}
					</ButtonGroup>

					<Form.Group controlId="machineName">
						<Form.Label>{kind === 'machine' ? 'Nazwa maszyny' : 'Nazwa linii'}</Form.Label>
						<Form.Control
							autoFocus
							value={name}
							onChange={(e) => setName(e.target.value)}
							isInvalid={submitted && (trimmedName === '' || nameTaken)}
							placeholder={kind === 'machine' ? 'np. DMU 65' : 'np. Linia 9'}
						/>
						<Form.Control.Feedback type="invalid">{nameTaken ? 'Maszyna o tej nazwie już istnieje' : 'Podaj nazwę'}</Form.Control.Feedback>
					</Form.Group>

					<Form.Group controlId="workMode">
						<Form.Label>System pracy</Form.Label>
						<Form.Select
							value={mode}
							onChange={(e) => {
								setMode(e.target.value as WorkMode);
								setModeTouched(true);
							}}>
							{Object.entries(WORK_MODE_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</Form.Select>
					</Form.Group>

					{kind === 'line' && (
						<div>
							<Form.Label className="mb-1">Maszyny w linii</Form.Label>
							<Form.Text as="div" muted className="mb-2">
								Pracują równolegle - zlecenie dzieli się między nie. Przy awarii wybiera się, które stoją.
							</Form.Text>
							<div className="d-flex flex-column gap-2">
								{rows.map((r, index) => (
									<div key={r.key} className="d-flex align-items-start gap-2">
										<span className="text-secondary small pt-2" style={{ width: '1.5rem' }}>
											{index + 1}.
										</span>
										<Form.Group className="flex-grow-1" controlId={`lineMachine${r.key}`}>
											<Form.Control
												size="sm"
												aria-label={`Maszyna ${index + 1}`}
												value={r.name}
												onChange={(e) => setRows(rows.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))}
												isInvalid={submitted && !!rowError(index)}
											/>
											<Form.Control.Feedback type="invalid">{rowError(index)}</Form.Control.Feedback>
										</Form.Group>
										<CloseButton
											className="mt-2"
											aria-label={`Usuń maszynę ${index + 1}`}
											title={rows.length <= MIN_LINE_MACHINES ? `Linia musi mieć co najmniej ${MIN_LINE_MACHINES} maszyny` : 'Usuń maszynę z linii'}
											disabled={rows.length <= MIN_LINE_MACHINES}
											onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
										/>
									</div>
								))}
							</div>
							<Button size="sm" variant="outline-secondary" className="mt-2" onClick={() => setRows([...rows, row(freeRowName())])}>
								+ Dodaj maszynę do linii
							</Button>
							{removedWithBreakdowns && <div className="small text-warning-emphasis mt-2">Awarie usuniętych maszyn zostaną usunięte z planu.</div>}
						</div>
					)}
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
