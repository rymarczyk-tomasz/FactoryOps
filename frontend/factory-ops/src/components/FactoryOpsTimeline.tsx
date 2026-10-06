import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, ButtonToolbar } from 'react-bootstrap';
import Timeline, { DateHeader, SidebarHeader, TimelineHeaders, TimelineItemBase, TimelineMarkers, TodayMarker } from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
import { usePlan } from '../data/PlanContext';
import { calendarLookup, nonWorkingPeriods, workMode } from '../domain/calendar';
import { formatDateTime, formatHours, programmerName, timelineLabel } from '../domain/format';
import { blockStatus, previewMove } from '../domain/schedule';
import { nearestShiftStart, shiftDayStart } from '../domain/shifts';
import { Block, Id, Machine } from '../domain/types';
import BlockFormModal, { BlockFormDefaults } from './BlockFormModal';
import ConfirmModal from './ConfirmModal';
import DayContextMenu, { DayMenuTarget } from './DayContextMenu';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Prefiks id tła z dniami wolnymi - takich elementów nie da się zaznaczyć ani przesunąć. */
const OFF_PREFIX = 'off:';
const DROP_INDICATOR_PREFIX = 'drop:';

const PROJECT_COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#059669', '#dc2626', '#4f46e5'];

function projectColor(project: string): string {
	let hash = 0;
	for (const char of project) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

type MachineGroup = { id: Id; title: string; machine: Machine; stackItems: boolean };

// treść zostaje po zamknięciu, żeby modal nie zmieniał się w trakcie animacji zamykania
type FormState = { show: boolean; block?: Block; defaults?: BlockFormDefaults };

/** Bloczek w trakcie przeciągania: docelowa maszyna i początek przyciągnięty do zmiany. */
type DragState = { id: Id; machineId: Id; start: number };

const FactoryOpsTimeline = () => {
	const { state, moveBlock, deleteBlock, undo, canUndo } = usePlan();
	const [selectedId, setSelectedId] = useState<Id>();
	const [form, setForm] = useState<FormState>({ show: false });
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [dayMenu, setDayMenu] = useState<DayMenuTarget>();
	const closeDayMenu = useCallback(() => setDayMenu(undefined), []);
	const [drag, setDrag] = useState<DragState>();
	// ostatnia pozycja podglądu bez czekania na render - przy upuszczeniu bloczek ląduje dokładnie tam, gdzie kreska
	const dragRef = useRef<DragState>();

	// upuszczenie bez zmiany miejsca nie wywołuje onItemMove - podgląd chowamy po puszczeniu przycisku
	const dragging = drag !== undefined;
	useEffect(() => {
		if (!dragging) return;
		// po onItemMove biblioteki, które też reaguje na puszczenie przycisku i potrzebuje ostatniej pozycji
		const end = () =>
			setTimeout(() => {
				dragRef.current = undefined;
				setDrag(undefined);
			});
		window.addEventListener('pointerup', end);
		return () => window.removeEventListener('pointerup', end);
	}, [dragging]);

	const preview = useMemo(() => drag && previewMove(state.blocks, drag.id, drag.start, drag.machineId, calendarLookup(state)), [drag, state]);

	const selected = state.blocks.find((b) => b.id === selectedId);
	const select = (id: Id) => !String(id).startsWith(OFF_PREFIX) && !String(id).startsWith(DROP_INDICATOR_PREFIX) && setSelectedId(String(id));

	const openDayMenu = (machineId: Id, time: number, e: React.SyntheticEvent) => {
		e.preventDefault();
		const { clientX, clientY } = e as React.MouseEvent;
		setDayMenu({ x: clientX, y: clientY, machineId, day: shiftDayStart(time) });
	};

	// bloczki na maszynie nigdy na siebie nie nachodzą (pilnuje tego harmonogram), więc bez układania w stos -
	// dzięki temu tło z dniami wolnymi leży pod zleceniami
	const groups = useMemo<MachineGroup[]>(() => state.machines.map((m) => ({ id: m.id, title: m.name, machine: m, stackItems: false })), [state.machines]);

	const offItems = useMemo<TimelineItemBase<number>[]>(() => {
		const calendars = calendarLookup(state);
		const now = Date.now();
		const from = Math.min(now, ...state.blocks.map((b) => b.start)) - 30 * DAY;
		const to = Math.max(now, ...state.blocks.map((b) => b.end)) + 120 * DAY;
		return state.machines.flatMap((machine) =>
			nonWorkingPeriods(calendars(machine.id), from, to).map(([start, end]) => ({
				id: `${OFF_PREFIX}${machine.id}:${start}`,
				group: machine.id,
				title: '',
				start_time: start,
				end_time: end,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: 'non-working-item'
			}))
		);
	}, [state]);

	const draggedId = drag?.id;
	const blockItems = useMemo<TimelineItemBase<number>[]>(() => {
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
				// długość wynika z godzin w zamówieniu - zmienia się ją w formularzu, nie myszką
				canResize: false,
				canChangeGroup: true,
				className: block.id === draggedId ? 'dragging-block' : undefined,
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
	}, [state.blocks, state.programmers, draggedId]);

	// kreska w miejscu, gdzie faktycznie wyląduje przenoszony bloczek (po zepchnięciu kolejki)
	const indicatorItems = useMemo<TimelineItemBase<number>[]>(() => {
		if (!drag || !preview) return [];
		const neighbours = [preview.after && `po ${preview.after.orderNo}`, preview.before && `przed ${preview.before.orderNo}`].filter(Boolean);
		return [
			{
				// nowe id przy każdej zmianie: w trakcie przeciągania biblioteka nie przelicza położenia istniejących elementów
				id: `${DROP_INDICATOR_PREFIX}${drag.machineId}:${preview.start}`,
				group: drag.machineId,
				title: [formatDateTime(preview.start), ...neighbours].join(' · '),
				start_time: preview.start,
				end_time: preview.start + 60_000,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: 'drop-indicator'
			}
		];
	}, [drag, preview]);

	const items = useMemo(() => [...offItems, ...blockItems, ...indicatorItems], [offItems, blockItems, indicatorItems]);

	return (
		<>
			<div className="d-flex flex-wrap align-items-center gap-3 mb-3">
				<ButtonToolbar className="gap-2">
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
				<small className="text-secondary">
					<span className="legend-swatch non-working-item" /> dzień wolny maszyny · prawy klik na planie: dni pracujące/wolne
				</small>
			</div>

			<Timeline<TimelineItemBase<number>, MachineGroup>
				groups={groups}
				items={items}
				defaultTimeStart={Date.now() - 2 * DAY}
				defaultTimeEnd={Date.now() + 12 * DAY}
				minZoom={DAY}
				maxZoom={90 * DAY}
				dragSnap={HOUR}
				lineHeight={44}
				itemHeightRatio={0.8}
				canMove
				canChangeGroup
				canResize={false}
				selected={selectedId ? [selectedId] : []}
				onItemSelect={select}
				onItemClick={select}
				onItemDeselect={() => setSelectedId(undefined)}
				onCanvasDoubleClick={(groupId, time) => setForm({ show: true, defaults: { machineId: String(groupId), start: nearestShiftStart(time) } })}
				onCanvasContextMenu={(groupId, time, e) => openDayMenu(String(groupId), time, e)}
				onItemContextMenu={(itemId, e, time) => {
					const block = state.blocks.find((b) => b.id === itemId);
					if (block) openDayMenu(block.machineId, time, e);
				}}
				moveResizeValidator={(_action, _item, time) => nearestShiftStart(time)}
				onItemDrag={(e) => {
					if (e.eventType !== 'move') return;
					const next = { id: String(e.itemId), machineId: state.machines[e.newGroupOrder].id, start: nearestShiftStart(e.time) };
					const last = dragRef.current;
					// zdarzenie przychodzi przy każdym ruchu myszy - przeliczamy tylko po zmianie zmiany lub maszyny
					if (last && last.id === next.id && last.machineId === next.machineId && last.start === next.start) return;
					dragRef.current = next;
					setDrag(next);
				}}
				onItemMove={(id, time, groupOrder) => {
					const last = dragRef.current;
					dragRef.current = undefined;
					setDrag(undefined);
					if (last && last.id === id) moveBlock(last.id, last.start, last.machineId);
					else moveBlock(String(id), time, state.machines[groupOrder].id);
				}}
				groupRenderer={({ group }) => (
					<div className="d-flex align-items-center justify-content-between gap-1">
						<span className="text-truncate" title={group.title}>
							{group.title}
						</span>
						{workMode(group.machine) === 'continuous' && (
							<Badge bg="success" pill title="System 4-brygadowy">
								24/7
							</Badge>
						)}
					</div>
				)}>
				<TimelineHeaders className="sticky">
					<SidebarHeader>{({ getRootProps }) => <div {...getRootProps()} className="timeline-sidebar-header">Maszyna</div>}</SidebarHeader>
					<DateHeader unit="primaryHeader" labelFormat={timelineLabel} />
					<DateHeader labelFormat={timelineLabel} />
				</TimelineHeaders>
				<TimelineMarkers>
					<TodayMarker />
				</TimelineMarkers>
			</Timeline>

			{dayMenu && (
				<DayContextMenu
					target={dayMenu}
					onAddBlock={() => setForm({ show: true, defaults: { machineId: dayMenu.machineId, start: dayMenu.day } })}
					onClose={closeDayMenu}
				/>
			)}
			<BlockFormModal show={form.show} block={form.block} defaults={form.defaults} onHide={() => setForm((f) => ({ ...f, show: false }))} />
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
