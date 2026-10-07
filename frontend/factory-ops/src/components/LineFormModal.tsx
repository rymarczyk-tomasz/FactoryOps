import { FormEvent, useEffect, useRef, useState } from 'react';
import { Badge, Button, CloseButton, Form, InputGroup, Modal } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { lineOfMachine, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { MIN_LINE_MACHINES } from '../domain/machines';
import { Id, Line, WorkMode } from '../domain/types';
import { nameTaken } from './MachineFormModal';

/** Maszyna na liście linii: istniejąca (`machineId`) albo nowa, tworzona przy zapisie linii. */
type Row = { key: number; machineId?: Id; name: string };

interface LineFormModalProps {
	show: boolean;
	/** Edytowana linia; brak = dodawanie nowej. */
	line?: Line;
	onHide: () => void;
}

/** Bez zmiany systemu pracy maszyn (przy edycji) - każda maszyna linii może mieć własny. */
const KEEP = '';

const LineFormModal = ({ show, line, onHide }: LineFormModalProps) => {
	const { state, saveLine } = usePlan();
	const isEdit = line !== undefined;
	const nextKey = useRef(0);
	const [name, setName] = useState('');
	const [rows, setRows] = useState<Row[]>([]);
	const [mode, setMode] = useState<WorkMode | typeof KEEP>(KEEP);
	const [newName, setNewName] = useState('');
	const [submitted, setSubmitted] = useState(false);

	const machineName = (id: Id) => state.machines.find((m) => m.id === id)?.name ?? '';

	useEffect(() => {
		if (!show) return;
		setName(line?.name ?? '');
		setRows((line?.machineIds ?? []).map((machineId) => ({ key: nextKey.current++, machineId, name: machineName(machineId) })));
		setMode(isEdit ? KEEP : 'continuous');
		setNewName('');
		setSubmitted(false);
		// formularz ustawiamy tylko przy otwarciu
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [show]);

	const trimmedName = name.trim();
	const taken = nameTaken([...state.machines, ...state.lines], trimmedName, line?.id);
	const chosen = new Set(rows.map((r) => r.machineId).filter(Boolean));
	const available = state.machines.filter((m) => !chosen.has(m.id));
	const allNames = [...state.machines, ...state.lines];
	const newRows = rows.filter((r) => r.machineId === undefined);
	const trimmedNew = newName.trim();
	const newNameError =
		trimmedNew && (nameTaken(allNames, trimmedNew) || newRows.some((r) => r.name.toLowerCase() === trimmedNew.toLowerCase()))
			? 'Maszyna o tej nazwie już istnieje'
			: undefined;
	const valid = trimmedName !== '' && !taken && rows.length >= MIN_LINE_MACHINES;

	const addExisting = (machineId: Id) => machineId && setRows([...rows, { key: nextKey.current++, machineId, name: machineName(machineId) }]);
	const addNew = () => {
		if (!trimmedNew || newNameError) return;
		setRows([...rows, { key: nextKey.current++, name: trimmedNew }]);
		setNewName('');
	};

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		setSubmitted(true);
		if (!valid) return;
		saveLine(
			{
				name: trimmedName,
				machineIds: rows.flatMap((r) => (r.machineId ? [r.machineId] : [])),
				newMachines: newRows.map((r) => ({ name: r.name, workMode: mode || 'continuous' })),
				workMode: mode || undefined
			},
			line?.id
		);
		onHide();
	};

	return (
		<Modal show={show} onHide={onHide} centered>
			<Form noValidate onSubmit={onSubmit}>
				<Modal.Header closeButton>
					<Modal.Title>{isEdit ? `Edytuj: ${line.name}` : 'Nowa linia produkcyjna'}</Modal.Title>
				</Modal.Header>
				<Modal.Body className="d-flex flex-column gap-3">
					<Form.Group controlId="lineName">
						<Form.Label>Nazwa linii</Form.Label>
						<Form.Control
							autoFocus
							value={name}
							onChange={(e) => setName(e.target.value)}
							isInvalid={submitted && (trimmedName === '' || taken)}
							placeholder="np. Linia 10"
						/>
						<Form.Control.Feedback type="invalid">{taken ? 'Maszyna lub linia o tej nazwie już istnieje' : 'Podaj nazwę'}</Form.Control.Feedback>
					</Form.Group>

					<div>
						<Form.Label className="mb-1">Maszyny w linii</Form.Label>
						<Form.Text as="div" muted className="mb-2">
							Pracują równolegle - zlecenie linii dzieli się między nie. Awaria jednej maszyny nie zatrzymuje linii, tylko ją spowalnia.
						</Form.Text>
						<div className="d-flex flex-column gap-1">
							{rows.map((r, index) => {
								const otherLine = r.machineId ? lineOfMachine(state.lines, r.machineId) : undefined;
								const machine = state.machines.find((m) => m.id === r.machineId);
								return (
									<div key={r.key} className="d-flex align-items-center gap-2 line-member-row">
										<span className="text-secondary small" style={{ width: '1.5rem' }}>
											{index + 1}.
										</span>
										<span className="flex-grow-1">
											{r.name}
											{!r.machineId && (
												<Badge bg="success" className="ms-2">
													nowa
												</Badge>
											)}
											{otherLine && otherLine.id !== line?.id && <span className="small text-warning-emphasis ms-2">przejdzie z {otherLine.name}</span>}
										</span>
										{machine && <span className="small text-secondary">{WORK_MODE_LABELS[workMode(machine)]}</span>}
										<CloseButton
											aria-label={`Usuń ${r.name} z linii`}
											title="Usuń z linii (maszyna zostanie jako samodzielna)"
											onClick={() => setRows(rows.filter((x) => x.key !== r.key))}
										/>
									</div>
								);
							})}
							{rows.length === 0 && <div className="small text-secondary">Brak maszyn.</div>}
						</div>
						{submitted && rows.length < MIN_LINE_MACHINES && <div className="small text-danger mt-1">Linia musi mieć co najmniej {MIN_LINE_MACHINES} maszyny.</div>}

						<div className="d-flex flex-column gap-2 mt-3">
							<Form.Select size="sm" aria-label="Dodaj istniejącą maszynę" value="" onChange={(e) => addExisting(e.target.value)}>
								<option value="">+ Dodaj istniejącą maszynę…</option>
								{available.map((m) => {
									const otherLine = lineOfMachine(state.lines, m.id);
									return (
										<option key={m.id} value={m.id}>
											{m.name}
											{otherLine && otherLine.id !== line?.id ? ` (teraz w ${otherLine.name})` : ''}
										</option>
									);
								})}
							</Form.Select>
							<InputGroup size="sm" hasValidation>
								<Form.Control
									placeholder="Nazwa nowej maszyny, np. L10-M1"
									aria-label="Nazwa nowej maszyny"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') {
											e.preventDefault();
											addNew();
										}
									}}
									isInvalid={!!newNameError}
								/>
								<Button variant="outline-secondary" disabled={!trimmedNew || !!newNameError} onClick={addNew}>
									+ Nowa maszyna
								</Button>
								<Form.Control.Feedback type="invalid">{newNameError}</Form.Control.Feedback>
							</InputGroup>
						</div>
					</div>

					<Form.Group controlId="lineWorkMode">
						<Form.Label>System pracy maszyn linii</Form.Label>
						<Form.Select value={mode} onChange={(e) => setMode(e.target.value as WorkMode | typeof KEEP)}>
							{isEdit && <option value={KEEP}>Bez zmian (każda maszyna wg swojego ustawienia)</option>}
							{Object.entries(WORK_MODE_LABELS).map(([value, label]) => (
								<option key={value} value={value}>
									{isEdit ? `Wszystkie: ${label}` : label}
								</option>
							))}
						</Form.Select>
						<Form.Text muted>System pracy pojedynczej maszyny można potem zmienić w jej edycji.</Form.Text>
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

export default LineFormModal;
