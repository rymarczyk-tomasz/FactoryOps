import { useMemo, useState } from 'react';
import { Button, Dropdown } from 'react-bootstrap';
import ConfirmModal from '../components/ConfirmModal';
import LineFormModal from '../components/LineFormModal';
import MachineFormModal from '../components/MachineFormModal';
import PageHeader from '../components/PageHeader';
import { loadByDay, ordersLabel, totalPercent } from '../components/planSelectors';
import { usePlan } from '../data/PlanContext';
import { isOngoing, lineMachines, lineOfMachine, standaloneMachines, workMode, WORK_MODE_LABELS } from '../domain/calendar';
import { shiftDayStart } from '../domain/shifts';
import { Id, Line, Machine } from '../domain/types';
import './MachinesPage.css';

/** Obciążenie na kartach i w tabeli: tyle dób od bieżącej. */
const LOAD_DAYS = 7;
const HOUR = 3600_000;

// treść zostaje po zamknięciu, żeby okienko nie zmieniało się w trakcie animacji zamykania
type MachineForm = { show: boolean; machine?: Machine };
type LineForm = { show: boolean; line?: Line };

/** Mini-pasek obciążenia z procentem - neutralny; kolor ostrzegawczy jest tylko na mapie cieplnej Obciążenia. */
const LoadBar = ({ percent, wide }: { percent: number | undefined; wide?: boolean }) => (
	<span className={`machine-load ${wide ? 'is-wide' : ''}`} title={percent === undefined ? 'Brak czasu pracy w najbliższych dobach' : `Obciążenie ${LOAD_DAYS} dni od dziś 6:00`}>
		<span className="machine-load-bar">
			<span style={{ width: `${percent ?? 0}%` }} />
		</span>
		<span className="mono machine-load-value">{percent === undefined ? '—' : `${percent}%`}</span>
	</span>
);

interface MoreMenuProps {
	label: string;
	canCompact: boolean;
	onEdit: () => void;
	onCompact: () => void;
	onDelete: () => void;
}

/** Menu „⋯”: edycja, domknięcie przerw i - jako ostatnie, na czerwono - usunięcie. */
const MoreMenu = ({ label, canCompact, onEdit, onCompact, onDelete }: MoreMenuProps) => (
	<Dropdown align="end">
		<Dropdown.Toggle as="button" bsPrefix="more-toggle" aria-label={`Akcje: ${label}`} title="Akcje">
			⋯
		</Dropdown.Toggle>
		<Dropdown.Menu>
			<Dropdown.Item as="button" type="button" onClick={onEdit}>
				Edytuj
			</Dropdown.Item>
			<Dropdown.Item as="button" type="button" disabled={!canCompact} title="Usuń przerwy między zleceniami" onClick={onCompact}>
				Domknij przerwy
			</Dropdown.Item>
			<Dropdown.Divider />
			<Dropdown.Item as="button" type="button" className="text-danger" onClick={onDelete}>
				Usuń…
			</Dropdown.Item>
		</Dropdown.Menu>
	</Dropdown>
);

