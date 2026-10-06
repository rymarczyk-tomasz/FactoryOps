import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, ButtonToolbar } from 'react-bootstrap';
import Timeline, { DateHeader, SidebarHeader, TimelineHeaders, TimelineItemBase, TimelineMarkers, TodayMarker } from 'react-calendar-timeline';
import type { ItemRendererProps } from 'react-calendar-timeline/dist/lib/items/Item';
import 'react-calendar-timeline/style.css';
import { usePlan } from '../data/PlanContext';
import { calendarLookup, capacityLookup, isLine, nonWorkingPeriods, nonWorkingSegments, unitCount, unitLabel, workMode } from '../domain/calendar';
import { formatDateTime, formatHours, programmerName, timelineLabel } from '../domain/format';
import { blockStatus, previewMove } from '../domain/schedule';
import { nearestHourStart, shiftDayStart } from '../domain/shifts';
import { Block, Id, Machine } from '../domain/types';
import BlockFormModal, { BlockFormDefaults } from './BlockFormModal';
import ConfirmModal from './ConfirmModal';
import DayContextMenu, { DayMenuTarget } from './DayContextMenu';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Prefiksy id elementów pomocniczych (czas wolny, awarie, kreska przy przeciąganiu) - nie da się ich zaznaczyć ani przesunąć. */
const OFF_PREFIX = 'off:';
const BREAKDOWN_PREFIX = 'brk:';
const DROP_INDICATOR_PREFIX = 'drop:';
const isHelperItem = (id: Id) => [OFF_PREFIX, BREAKDOWN_PREFIX, DROP_INDICATOR_PREFIX].some((prefix) => String(id).startsWith(prefix));
/** Zakres, w którym rysujemy czas wolny maszyn. */
const BACKGROUND_DAYS_BEFORE = 30;
const BACKGROUND_DAYS_AFTER = 120;

const PROJECT_COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#059669', '#dc2626', '#4f46e5'];

