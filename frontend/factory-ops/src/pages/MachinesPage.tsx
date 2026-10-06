import { useState } from 'react';
import { Badge, Button, Table } from 'react-bootstrap';
import ConfirmModal from '../components/ConfirmModal';
import MachineFormModal from '../components/MachineFormModal';
import { usePlan } from '../data/PlanContext';
import { isLine, unitCount, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { Machine } from '../domain/types';

// treść zostaje po zamknięciu, żeby okienko nie zmieniało się w trakcie animacji zamykania
type FormState = { show: boolean; machine?: Machine };

const MachinesPage = () => {
	const { state, deleteMachine, compactMachine } = usePlan();
	const [form, setForm] = useState<FormState>({ show: false });
	const [toDelete, setToDelete] = useState<Machine>();

	const blockCount = (machineId: string) => state.blocks.filter((b) => b.machineId === machineId).length;

	return (
		<>
			<div className="d-flex align-items-center justify-content-between mb-3">
				<span className="text-secondary">
					{state.machines.filter(isLine).length} linii, {state.machines.filter((m) => !isLine(m)).length} maszyn
				</span>
				<Button onClick={() => setForm({ show: true })}>+ Dodaj maszynę / linię</Button>
			</div>
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
							<td className="fw-medium">{machine.name}</td>
							<td>
								{isLine(machine) ? (
									<>
										<Badge bg="primary" pill className="me-2">
											{unitCount(machine)}×
										</Badge>
										<span className="text-secondary small">{machine.lineMachines!.join(', ')}</span>
									</>
								) : (
									'Maszyna'
								)}
							</td>
							<td>{WORK_MODE_LABELS[workMode(machine)]}</td>
							<td>{blockCount(machine.id)}</td>
							<td className="text-end text-nowrap">
								<Button size="sm" variant="outline-primary" className="me-2" onClick={() => setForm({ show: true, machine })}>
									Edytuj
								</Button>
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
			<MachineFormModal show={form.show} machine={form.machine} onHide={() => setForm((f) => ({ ...f, show: false }))} />
			<ConfirmModal show={toDelete !== undefined} title="Usunąć maszynę?" onConfirm={() => toDelete && deleteMachine(toDelete.id)} onHide={() => setToDelete(undefined)}>
				Maszyna <strong>{toDelete?.name}</strong> zostanie usunięta razem z jej zleceniami ({toDelete ? blockCount(toDelete.id) : 0}).
			</ConfirmModal>
		</>
	);
};

export default MachinesPage;
