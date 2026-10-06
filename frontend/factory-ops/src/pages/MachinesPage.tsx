import React, { FormEvent, useState } from 'react';
import { Button, Form, InputGroup, Table } from 'react-bootstrap';
import ConfirmModal from '../components/ConfirmModal';
import { usePlan } from '../data/PlanContext';
import { unitCount, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { Machine, WorkMode } from '../domain/types';

/** 1 = pojedyncza maszyna, więcej = linia z tyloma jednakowymi maszynami. */
const UNIT_OPTIONS = [1, 2, 3, 4];
const unitsLabel = (units: number) => (units === 1 ? 'Maszyna' : `Linia, ${units} maszyny`);

const MachinesPage = () => {
	const { state, addMachine, renameMachine, deleteMachine, compactMachine, setMachineWorkMode, setMachineUnits } = usePlan();
	const [newName, setNewName] = useState('');
	const [newUnits, setNewUnits] = useState(1);
	const [toDelete, setToDelete] = useState<Machine>();

	const blockCount = (machineId: string) => state.blocks.filter((b) => b.machineId === machineId).length;

	const onAdd = (e: FormEvent) => {
		e.preventDefault();
		if (!newName.trim()) return;
		addMachine(newName.trim(), newUnits);
		setNewName('');
	};

	return (
		<>
			<Form onSubmit={onAdd} className="mb-3" style={{ maxWidth: 640 }}>
				<InputGroup>
					<Form.Control placeholder="Nazwa nowej maszyny lub linii" value={newName} onChange={(e) => setNewName(e.target.value)} />
					<Form.Select aria-label="Rodzaj" value={newUnits} onChange={(e) => setNewUnits(Number(e.target.value))} style={{ maxWidth: 200 }}>
						{UNIT_OPTIONS.map((units) => (
							<option key={units} value={units}>
								{unitsLabel(units)}
							</option>
						))}
					</Form.Select>
					<Button type="submit" disabled={!newName.trim()}>
						Dodaj
					</Button>
				</InputGroup>
			</Form>
			<Table hover className="align-middle mb-0">
				<thead>
					<tr>
						<th>Nazwa</th>
						<th>Rodzaj</th>
						<th>System pracy</th>
						<th>Zlecenia</th>
						<th />
					</tr>
				</thead>
				<tbody>
					{state.machines.map((machine) => (
						<tr key={machine.id}>
							<td>
								<Form.Control
									size="sm"
									defaultValue={machine.name}
									aria-label="Nazwa maszyny"
									onBlur={(e) => e.target.value.trim() && e.target.value !== machine.name && renameMachine(machine.id, e.target.value.trim())}
								/>
							</td>
							<td>
								<Form.Select
									size="sm"
									aria-label="Rodzaj"
									value={unitCount(machine)}
									onChange={(e) => setMachineUnits(machine.id, Number(e.target.value))}>
									{UNIT_OPTIONS.map((units) => (
										<option key={units} value={units}>
											{unitsLabel(units)}
										</option>
									))}
								</Form.Select>
							</td>
							<td>
								<Form.Select
									size="sm"
									aria-label="System pracy"
									value={workMode(machine)}
									onChange={(e) => setMachineWorkMode(machine.id, e.target.value as WorkMode)}>
									{Object.entries(WORK_MODE_LABELS).map(([mode, label]) => (
										<option key={mode} value={mode}>
											{label}
										</option>
									))}
								</Form.Select>
							</td>
							<td>{blockCount(machine.id)}</td>
							<td className="text-end text-nowrap">
								<Button size="sm" variant="outline-secondary" className="me-2" title="Usuń przerwy między zleceniami" onClick={() => compactMachine(machine.id)}>
									Domknij przerwy
								</Button>
								<Button size="sm" variant="outline-danger" onClick={() => setToDelete(machine)}>
									Usuń
								</Button>
							</td>
						</tr>
					))}
				</tbody>
			</Table>
			<ConfirmModal show={toDelete !== undefined} title="Usunąć maszynę?" onConfirm={() => toDelete && deleteMachine(toDelete.id)} onHide={() => setToDelete(undefined)}>
				Maszyna <strong>{toDelete?.name}</strong> zostanie usunięta razem z jej zleceniami ({toDelete ? blockCount(toDelete.id) : 0}).
			</ConfirmModal>
		</>
	);
};

export default MachinesPage;
