import { Button, Form } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { breakdownEnd, findLine, isOngoing, lineOfMachine, resourceName } from '../domain/calendar';
import { formatDateTime, formatHours, programmerName, STATUS_LABELS } from '../domain/format';
import { blockStatus } from '../domain/schedule';
import { Block, BlockStatus, Id } from '../domain/types';
import { projectColorVar } from './projectColor';

/** Warianty Badge dla listy zleceń (do etapu 4 redesignu). */
export const STATUS_VARIANTS: Record<BlockStatus, string> = { done: 'secondary', in_progress: 'success', planned: 'primary' };
export const STATUS_PILLS: Record<BlockStatus, string> = { done: 'pill-neutral', in_progress: 'pill-success', planned: 'pill-info' };

const HOUR = 3600_000;
/** Kolejka w panelu: tyle zleceń przed i po zaznaczonym. */
const QUEUE_BEFORE = 1;
const QUEUE_AFTER = 2;

const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const shortDayTimeFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', hour: '2-digit', minute: '2-digit' });

/** Koniec zlecenia w kolejce: sama godzina, gdy kończy się tego samego dnia, co zaczyna. */
const endLabel = (start: number, end: number) => (new Date(start).toDateString() === new Date(end).toDateString() ? timeFormat.format(end) : shortDayTimeFormat.format(end));

interface BlockDetailsPanelProps {
	block: Block;
	onSelect: (id: Id) => void;
	onEdit: (block: Block) => void;
	onDelete: (block: Block) => void;
	onShow: (block: Block) => void;
	onClose: () => void;
}

