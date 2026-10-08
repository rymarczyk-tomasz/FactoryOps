import React, { CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'react-bootstrap';
import Timeline, {
	CustomHeader,
	CustomMarker,
	DateHeader,
	ReactCalendarTimelineProps,
	SidebarHeader,
	TimelineHeaders,
	TimelineItemBase,
	TimelineMarkers
} from 'react-calendar-timeline';
import 'react-calendar-timeline/style.css';
import './timeline.css';
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
import { addHours, dayKey, isWeekend, nearestHourStart, shiftDayStart } from '../domain/shifts';
import { Block, Breakdown, Id, Line, Machine } from '../domain/types';
import BlockDetailsPanel from './BlockDetailsPanel';
import BlockFormModal, { BlockFormDefaults } from './BlockFormModal';
import BreakdownModal, { BreakdownModalTarget } from './BreakdownModal';
import BlockHoverCard, { HoverAnchor } from './BlockHoverCard';
import ConfirmModal from './ConfirmModal';
import DayCalendarModal from './DayCalendarModal';
import PageHeader from './PageHeader';
import { loadByDay, removalImpact, totalPercent } from './planSelectors';
import { PlanNavigationState } from './planNavigation';
import { projectColor } from './projectColor';
import RowContextMenu, { RowMenuTarget } from './RowContextMenu';
import Segmented from './Segmented';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MINUTE = 60 * 1000;
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
/** Obciążenie w wierszu planu: tyle dób od bieżącej. */
const LOAD_DAYS = 7;
/** Jak długo podświetla się wiersz po kliknięciu awarii w menu bocznym (z wygaszaniem). */
const ROW_FLASH_MS = 1800;
/** Po ilu ms bez ruchu nad zleceniem pokazuje się karta podpowiedzi. */
const HOVER_DELAY = 400;

const COLOR_STRIPE_BASE = 'oklch(0.975 0.004 255)';
const tint = (color: string, percent: number) => `color-mix(in oklch, ${color} ${percent}%, white)`;

/**
 * Tło zlecenia: jasny odcień koloru projektu, a fragmenty przypadające na dni wolne maszyny (np. weekend między
 * piątkiem a poniedziałkiem) zakreskowane - zlecenie stoi, ale wciąż zajmuje maszynę.
 */
function blockBackground(color: string, start: number, end: number, offSegments: [number, number][]): string {
	const fill = tint(color, 14);
	if (offSegments.length === 0) return fill;
	const pct = (ms: number) => `${(((ms - start) / (end - start)) * 100).toFixed(3)}%`;
	// warstwa wierzchnia: wypełnienie z przezroczystymi "oknami", przez które widać paski spod spodu
	const stops = offSegments.flatMap(([from, to]) => [`${fill} ${pct(from)}`, `transparent ${pct(from)}`, `transparent ${pct(to)}`, `${fill} ${pct(to)}`]);
	const solid = `linear-gradient(to right, ${fill} 0%, ${stops.join(', ')}, ${fill} 100%)`;
	const stripes = `repeating-linear-gradient(-45deg, ${COLOR_STRIPE_BASE} 0 6px, ${tint(color, 10)} 6px 12px)`;
	return `${solid}, ${stripes}`;
}

/** Wykonana część zlecenia w toku - ciemniejszy odcień od początku do „teraz”. */
const progressLayer = (color: string, percent: number) => `linear-gradient(to right, ${tint(color, 34)} 0 ${percent}%, transparent ${percent}% 100%)`;

type ItemKind = 'block' | 'off' | 'breakdown' | 'lineDown' | 'drop';

/**
 * Element timeline: zlecenie albo awaria z wariantami opisu (renderer wybiera najdłuższy, który mieści się w kafelku).
 * `lineDown` - nakładka na wierszu linii: zamalowana część wysokości odpowiada części maszyn linii, które stoją.
 */
type PlanItem = TimelineItemBase<number> & {
	kind: ItemKind;
	labels?: string[];
	lineDown?: { down: number; units: number; labels: string[] };
};
/** Biblioteka nie eksportuje typu propsów renderera - bierzemy go z propa `itemRenderer`. */
type ItemRendererProps = Parameters<NonNullable<ReactCalendarTimelineProps<PlanItem>['itemRenderer']>>[0];

/** Przybliżona szerokość znaku przy 12px + odstępy wewnątrz kafelka. */
const CHAR_WIDTH = 6.8;
/** Napis awarii jest mniejszy (10.5px). */
const SMALL_CHAR_WIDTH = 6;
const LABEL_PADDING = 16;

/** Opis bloczka: operacja i numer projektu - nazwa projektu jest w podpowiedzi i panelu. */
function blockLabels(block: Block): string[] {
	return [`${block.operation} · ${block.projectNo}`, block.operation];
}

/**
 * Opis nigdy nie wychodzi poza kafelek - inaczej przy krótkich zleceniach obok siebie napis
 * zasłaniał sąsiada i kliknięcie trafiało w złe zlecenie. Za wąski kafelek zostaje bez napisu (dane w podpowiedzi).
 */
function renderItem({ item, itemContext, timelineContext, getItemProps }: ItemRendererProps) {
	const { key, ref, ...props } = getItemProps(item.itemProps ?? {});
	// część elementu przed lewą krawędzią widoku [px] - etykieta zaczyna się za nią, żeby nie gubiła początku
	const visibleLeft = timelineContext.getLeftOffsetFromDate(timelineContext.getTimelineState().visibleTimeStart);
	const hidden = Math.max(0, Math.min(itemContext.dimensions.width, visibleLeft - itemContext.dimensions.left));
	const width = itemContext.dimensions.width - hidden;
	const labelStyle = hidden > 0 ? { marginLeft: hidden } : undefined;
	const fitting = (labels: string[], charWidth: number) => labels.find((l) => l.length * charWidth + LABEL_PADDING <= width) ?? '';
	switch (item.kind) {
		case 'off':
		case 'drop':
			return <div {...props} ref={ref} key={key} />;
		case 'lineDown': {
			const { down, units, labels } = item.lineDown!;
			const label = fitting(labels, SMALL_CHAR_WIDTH);
			return (
				<div {...props} ref={ref} key={key}>
					<div className="row-fill line-down-fill" style={{ height: `${(down / units) * 100}%` }} />
					{label && (
						<span className="breakdown-label" style={labelStyle}>
							{label}
						</span>
					)}
				</div>
			);
		}
		case 'breakdown': {
			const label = item.labels ? fitting(item.labels, SMALL_CHAR_WIDTH) : '';
			return (
				<div {...props} ref={ref} key={key}>
					<div className="row-fill breakdown-fill">
						{label && (
							<span className="breakdown-label" style={labelStyle}>
								{label}
							</span>
						)}
					</div>
				</div>
			);
		}
		default: {
			const label = item.labels ? fitting(item.labels, CHAR_WIDTH) : itemContext.title;
			return (
				<div
					{...props}
					ref={ref}
					key={key}
					// biblioteka nie oznacza zaznaczenia klasą - ustawiamy ją sami
					className={itemContext.selected ? `${props.className} is-selected` : props.className}
					// bez natywnego dymka - plan pokazuje własną kartę podpowiedzi (szuka zlecenia po data-block-id)
					title={undefined}
					aria-label={item.itemProps?.['aria-label']}
					data-block-id={item.id}>
					<div className="plan-block-body">
						{label && (
							<span className="plan-block-label" style={labelStyle}>
								{label}
							</span>
						)}
					</div>
				</div>
			);
		}
	}
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
const ROW_HEIGHT = 40;
const LINE_MACHINE_ROW_HEIGHT = 32;
const ITEM_HEIGHT_RATIO = 0.72;
const SIDEBAR_WIDTH = 230;
const DAY_HEADER_HEIGHT = 48;
const HOUR_HEADER_HEIGHT = 24;
/** Szerokość podpisu „dziś · od 6:00” z odstępem [px] - gdy kreska „teraz” jest dalej, podpis mieści się przed nią. */
const TODAY_LABEL_WIDTH = 110;
const DAY_CELL_PADDING = 8;
/** Doba widoczna węziej niż tyle [px] nie ma podpisu - zostałby z niego skrawek. */
const DAY_CELL_MIN_VISIBLE = 56;
/** Przybliżone szerokości znaku daty (mono 13px i 12px) i podpisu nad nią (11px) - do dopasowania podpisu doby. */
const DATE_CHAR_WIDTH = 7.9;
const DATE_CHAR_WIDTH_SMALL = 7.3;
const SUB_CHAR_WIDTH = 6;

/** Odstęp między bloczkiem a krawędzią wiersza - tło (czas wolny, awaria) rozciągamy o niego na całą wysokość. */
/** Miejsce na nazwę i opis w wierszu sidebaru [px] (bez kropki i obciążenia) i przybliżone szerokości znaków. */
const ROW_TEXT_WIDTH = 112;
const NAME_CHAR_WIDTH = 7.9;
const META_CHAR_WIDTH = 5.6;
/** Opis (np. „pon–pt”) tylko obok pełnej nazwy - inaczej zostałby z niego ucięty skrawek, a nazwa skróciłaby się bez potrzeby. */
const metaFits = (name: string, meta: string) => name.length * NAME_CHAR_WIDTH + 8 + meta.length * META_CHAR_WIDTH <= ROW_TEXT_WIDTH;

const rowGapStyle = (rowHeight: number): CSSProperties => ({ '--row-gap': `${(rowHeight * (1 - ITEM_HEIGHT_RATIO)) / 2}px` }) as CSSProperties;

// treść zostaje po zamknięciu, żeby modal nie zmieniał się w trakcie animacji zamykania
type FormState = { show: boolean; block?: Block; defaults?: BlockFormDefaults };
type BreakdownFormState = { show: boolean; target?: BreakdownModalTarget };
type DayFormState = { show: boolean; day?: number };

/** Bloczek w trakcie przeciągania: docelowa maszyna i początek przyciągnięty do pełnej godziny. */
type DragState = { id: Id; machineId: Id; start: number };

/** Widoczny zakres planu. Ułamek `lead` to część zakresu przed „teraz”. */
const ZOOMS = [
	{ label: 'Dzień', span: DAY, lead: 0.2, header: '1 doba' },
	{ label: 'Tydzień', span: 7 * DAY, lead: 1 / 7, header: '7 dni' },
	{ label: 'Miesiąc', span: 30 * DAY, lead: 0.1, header: '30 dni' }
];
/** Godziny w nagłówku tylko przy małym zakresie - przy tygodniu byłyby nieczytelne. */
const HOUR_HEADER_MAX_SPAN = 3 * DAY;
type Range = { start: number; end: number };
const rangeAround = (time: number, span: number, lead: number): Range => ({ start: time - span * lead, end: time + span * (1 - lead) });

function matchesQuery(block: Block, query: string): boolean {
	const q = query.trim().toLowerCase();
	return [block.orderNo, block.projectNo, block.project, block.operation].some((field) => field.toLowerCase().includes(q));
}

const pad = (n: number) => String(n).padStart(2, '0');
const weekdayFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short' });
const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const weekday = (ms: number) => weekdayFormat.format(ms).replace('.', '');

/** Zakres w pasku górnym: „07–14.10.2026”, „28.09–05.10.2026” albo „08.10.2026”. */
function rangeLabel({ start, end }: Range): string {
	const from = new Date(start);
	const to = new Date(end - 1);
	const full = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
	if (from.toDateString() === to.toDateString()) return full(from);
	if (from.getFullYear() !== to.getFullYear()) return `${full(from)}–${full(to)}`;
	if (from.getMonth() === to.getMonth()) return `${pad(from.getDate())}–${full(to)}`;
	return `${pad(from.getDate())}.${pad(from.getMonth() + 1)}–${full(to)}`;
}

/** Pole tekstowe, w którym pisze użytkownik - wtedy skróty klawiszowe planu nie działają. */
const isTyping = (target: EventTarget | null) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** Bieżąca minuta - dla kreski „teraz” i godziny na niej. */
function useMinuteClock(): number {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), MINUTE);
		return () => clearInterval(timer);
	}, []);
	return now;
}

