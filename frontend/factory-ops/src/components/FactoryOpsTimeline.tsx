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
import { useLocation, useNavigate } from 'react-router-dom';
import { usePlan } from '../data/PlanContext';
import {
	breakdownEnd,
	calendarLookup,
	formatWorkingHours,
	isOngoing,
	lineMachines,
	lineOfMachine,
	nonWorkingPeriods,
	nonWorkingSegments,
	resourceName,
	standaloneMachines,
	workMode
} from '../domain/calendar';
import { formatDateTime, formatHours, programmerName, timelineLabel } from '../domain/format';
import { blockStatus, previewMove } from '../domain/schedule';
import { dayKey, nearestHourStart, shiftDayStart } from '../domain/shifts';
import { Block, Breakdown, Id, Line, Machine } from '../domain/types';
import { RevealBreakdownState } from './AppRail';
import BlockDetailsPanel from './BlockDetailsPanel';
import BlockFormModal, { BlockFormDefaults } from './BlockFormModal';
import BreakdownModal, { BreakdownModalTarget } from './BreakdownModal';
import ConfirmModal from './ConfirmModal';
import DayCalendarModal from './DayCalendarModal';
import RowContextMenu, { RowMenuTarget } from './RowContextMenu';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
/** Prefiksy id elementów pomocniczych (czas wolny, awarie, kreska przy przeciąganiu) - nie da się ich zaznaczyć ani przesunąć. */
const OFF_PREFIX = 'off:';
const BREAKDOWN_PREFIX = 'brk:';
const LINE_DOWN_PREFIX = 'lbrk:';
const DROP_INDICATOR_PREFIX = 'drop:';
const isHelperItem = (id: Id) => [OFF_PREFIX, BREAKDOWN_PREFIX, LINE_DOWN_PREFIX, DROP_INDICATOR_PREFIX].some((prefix) => String(id).startsWith(prefix));
/**
 * Rysujemy tylko widoczny zakres z zapasem po obu stronach, zaokrąglony do tygodnia - plan ma tysiące zleceń,
 * a przy przewijaniu w obrębie tygodnia elementy nie są liczone od nowa.
 */
const WINDOW_STEP = 7 * 24 * 60 * 60 * 1000;
/** Przeciągany bloczek tak blisko krawędzi planu [px] przewija plan w tę stronę. */
const AUTO_SCROLL_EDGE = 70;
/** Co ile ms i o jaką część widocznego zakresu (przy samej krawędzi) przewija się plan. */
const AUTO_SCROLL_INTERVAL = 50;
const AUTO_SCROLL_STEP = 0.02;

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
 * Element timeline: zlecenie albo awaria z wariantami opisu (renderer wybiera najdłuższy, który mieści się w kafelku).
 * `lineDown` - nakładka na wierszu linii: zamalowana część wysokości odpowiada części maszyn linii, które stoją.
 */
type PlanItem = TimelineItemBase<number> & { labels?: string[]; lineDown?: { down: number; units: number; labels: string[] } };
/** Biblioteka nie eksportuje typu propsów renderera - bierzemy go z propa `itemRenderer`. */
type ItemRendererProps = Parameters<NonNullable<ReactCalendarTimelineProps<PlanItem>['itemRenderer']>>[0];
type IntervalRendererProps = Parameters<NonNullable<React.ComponentProps<typeof DateHeader>['intervalRenderer']>>[0];

/** Przybliżona szerokość znaku przy czcionce 0.8rem + odstępy wewnątrz kafelka. */
const CHAR_WIDTH = 7;
/** Napis awarii linii jest mniejszy (0.65rem). */
const SMALL_CHAR_WIDTH = 6;
const LABEL_PADDING = 14;

/** Opis bloczka: stopień, numer projektu, nazwa projektu - od najdłuższego, renderer wybierze ten, który się zmieści. */
function blockLabels(block: Block): string[] {
	return [`${block.operation} · ${block.projectNo} · ${block.project}`, `${block.operation} · ${block.projectNo}`, block.operation];
}

/**
 * Opis nigdy nie wychodzi poza kafelek - inaczej przy krótkich zleceniach obok siebie napis
 * zasłaniał sąsiada i kliknięcie trafiało w złe zlecenie. Za wąski kafelek zostaje bez napisu (dane w podpowiedzi).
 */
