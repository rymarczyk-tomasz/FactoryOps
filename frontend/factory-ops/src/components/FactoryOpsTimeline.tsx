import React, { useMemo, useState } from 'react';
import { Button, ButtonToolbar } from 'react-bootstrap';
import Timeline, { DateHeader, SidebarHeader, TimelineHeaders, TimelineItemBase, TimelineMarkers, TodayMarker } from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
import { usePlan } from '../data/PlanContext';
import { formatDateTime, formatHours, programmerName, timelineLabel } from '../domain/format';
import { blockStatus } from '../domain/schedule';
import { isWorkingDay, nearestShiftStart } from '../domain/shifts';
import { Block, Id } from '../domain/types';
import BlockFormModal, { BlockFormDefaults } from './BlockFormModal';
import ConfirmModal from './ConfirmModal';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const PROJECT_COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#059669', '#dc2626', '#4f46e5'];

function projectColor(project: string): string {
	let hash = 0;
	for (const char of project) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

// treść zostaje po zamknięciu, żeby modal nie zmieniał się w trakcie animacji zamykania
type FormState = { show: boolean; block?: Block; defaults?: BlockFormDefaults };

const FactoryOpsTimeline = () => {
	const { state, moveBlock, resizeBlock, deleteBlock, undo, canUndo } = usePlan();
	const [selectedId, setSelectedId] = useState<Id>();
	const [form, setForm] = useState<FormState>({ show: false });
	const [confirmDelete, setConfirmDelete] = useState(false);

	const selected = state.blocks.find((b) => b.id === selectedId);

	const groups = useMemo(() => state.machines.map((m) => ({ id: m.id, title: m.name })), [state.machines]);

	const items = useMemo<TimelineItemBase<number>[]>(() => {
		const now = Date.now();
		return state.blocks.map((block) => {
			const color = projectColor(block.project);
			const programmer = state.programmers.find((p) => p.id === block.programmerId);
			const tooltip = [
				`${block.orderNo} · ${block.project}`,
				block.operation,
				formatHours(block.hours),
				`${formatDateTime(block.start)} → ${formatDateTime(block.end)}`,
				programmerName(programmer)
			]
				.filter(Boolean)
				.join('\n');
			return {
				id: block.id,
				group: block.machineId,
				title: `${block.orderNo} · ${block.operation}`,
				start_time: block.start,
				end_time: block.end,
				canMove: true,
				canResize: 'right',
				canChangeGroup: true,
				itemProps: {
					title: tooltip,
					onDoubleClick: () => setForm({ show: true, block }),
					style: {
						background: color,
						borderColor: color,
						opacity: blockStatus(block, now) === 'done' ? 0.55 : 1
					}
				}
			};
		});
	}, [state.blocks, state.programmers]);

	return (
		<>
			<ButtonToolbar className="gap-2 mb-3">
				<Button size="sm" onClick={() => setForm({ show: true })}>
					Dodaj zlecenie
				</Button>
				<Button size="sm" variant="outline-secondary" disabled={!selected} onClick={() => setForm({ show: true, block: selected })}>
					Edytuj
				</Button>
				<Button size="sm" variant="outline-danger" disabled={!selected} onClick={() => setConfirmDelete(true)}>
					Usuń
				</Button>
				<Button size="sm" variant="outline-secondary" disabled={!canUndo} onClick={undo}>
					Cofnij
				</Button>
			</ButtonToolbar>

			<Timeline
				groups={groups}
				items={items}
				defaultTimeStart={Date.now() - 2 * DAY}
				defaultTimeEnd={Date.now() + 12 * DAY}
				minZoom={DAY}
				maxZoom={90 * DAY}
				dragSnap={HOUR}
				lineHeight={44}
				itemHeightRatio={0.8}
				stackItems
				canMove
				canChangeGroup
				selected={selectedId ? [selectedId] : []}
				onItemSelect={(id) => setSelectedId(String(id))}
				onItemClick={(id) => setSelectedId(String(id))}
				onItemDeselect={() => setSelectedId(undefined)}
				onCanvasDoubleClick={(groupId, time) => setForm({ show: true, defaults: { machineId: String(groupId), start: nearestShiftStart(time) } })}
				moveResizeValidator={(_action, _item, time) => nearestShiftStart(time)}
				onItemMove={(id, time, groupOrder) => moveBlock(String(id), time, state.machines[groupOrder].id)}
				onItemResize={(id, time, edge) => edge === 'right' && resizeBlock(String(id), time)}
				verticalLineClassNamesForTime={(start) => (isWorkingDay(new Date(start), state.calendar) ? [] : ['non-working'])}>
				<TimelineHeaders className="sticky">
					<SidebarHeader>{({ getRootProps }) => <div {...getRootProps()} className="timeline-sidebar-header">Maszyna</div>}</SidebarHeader>
					<DateHeader unit="primaryHeader" labelFormat={timelineLabel} />
					<DateHeader labelFormat={timelineLabel} />
				</TimelineHeaders>
				<TimelineMarkers>
					<TodayMarker />
				</TimelineMarkers>
			</Timeline>

			<BlockFormModal
				show={form.show}
				block={form.block}
				defaults={form.defaults}
				onHide={() => setForm((f) => ({ ...f, show: false }))}
			/>
			<ConfirmModal
				show={confirmDelete}
				title="Usunąć zlecenie?"
				onConfirm={() => {
					if (selected) deleteBlock(selected.id);
					setSelectedId(undefined);
				}}
				onHide={() => setConfirmDelete(false)}>
				{selected && (
					<>
						Zlecenie <strong>{selected.orderNo}</strong> ({selected.operation}) zostanie usunięte z planu.
					</>
				)}
			</ConfirmModal>
		</>
	);
};

export default FactoryOpsTimeline;