const FactoryOpsTimeline = () => {
	const { state, now, moveBlock, deleteBlock } = usePlan();
	const clock = useMinuteClock();
	const [selectedId, setSelectedId] = useState<Id>();
	const [form, setForm] = useState<FormState>({ show: false });
	const [breakdownForm, setBreakdownForm] = useState<BreakdownFormState>({ show: false });
	const [dayForm, setDayForm] = useState<DayFormState>({ show: false });
	const [toDelete, setToDelete] = useState<Block>();
	// liczone raz przy otwarciu potwierdzenia - przeliczenie planu bez zlecenia
	const deleteImpact = useMemo(() => (toDelete ? removalImpact(state, toDelete.id, now) : []), [toDelete]); // eslint-disable-line react-hooks/exhaustive-deps
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
	const [matchIndex, setMatchIndex] = useState(0);
	/** Zlecenia przekazane z listy („Pokaż na planie” przy kilku zaznaczonych) - wyróżnione jak wyniki wyszukiwania. */
	const [listPick, setListPick] = useState<Id[]>([]);
	/** Wiersz, do którego przewinąć plan w pionie, gdy już będzie widoczny (po rozwinięciu grupy lub linii). */
	const [scrollToRow, setScrollToRow] = useState<Id>();
	/** Wiersz chwilowo podświetlony - żeby było widać, gdzie przeniosło kliknięcie awarii. */
	const [flashRow, setFlashRow] = useState<Id>();
	/** Karta podpowiedzi zlecenia - pokazuje się po chwili bez ruchu nad zleceniem, znika przy kliknięciu i przeciąganiu. */
	const [hover, setHover] = useState<{ id: Id; anchor: HoverAnchor }>();
	const hoverTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
	const hoverTarget = useRef<Id>(undefined);
	const hideHover = useCallback(() => {
		clearTimeout(hoverTimer.current);
		hoverTarget.current = undefined;
		setHover(undefined);
	}, []);
	const trackHover = (e: React.MouseEvent) => {
		const element = (e.target as Element).closest<HTMLElement>('[data-block-id]');
		const id = element?.dataset.blockId;
		if (id === hoverTarget.current) return;
		hideHover();
		if (!element || !id || e.buttons !== 0) return;
		hoverTarget.current = id;
		const x = e.clientX;
		hoverTimer.current = setTimeout(() => {
			const rect = element.getBoundingClientRect();
			setHover({ id, anchor: { x, top: rect.top, bottom: rect.bottom } });
		}, HOVER_DELAY);
	};
	useEffect(() => () => clearTimeout(hoverTimer.current), []);
	const searchRef = useRef<HTMLInputElement>(null);
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
	// prawy przycisk otwiera tylko menu - bez zmiany zaznaczenia (otwarty panel zwęziłby plan i przesunął wiersz pod menu)
	const rightPress = useRef(false);
	const select = (id: Id) => !rightPress.current && !isHelperItem(id) && setSelectedId(String(id));

	// panel zlecenia zwęża plan - biblioteka przelicza szerokość tylko przy zmianie rozmiaru okna
	const panelOpen = selected !== undefined;
	useLayoutEffect(() => {
		window.dispatchEvent(new Event('resize'));
	}, [panelOpen]);

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

	// polecenia z innych widoków: klik w kartę awarii w menu bocznym (odsłonięcie maszyny, początek awarii w lewej
	// części widoku, chwilowe podświetlenie wiersza) albo „Pokaż na planie” na liście (zaznaczenie zlecenia).
	// Stan nawigacji czyścimy od razu - inaczej cofnięcie i odświeżenie strony przewijałyby plan jeszcze raz.
	const location = useLocation();
	const navigate = useNavigate();
	const command = location.state as PlanNavigationState | null;
	useEffect(() => {
		if (!command?.revealBreakdown && !command?.showBlock && !command?.showBlocks) return;
		const breakdown = command.revealBreakdown && state.breakdowns.find((b) => b.id === command.revealBreakdown);
		const picked = command.showBlocks ? state.blocks.filter((b) => command.showBlocks!.includes(b.id)).sort((a, b) => a.start - b.start) : [];
		if (picked.length > 0) {
			setQuery('');
			setListPick(picked.map((b) => b.id));
			setMatchIndex(0);
		}
		const block = (command.showBlock && state.blocks.find((b) => b.id === command.showBlock)) || picked[0];
		const rowId = breakdown ? breakdown.machineId : block ? block.machineId : undefined;
		if (breakdown) {
			reveal(breakdown.machineId);
			setRange(rangeAround(breakdown.start, span, 0.25));
			setFlashRow(breakdown.machineId);
		}
		if (block) {
			setSelectedId(block.id);
			showBlock(block);
		}
		if (rowId) setScrollToRow(rowId);
		navigate(location.pathname, { replace: true, state: null });
		// reagujemy tylko na nowe polecenie z nawigacji
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [command?.revealBreakdown, command?.showBlock, command?.showBlocks, location.key]);

	useEffect(() => {
		if (!flashRow) return;
		const timer = setTimeout(() => setFlashRow(undefined), ROW_FLASH_MS);
		return () => clearTimeout(timer);
	}, [flashRow]);

	// --- wyszukiwanie ---
	const picking = !query.trim() && listPick.length > 0;
	const matches = useMemo(() => {
		if (query.trim()) return state.blocks.filter((b) => matchesQuery(b, query)).sort((a, b) => a.start - b.start);
		const picked = new Set(listPick);
		return state.blocks.filter((b) => picked.has(b.id)).sort((a, b) => a.start - b.start);
	}, [state.blocks, query, listPick]);
	const matchIds = useMemo(() => new Set(matches.map((b) => b.id)), [matches]);
	const jumpToMatch = (index: number) => {
		if (matches.length === 0) return;
		const wrapped = (index + matches.length) % matches.length;
		setMatchIndex(wrapped);
		setSelectedId(matches[wrapped].id);
		showBlock(matches[wrapped]);
	};

	// skróty: „/” - wyszukiwarka, Esc - zamyka kartę podpowiedzi, a bez niej panel zlecenia (gdy nie ma otwartego okna)
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			// okno lub menu prawego kliku obsługują klawisze same
			if (isTyping(e.target) || document.querySelector('.modal.show, .row-menu')) return;
			if (e.key === 'Escape' && document.querySelector('.hover-card')) {
				hideHover();
				return;
			}
			if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
				e.preventDefault();
				// wyróżnienie zleceń z listy ustępuje wyszukiwaniu - pole pojawia się po przerysowaniu
				setListPick([]);
				requestAnimationFrame(() => {
					searchRef.current?.focus();
					searchRef.current?.select();
				});
			} else if (e.key === 'Escape') setSelectedId(undefined);
		};
		document.addEventListener('keydown', onKey);
		return () => document.removeEventListener('keydown', onKey);
	}, [hideHover]);

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
	const rowHeights = useMemo(() => new Map(groups.map((g) => [g.id, g.height ?? ROW_HEIGHT])), [groups]);
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

	// obciążenie każdego zasobu w najbliższych dobach (od 6:00 bieżącej) - mini-pasek w wierszu planu
	const loadByResource = useMemo(() => {
		const days = loadByDay(state, now, shiftDayStart(now), LOAD_DAYS);
		return new Map([...days].map(([id, loads]) => [id, totalPercent(loads)]));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.blocks, state.lines, state.machines, state.calendar, state.breakdowns, now]);

	const windowFrom = Math.floor((range.start - span / 2) / WINDOW_STEP) * WINDOW_STEP;
	const windowTo = Math.ceil((range.end + span / 2) / WINDOW_STEP) * WINDOW_STEP;

	// tło zależy tylko od kalendarzy i widocznego zakresu - nie przeliczamy go przy każdym przesunięciu zlecenia
	const offItems = useMemo<PlanItem[]>(() => {
		const calendars = calendarLookup(state);
		return [...visibleIds].flatMap((id) =>
			nonWorkingPeriods(calendars(id), windowFrom, windowTo).map(([start, end]) => ({
				id: `${OFF_PREFIX}${id}:${start}`,
				kind: 'off' as const,
				group: id,
				title: '',
				start_time: start,
				end_time: end,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: 'non-working-item',
				itemProps: { style: rowGapStyle(rowHeights.get(id) ?? ROW_HEIGHT) }
			}))
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.calendar, state.machines, state.lines, visibleIds, rowHeights, windowFrom, windowTo]);

	// awaria maszyny to czerwony pasek w jej wierszu; na wierszu linii - nakładka pokazująca, ile maszyn stoi
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
				kind: 'breakdown',
				group: breakdown.machineId,
				title: tooltip,
				labels: ongoing ? ['Awaria · trwa', 'Awaria', '!'] : ['Awaria', '!'],
				start_time: breakdown.start,
				end_time: end,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: ongoing ? 'breakdown-item ongoing' : 'breakdown-item',
				itemProps: { title: tooltip, style: rowGapStyle(rowHeights.get(breakdown.machineId) ?? ROW_HEIGHT) }
			};
		});
		const onLines = state.lines.flatMap((line) =>
			lineDownSegments(line, state.breakdowns, now).map(({ start, end, machineIds }): PlanItem => {
				const names = machineIds.map((id) => machineNames.get(id) ?? '').join(', ');
				return {
					id: `${LINE_DOWN_PREFIX}${line.id}:${start}`,
					kind: 'lineDown',
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
	}, [state.breakdowns, state.machines, state.lines, rowHeights, now]);

	const draggedId = drag?.id;
	const searching = query.trim() !== '' || listPick.length > 0;
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
			const status = blockStatus(block, now);
			const progress = status === 'in_progress' ? Math.min(100, ((now - block.start) / (block.end - block.start)) * 100) : 0;
			const classes = [
				'plan-block',
				status === 'done' && 'is-done',
				block.id === draggedId && 'dragging-block',
				searching && (matchIds.has(block.id) ? 'search-match' : 'dimmed')
			].filter(Boolean);
			return {
				id: block.id,
				kind: 'block',
				group: block.machineId,
				title: blockLabels(block)[0],
				labels: blockLabels(block),
				start_time: block.start,
				end_time: block.end,
				canMove: true,
				// długość wynika z godzin w zamówieniu - zmienia się ją w formularzu, nie myszką
				canResize: false,
				canChangeGroup: true,
				className: classes.join(' '),
				itemProps: {
					// opis dla czytników ekranu (getItemProps go nie przekazuje - ustawia go renderItem)
					'aria-label': tooltip,
					onDoubleClick: () => setForm({ show: true, block }),
					style: {
						'--c': color,
						'--block-bg': progress > 0 ? `${progressLayer(color, progress)}, ${background}` : background
					} as CSSProperties
				}
			};
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.blocks, blockLooks, now, draggedId, selectedId, searching, matchIds, windowFrom, windowTo, visibleIds]);

	// gdzie wyląduje przenoszony bloczek - opis w stopce, żeby nie zasłaniał zleceń na planie
	const dropInfo = preview && {
		resource: resourceName(state, drag?.machineId),
		start: formatDateTime(preview.start),
		after: preview.after && { label: preview.pinned ? 'przerwa po' : 'po', orderNo: preview.after.orderNo },
		before: preview.before?.orderNo
	};

	// kreska w miejscu, gdzie faktycznie wyląduje przenoszony bloczek (po zepchnięciu kolejki)
	const indicatorItems = useMemo<PlanItem[]>(() => {
		if (!drag || !preview) return [];
		return [
			{
				// nowe id przy każdej zmianie: w trakcie przeciągania biblioteka nie przelicza położenia istniejących elementów
				id: `${DROP_INDICATOR_PREFIX}${drag.machineId}:${preview.start}`,
				kind: 'drop',
				group: drag.machineId,
				title: '',
				start_time: preview.start,
				end_time: preview.start + 60_000,
				canMove: false,
				canResize: false,
				canChangeGroup: false,
				className: 'drop-indicator',
				itemProps: { style: rowGapStyle(rowHeights.get(drag.machineId) ?? ROW_HEIGHT) }
			}
		];
	}, [drag, preview, rowHeights]);

	// elementy zwiniętych wierszy nie trafiają do biblioteki
	const items = useMemo(
		() => [...offItems, ...blockItems, ...breakdownItems, ...indicatorItems].filter((item) => visibleIds.has(String(item.group))),
		[offItems, blockItems, breakdownItems, indicatorItems, visibleIds]
	);

	const ongoingByMachine = useMemo(() => new Set(state.breakdowns.filter(isOngoing).map((b) => b.machineId)), [state.breakdowns]);

	/** Granice dób zakładu (6:00) w zakresie rysowanym przez bibliotekę - kolumny nagłówka i linie siatki. */
	const dayStarts = useMemo(() => {
		const starts: number[] = [];
		for (let day = shiftDayStart(windowFrom); day < windowTo; day = addHours(day, 24)) starts.push(day);
		return starts;
	}, [windowFrom, windowTo]);

	const machineExceptionDays = useMemo(() => new Set(state.machines.flatMap((m) => Object.keys(m.overrides ?? {}))), [state.machines]);

	/** Komórka doby w nagłówku: kliknięcie otwiera kalendarz dnia; podpis pokazuje dziś, dzień wolny lub wyjątek zakładu. */
	const renderDayCell = (day: number, left: number, width: number, visibleLeft: number, nowX?: number) => {
		const date = new Date(day);
		const key = dayKey(date);
		const plant = state.calendar.overrides[key];
		const today = day === shiftDayStart(clock);
		const off = plant === false || (plant === undefined && isWeekend(date));
		const sub = today
			? 'dziś · od 6:00'
			: plant === true
				? 'pracujący'
				: plant === false
					? 'wolne · zakład'
					: plant !== undefined
						? formatWorkingHours(plant)
						: off
							? 'wolne pon–pt'
							: '';
		const label = `${weekday(day)} ${date.getDate()}.${date.getMonth() + 1}`;
		// podpis dzisiejszej doby nie może wchodzić pod godzinę na kresce „teraz” - stoi za nią, chyba że mieści się przed
		const nowOffset = today && nowX !== undefined ? nowX - left : undefined;
		const todayPadding = nowOffset !== undefined && nowOffset < TODAY_LABEL_WIDTH ? Math.max(36, nowOffset + 30) : 0;
		// doba zaczęta przed lewą krawędzią widoku: podpis od krawędzi, a gdy widać tylko skrawek - bez podpisu
		const hiddenPart = Math.max(0, visibleLeft - left);
		const paddingLeft = Math.max(DAY_CELL_PADDING, todayPadding, hiddenPart + DAY_CELL_PADDING);
		const room = width - paddingLeft;
		const showLabel = width - hiddenPart >= DAY_CELL_MIN_VISIBLE;
		// za mało miejsca: najpierw znika podpis nad datą, potem data maleje do 12px, na końcu zostaje „8.10”
		const shortLabel = `${date.getDate()}.${date.getMonth() + 1}`;
		const dateMode =
			label.length * DATE_CHAR_WIDTH <= room
				? 'full'
				: label.length * DATE_CHAR_WIDTH_SMALL <= room
					? 'compact'
					: shortLabel.length * DATE_CHAR_WIDTH_SMALL <= room
						? 'short'
						: room >= 14
							? 'day'
							: 'none';
		const subFits = (text: string) => text.length * SUB_CHAR_WIDTH <= room;
		const subText = dateMode !== 'full' || !sub ? '' : subFits(sub) ? sub : today && subFits('dziś') ? 'dziś' : '';
		const dateText = dateMode === 'short' ? shortLabel : dateMode === 'day' ? String(date.getDate()) : label;
		const classes = ['day-cell', today && 'is-today', off && 'is-off', plant !== undefined && plant !== false && plant !== true && 'is-hours', plant === true && 'is-working'];
		return (
			<button
				type="button"
				key={day}
				className={classes.filter(Boolean).join(' ')}
				style={{ left, width, paddingLeft }}
				onClick={() => setDayForm({ show: true, day })}
				title={[label, sub, machineExceptionDays.has(key) && 'są wyjątki maszyn', 'Kliknij: dzień pracujący / wolny'].filter(Boolean).join(' · ')}>
				{showLabel && dateMode !== 'none' && (
					<>
						{subText && <span className="day-cell-sub">{subText}</span>}
						<span className={`day-cell-date ${dateMode === 'full' ? '' : 'is-small'}`}>{dateText}</span>
					</>
				)}
				{machineExceptionDays.has(key) && <span className="day-exception-dot" />}
			</button>
		);
	};

	const zoomLabel = activeZoom?.header ?? `${Math.round(span / DAY)} dni`;

	return (
		<>
			<PageHeader
				title="Plan"
				context={rangeLabel(range)}
				tools={
					<>
						<Segmented
							className="ms-2"
							label="Zakres planu"
							value={activeZoom}
							onChange={(zoom) => zoom && zoomTo(zoom)}
							options={ZOOMS.map((zoom) => ({ value: zoom, label: zoom.label }))}
						/>
						<div className="d-flex gap-1" role="group" aria-label="Przewijanie planu">
							<button type="button" className="icon-button" onClick={() => shift(-1)} aria-label="Wcześniej" title="Wcześniej (Shift + kółko myszy)">
								‹
							</button>
							<button type="button" className="icon-button px-2" onClick={goToday}>
								Dziś
							</button>
							<button type="button" className="icon-button" onClick={() => shift(1)} aria-label="Później" title="Później (Shift + kółko myszy)">
								›
							</button>
						</div>
					</>
				}>
				<div className="search-field plan-search">
					{picking ? (
						<span className="pick-label" title="Zlecenia zaznaczone na liście - strzałki przechodzą między nimi">
							{listPick.length} wybranych z listy
						</span>
					) : (
						<input
							ref={searchRef}
							type="search"
							placeholder="Szukaj zlecenia, projektu…"
							aria-label="Szukaj zleceń"
							value={query}
							onChange={(e) => {
								setQuery(e.target.value);
								setListPick([]);
								setMatchIndex(0);
							}}
							onKeyDown={(e) => {
								if (e.key === 'Enter') jumpToMatch(e.shiftKey ? matchIndex - 1 : searching && selectedId === matches[matchIndex]?.id ? matchIndex + 1 : matchIndex);
								if (e.key === 'Escape') {
									setQuery('');
									e.currentTarget.blur();
								}
							}}
						/>
					)}
					{searching ? (
						<>
							<span className="search-count mono">{matches.length ? `${matchIndex + 1}/${matches.length}` : 'brak'}</span>
							<button type="button" className="search-step" disabled={!matches.length} onClick={() => jumpToMatch(matchIndex - 1)} aria-label="Poprzednie">
								‹
							</button>
							<button type="button" className="search-step" disabled={!matches.length} onClick={() => jumpToMatch(matchIndex + 1)} aria-label="Następne">
								›
							</button>
							{picking && (
								<button type="button" className="search-step" onClick={() => setListPick([])} aria-label="Zakończ wyróżnianie zleceń z listy" title="Zakończ">
									×
								</button>
							)}
						</>
					) : (
						<span className="kbd-hint" aria-hidden="true">
							/
						</span>
					)}
				</div>
				<Button variant="outline-danger" onClick={() => setBreakdownForm({ show: true, target: {} })}>
					Zgłoś awarię
				</Button>
				<Button onClick={() => setForm({ show: true })}>Nowe zlecenie</Button>
			</PageHeader>

			<div className="plan-layout">
				<div className="plan-main" onMouseOver={trackHover} onMouseLeave={hideHover} onMouseDownCapture={hideHover} onWheelCapture={hideHover}>
					<div
						ref={timelineRef}
						className={`plan-timeline ${span > HOUR_HEADER_MAX_SPAN ? 'zoom-wide' : 'zoom-hours'}`}
						onPointerDownCapture={(e) => {
							rightPress.current = e.button === 2;
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
							sidebarWidth={SIDEBAR_WIDTH}
							lineHeight={ROW_HEIGHT}
							itemHeightRatio={ITEM_HEIGHT_RATIO}
							canMove
							canChangeGroup
							canResize={false}
							selected={selectedId ? [selectedId] : []}
							onItemSelect={select}
							onItemClick={select}
							onItemDeselect={() => !rightPress.current && setSelectedId(undefined)}
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
							horizontalLineClassNamesForGroup={(group) =>
								[group.header ? 'group-header-row' : group.inLine ? 'line-machine-row' : '', group.id === flashRow ? 'row-flash' : ''].filter(Boolean)
							}
							groupRenderer={({ group }) => {
								const flash = group.id === flashRow ? ' row-flash' : '';
								if (group.header) {
									const kind = group.header.kind;
									return (
										<button
											type="button"
											className="row-label group-header"
											aria-expanded={!group.header.collapsed}
											onClick={() => setCollapsed((c) => ({ ...c, [kind]: !c[kind] }))}>
											<span className="group-chevron">{group.header.collapsed ? '▸' : '▾'}</span>
											<span className="group-title">{group.title}</span>
											<span className="group-count mono">{group.header.count}</span>
										</button>
									);
								}
								const load = loadByResource.get(group.id);
								const loadBar = (
									<span className="row-load" title={load === undefined ? 'Brak czasu pracy w najbliższych dobach' : `Obciążenie ${LOAD_DAYS} dni od dziś 6:00`}>
										<span className="row-load-bar">
											<span style={{ width: `${load ?? 0}%` }} />
										</span>
										<span className="row-load-value mono">{load === undefined ? '—' : `${load}%`}</span>
									</span>
								);
								if (group.line) {
									const line = group.line;
									const members = lineMachines(line, state.machines);
									const expanded = expandedLines.has(line.id);
									const down = members.filter((m) => ongoingByMachine.has(m.id));
									const continuous = members.length > 0 && members.every((m) => workMode(m) === 'continuous');
									return (
										<div className={`row-label${flash}`} title={down.length ? `Awaria: ${down.map((m) => m.name).join(', ')}` : undefined}>
											<button
												type="button"
												className="row-toggle"
												aria-expanded={expanded}
												title={expanded ? 'Zwiń maszyny linii' : 'Pokaż maszyny linii'}
												onClick={() => toggleLine(line.id)}>
												{expanded ? '▾' : '▸'}
											</button>
											<span className={`status-dot ${down.length ? 'danger' : ''}`} />
											<span className="row-name mono">{group.title}</span>
											<span className="row-meta">
												{members.length}×{continuous ? ' · 24/7' : ''}
											</span>
											{loadBar}
										</div>
									);
								}
								const meta = workMode(group.machine) === 'continuous' ? '24/7' : 'pon–pt';
								return (
									<div
										className={`row-label${group.inLine ? ' in-line' : ''}${flash}`}
										title={group.inLine ? `${group.title} · ${lineOfMachine(state.lines, group.id)?.name ?? ''}` : `${group.title} · ${meta}`}>
										<span className={`status-dot ${ongoingByMachine.has(group.id) ? 'danger' : ''}`} />
										<span className="row-name mono">{group.title}</span>
										{!group.inLine && metaFits(group.title, meta) && <span className="row-meta">{meta}</span>}
										{loadBar}
									</div>
								);
							}}>
							<TimelineHeaders className="plan-headers">
								<SidebarHeader>
									{({ getRootProps }) => (
										<div {...getRootProps()} className="plan-sidebar-header">
											{state.lines.length > 0 && (
												<button
													type="button"
													className="sidebar-link"
													onClick={() => setExpandedLines(allLinesExpanded ? new Set() : new Set(state.lines.map((l) => l.id)))}>
													{allLinesExpanded ? 'Zwiń maszyny linii' : 'Pokaż maszyny linii'}
												</button>
											)}
											<span className="plan-sidebar-labels">
												<span>Zasób</span>
												<span>{zoomLabel}</span>
											</span>
										</div>
									)}
								</SidebarHeader>
								<CustomHeader unit="day" height={DAY_HEADER_HEIGHT}>
									{({ headerContext: { intervals }, getRootProps }) => {
										// pozycja chwili w px - liniowo w obrębie doby kalendarzowej biblioteki (zmiana czasu przesuwa tylko jej dobę)
										const x = (time: number) => {
											const interval = intervals.find((i) => i.startTime.valueOf() <= time && time < i.endTime.valueOf());
											if (!interval) return undefined;
											const from = interval.startTime.valueOf();
											return interval.left + ((time - from) / (interval.endTime.valueOf() - from)) * interval.labelWidth;
										};
										const nowX = x(clock);
										const visibleLeft = x(range.start) ?? 0;
										return (
											<div {...getRootProps()} className="plan-day-header">
												{dayStarts.map((day) => {
													const left = x(day);
													const right = x(addHours(day, 24));
													return left === undefined || right === undefined ? null : renderDayCell(day, left, right - left, visibleLeft, nowX);
												})}
												{nowX !== undefined && (
													<>
														<span className="now-chip mono" style={{ left: nowX }}>
															{timeFormat.format(clock)}
														</span>
														<span className="now-header-line" style={{ left: nowX }} />
													</>
												)}
											</div>
										);
									}}
								</CustomHeader>
								{span <= HOUR_HEADER_MAX_SPAN && <DateHeader unit="hour" height={HOUR_HEADER_HEIGHT} labelFormat={timelineLabel} />}
							</TimelineHeaders>
							<TimelineMarkers>
								{dayStarts.map((day) => (
									<CustomMarker key={day} date={day}>
										{({ styles }) => <div style={styles} className="day-boundary" />}
									</CustomMarker>
								))}
								<CustomMarker date={clock}>{({ styles }) => <div style={styles} className="now-line" />}</CustomMarker>
							</TimelineMarkers>
						</Timeline>
					</div>

					<footer className={`plan-footer ${dropInfo ? 'is-dropping' : ''}`}>
						{dropInfo ? (
							<span className="drop-info">
								<span className="drop-info-bar" />
								<span>
									<strong>Wstawisz:</strong> {dropInfo.resource} · {dropInfo.start}
									{dropInfo.after && (
										<>
											{' '}
											· {dropInfo.after.label} <span className="mono">{dropInfo.after.orderNo}</span>
										</>
									)}
									{dropInfo.before && (
										<>
											{' '}
											· przed <span className="mono">{dropInfo.before}</span>
										</>
									)}
								</span>
							</span>
						) : (
							<>
								<span className="legend-item">
									<span className="legend-swatch swatch-progress" /> w toku
								</span>
								<span className="legend-item">
									<span className="legend-swatch swatch-off" /> wolne
								</span>
								<span className="legend-item">
									<span className="legend-swatch swatch-breakdown" /> awaria
								</span>
								<span className="legend-hints mono">
									<span>dwuklik · nowe zlecenie</span>
									<span>prawy klik · awaria / dzień</span>
									<span>klik w dzień · kalendarz</span>
									<span>/ · szukaj</span>
									<span>Ctrl+Z · cofnij</span>
								</span>
							</>
						)}
					</footer>
				</div>

				{selected && (
					<BlockDetailsPanel
						block={selected}
						onSelect={setSelectedId}
						onEdit={(block) => setForm({ show: true, block })}
						onDelete={setToDelete}
						onShow={showBlock}
						onClose={() => setSelectedId(undefined)}
					/>
				)}
			</div>

			{hover && !dragging && !rowMenu && state.blocks.some((b) => b.id === hover.id) && (
				<BlockHoverCard block={state.blocks.find((b) => b.id === hover.id)!} anchor={hover.anchor} />
			)}
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
				undoable
				impact={
					toDelete &&
					(deleteImpact.length ? deleteImpact.map((line) => <div key={line}>{line}</div>) : 'Kolejne zlecenia nie przesuną się - nie ma ich albo mają terminy')
				}
				onConfirm={() => {
					if (!toDelete) return;
					deleteBlock(toDelete.id);
					if (toDelete.id === selectedId) setSelectedId(undefined);
				}}
				onHide={() => setToDelete(undefined)}>
				{toDelete && (
					<>
						Zlecenie <strong className="mono fw-medium">{toDelete.orderNo}</strong> ({toDelete.operation}) zostanie usunięte z planu. Następne zlecenia na
						maszynie cofną się na jego miejsce.
					</>
				)}
			</ConfirmModal>
		</>
	);
};

export default FactoryOpsTimeline;
