import { useState } from 'react';
import { Badge, Button, Table } from 'react-bootstrap';
import ConfirmModal from '../components/ConfirmModal';
import LineFormModal from '../components/LineFormModal';
import MachineFormModal from '../components/MachineFormModal';
import PageHeader from '../components/PageHeader';
import { usePlan } from '../data/PlanContext';
import { isOngoing, lineMachines, lineOfMachine, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { Id, Line, Machine } from '../domain/types';

// treść zostaje po zamknięciu, żeby okienko nie zmieniało się w trakcie animacji zamykania
type MachineForm = { show: boolean; machine?: Machine };
type LineForm = { show: boolean; line?: Line };

const MachinesPage = () => {
	const { state, deleteMachine, deleteLine, compactMachine } = usePlan();
	const [machineForm, setMachineForm] = useState<MachineForm>({ show: false });
	const [lineForm, setLineForm] = useState<LineForm>({ show: false });
	const [machineToDelete, setMachineToDelete] = useState<Machine>();
	const [lineToDelete, setLineToDelete] = useState<Line>();

	const blockCount = (id: Id) => state.blocks.filter((b) => b.machineId === id).length;
	const down = new Set(state.breakdowns.filter(isOngoing).map((b) => b.machineId));

	/** System pracy linii: wspólny dla jej maszyn albo „różny”. */
	const lineWorkMode = (members: Machine[]) => {
		const modes = new Set(members.map(workMode));
		return modes.size === 1 ? WORK_MODE_LABELS[[...modes][0]] : 'różny dla maszyn';
	};

	const actions = (id: Id, onEdit: () => void, onDelete: () => void) => (
		<td className="text-end text-nowrap">
			<Button size="sm" variant="outline-primary" className="me-2" onClick={onEdit}>
				Edytuj
			</Button>
			<Button
				size="sm"
				variant="outline-secondary"
				className="me-2"
				title="Usuń przerwy między zleceniami"
				disabled={blockCount(id) === 0}
				onClick={() => compactMachine(id)}>
				Domknij przerwy
			</Button>
			<Button size="sm" variant="outline-danger" onClick={onDelete}>
				Usuń
			</Button>
		</td>
	);

	return (
		<>
			<PageHeader title="Maszyny" />
			<div className="page-body d-flex flex-column gap-4">
				<div>
					<div className="d-flex align-items-center justify-content-between mb-2">
						<div>
							<h2 className="h5 mb-0">Linie produkcyjne</h2>
							<span className="small text-secondary">Linia to grupa maszyn pracujących równolegle. Zlecenie można dać na całą linię albo na jedną jej maszynę.</span>
						</div>
						<Button onClick={() => setLineForm({ show: true })}>+ Dodaj linię</Button>
					</div>
					<Table hover className="align-middle mb-0">
						<thead>
							<tr>
								<th>Nazwa</th>
								<th>Maszyny</th>
								<th>System pracy</th>
								<th>Zlecenia linii</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{state.lines.map((line) => {
								const members = lineMachines(line, state.machines);
								const onMachines = members.reduce((sum, m) => sum + blockCount(m.id), 0);
								return (
									<tr key={line.id}>
										<td className="fw-medium">{line.name}</td>
										<td>
											<span className="d-flex flex-wrap gap-1">
												{members.map((m) => (
													<Badge
														key={m.id}
														bg={down.has(m.id) ? 'danger' : 'light'}
														text={down.has(m.id) ? undefined : 'dark'}
														className="border"
														title={down.has(m.id) ? 'Trwa awaria' : undefined}>
														{m.name}
													</Badge>
												))}
											</span>
										</td>
										<td>{lineWorkMode(members)}</td>
										<td>
											{blockCount(line.id)}
											{onMachines > 0 && <span className="small text-secondary"> + {onMachines} na maszynach</span>}
										</td>
										{actions(
											line.id,
											() => setLineForm({ show: true, line }),
											() => setLineToDelete(line)
										)}
									</tr>
								);
							})}
							{state.lines.length === 0 && (
								<tr>
									<td colSpan={5} className="text-center text-secondary py-3">
										Brak linii.
									</td>
								</tr>
							)}
						</tbody>
					</Table>
				</div>

				<div>
					<div className="d-flex align-items-center justify-content-between mb-2">
						<div>
							<h2 className="h5 mb-0">Maszyny</h2>
							<span className="small text-secondary">
								{state.machines.length} maszyn, w tym {state.machines.filter((m) => lineOfMachine(state.lines, m.id)).length} w liniach
							</span>
						</div>
						<Button onClick={() => setMachineForm({ show: true })}>+ Dodaj maszynę</Button>
					</div>
					<Table hover className="align-middle mb-0">
						<thead>
							<tr>
								<th>Nazwa</th>
								<th>Linia</th>
								<th>System pracy</th>
								<th>Zlecenia</th>
								<th />
							</tr>
						</thead>
						<tbody>
							{state.machines.map((machine) => (
								<tr key={machine.id}>
									<td className="fw-medium">
										{machine.name}
										{down.has(machine.id) && (
											<Badge bg="danger" pill className="ms-2">
												awaria
											</Badge>
										)}
									</td>
									<td>{lineOfMachine(state.lines, machine.id)?.name ?? <span className="text-secondary">—</span>}</td>
									<td>{WORK_MODE_LABELS[workMode(machine)]}</td>
									<td>{blockCount(machine.id)}</td>
									{actions(
										machine.id,
										() => setMachineForm({ show: true, machine }),
										() => setMachineToDelete(machine)
									)}
								</tr>
							))}
						</tbody>
					</Table>
				</div>

				<MachineFormModal show={machineForm.show} machine={machineForm.machine} onHide={() => setMachineForm((f) => ({ ...f, show: false }))} />
				<LineFormModal show={lineForm.show} line={lineForm.line} onHide={() => setLineForm((f) => ({ ...f, show: false }))} />
				<ConfirmModal
					show={machineToDelete !== undefined}
					title="Usunąć maszynę?"
					onConfirm={() => machineToDelete && deleteMachine(machineToDelete.id)}
					onHide={() => setMachineToDelete(undefined)}>
					Maszyna <strong>{machineToDelete?.name}</strong> zostanie usunięta razem z jej zleceniami ({machineToDelete ? blockCount(machineToDelete.id) : 0}) i awariami.
					{machineToDelete && lineOfMachine(state.lines, machineToDelete.id) && ` Zniknie też z ${lineOfMachine(state.lines, machineToDelete.id)!.name}.`}
				</ConfirmModal>
				<ConfirmModal
					show={lineToDelete !== undefined}
					title="Usunąć linię?"
					onConfirm={() => lineToDelete && deleteLine(lineToDelete.id)}
					onHide={() => setLineToDelete(undefined)}>
					Linia <strong>{lineToDelete?.name}</strong> zostanie usunięta razem ze zleceniami linii ({lineToDelete ? blockCount(lineToDelete.id) : 0}). Jej maszyny
					zostaną jako samodzielne, z własnymi zleceniami.
				</ConfirmModal>
			</div>
		</>
	);
};

export default MachinesPage;
