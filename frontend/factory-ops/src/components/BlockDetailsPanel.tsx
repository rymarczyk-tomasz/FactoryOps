import React from 'react';
import { Badge, Button, Form, Offcanvas } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { isLine, unitCount, unitLabel } from '../domain/calendar';
import { formatDateTime, formatHours, programmerName, STATUS_LABELS } from '../domain/format';
import { blockStatus } from '../domain/schedule';
import { Block, BlockStatus } from '../domain/types';

export const STATUS_VARIANTS: Record<BlockStatus, string> = { done: 'secondary', in_progress: 'success', planned: 'primary' };

const HOUR = 3600_000;

interface BlockDetailsPanelProps {
	block?: Block;
	onEdit: (block: Block) => void;
	onDelete: (block: Block) => void;
	onShow: (block: Block) => void;
	onClose: () => void;
}

/** Panel boczny zaznaczonego zlecenia: szczegóły, programista i akcje. */
const BlockDetailsPanel = ({ block, onEdit, onDelete, onShow, onClose }: BlockDetailsPanelProps) => {
	const { state, now, updateBlock } = usePlan();
	const machine = state.machines.find((m) => m.id === block?.machineId);
	// awarie na maszynie w czasie zlecenia - to one je wydłużają
	const breakdowns = block ? state.breakdowns.filter((b) => b.machineId === block.machineId && b.start < block.end && b.end > block.start) : [];
	const status = block && blockStatus(block, now);

	return (
		<Offcanvas show={block !== undefined} onHide={onClose} placement="end" backdrop={false} scroll className="details-panel">
			{block && machine && status && (
				<>
					<Offcanvas.Header closeButton>
						<Offcanvas.Title>
							{block.orderNo}
							<Badge bg={STATUS_VARIANTS[status]} className="ms-2 align-middle fs-6 fw-normal">
								{STATUS_LABELS[status]}
							</Badge>
						</Offcanvas.Title>
					</Offcanvas.Header>
					<Offcanvas.Body className="d-flex flex-column gap-3">
						<dl className="details-list mb-0">
							<dt>Projekt</dt>
							<dd>{block.project}</dd>
							<dt>Operacja</dt>
							<dd>{block.operation}</dd>
							<dt>{isLine(machine) ? 'Linia' : 'Maszyna'}</dt>
							<dd>
								{machine.name}
								{isLine(machine) && <span className="text-secondary"> · {unitCount(machine)} maszyny</span>}
							</dd>
							<dt>Czas pracy</dt>
							<dd>
								{formatHours(block.hours)}
								{isLine(machine) && <span className="text-secondary"> jednej maszyny · na planie {Math.round((block.end - block.start) / HOUR)} h</span>}
							</dd>
							<dt>Start</dt>
							<dd>{formatDateTime(block.start)}</dd>
							<dt>Koniec</dt>
							<dd>{formatDateTime(block.end)}</dd>
							{block.pinnedStart !== undefined && (
								<>
									<dt>Termin</dt>
									<dd>nie wcześniej niż {formatDateTime(block.pinnedStart)}</dd>
								</>
							)}
							{block.note && (
								<>
									<dt>Uwagi</dt>
									<dd className="text-pre-wrap">{block.note}</dd>
								</>
							)}
						</dl>

						{breakdowns.length > 0 && (
							<div className="alert alert-danger py-2 mb-0 small">
								<div className="fw-semibold">Awarie w trakcie zlecenia</div>
								{breakdowns.map((b) => (
									<div key={b.id}>
										{isLine(machine) && `${b.units.map((u) => unitLabel(machine, u)).join(', ')} · `}
										{formatDateTime(b.start)} → {formatDateTime(b.end)}
									</div>
								))}
							</div>
						)}

						<Form.Group controlId="panelProgrammer">
							<Form.Label className="small text-secondary mb-1">Programista</Form.Label>
							<Form.Select size="sm" value={block.programmerId ?? ''} onChange={(e) => updateBlock(block.id, { programmerId: e.target.value || undefined })}>
								<option value="">— nie przypisano —</option>
								{state.programmers.map((p) => (
									<option key={p.id} value={p.id}>
										{programmerName(p)}
									</option>
								))}
							</Form.Select>
						</Form.Group>

						<div className="d-flex flex-wrap gap-2 mt-auto">
							<Button size="sm" onClick={() => onEdit(block)}>
								Edytuj
							</Button>
							<Button size="sm" variant="outline-secondary" onClick={() => onShow(block)}>
								Pokaż na planie
							</Button>
							<Button size="sm" variant="outline-danger" className="ms-auto" onClick={() => onDelete(block)}>
								Usuń
							</Button>
						</div>
					</Offcanvas.Body>
				</>
			)}
		</Offcanvas>
	);
};

export default BlockDetailsPanel;