function projectColor(project: string): string {
	let hash = 0;
	for (const char of project) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

/**
 * Tło zlecenia: pełny kolor, a fragmenty przypadające na dni wolne maszyny (np. weekend między
 * piątkiem a poniedziałkiem) zakreskowane - zlecenie stoi, ale wciąż zajmuje maszynę.
 */
function blockBackground(color: string, start: number, end: number, offSegments: [number, number][]): string {
	if (offSegments.length === 0) return color;
	const pct = (ms: number) => `${(((ms - start) / (end - start)) * 100).toFixed(3)}%`;
	// warstwa wierzchnia: pełny kolor z przezroczystymi "oknami", przez które widać paski spod spodu
	const stops = offSegments.flatMap(([from, to]) => [`${color} ${pct(from)}`, `transparent ${pct(from)}`, `transparent ${pct(to)}`, `${color} ${pct(to)}`]);
	const solid = `linear-gradient(to right, ${color} 0%, ${stops.join(', ')}, ${color} 100%)`;
	const stripes = `repeating-linear-gradient(-45deg, ${color}59 0 6px, ${color}a6 6px 12px)`;
	return `${solid}, ${stripes}`;
}

/**
 * Element timeline: zlecenie z wariantami opisu (renderer wybiera najdłuższy, który mieści się w kafelku)
 * albo nakładka awarii - zamalowana część wysokości odpowiada części maszyn linii, które stoją.
 */
type PlanItem = TimelineItemBase<number> & { labels?: string[]; breakdown?: { down: number; units: number; labels: string[] } };

/** Przybliżona szerokość znaku przy czcionce 0.8rem + odstępy wewnątrz kafelka. */
const CHAR_WIDTH = 7;
/** Napis awarii jest mniejszy (0.65rem). */
const BREAKDOWN_CHAR_WIDTH = 6;
const LABEL_PADDING = 14;

function blockLabels(block: Block): string[] {
	const shortNo = block.orderNo.split('/').pop() ?? block.orderNo;
	return [`${block.orderNo} · ${block.operation}`, `${shortNo} · ${block.operation}`, shortNo];
}

/**
 * Opis nigdy nie wychodzi poza kafelek - inaczej przy krótkich zleceniach obok siebie napis
 * zasłaniał sąsiada i kliknięcie trafiało w złe zlecenie. Za wąski kafelek zostaje bez napisu (dane w podpowiedzi).
 */
function renderItem({ item, itemContext, getItemProps }: ItemRendererProps<PlanItem>) {
	const { key, ref, ...props } = getItemProps(item.itemProps ?? {});
	const width = itemContext.dimensions.width;
	const fitting = (labels: string[], charWidth: number) => labels.find((l) => l.length * charWidth + LABEL_PADDING <= width) ?? '';
	if (item.breakdown) {
		const { down, units, labels } = item.breakdown;
		const label = fitting(labels, BREAKDOWN_CHAR_WIDTH);
		return (
			<div {...props} ref={ref} key={key}>
				<div key="fill" className="breakdown-fill" style={{ height: `${(down / units) * 100}%` }} />
				{label && (
					<span key="label" className="breakdown-label">
						{label}
					</span>
				)}
			</div>
		);
	}
	const label = item.labels ? fitting(item.labels, CHAR_WIDTH) : itemContext.title;
	return (
		<div
			{...props}
			ref={ref}
			key={key}
			// biblioteka nie oznacza zaznaczenia klasą, a jej podpowiedź to sam tytuł - ustawiamy oba sami
			className={itemContext.selected ? `${props.className} is-selected` : props.className}
			title={item.itemProps?.title ?? props.title}>
			{label && <div className="rct-item-content">{label}</div>}
		</div>
	);
}

type MachineGroup = { id: Id; title: string; machine: Machine; stackItems: boolean };

// treść zostaje po zamknięciu, żeby modal nie zmieniał się w trakcie animacji zamykania
type FormState = { show: boolean; block?: Block; defaults?: BlockFormDefaults };

/** Bloczek w trakcie przeciągania: docelowa maszyna i początek przyciągnięty do pełnej godziny. */
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

	const preview = useMemo(() => drag && previewMove(state.blocks, drag.id, drag.start, drag.machineId, capacityLookup(state), Date.now()), [drag, state]);

	const selected = state.blocks.find((b) => b.id === selectedId);
	const select = (id: Id) => !isHelperItem(id) && setSelectedId(String(id));

	const openDayMenu = (machineId: Id, time: number, e: React.SyntheticEvent) => {
		e.preventDefault();
		const { clientX, clientY } = e as React.MouseEvent;
		setDayMenu({ x: clientX, y: clientY, machineId, day: shiftDayStart(time), hour: nearestHourStart(time) });
	};

	// bloczki na maszynie nigdy na siebie nie nachodzą (pilnuje tego harmonogram), więc bez układania w stos -
	// dzięki temu tło z dniami wolnymi leży pod zleceniami
	const groups = useMemo<MachineGroup[]>(() => state.machines.map((m) => ({ id: m.id, title: m.name, machine: m, stackItems: false })), [state.machines]);

	// tło zależy tylko od kalendarzy - nie przeliczamy go przy każdym przesunięciu zlecenia
	const offItems = useMemo<PlanItem[]>(() => {
		const calendars = calendarLookup({ calendar: state.calendar, machines: state.machines });
		const now = Date.now();
		const from = now - BACKGROUND_DAYS_BEFORE * DAY;
		const to = now + BACKGROUND_DAYS_AFTER * DAY;
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
	}, [state.calendar, state.machines]);

	// awarie leżą nad zleceniami (półprzezroczyste), żeby było widać, które zlecenie zwalniają
	const breakdownItems = useMemo<PlanItem[]>(() => {
		const machines = new Map(state.machines.map((m) => [m.id, m]));
		return state.breakdowns.map((breakdown) => {
			const machine = machines.get(breakdown.machineId);
			const units = unitCount(machine);
			const machinesDown = breakdown.units.map(unitLabel).join(', ');
			// od najdłuższego - renderer wybierze ten, który się zmieści
			const labels = isLine(machine) ? [`Awaria ${machinesDown}`, machinesDown, '!'] : ['Awaria', '!'];
			return {
				id: `${BREAKDOWN_PREFIX}${breakdown.id}`,
				group: breakdown.machineId,
				title: labels[0],
				start_time: breakdown.start,
				end_time: breakdown.end,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: 'breakdown-item',
				breakdown: { down: Math.min(breakdown.units.length, units), units, labels }
			};
		});
	}, [state.breakdowns, state.machines]);

	const draggedId = drag?.id;
	const blockItems = useMemo<PlanItem[]>(() => {
		const now = Date.now();
		const calendars = calendarLookup({ calendar: state.calendar, machines: state.machines });
		const machines = new Map(state.machines.map((m) => [m.id, m]));
		return state.blocks.map((block) => {
			const color = projectColor(block.project);
			const programmer = state.programmers.find((p) => p.id === block.programmerId);
			const machine = machines.get(block.machineId);
			const tooltip = [
				`${block.orderNo} · ${block.project}`,
				block.operation,
				isLine(machine) ? `${formatHours(block.hours)} pracy maszyny · linia: ${unitCount(machine)} maszyny` : formatHours(block.hours),
				`${formatDateTime(block.start)} → ${formatDateTime(block.end)}`,
				block.pinnedStart !== undefined ? `Termin: nie wcześniej niż ${formatDateTime(block.pinnedStart)}` : '',
				programmerName(programmer)
			]
				.filter(Boolean)
				.join('\n');
			return {
				id: block.id,
				group: block.machineId,
				title: `${block.orderNo} · ${block.operation}`,
				labels: blockLabels(block),
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
						background: blockBackground(color, block.start, block.end, nonWorkingSegments(calendars(block.machineId), block.start, block.end)),
						borderColor: color,
						opacity: blockStatus(block, now) === 'done' ? 0.55 : 1
					}
				}
			};
		});
	}, [state.blocks, state.programmers, state.calendar, state.machines, draggedId]);

	// kreska w miejscu, gdzie faktycznie wyląduje przenoszony bloczek (po zepchnięciu kolejki)
	const indicatorItems = useMemo<PlanItem[]>(() => {
		if (!drag || !preview) return [];
		const neighbours = [
			preview.after && (preview.pinned ? `przerwa po ${preview.after.orderNo}` : `po ${preview.after.orderNo}`),
			preview.before && `przed ${preview.before.orderNo}`
		].filter(Boolean);
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

	const items = useMemo(() => [...offItems, ...blockItems, ...breakdownItems, ...indicatorItems], [offItems, blockItems, breakdownItems, indicatorItems]);

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
					<span className="legend-swatch non-working-item" /> czas wolny <span className="legend-swatch breakdown-swatch ms-2" /> awaria · prawy klik na planie:
					godziny pracy i awarie
				</small>
			</div>

			<Timeline<PlanItem, MachineGroup>
				groups={groups}
				items={items}
				defaultTimeStart={Date.now() - 2 * DAY}
				defaultTimeEnd={Date.now() + 12 * DAY}
				minZoom={DAY}
				maxZoom={90 * DAY}
				dragSnap={HOUR}
				lineHeight={38}
				itemHeightRatio={0.8}
				canMove
				canChangeGroup
				canResize={false}
				selected={selectedId ? [selectedId] : []}
				onItemSelect={select}
				onItemClick={select}
				onItemDeselect={() => setSelectedId(undefined)}
				onCanvasDoubleClick={(groupId, time) => setForm({ show: true, defaults: { machineId: String(groupId), start: nearestHourStart(time) } })}
				onCanvasContextMenu={(groupId, time, e) => openDayMenu(String(groupId), time, e)}
				onItemContextMenu={(itemId, e, time) => {
					const block = state.blocks.find((b) => b.id === itemId);
					if (block) openDayMenu(block.machineId, time, e);
				}}
				moveResizeValidator={(_action, _item, time) => nearestHourStart(time)}
				onItemDrag={(e) => {
					if (e.eventType !== 'move') return;
					const next = { id: String(e.itemId), machineId: state.machines[e.newGroupOrder].id, start: nearestHourStart(e.time) };
					const last = dragRef.current;
					// zdarzenie przychodzi przy każdym ruchu myszy - przeliczamy tylko po zmianie godziny lub maszyny
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
				itemRenderer={renderItem}
				groupRenderer={({ group }) => (
					<div className="d-flex align-items-center justify-content-between gap-1">
						<span className="text-truncate" title={group.title}>
							{group.title}
						</span>
						<span className="d-flex gap-1">
							{isLine(group.machine) && (
								<Badge bg="primary" pill title={`Linia: ${unitCount(group.machine)} maszyny pracujące równolegle`}>
									{unitCount(group.machine)}×
								</Badge>
							)}
							{workMode(group.machine) === 'continuous' && (
								<Badge bg="success" pill title="System 4-brygadowy">
									24/7
								</Badge>
							)}
						</span>
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
					onAddBlock={() => setForm({ show: true, defaults: { machineId: dayMenu.machineId, start: dayMenu.hour } })}
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