/** Panel zaznaczonego zlecenia - kolumna obok planu: szczegóły, awarie, programista, kolejka zasobu i akcje. */
const BlockDetailsPanel = ({ block, onSelect, onEdit, onDelete, onShow, onClose }: BlockDetailsPanelProps) => {
	const { state, now, updateBlock } = usePlan();
	const line = findLine(state.lines, block.machineId);
	const machine = state.machines.find((m) => m.id === block.machineId);
	if (!machine && !line) return null;
	const parentLine = machine ? lineOfMachine(state.lines, machine.id) : undefined;
	const resource = resourceName(state, block.machineId);
	// awarie maszyn zlecenia w jego czasie - to one je wydłużają
	const machineIds = new Set(line ? line.machineIds : [block.machineId]);
	const breakdowns = state.breakdowns.filter((b) => machineIds.has(b.machineId) && b.start < block.end && breakdownEnd(b, now) > block.start);
	const status = blockStatus(block, now);
	const progress = status === 'in_progress' ? Math.round(((now - block.start) / (block.end - block.start)) * 100) : undefined;

	const queue = state.blocks.filter((b) => b.machineId === block.machineId).sort((a, b) => a.start - b.start);
	const index = queue.findIndex((b) => b.id === block.id);
	const neighbours = queue.slice(Math.max(0, index - QUEUE_BEFORE), index + QUEUE_AFTER + 1);

	return (
		<aside className="details-panel" aria-label="Szczegóły zlecenia">
			<header className="details-header">
				<div className="details-header-row">
					<span className="project-chip mono" style={projectColorVar(block.projectNo || block.project)}>
						{block.projectNo}
					</span>
					<span className={`pill ${STATUS_PILLS[status]}`}>{STATUS_LABELS[status]}</span>
					<button type="button" className="btn-close ms-auto" aria-label="Zamknij panel" onClick={onClose} />
				</div>
				<h2 className="details-title">
					{block.operation} · {block.project}
				</h2>
				<div className="details-order mono">{block.orderNo}</div>
				{progress !== undefined && (
					<div className="details-progress" title="Wykonana część zlecenia (według planu)">
						<span className="details-progress-bar">
							<span style={{ width: `${progress}%` }} />
						</span>
						<span className="mono">{progress}%</span>
					</div>
				)}
			</header>

			<div className="details-body">
				{breakdowns.length > 0 && (
					<div className="details-alert">
						<div className="fw-semibold">{breakdowns.length > 1 ? 'Awarie w trakcie zlecenia' : 'Awaria w trakcie zlecenia'}</div>
						{breakdowns.map((b) => {
							const name = resourceName(state, b.machineId);
							const since = now - b.start < 24 * HOUR ? timeFormat.format(b.start) : formatDateTime(b.start);
							return (
								<div key={b.id}>
									{isOngoing(b)
										? `${name} stoi od ${since} — zlecenie wydłuża się co godzinę.`
										: `${name} stała ${formatDateTime(b.start)} → ${formatDateTime(breakdownEnd(b, now))}.`}
								</div>
							);
						})}
					</div>
				)}

				<dl className="details-list">
					<dt>{line ? 'Linia' : 'Maszyna'}</dt>
					<dd>
						<span className="mono">{resource}</span>
						{line && <span className="text-secondary"> · {line.machineIds.length} maszyny</span>}
						{parentLine && <span className="text-secondary"> · z {parentLine.name}</span>}
					</dd>
					<dt>Czas pracy</dt>
					<dd>
						{formatHours(block.hours)}
						{line && <span className="text-secondary"> jednej maszyny · na planie {Math.round((block.end - block.start) / HOUR)} h</span>}
					</dd>
					<dt>Start</dt>
					<dd className="mono details-time">{formatDateTime(block.start)}</dd>
					<dt>Koniec</dt>
					<dd className="mono details-time">{formatDateTime(block.end)}</dd>
					{block.pinnedStart !== undefined && (
						<>
							<dt>Termin</dt>
							<dd>
								nie wcześniej niż <span className="mono details-time">{formatDateTime(block.pinnedStart)}</span>
							</dd>
						</>
					)}
					{block.note && (
						<>
							<dt>Uwagi</dt>
							<dd className="text-pre-wrap">{block.note}</dd>
						</>
					)}
				</dl>

				<Form.Group controlId="panelProgrammer">
					<Form.Label>Programista</Form.Label>
					<Form.Select
						size="sm"
						className={block.programmerId ? '' : 'is-unassigned'}
						value={block.programmerId ?? ''}
						onChange={(e) => updateBlock(block.id, { programmerId: e.target.value || undefined })}>
						<option value="">Nie przypisano</option>
						{state.programmers.map((p) => (
							<option key={p.id} value={p.id}>
								{programmerName(p)}
							</option>
						))}
					</Form.Select>
				</Form.Group>

				<section className="details-queue" aria-label={`Kolejka ${resource}`}>
					<span className="details-queue-label">
						Kolejka · <span className="mono">{resource}</span>
					</span>
					{neighbours.map((b) => (
						<button
							key={b.id}
							type="button"
							className={`queue-item ${b.id === block.id ? 'is-current' : ''} ${blockStatus(b, now) === 'done' ? 'is-done' : ''}`}
							style={projectColorVar(b.projectNo || b.project)}
							aria-current={b.id === block.id}
							onClick={() => onSelect(b.id)}>
							<span className="queue-bar" />
							<span className="queue-text">
								<span className="queue-title">
									{b.operation} · {b.projectNo} · {b.project}
								</span>
								<span className="queue-when mono">
									{formatDateTime(b.start)} → {endLabel(b.start, b.end)}
								</span>
							</span>
						</button>
					))}
				</section>
			</div>

			<footer className="details-footer">
				<Button className="flex-grow-1" onClick={() => onEdit(block)}>
					Edytuj
				</Button>
				<Button variant="outline-secondary" onClick={() => onShow(block)} title="Przewiń plan do zlecenia">
					Pokaż
				</Button>
				<Button variant="outline-secondary" className="details-delete" onClick={() => onDelete(block)}>
					Usuń
				</Button>
			</footer>
		</aside>
	);
};

export default BlockDetailsPanel;
