import { FormEvent, useEffect, useRef, useState } from 'react';
import { Button, Form, Modal } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { lineOfMachine, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { MIN_LINE_MACHINES } from '../domain/machines';
import { Id, Line, WorkMode } from '../domain/types';
import { nameTaken } from './MachineFormModal';
import './modals.css';

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
		<Modal show={show} onHide={onHide} centered dialogClassName="line-dialog">
			<Form noValidate onSubmit={onSubmit}>
				<Modal.Header closeButton closeLabel="Zamknij">
					<Modal.Title>
						{isEdit ? (
							<>
								Edytuj:<span className="modal-title-name">{line.name}</span>
							</>
						) : (
							'Nowa linia produkcyjna'
						)}
					</Modal.Title>
				</Modal.Header>
				<Modal.Body className="modal-stack">
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
						<Form.Label as="div">Maszyny w linii · pracują równolegle</Form.Label>
						<div className="member-list">
							{rows.map((r, index) => {
								const otherLine = r.machineId ? lineOfMachine(state.lines, r.machineId) : undefined;
								const machine = state.machines.find((m) => m.id === r.machineId);
								const wasMember = r.machineId !== undefined && line?.machineIds.includes(r.machineId);
								const moves = otherLine && otherLine.id !== line?.id;
								const joins = machine && !otherLine && !wasMember;
								const note = moves ? `przejdzie z ${otherLine.name}` : joins ? 'samodzielna → przejdzie do linii' : '';
								return (
									<div key={r.key} className="member-row">
										<span className="member-no">{index + 1}.</span>
										<span className="member-name">{r.name}</span>
										{!r.machineId && <span className="member-new">nowa</span>}
										{note && <span className="member-note">{note}</span>}
										<span className="member-mode">{machine ? WORK_MODE_LABELS[workMode(machine)] : ''}</span>
										<button
											type="button"
											className="member-remove"
											aria-label={`Usuń ${r.name} z linii`}
											title="Usuń z linii (maszyna zostanie jako samodzielna)"
											onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
											×
										</button>
									</div>
								);
							})}
							{rows.length === 0 && <div className="member-empty">Brak maszyn - dodaj co najmniej {MIN_LINE_MACHINES}.</div>}
							<div className="member-add">
								<Form.Select size="sm" aria-label="Dodaj istniejącą maszynę" value="" onChange={(e) => addExisting(e.target.value)}>
									<option value="">Dodaj istniejącą…</option>
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
								<div>
									<Form.Control
										size="sm"
										className="mono"
										placeholder="Nowa, np. L10-M4"
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
									<Form.Control.Feedback type="invalid">{newNameError}</Form.Control.Feedback>
								</div>
								<Button size="sm" variant="outline-secondary" disabled={!trimmedNew || !!newNameError} onClick={addNew}>
									Dodaj
								</Button>
							</div>
						</div>
						{submitted && rows.length < MIN_LINE_MACHINES ? (
							<div className="invalid-feedback d-block">Linia musi mieć co najmniej {MIN_LINE_MACHINES} maszyny.</div>
						) : (
							<Form.Text as="div">Zlecenie linii dzieli się między maszyny. Awaria jednej maszyny spowalnia linię, ale jej nie zatrzymuje.</Form.Text>
						)}
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
						<Form.Text as="div">System pracy pojedynczej maszyny można potem zmienić w jej edycji.</Form.Text>
					</Form.Group>
				</Modal.Body>
				<Modal.Footer>
					<Button variant="light" onClick={onHide}>
						Anuluj
					</Button>
					<Button type="submit" variant="primary">
						{isEdit ? 'Zapisz' : 'Dodaj linię'}
					</Button>
				</Modal.Footer>
			</Form>
		</Modal>
	);
};

export default LineFormModal;
