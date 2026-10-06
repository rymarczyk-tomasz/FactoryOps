import React, { FormEvent, useState } from 'react';
import { Button, Form, InputGroup, Table } from 'react-bootstrap';
import ConfirmModal from '../components/ConfirmModal';
import { usePlan } from '../data/PlanContext';
import { Machine } from '../domain/types';

const MachinesPage = () => {
	const { state, addMachine, renameMachine, deleteMachine, compactMachine } = usePlan();
	const [newName, setNewName] = useState('');
	const [toDelete, setToDelete] = useState<Machine>();

	const blockCount = (machineId: string) => state.blocks.filter((b) => b.machineId === machineId).length;

	const onAdd = (e: FormEvent) => {
		e.preventDefault();
		if (!newName.trim()) return;
		addMachine(newName.trim());
		setNewName('');
	};

	return (
		<>
			<Form onSubmit={onAdd} className="mb-3" style={{ maxWidth: 480 }}>
				<InputGroup>
					<Form.Control placeholder="Nazwa nowej maszyny" value={newName} onChange={(e) => setNewName(e.target.value)} />
					<Button type="submit" disabled={!newName.trim()}>
						Dodaj maszynę
					</Button>
				</InputGroup>
			</Form>
			<Table hover className="align-middle mb-0">
				<thead>
					<tr>
						<th>Nazwa</th>
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
