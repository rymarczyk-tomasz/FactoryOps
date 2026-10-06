import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Badge, Button, ButtonGroup, Form, InputGroup } from 'react-bootstrap';
import Timeline, {
	DateHeader,
	ReactCalendarTimelineProps,
	SidebarHeader,
	TimelineHeaders,
	TimelineItemBase,
	TimelineMarkers,
	TodayMarker
} from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
import { usePlan } from '../data/PlanContext';
import { calendarLookup, capacityLookup, isLine, nonWorkingPeriods, nonWorkingSegments, unitCount, unitLabel, workMode } from '../domain/calendar';
import { formatDateTime, formatHours, programmerName, timelineLabel } from '../domain/format';
import { blockStatus, previewMove } from '../domain/schedule';
import { nearestHourStart, shiftDayStart } from '../domain/shifts';
import { Block, Id, Machine } from '../domain/types';
import BlockDetailsPanel from './BlockDetailsPanel';
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
/** Biblioteka nie eksportuje typu propsów renderera - bierzemy go z propa `itemRenderer`. */
type ItemRendererProps = Parameters<NonNullable<ReactCalendarTimelineProps<PlanItem>['itemRenderer']>>[0];

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
function renderItem({ item, itemContext, getItemProps }: ItemRendererProps) {
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

type GroupKind = 'lines' | 'machines';

/** Wiersz planu: maszyna/linia albo nagłówek zwijanej grupy („Linie produkcyjne”, „Maszyny”). */
type PlanGroup = { id: Id; title: string; stackItems: boolean; height?: number; machine?: Machine; header?: { kind: GroupKind; count: number; collapsed: boolean } };

const GROUP_TITLES: Record<GroupKind, string> = { lines: 'Linie produkcyjne', machines: 'Maszyny' };
const HEADER_HEIGHT = 30;

// treść zostaje po zamknięciu, żeby modal nie zmieniał się w trakcie animacji zamykania
type FormState = { show: boolean; block?: Block; defaults?: BlockFormDefaults };

/** Bloczek w trakcie przeciągania: docelowa maszyna i początek przyciągnięty do pełnej godziny. */
type DragState = { id: Id; machineId: Id; start: number };

/** Widoczny zakres planu. Ułamek `lead` to część zakresu przed „teraz”. */
const ZOOMS = [
	{ label: 'Dzień', span: DAY, lead: 0.2 },
	{ label: 'Tydzień', span: 7 * DAY, lead: 1 / 7 },
	{ label: 'Miesiąc', span: 30 * DAY, lead: 0.1 }
];
type Range = { start: number; end: number };
const rangeAround = (time: number, span: number, lead: number): Range => ({ start: time - span * lead, end: time + span * (1 - lead) });

function matchesQuery(block: Block, query: string): boolean {
	const q = query.trim().toLowerCase();
	return [block.orderNo, block.project, block.operation].some((field) => field.toLowerCase().includes(q));
}

const FactoryOpsTimeline = () => {
	const { state, moveBlock, deleteBlock, undo, canUndo } = usePlan();
	const [selectedId, setSelectedId] = useState<Id>();
	const [form, setForm] = useState<FormState>({ show: false });
	const [toDelete, setToDelete] = useState<Block>();
	const [dayMenu, setDayMenu] = useState<DayMenuTarget>();
	const closeDayMenu = useCallback(() => setDayMenu(undefined), []);
	const [drag, setDrag] = useState<DragState>();
	// ostatnia pozycja podglądu bez czekania na render - przy upuszczeniu bloczek ląduje dokładnie tam, gdzie kreska
	const dragRef = useRef<DragState>();
	const [range, setRange] = useState<Range>(() => rangeAround(Date.now(), ZOOMS[1].span, ZOOMS[1].lead));
	const [collapsed, setCollapsed] = useState<Record<GroupKind, boolean>>({ lines: false, machines: false });
	const [query, setQuery] = useState('');
	const [matchIndex, setMatchIndex] = useState(0);

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

	// --- zoom i przewijanie ---
	const span = range.end - range.start;
	const activeZoom = ZOOMS.find((z) => Math.abs(z.span - span) < HOUR);
	const zoomTo = (zoom: (typeof ZOOMS)[number]) => setRange(rangeAround(Date.now(), zoom.span, zoom.lead));
	const goToday = () => setRange(rangeAround(Date.now(), span, activeZoom?.lead ?? 0.15));
	const showBlock = (block: Block) => setRange(rangeAround(block.start, Math.max(span, (block.end - block.start) * 1.5), 0.15));

	// --- wyszukiwanie ---
	const matches = useMemo(() => (query.trim() ? [...state.blocks].filter((b) => matchesQuery(b, query)).sort((a, b) => a.start - b.start) : []), [state.blocks, query]);
	const matchIds = useMemo(() => new Set(matches.map((b) => b.id)), [matches]);
	const jumpToMatch = (index: number) => {
		if (matches.length === 0) return;
		const wrapped = (index + matches.length) % matches.length;
		setMatchIndex(wrapped);
		setSelectedId(matches[wrapped].id);
		showBlock(matches[wrapped]);
	};

	// --- wiersze: linie i maszyny w zwijanych grupach ---
	// bloczki na maszynie nigdy na siebie nie nachodzą (pilnuje tego harmonogram), więc bez układania w stos -
	// dzięki temu tło z dniami wolnymi leży pod zleceniami
	const groups = useMemo<PlanGroup[]>(() => {
		const row = (m: Machine): PlanGroup => ({ id: m.id, title: m.name, machine: m, stackItems: false });
		const byKind: Record<GroupKind, Machine[]> = { lines: state.machines.filter(isLine), machines: state.machines.filter((m) => !isLine(m)) };
		// nagłówki tylko wtedy, gdy są oba rodzaje - inaczej nie ma czego grupować
		if (byKind.lines.length === 0 || byKind.machines.length === 0) return state.machines.map(row);
		return (['lines', 'machines'] as GroupKind[]).flatMap((kind) => [
			{
				id: `hdr:${kind}`,
				title: GROUP_TITLES[kind],
				stackItems: false,
				height: HEADER_HEIGHT,
				header: { kind, count: byKind[kind].length, collapsed: collapsed[kind] }
			},
			...(collapsed[kind] ? [] : byKind[kind].map(row))
		]);
	}, [state.machines, collapsed]);
	const visibleMachineIds = useMemo(() => new Set(groups.filter((g) => g.machine).map((g) => g.id)), [groups]);
	/** Maszyna wiersza o danym numerze; na nagłówku grupy - `undefined`. */
	const machineAtRow = (groupOrder: number) => groups[groupOrder]?.machine?.id;

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
			const machinesDown = breakdown.units.map((unit) => unitLabel(machine, unit)).join(', ');
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
	const searching = query.trim() !== '';
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
			const classes = [block.id === draggedId && 'dragging-block', searching && (matchIds.has(block.id) ? 'search-match' : 'dimmed')].filter(Boolean);
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
				className: classes.join(' ') || undefined,
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
	}, [state.blocks, state.programmers, state.calendar, state.machines, draggedId, searching, matchIds]);

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

	// elementy zwiniętych grup nie trafiają do biblioteki
	const items = useMemo(
		() => [...offItems, ...blockItems, ...breakdownItems, ...indicatorItems].filter((item) => visibleMachineIds.has(String(item.group))),
		[offItems, blockItems, breakdownItems, indicatorItems, visibleMachineIds]
	);

	return (
		<>
			<div className="d-flex flex-wrap align-items-center gap-2 mb-3 plan-toolbar">
				<Button size="sm" onClick={() => setForm({ show: true })}>
					+ Dodaj zlecenie
				</Button>
				<Button size="sm" variant="outline-secondary" disabled={!canUndo} onClick={undo}>
					Cofnij
				</Button>
				<div className="vr mx-1" />
				<ButtonGroup size="sm" aria-label="Zakres planu">
					{ZOOMS.map((zoom) => (
						<Button key={zoom.label} variant={activeZoom === zoom ? 'secondary' : 'outline-secondary'} onClick={() => zoomTo(zoom)}>
							{zoom.label}
						</Button>
					))}
				</ButtonGroup>
				<Button size="sm" variant="outline-secondary" onClick={goToday}>
					Dziś
				</Button>
				<div className="vr mx-1" />
				<InputGroup size="sm" className="plan-search">
					<Form.Control
						type="search"
						placeholder="Szukaj: nr zamówienia, projekt, operacja"
						aria-label="Szukaj zleceń"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setMatchIndex(0);
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter') jumpToMatch(e.shiftKey ? matchIndex - 1 : searching && selectedId === matches[matchIndex]?.id ? matchIndex + 1 : matchIndex);
							if (e.key === 'Escape') setQuery('');
						}}
					/>
					{searching && (
						<>
							<InputGroup.Text className="text-nowrap">{matches.length ? `${matchIndex + 1} / ${matches.length}` : 'brak'}</InputGroup.Text>
							<Button variant="outline-secondary" disabled={!matches.length} onClick={() => jumpToMatch(matchIndex - 1)} aria-label="Poprzednie">
								‹
							</Button>
							<Button variant="outline-secondary" disabled={!matches.length} onClick={() => jumpToMatch(matchIndex + 1)} aria-label="Następne">
								›
							</Button>
						</>
					)}
				</InputGroup>
				<small className="text-secondary ms-auto">
					<span className="legend-swatch non-working-item" /> czas wolny <span className="legend-swatch breakdown-swatch ms-2" /> awaria · prawy klik: godziny pracy
					i awarie
				</small>
			</div>

			<Timeline<PlanItem, PlanGroup>
				groups={groups}
				items={items}
				visibleTimeStart={range.start}
				visibleTimeEnd={range.end}
				onTimeChange={(start, end) => setRange({ start, end })}
				minZoom={12 * HOUR}
				maxZoom={90 * DAY}
				dragSnap={HOUR}
				sidebarWidth={200}
				lineHeight={38}
				itemHeightRatio={0.8}
				canMove
				canChangeGroup
				canResize={false}
				selected={selectedId ? [selectedId] : []}
				onItemSelect={select}
				onItemClick={select}
				onItemDeselect={() => setSelectedId(undefined)}
				onCanvasDoubleClick={(groupId, time) =>
					visibleMachineIds.has(String(groupId)) && setForm({ show: true, defaults: { machineId: String(groupId), start: nearestHourStart(time) } })
				}
				onCanvasContextMenu={(groupId, time, e) => (visibleMachineIds.has(String(groupId)) ? openDayMenu(String(groupId), time, e) : e.preventDefault())}
				onItemContextMenu={(itemId, e, time) => {
					const block = state.blocks.find((b) => b.id === itemId);
					if (block) openDayMenu(block.machineId, time, e);
				}}
				moveResizeValidator={(_action, _item, time) => nearestHourStart(time)}
				onItemDrag={(e) => {
					if (e.eventType !== 'move') return;
					const last = dragRef.current;
					const id = String(e.itemId);
					// nad nagłówkiem grupy zostajemy na ostatniej maszynie
					const machineId = machineAtRow(e.newGroupOrder) ?? last?.machineId ?? state.blocks.find((b) => b.id === id)?.machineId;
					if (!machineId) return;
					const next = { id, machineId, start: nearestHourStart(e.time) };
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
					else {
						const machineId = machineAtRow(groupOrder) ?? state.blocks.find((b) => b.id === id)?.machineId;
						if (machineId) moveBlock(String(id), time, machineId);
					}
				}}
				itemRenderer={renderItem}
				horizontalLineClassNamesForGroup={(group) => (group.header ? ['group-header-row'] : [])}
				groupRenderer={({ group }) =>
					group.header ? (
						<button
							type="button"
							className="group-header"
							aria-expanded={!group.header.collapsed}
							onClick={() => setCollapsed((c) => ({ ...c, [group.header!.kind]: !c[group.header!.kind] }))}>
							<span className="group-chevron">{group.header.collapsed ? '▸' : '▾'}</span>
							{group.title}
							<span className="text-secondary fw-normal ms-1">({group.header.count})</span>
						</button>
					) : (
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
					)
				}>
				<TimelineHeaders className="sticky">
					<SidebarHeader>{({ getRootProps }) => <div {...getRootProps()} className="timeline-sidebar-header">Maszyna / linia</div>}</SidebarHeader>
					<DateHeader unit="primaryHeader" labelFormat={timelineLabel} />
					<DateHeader labelFormat={timelineLabel} />
				</TimelineHeaders>
				<TimelineMarkers>
					<TodayMarker />
				</TimelineMarkers>
			</Timeline>

			<BlockDetailsPanel
				block={selected}
				onEdit={(block) => setForm({ show: true, block })}
				onDelete={setToDelete}
				onShow={showBlock}
				onClose={() => setSelectedId(undefined)}
			/>
			{dayMenu && (
				<DayContextMenu
					target={dayMenu}
					onAddBlock={() => setForm({ show: true, defaults: { machineId: dayMenu.machineId, start: dayMenu.hour } })}
					onClose={closeDayMenu}
				/>
			)}
			<BlockFormModal show={form.show} block={form.block} defaults={form.defaults} onHide={() => setForm((f) => ({ ...f, show: false }))} />
			<ConfirmModal
				show={toDelete !== undefined}
				title="Usunąć zlecenie?"
				onConfirm={() => {
					if (!toDelete) return;
					deleteBlock(toDelete.id);
					if (toDelete.id === selectedId) setSelectedId(undefined);
				}}
				onHide={() => setToDelete(undefined)}>
				{toDelete && (
					<>
						Zlecenie <strong>{toDelete.orderNo}</strong> ({toDelete.operation}) zostanie usunięte z planu. Następne zlecenia na maszynie cofną się na jego miejsce.
					</>
				)}
			</ConfirmModal>
		</>
	);
};

export default FactoryOpsTimeline;