function renderItem({ item, itemContext, getItemProps }: ItemRendererProps) {
	const { key, ref, ...props } = getItemProps(item.itemProps ?? {});
	const width = itemContext.dimensions.width;
	const fitting = (labels: string[], charWidth: number) => labels.find((l) => l.length * charWidth + LABEL_PADDING <= width) ?? '';
	if (item.lineDown) {
		const { down, units, labels } = item.lineDown;
		const label = fitting(labels, SMALL_CHAR_WIDTH);
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

/** Odcinki czasu, w których stoi ta sama grupa maszyn linii (z nakładających się awarii jej maszyn). */
function lineDownSegments(line: Line, breakdowns: Breakdown[], now: number): { start: number; end: number; machineIds: Id[] }[] {
	const own = breakdowns.filter((b) => line.machineIds.includes(b.machineId)).map((b) => ({ machineId: b.machineId, start: b.start, end: breakdownEnd(b, now) }));
	const points = [...new Set(own.flatMap((b) => [b.start, b.end]))].sort((a, b) => a - b);
	const segments: { start: number; end: number; machineIds: Id[] }[] = [];
	for (let i = 0; i < points.length - 1; i++) {
		const [start, end] = [points[i], points[i + 1]];
		const machineIds = line.machineIds.filter((id) => own.some((b) => b.machineId === id && b.start <= start && b.end >= end));
		if (machineIds.length === 0) continue;
		const last = segments[segments.length - 1];
		if (last && last.end === start && last.machineIds.join() === machineIds.join()) last.end = end;
		else segments.push({ start, end, machineIds });
	}
	return segments;
}

type GroupKind = 'lines' | 'machines';

/** Wiersz planu: linia, maszyna (także maszyna linii, wcięta pod nią) albo nagłówek zwijanej grupy. */
type PlanGroup = {
	id: Id;
	title: string;
	stackItems: boolean;
	height?: number;
	line?: Line;
	machine?: Machine;
	/** Maszyna wyświetlana pod swoją linią. */
	inLine?: boolean;
	header?: { kind: GroupKind; count: number; collapsed: boolean };
};

const GROUP_TITLES: Record<GroupKind, string> = { lines: 'Linie produkcyjne', machines: 'Maszyny' };
const HEADER_HEIGHT = 30;
const ROW_HEIGHT = 38;
const LINE_MACHINE_ROW_HEIGHT = 30;

// treść zostaje po zamknięciu, żeby modal nie zmieniał się w trakcie animacji zamykania
type FormState = { show: boolean; block?: Block; defaults?: BlockFormDefaults };
type BreakdownFormState = { show: boolean; target?: BreakdownModalTarget };
type DayFormState = { show: boolean; day?: number };

/** Bloczek w trakcie przeciągania: docelowa maszyna i początek przyciągnięty do pełnej godziny. */
type DragState = { id: Id; machineId: Id; start: number };

/** Widoczny zakres planu. Ułamek `lead` to część zakresu przed „teraz”. */
const ZOOMS = [
	{ label: 'Dzień', span: DAY, lead: 0.2 },
	{ label: 'Tydzień', span: 7 * DAY, lead: 1 / 7 },
	{ label: 'Miesiąc', span: 30 * DAY, lead: 0.1 }
];
/** Godziny w nagłówku tylko przy małym zakresie - przy tygodniu byłyby nieczytelne. */
const HOUR_HEADER_MAX_SPAN = 3 * DAY;
type Range = { start: number; end: number };
const rangeAround = (time: number, span: number, lead: number): Range => ({ start: time - span * lead, end: time + span * (1 - lead) });

function matchesQuery(block: Block, query: string): boolean {
	const q = query.trim().toLowerCase();
	return [block.orderNo, block.projectNo, block.project, block.operation].some((field) => field.toLowerCase().includes(q));
}

const FactoryOpsTimeline = () => {
	const { state, now, moveBlock, deleteBlock, undo, canUndo } = usePlan();
	const [selectedId, setSelectedId] = useState<Id>();
	const [form, setForm] = useState<FormState>({ show: false });
	const [breakdownForm, setBreakdownForm] = useState<BreakdownFormState>({ show: false });
	const [dayForm, setDayForm] = useState<DayFormState>({ show: false });
	const [toDelete, setToDelete] = useState<Block>();
	const [rowMenu, setRowMenu] = useState<RowMenuTarget>();
	const closeRowMenu = useCallback(() => setRowMenu(undefined), []);
	const [drag, setDrag] = useState<DragState>();
	// ostatnia pozycja podglądu bez czekania na render - przy upuszczeniu bloczek ląduje dokładnie tam, gdzie kreska
	const dragRef = useRef<DragState>();
	const [range, setRange] = useState<Range>(() => rangeAround(Date.now(), ZOOMS[1].span, ZOOMS[1].lead));
	const [collapsed, setCollapsed] = useState<Record<GroupKind, boolean>>({ lines: false, machines: false });
	// na start rozwinięte są linie, których maszyny mają własne zlecenia - inaczej nie byłoby ich widać
	const [expandedLines, setExpandedLines] = useState<Set<Id>>(
		() => new Set(state.lines.filter((l) => state.blocks.some((b) => l.machineIds.includes(b.machineId))).map((l) => l.id))
	);
	const [query, setQuery] = useState('');
	/** Wiersz, do którego przewinąć plan w pionie, gdy już będzie widoczny (po rozwinięciu grupy lub linii). */
	const [scrollToRow, setScrollToRow] = useState<Id>();
	const [matchIndex, setMatchIndex] = useState(0);
	// przeciąganie pustego planu nie przesuwa widoku - myliło się z przeciąganiem zleceń
	const panBlocked = useRef(false);

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

	// przeciąganie przy lewej lub prawej krawędzi planu przewija plan - im bliżej krawędzi, tym szybciej
	const timelineRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!dragging) return;
		let pointer: { x: number; y: number } | undefined;
		const track = (e: PointerEvent) => {
			if (e.isTrusted) pointer = { x: e.clientX, y: e.clientY };
		};
		window.addEventListener('pointermove', track, true);
		const timer = setInterval(() => {
			const canvas = timelineRef.current?.querySelector('.rct-scroll');
			if (!pointer || !canvas) return;
			const rect = canvas.getBoundingClientRect();
			const fromLeft = pointer.x - rect.left;
			const fromRight = rect.right - pointer.x;
			const direction = fromLeft < AUTO_SCROLL_EDGE ? -1 : fromRight < AUTO_SCROLL_EDGE ? 1 : 0;
			if (direction === 0) return;
			const depth = Math.min(1, (AUTO_SCROLL_EDGE - Math.max(0, Math.min(fromLeft, fromRight))) / AUTO_SCROLL_EDGE);
			setRange((r) => {
				const step = (r.end - r.start) * AUTO_SCROLL_STEP * (0.25 + depth) * direction;
				return { start: r.start + step, end: r.end + step };
			});
			// biblioteka liczy miejsce upuszczenia tylko przy ruchu myszy - po przewinięciu podsyłamy ruch w tym samym miejscu
			const { x, y } = pointer;
			requestAnimationFrame(() =>
				document.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true, pointerType: 'mouse', isPrimary: true, buttons: 1, pointerId: 1 }))
			);
		}, AUTO_SCROLL_INTERVAL);
		return () => {
			window.removeEventListener('pointermove', track, true);
			clearInterval(timer);
		};
	}, [dragging]);

	const preview = useMemo(() => drag && previewMove(state.blocks, drag.id, drag.start, drag.machineId, state, Date.now()), [drag, state]);

	const selected = state.blocks.find((b) => b.id === selectedId);
	const select = (id: Id) => !isHelperItem(id) && setSelectedId(String(id));

	const openRowMenu = (resourceId: Id, time: number, e: React.SyntheticEvent) => {
		e.preventDefault();
		const { clientX, clientY } = e as React.MouseEvent;
		setRowMenu({ x: clientX, y: clientY, resourceId, day: shiftDayStart(time), hour: nearestHourStart(time) });
	};

	// --- zoom i przewijanie ---
	const span = range.end - range.start;
	const activeZoom = ZOOMS.find((z) => Math.abs(z.span - span) < HOUR);
	const zoomTo = (zoom: (typeof ZOOMS)[number]) => setRange(rangeAround(Date.now(), zoom.span, zoom.lead));
	const goToday = () => setRange(rangeAround(Date.now(), span, activeZoom?.lead ?? 0.15));
	const shift = (direction: 1 | -1) => setRange((r) => ({ start: r.start + (direction * span) / 2, end: r.end + (direction * span) / 2 }));

	// --- wiersze: linie (z rozwijanymi maszynami) i samodzielne maszyny w zwijanych grupach ---
	const standalone = useMemo(() => standaloneMachines(state), [state]);
	const allLinesExpanded = state.lines.length > 0 && state.lines.every((l) => expandedLines.has(l.id));
	const toggleLine = (lineId: Id) =>
		setExpandedLines((current) => {
			const next = new Set(current);
			if (next.has(lineId)) next.delete(lineId);
			else next.add(lineId);
			return next;
		});
	/** Pokazuje wiersz zasobu - rozwija grupę i linię, w której jest maszyna. */
	const reveal = (resourceId: Id) => {
		const line = lineOfMachine(state.lines, resourceId);
		const isLineRow = state.lines.some((l) => l.id === resourceId);
		setCollapsed((c) => ({ ...c, [line || isLineRow ? 'lines' : 'machines']: false }));
		if (line && !expandedLines.has(line.id)) toggleLine(line.id);
	};

	const showBlock = (block: Block) => {
		reveal(block.machineId);
		setRange(rangeAround(block.start, Math.max(span, (block.end - block.start) * 1.5), 0.15));
	};

	// klik w kartę awarii w menu bocznym: odsłonięcie maszyny i przewinięcie do początku awarii.
	// Stan nawigacji czyścimy od razu - inaczej cofnięcie i odświeżenie strony przewijałyby plan jeszcze raz.
	const location = useLocation();
	const navigate = useNavigate();
	const revealBreakdownId = (location.state as RevealBreakdownState | null)?.revealBreakdown;
	useEffect(() => {
		if (!revealBreakdownId) return;
		const breakdown = state.breakdowns.find((b) => b.id === revealBreakdownId);
		if (breakdown) {
			reveal(breakdown.machineId);
			setRange(rangeAround(breakdown.start, span, 0.15));
			setScrollToRow(breakdown.machineId);
		}
		navigate(location.pathname, { replace: true, state: null });
		// reagujemy tylko na nowe polecenie z nawigacji
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [revealBreakdownId, location.key]);

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

	// bloczki na maszynie nigdy na siebie nie nachodzą (pilnuje tego harmonogram), więc bez układania w stos -
	// dzięki temu tło z dniami wolnymi leży pod zleceniami
	const groups = useMemo<PlanGroup[]>(() => {
		const machineRow = (m: Machine, inLine = false): PlanGroup => ({
			id: m.id,
			title: m.name,
			machine: m,
			inLine,
			stackItems: false,
			height: inLine ? LINE_MACHINE_ROW_HEIGHT : ROW_HEIGHT
		});
		const lineRows = state.lines.flatMap((line): PlanGroup[] => [
			{ id: line.id, title: line.name, line, stackItems: false, height: ROW_HEIGHT },
			...(expandedLines.has(line.id) ? lineMachines(line, state.machines).map((m) => machineRow(m, true)) : [])
		]);
		const machineRows = standalone.map((m) => machineRow(m));
		// nagłówki tylko wtedy, gdy są oba rodzaje - inaczej nie ma czego grupować
		if (state.lines.length === 0) return machineRows;
		if (standalone.length === 0) return lineRows;
		const header = (kind: GroupKind, count: number): PlanGroup => ({
			id: `hdr:${kind}`,
			title: GROUP_TITLES[kind],
			stackItems: false,
			height: HEADER_HEIGHT,
			header: { kind, count, collapsed: collapsed[kind] }
		});
		return [header('lines', state.lines.length), ...(collapsed.lines ? [] : lineRows), header('machines', standalone.length), ...(collapsed.machines ? [] : machineRows)];
	}, [state.lines, state.machines, standalone, collapsed, expandedLines]);
	const visibleIds = useMemo(() => new Set(groups.filter((g) => g.machine || g.line).map((g) => g.id)), [groups]);
	useEffect(() => {
		if (!scrollToRow) return;
		const index = groups.findIndex((g) => g.id === scrollToRow);
		if (index < 0) return;
		timelineRef.current?.querySelectorAll('.rct-sidebar-row')[index]?.scrollIntoView({ block: 'center' });
		setScrollToRow(undefined);
	}, [groups, scrollToRow]);
	/** Maszyna lub linia wiersza o danym numerze; na nagłówku grupy - `undefined`. */
	const resourceAtRow = (groupOrder: number) => {
		const group = groups[groupOrder];
		return group?.machine || group?.line ? group.id : undefined;
	};

	const windowFrom = Math.floor((range.start - span / 2) / WINDOW_STEP) * WINDOW_STEP;
	const windowTo = Math.ceil((range.end + span / 2) / WINDOW_STEP) * WINDOW_STEP;

	// tło zależy tylko od kalendarzy i widocznego zakresu - nie przeliczamy go przy każdym przesunięciu zlecenia
	const offItems = useMemo<PlanItem[]>(() => {
		const calendars = calendarLookup(state);
		return [...visibleIds].flatMap((id) =>
			nonWorkingPeriods(calendars(id), windowFrom, windowTo).map(([start, end]) => ({
				id: `${OFF_PREFIX}${id}:${start}`,
				group: id,
				title: '',
				start_time: start,
				end_time: end,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: 'non-working-item'
			}))
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.calendar, state.machines, state.lines, visibleIds, windowFrom, windowTo]);

	// awaria maszyny to czerwony bloczek w jej wierszu; na wierszu linii - nakładka pokazująca, ile maszyn stoi
	const breakdownItems = useMemo<PlanItem[]>(() => {
		const machineNames = new Map(state.machines.map((m) => [m.id, m.name]));
		const onMachines = state.breakdowns.map((breakdown): PlanItem => {
			const end = breakdownEnd(breakdown, now);
			const ongoing = isOngoing(breakdown);
			const tooltip = [
				`Awaria ${machineNames.get(breakdown.machineId) ?? ''}`,
				`od ${formatDateTime(breakdown.start)}`,
				ongoing ? 'trwa - rośnie co godzinę, dopóki jej nie zakończysz' : `do ${formatDateTime(end)}`,
				'Prawy klik: zakończ lub usuń'
			].join('\n');
			return {
				id: `${BREAKDOWN_PREFIX}${breakdown.id}`,
				group: breakdown.machineId,
				title: tooltip,
				labels: ongoing ? ['Awaria · trwa', 'Awaria', '!'] : ['Awaria', '!'],
				start_time: breakdown.start,
				end_time: end,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: ongoing ? 'breakdown-block ongoing' : 'breakdown-block',
				itemProps: { title: tooltip }
			};
		});
		const onLines = state.lines.flatMap((line) =>
			lineDownSegments(line, state.breakdowns, now).map(({ start, end, machineIds }): PlanItem => {
				const names = machineIds.map((id) => machineNames.get(id) ?? '').join(', ');
				return {
					id: `${LINE_DOWN_PREFIX}${line.id}:${start}`,
					group: line.id,
					title: `Awaria ${names}`,
					start_time: start,
					end_time: end,
					canMove: false,
					canResize: false,
					canChangeGroup: false,
					className: 'line-breakdown-item',
					lineDown: { down: machineIds.length, units: Math.max(1, line.machineIds.length), labels: [`Awaria ${names}`, names, '!'] }
				};
			})
		);
		return [...onMachines, ...onLines];
	}, [state.breakdowns, state.machines, state.lines, now]);

	const draggedId = drag?.id;
	const searching = query.trim() !== '';
	// tło (z zakreskowanym czasem wolnym) i podpowiedź liczymy raz na zlecenie - przy przewijaniu tysięcy zleceń
	// liczyłyby się od nowa; nowa pamięć po zmianie kalendarzy, linii lub programistów
	// eslint-disable-next-line react-hooks/exhaustive-deps
	const blockLooks = useMemo(() => new WeakMap<Block, { background: string; tooltip: string }>(), [state.calendar, state.machines, state.lines, state.programmers]);
	const blockItems = useMemo<PlanItem[]>(() => {
		const calendars = calendarLookup(state);
		const lines = new Map(state.lines.map((l) => [l.id, l]));
		const look = (block: Block, color: string) => {
			let value = blockLooks.get(block);
			if (value === undefined) {
				const programmer = state.programmers.find((p) => p.id === block.programmerId);
				const line = lines.get(block.machineId);
				const tooltip = [
					`${block.operation} · ${block.projectNo} · ${block.project}`,
					`Zamówienie ${block.orderNo}`,
					line ? `${formatHours(block.hours)} pracy maszyny · linia: ${line.machineIds.length} maszyny` : formatHours(block.hours),
					`${formatDateTime(block.start)} → ${formatDateTime(block.end)}`,
					block.pinnedStart !== undefined ? `Termin: nie wcześniej niż ${formatDateTime(block.pinnedStart)}` : '',
					programmerName(programmer)
				]
					.filter(Boolean)
					.join('\n');
				value = { tooltip, background: blockBackground(color, block.start, block.end, nonWorkingSegments(calendars(block.machineId), block.start, block.end)) };
				blockLooks.set(block, value);
			}
			return value;
		};
		const shown = state.blocks.filter((b) => (b.end > windowFrom && b.start < windowTo && visibleIds.has(b.machineId)) || b.id === draggedId || b.id === selectedId);
		return shown.map((block) => {
			const color = projectColor(block.projectNo || block.project);
			const { tooltip, background } = look(block, color);
			const classes = [block.id === draggedId && 'dragging-block', searching && (matchIds.has(block.id) ? 'search-match' : 'dimmed')].filter(Boolean);
			return {
				id: block.id,
				group: block.machineId,
				title: blockLabels(block)[0],
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
						background,
						borderColor: color,
						opacity: blockStatus(block, now) === 'done' ? 0.55 : 1
					}
				}
			};
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.blocks, blockLooks, now, draggedId, selectedId, searching, matchIds, windowFrom, windowTo, visibleIds]);

	// gdzie wyląduje przenoszony bloczek - opis na pasku narzędzi, żeby nie zasłaniał zleceń na planie
	const dropInfo = preview && [
		resourceName(state, drag?.machineId),
		formatDateTime(preview.start),
		preview.after && (preview.pinned ? `przerwa po ${preview.after.orderNo}` : `po ${preview.after.orderNo}`),
		preview.before && `przed ${preview.before.orderNo}`
	]
		.filter(Boolean)
		.join(' · ');

	// kreska w miejscu, gdzie faktycznie wyląduje przenoszony bloczek (po zepchnięciu kolejki)
	const indicatorItems = useMemo<PlanItem[]>(() => {
		if (!drag || !preview) return [];
		return [
			{
				// nowe id przy każdej zmianie: w trakcie przeciągania biblioteka nie przelicza położenia istniejących elementów
				id: `${DROP_INDICATOR_PREFIX}${drag.machineId}:${preview.start}`,
				group: drag.machineId,
				title: '',
				start_time: preview.start,
				end_time: preview.start + 60_000,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: 'drop-indicator'
			}
		];
	}, [drag, preview]);

	// elementy zwiniętych wierszy nie trafiają do biblioteki
	const items = useMemo(
		() => [...offItems, ...blockItems, ...breakdownItems, ...indicatorItems].filter((item) => visibleIds.has(String(item.group))),
		[offItems, blockItems, breakdownItems, indicatorItems, visibleIds]
	);

	const ongoingByMachine = useMemo(() => new Set(state.breakdowns.filter(isOngoing).map((b) => b.machineId)), [state.breakdowns]);

	/** Komórka dnia w nagłówku: kliknięcie otwiera kalendarz dnia; kolor pokazuje wyjątek zakładu, kropka - wyjątki maszyn. */
	const renderDayInterval = ({ getIntervalProps, intervalContext }: IntervalRendererProps) => {
		const { interval } = intervalContext;
		const date = new Date(interval.startTime.valueOf());
		const key = dayKey(date);
		const plant = state.calendar.overrides[key];
		const machineExceptions = state.machines.some((m) => m.overrides?.[key] !== undefined);
		const status = plant === undefined ? '' : plant === true ? 'day-working' : plant === false ? 'day-off' : 'day-hours';
		const statusText = plant === undefined ? '' : plant === true ? 'pracujący' : plant === false ? 'wolny' : formatWorkingHours(plant);
		// bez onClick biblioteki - ta przybliżałaby plan do klikniętego dnia
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const { key: intervalKey, onClick, ...props } = getIntervalProps({ interval });
		return (
			<div
				key={intervalKey}
				{...props}
				onClick={() => setDayForm({ show: true, day: shiftDayStart(new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime()) })}
				className={`rct-dateHeader day-header-cell ${status}`}
				title={[
					timelineLabel([interval.startTime, interval.endTime], 'day', 200),
					statusText && `cały zakład: ${statusText}`,
					machineExceptions && 'są wyjątki maszyn'
				]
					.filter(Boolean)
					.join(' · ')
					.concat('\nKliknij: dzień pracujący / wolny')}>
				<span>{timelineLabel([interval.startTime, interval.endTime], 'day', interval.labelWidth)}</span>
				{machineExceptions && <span className="day-exception-dot" />}
			</div>
		);
	};

	return (
		<>
			<div className="d-flex flex-wrap align-items-center gap-2 mb-3 plan-toolbar">
				<Button size="sm" onClick={() => setForm({ show: true })}>
					+ Dodaj zlecenie
				</Button>
				<Button size="sm" variant="outline-danger" onClick={() => setBreakdownForm({ show: true, target: {} })}>
					Zgłoś awarię
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
				<ButtonGroup size="sm" aria-label="Przewijanie planu">
					<Button variant="outline-secondary" onClick={() => shift(-1)} aria-label="Wcześniej" title="Wcześniej (Shift + kółko myszy)">
						‹
					</Button>
					<Button variant="outline-secondary" onClick={goToday}>
						Dziś
					</Button>
					<Button variant="outline-secondary" onClick={() => shift(1)} aria-label="Później" title="Później (Shift + kółko myszy)">
						›
					</Button>
				</ButtonGroup>
				<Form.Check
					type="switch"
					id="showLineMachines"
					className="ms-1 small"
					label="Pokaż maszyny linii"
					checked={allLinesExpanded}
					onChange={(e) => setExpandedLines(e.target.checked ? new Set(state.lines.map((l) => l.id)) : new Set())}
				/>
				<div className="vr mx-1" />
				<InputGroup size="sm" className="plan-search">
					<Form.Control
						type="search"
						placeholder="Szukaj: stopień, projekt, zamówienie"
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
				{dropInfo ? (
					<span className="ms-auto drop-info">Wstawisz: {dropInfo}</span>
				) : (
					<small className="text-secondary ms-auto">
						<span className="legend-swatch non-working-item" /> czas wolny <span className="legend-swatch breakdown-swatch ms-2" /> awaria · kliknij dzień w nagłówku:
						pracujący / wolny
					</small>
				)}
			</div>

			<div
				ref={timelineRef}
				className="plan-timeline"
				onPointerDownCapture={(e) => {
					panBlocked.current = e.pointerType === 'mouse' && !(e.target as HTMLElement).closest('.rct-item');
				}}
				onPointerMoveCapture={(e) => {
					if (panBlocked.current && e.buttons !== 0) e.stopPropagation();
				}}
				onPointerUpCapture={() => {
					panBlocked.current = false;
				}}>
				<Timeline<PlanItem, PlanGroup>
					groups={groups}
					items={items}
					visibleTimeStart={range.start}
					visibleTimeEnd={range.end}
					onTimeChange={(start, end) => setRange({ start, end })}
					minZoom={12 * HOUR}
					maxZoom={90 * DAY}
					dragSnap={HOUR}
					sidebarWidth={210}
					lineHeight={ROW_HEIGHT}
					itemHeightRatio={0.8}
					canMove
					canChangeGroup
					canResize={false}
					selected={selectedId ? [selectedId] : []}
					onItemSelect={select}
					onItemClick={select}
					onItemDeselect={() => setSelectedId(undefined)}
					onCanvasDoubleClick={(groupId, time) =>
						visibleIds.has(String(groupId)) && setForm({ show: true, defaults: { machineId: String(groupId), start: nearestHourStart(time) } })
					}
					onCanvasContextMenu={(groupId, time, e) => (visibleIds.has(String(groupId)) ? openRowMenu(String(groupId), time, e) : e.preventDefault())}
					onItemContextMenu={(itemId, e, time) => {
						const id = String(itemId);
						const breakdown = id.startsWith(BREAKDOWN_PREFIX) ? state.breakdowns.find((b) => `${BREAKDOWN_PREFIX}${b.id}` === id) : undefined;
						const resourceId = breakdown?.machineId ?? state.blocks.find((b) => b.id === id)?.machineId;
						if (resourceId) openRowMenu(resourceId, time, e);
						else e.preventDefault();
					}}
					moveResizeValidator={(_action, _item, time) => nearestHourStart(time)}
					onItemDrag={(e) => {
						if (e.eventType !== 'move') return;
						const last = dragRef.current;
						const id = String(e.itemId);
						// nad nagłówkiem grupy zostajemy na ostatniej maszynie
						const machineId = resourceAtRow(e.newGroupOrder) ?? last?.machineId ?? state.blocks.find((b) => b.id === id)?.machineId;
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
							const machineId = resourceAtRow(groupOrder) ?? state.blocks.find((b) => b.id === id)?.machineId;
							if (machineId) moveBlock(String(id), time, machineId);
						}
					}}
					itemRenderer={renderItem}
					horizontalLineClassNamesForGroup={(group) => (group.header ? ['group-header-row'] : group.inLine ? ['line-machine-row'] : [])}
					groupRenderer={({ group }) => {
						if (group.header) {
							const kind = group.header.kind;
							return (
								<button
									type="button"
									className="group-header"
									aria-expanded={!group.header.collapsed}
									onClick={() => setCollapsed((c) => ({ ...c, [kind]: !c[kind] }))}>
									<span className="group-chevron">{group.header.collapsed ? '▸' : '▾'}</span>
									{group.title}
									<span className="text-secondary fw-normal ms-1">({group.header.count})</span>
								</button>
							);
						}
						if (group.line) {
							const line = group.line;
							const members = lineMachines(line, state.machines);
							const expanded = expandedLines.has(line.id);
							const down = members.filter((m) => ongoingByMachine.has(m.id));
							return (
								<div className="d-flex align-items-center justify-content-between gap-1">
									<button
										type="button"
										className="line-toggle text-truncate"
										aria-expanded={expanded}
										title={expanded ? 'Zwiń maszyny linii' : 'Pokaż maszyny linii'}
										onClick={() => toggleLine(line.id)}>
										<span className="group-chevron">{expanded ? '▾' : '▸'}</span>
										{group.title}
									</button>
									<span className="d-flex gap-1">
										{down.length > 0 && (
											<Badge bg="danger" pill title={`Awaria: ${down.map((m) => m.name).join(', ')}`}>
												!
											</Badge>
										)}
										<Badge bg="primary" pill title={`Linia: ${members.length} maszyny pracujące równolegle`}>
											{members.length}×
										</Badge>
										{members.length > 0 && members.every((m) => workMode(m) === 'continuous') && (
											<Badge bg="success" pill title="System 4-brygadowy">
												24/7
											</Badge>
										)}
									</span>
								</div>
							);
						}
						return (
							<div className={`d-flex align-items-center justify-content-between gap-1 ${group.inLine ? 'line-machine-label' : ''}`}>
								<span className="text-truncate" title={group.inLine ? `${group.title} · ${lineOfMachine(state.lines, group.id)?.name ?? ''}` : group.title}>
									{group.title}
								</span>
								<span className="d-flex gap-1">
									{ongoingByMachine.has(group.id) && (
										<Badge bg="danger" pill title="Trwa awaria">
											awaria
										</Badge>
									)}
									{!group.inLine && workMode(group.machine) === 'continuous' && (
										<Badge bg="success" pill title="System 4-brygadowy">
											24/7
										</Badge>
									)}
								</span>
							</div>
						);
					}}>
					<TimelineHeaders className="sticky">
						<SidebarHeader>{({ getRootProps }) => <div {...getRootProps()} className="timeline-sidebar-header">Linia / maszyna</div>}</SidebarHeader>
						{/* przy małym zakresie dni w nagłówku mają nazwę miesiąca, więc wiersz miesięcy jest zbędny */}
						{span > HOUR_HEADER_MAX_SPAN && <DateHeader unit="primaryHeader" labelFormat={timelineLabel} />}
						<DateHeader unit="day" intervalRenderer={renderDayInterval} />
						{span <= HOUR_HEADER_MAX_SPAN && <DateHeader unit="hour" labelFormat={timelineLabel} />}
					</TimelineHeaders>
					<TimelineMarkers>
						<TodayMarker />
					</TimelineMarkers>
				</Timeline>
			</div>

			{/* panel chowa się na czas przeciągania, żeby nie zasłaniał miejsca, w które przenosimy zlecenie */}
			<BlockDetailsPanel
				block={dragging ? undefined : selected}
				onEdit={(block) => setForm({ show: true, block })}
				onDelete={setToDelete}
				onShow={showBlock}
				onClose={() => setSelectedId(undefined)}
			/>
			{rowMenu && (
				<RowContextMenu
					target={rowMenu}
					onAddBlock={() => setForm({ show: true, defaults: { machineId: rowMenu.resourceId, start: rowMenu.hour } })}
					onReportBreakdown={(target) => setBreakdownForm({ show: true, target })}
					onOpenDay={() => setDayForm({ show: true, day: rowMenu.day })}
					onClose={closeRowMenu}
				/>
			)}
			<BlockFormModal show={form.show} block={form.block} defaults={form.defaults} onHide={() => setForm((f) => ({ ...f, show: false }))} />
			<BreakdownModal show={breakdownForm.show} target={breakdownForm.target} onHide={() => setBreakdownForm((f) => ({ ...f, show: false }))} />
			<DayCalendarModal show={dayForm.show} day={dayForm.day} onHide={() => setDayForm((f) => ({ ...f, show: false }))} />
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