const MachinesPage = () => {
	const { state, now, deleteMachine, deleteLine, compactMachine } = usePlan();
	const [machineForm, setMachineForm] = useState<MachineForm>({ show: false });
	const [lineForm, setLineForm] = useState<LineForm>({ show: false });
	const [machineToDelete, setMachineToDelete] = useState<Machine>();
	const [lineToDelete, setLineToDelete] = useState<Line>();
	const [query, setQuery] = useState('');

	const counts = useMemo(() => {
		const result = new Map<Id, number>();
		for (const b of state.blocks) result.set(b.machineId, (result.get(b.machineId) ?? 0) + 1);
		return result;
	}, [state.blocks]);
	const blockCount = (id: Id) => counts.get(id) ?? 0;
	const loads = useMemo(() => {
		const days = loadByDay(state, now, shiftDayStart(now), LOAD_DAYS);
		return new Map([...days].map(([id, d]) => [id, totalPercent(d)]));
	}, [state, now]);
	const downSince = useMemo(() => new Map(state.breakdowns.filter(isOngoing).map((b) => [b.machineId, b.start])), [state.breakdowns]);

	const q = query.trim().toLowerCase();
	const matches = (name: string) => !q || name.toLowerCase().includes(q);
	const lines = state.lines.filter((l) => matches(l.name) || lineMachines(l, state.machines).some((m) => matches(m.name)));
	const standalone = standaloneMachines(state).filter((m) => matches(m.name));
	const inLines = state.machines.filter((m) => lineOfMachine(state.lines, m.id)).length;

	return (
		<>
			<PageHeader title="Maszyny" context={`${state.machines.length} maszyn · ${state.lines.length} linii · ${inLines} w liniach`}>
				<div className="search-field machines-search">
					<input type="search" placeholder="Szukaj maszyny…" aria-label="Szukaj maszyny lub linii" value={query} onChange={(e) => setQuery(e.target.value)} />
				</div>
				<Button variant="outline-secondary" onClick={() => setLineForm({ show: true })}>
					Nowa linia
				</Button>
				<Button onClick={() => setMachineForm({ show: true })}>Nowa maszyna</Button>
			</PageHeader>

			<div className="page-body machines-page">
				<section className="machines-section">
					<div className="machines-section-head">
						<h2 className="machines-section-title">Linie produkcyjne</h2>
						<span className="machines-section-note">Maszyny pracujące równolegle — zlecenie na linię dzieli się między nie.</span>
					</div>
					<div className="line-cards">
						{lines.map((line) => {
							const members = lineMachines(line, state.machines);
							const down = members.filter((m) => downSince.has(m.id));
							const continuous = members.length > 0 && members.every((m) => workMode(m) === 'continuous');
							const own = blockCount(line.id);
							const onMachines = members.reduce((sum, m) => sum + blockCount(m.id), 0);
							// linia z samymi zleceniami maszyn: „N zleceń na maszynach”
							const ordersText =
								own === 0 && onMachines > 0 ? `${ordersLabel(onMachines)} na maszynach` : `${ordersLabel(own)}${onMachines ? ` + ${onMachines} na maszynach` : ''}`;
							return (
								<div key={line.id} className={`line-card ${down.length ? 'is-down' : ''}`}>
									<div className="line-card-head">
										<span className="line-card-name">{line.name}</span>
										<span className="mono line-card-meta">
											{members.length}×{continuous ? ' · 24/7' : ''}
										</span>
										{down.length > 0 && <span className="pill pill-danger">{down.length} stoi</span>}
										<span className="ms-auto">
											<MoreMenu
												label={line.name}
												canCompact={own > 0}
												onEdit={() => setLineForm({ show: true, line })}
												onCompact={() => compactMachine(line.id)}
												onDelete={() => setLineToDelete(line)}
											/>
										</span>
									</div>
									<div className="line-card-members">
										{members.map((m) => (
											<button
												key={m.id}
												type="button"
												className={`machine-chip mono ${downSince.has(m.id) ? 'is-down' : ''}`}
												title={`Edytuj ${m.name}${downSince.has(m.id) ? ' · awaria' : ''}`}
												onClick={() => setMachineForm({ show: true, machine: m })}>
												{m.name}
											</button>
										))}
										{members.length === 0 && <span className="text-secondary small">Brak maszyn</span>}
									</div>
									<div className="line-card-foot">
										<LoadBar percent={loads.get(line.id)} wide />
										<span className="line-card-orders">{ordersText}</span>
									</div>
								</div>
							);
						})}
						{lines.length === 0 && <p className="machines-empty">{q ? 'Brak linii pasujących do wyszukiwania.' : 'Brak linii.'}</p>}
					</div>
				</section>

				<section className="machines-section">
					<div className="machines-section-head">
						<h2 className="machines-section-title">Maszyny samodzielne</h2>
						<span className="mono machines-section-count">{standalone.length}</span>
						<span className="machines-section-note">Maszyny w liniach są na kartach powyżej - kliknij nazwę, żeby edytować.</span>
					</div>
					<div className="machines-table">
						<div className="machines-grid machines-head">
							<span>Maszyna</span>
							<span>System pracy</span>
							<span>Obciążenie {LOAD_DAYS} dni</span>
							<span className="text-end">Zlecenia</span>
							<span className="machines-state-col">Stan</span>
							<span />
						</div>
						{standalone.map((machine) => {
							const since = downSince.get(machine.id);
							return (
								<div key={machine.id} className="machines-grid machines-row">
									<span className="mono machines-name">{machine.name}</span>
									<span className="machines-mode">{WORK_MODE_LABELS[workMode(machine)].replace('Pon–pt', 'pon–pt')}</span>
									<LoadBar percent={loads.get(machine.id)} />
									<span className="mono text-end">{blockCount(machine.id)}</span>
									<span className={`machines-state-col machines-state ${since !== undefined ? 'is-down' : ''}`}>
										<span className={`status-dot ${since !== undefined ? 'danger' : 'ok'}`} />
										{since !== undefined ? `Awaria · ${Math.max(0, Math.floor((now - since) / HOUR))} h` : 'Pracuje'}
									</span>
									<span className="text-end">
										<MoreMenu
											label={machine.name}
											canCompact={blockCount(machine.id) > 0}
											onEdit={() => setMachineForm({ show: true, machine })}
											onCompact={() => compactMachine(machine.id)}
											onDelete={() => setMachineToDelete(machine)}
										/>
									</span>
								</div>
							);
						})}
						{standalone.length === 0 && <p className="machines-empty">{q ? 'Brak maszyn pasujących do wyszukiwania.' : 'Wszystkie maszyny są w liniach.'}</p>}
					</div>
				</section>
			</div>

			<MachineFormModal show={machineForm.show} machine={machineForm.machine} onHide={() => setMachineForm((f) => ({ ...f, show: false }))} />
			<LineFormModal show={lineForm.show} line={lineForm.line} onHide={() => setLineForm((f) => ({ ...f, show: false }))} />
			<ConfirmModal
				show={machineToDelete !== undefined}
				title="Usunąć maszynę?"
				undoable
				onConfirm={() => machineToDelete && deleteMachine(machineToDelete.id)}
				onHide={() => setMachineToDelete(undefined)}>
				Maszyna <strong className="mono fw-medium">{machineToDelete?.name}</strong> zostanie usunięta razem z jej zleceniami (
				{machineToDelete ? blockCount(machineToDelete.id) : 0}) i awariami.
				{machineToDelete && lineOfMachine(state.lines, machineToDelete.id) && ` Zniknie też z ${lineOfMachine(state.lines, machineToDelete.id)!.name}.`}
			</ConfirmModal>
			<ConfirmModal
				show={lineToDelete !== undefined}
				title="Usunąć linię?"
				undoable
				onConfirm={() => lineToDelete && deleteLine(lineToDelete.id)}
				onHide={() => setLineToDelete(undefined)}>
				Linia <strong>{lineToDelete?.name}</strong> zostanie usunięta razem ze zleceniami linii ({lineToDelete ? blockCount(lineToDelete.id) : 0}). Jej maszyny zostaną
				jako samodzielne, z własnymi zleceniami.
			</ConfirmModal>
		</>
	);
};

export default MachinesPage;
