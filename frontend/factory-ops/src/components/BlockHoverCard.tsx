import { useLayoutEffect, useRef, useState } from 'react';
import { usePlan } from '../data/PlanContext';
import { findLine } from '../domain/calendar';
import { formatDateTime, formatHours, programmerName } from '../domain/format';
import { Block } from '../domain/types';
import { machinesLabel } from './planSelectors';
import { projectColorVar } from './projectColor';
import './BlockHoverCard.css';

/** Gdzie pokazać kartę: poziomo przy kursorze, pionowo pod zleceniem (albo nad nim, gdy brakuje miejsca). */
export interface HoverAnchor {
	x: number;
	top: number;
	bottom: number;
}

const MARGIN = 8;
const GAP = 6;

const weekdayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');
/** „czw. 08.10 14:00” - krócej niż `formatDateTime`, żeby termin mieścił się w jednym wierszu; inny rok - pełny format. */
function shortDateTime(ms: number): string {
	const d = new Date(ms);
	if (d.getFullYear() !== new Date().getFullYear()) return formatDateTime(ms);
	return `${weekdayFormat.format(ms)} ${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${timeFormat.format(ms)}`;
}

/** Karta podpowiedzi zlecenia na planie (zamiast natywnego dymka `title`). */
const BlockHoverCard = ({ block, anchor }: { block: Block; anchor: HoverAnchor }) => {
	const { state } = usePlan();
	const ref = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState({ left: anchor.x, top: anchor.bottom + GAP, visible: false });

	useLayoutEffect(() => {
		const rect = ref.current?.getBoundingClientRect();
		if (!rect) return;
		const below = anchor.bottom + GAP;
		const top = below + rect.height <= window.innerHeight - MARGIN ? below : Math.max(MARGIN, anchor.top - GAP - rect.height);
		setPosition({ left: Math.max(MARGIN, Math.min(anchor.x - 24, window.innerWidth - rect.width - MARGIN)), top, visible: true });
	}, [anchor]);

	const line = findLine(state.lines, block.machineId);
	const programmer = state.programmers.find((p) => p.id === block.programmerId);
	return (
		<div ref={ref} className={`hover-card ${position.visible ? 'is-visible' : ''}`} role="tooltip" style={{ left: position.left, top: position.top }}>
			<div className="hover-card-head">
				<span className="project-chip mono" style={projectColorVar(block.projectNo || block.project)}>
					{block.projectNo}
				</span>
				<span className="hover-card-title">
					{block.operation} · {block.project}
				</span>
			</div>
			<dl className="hover-card-list">
				<dt>Zamówienie</dt>
				<dd className="mono">{block.orderNo}</dd>
				<dt>Czas</dt>
				<dd>{line ? `${formatHours(block.hours)} maszyny · linia: ${machinesLabel(line.machineIds.length)}` : formatHours(block.hours)}</dd>
				<dt>Termin</dt>
				<dd className="mono">
					{shortDateTime(block.start)} → {shortDateTime(block.end)}
				</dd>
				{block.pinnedStart !== undefined && (
					<>
						<dt>Start</dt>
						<dd>
							nie wcześniej niż <span className="mono">{shortDateTime(block.pinnedStart)}</span>
						</dd>
					</>
				)}
				<dt>Programista</dt>
				<dd className={programmer ? '' : 'is-unassigned'}>{programmer ? programmerName(programmer) : 'nie przypisano'}</dd>
				{block.note && (
					<>
						<dt>Uwagi</dt>
						<dd className="hover-card-note">{block.note}</dd>
					</>
				)}
			</dl>
			<span className="hover-card-foot">Klik: szczegóły · dwuklik: edycja · przeciągnij: przenieś</span>
		</div>
	);
};

export default BlockHoverCard;
