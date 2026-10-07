import { archiveOld } from '../domain/archive';
import { capacityLookup } from '../domain/calendar';
import { reflow } from '../domain/schedule';
import { addHours, endAfterWork, firstProductiveHourFrom, hourStartAtOrBefore, shiftDayStart } from '../domain/shifts';
import { Block, Breakdown, Line, Machine, PlanState, Programmer } from '../domain/types';

/** Linie produkcyjne: po 3 jednakowe maszyny, system 4-brygadowy (24/7). Zlecenia idą na całą linię. */
const LINE_COUNT = 8;
const LINE_UNITS = 3;
/** Linia z 5 maszynami, na której każde zlecenie idzie na inną maszynę. */
const SPLIT_LINE_UNITS = 5;

/** Pojedyncze maszyny pracujące pon-pt. */
const MACHINE_NAMES = [
	'HSTM 301',
	'HSTM 302',
	'HSTM 303',
	'HSTM 305',
	'HSTM 306',
	'HSTM 308',
	'HSTM 502',
	'HSTM 505',
	'HSTM 508',
	'DMU 65',
	'DMU 85',
	'DMU 125',
	'DMU 160',
	'DMU 210',
	'CTX 510',
	'CTX 800',
	'CTX 1250',
	'CTX beta 2000',
	'Mazak Integrex i-200',
	'Mazak Integrex i-400',
	'Mazak QTN 350',
	'Okuma MU-5000V',
	'Okuma MU-8000V',
	'Okuma LB3000',
	'Haas VF-2',
	'Haas VF-4',
	'Haas ST-30',
	'Hermle C42',
	'Hermle C52',
	'Doosan Puma 2600',
	'Doosan DNM 5700'
];

const PROGRAMMERS: Omit<Programmer, 'id'>[] = [
	{ name: 'Jan', surname: 'Kowalski' },
	{ name: 'Anna', surname: 'Nowak' },
	{ name: 'Piotr', surname: 'Wiśniewski' },
	{ name: 'Katarzyna', surname: 'Wójcik' }
];

const PROJECTS = [
	{ no: 'IMR-6000', name: 'Huanyon' },
	{ no: 'IMR-6001', name: 'Manzanillo' },
	{ no: 'IMR-6002', name: 'Kosovo' },
	{ no: 'IMR-6003', name: 'Bergen' },
	{ no: 'IMR-6004', name: 'Rotterdam' },
	{ no: 'IMR-6005', name: 'Gdańsk Port' }
];
const OPERATIONS = ['Stopień 1', 'Stopień 2', 'Stopień 3', 'Wirnik', 'Korpus', 'Wał', 'Pokrywa'];
/** Godziny pracy jednej maszyny z przewodnika: od 30 do 120 h (na linii dzielą się między jej maszyny). */
const MIN_HOURS = 30;
const MAX_HOURS = 120;
/** Zabezpieczenie przed nieskończoną pętlą, gdyby kolejka nie rosła. */
const MAX_ORDERS_PER_QUEUE = 2000;
/** Ile dni historii generujemy - część trafia do archiwum (starsza niż 30 dni). */
const HISTORY_DAYS = 60;
/** Do końca którego roku generujemy zlecenia. */
const PLAN_UNTIL_YEAR = 2027;

/** Deterministyczny generator, żeby demo zawsze wyglądało tak samo. */
function random(seed: number) {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function createSeedState(now: number): PlanState {
	const rnd = random(2026);
	const pick = <T>(list: T[]) => list[Math.floor(rnd() * list.length)];
	const calendar = { overrides: {} };

	const machines: Machine[] = [];
	const lines: Line[] = [];
	const addLine = (index: number, units: number) => {
		const members = Array.from({ length: units }, (_, unit): Machine => ({ id: `l${index}m${unit + 1}`, name: `L${index}-M${unit + 1}`, workMode: 'continuous' }));
		machines.push(...members);
		lines.push({ id: `l${index}`, name: `Linia ${index}`, machineIds: members.map((m) => m.id) });
	};
	for (let i = 1; i <= LINE_COUNT; i++) addLine(i, LINE_UNITS);
	addLine(LINE_COUNT + 1, SPLIT_LINE_UNITS);
	machines.push(...MACHINE_NAMES.map((name, i): Machine => ({ id: `m${i + 1}`, name, workMode: 'weekdays' })));
	const programmers: Programmer[] = PROGRAMMERS.map((p, i) => ({ ...p, id: `p${i + 1}` }));

	// przykładowe awarie: dwie trwają (rosną z czasem), jedna już usunięta
	const currentHour = hourStartAtOrBefore(now);
	const yesterday = addHours(shiftDayStart(now), -24);
	const breakdowns: Breakdown[] = [
		{ id: 'a1', machineId: 'l2m2', start: addHours(currentHour, -3) },
		{ id: 'a2', machineId: 'm12', start: addHours(currentHour, -5) },
		{ id: 'a3', machineId: 'l5m1', start: addHours(yesterday, 4), end: addHours(yesterday, 12) }
	];
	const resources = { calendar, machines, lines, breakdowns };

	// dane tworzą też historię (starsza niż 30 dni trafia do archiwum), więc liczymy je od początku planu, nie od „teraz”
	const planStart = now - HISTORY_DAYS * 24 * 3600_000;
	// zlecenia do końca 2027 roku (co najmniej rok naprzód) - demo ma pokazać, że plan radzi sobie z dużą ilością danych
	const planEnd = Math.max(new Date(PLAN_UNTIL_YEAR + 1, 0, 1, 6).getTime(), now + 365 * 24 * 3600_000);
	let orderCounter = 412;
	let blockCounter = 0;
	/**
	 * Kolejka jednej maszyny lub linii, dopóki nie sięgnie końca roku (albo `maxCount` zleceń);
	 * `others` - zlecenia, od których zależy (maszyny linii).
	 */
	const fillQueue = (machineId: string, others: Block[] = [], maxCount = MAX_ORDERS_PER_QUEUE): Block[] => {
		// zlecenia maszyn linii są już ułożone, więc wydajność kolejki liczymy raz
		const capacityAt = capacityLookup(resources, planStart, others)(machineId);
		const own: Block[] = [];
		let cursor = planStart;
		for (let i = 0; i < maxCount && cursor < planEnd; i++) {
			// czasem zlecenie czeka z przerwą (np. na materiał) - dostaje własny termin
			const pinnedStart = i > 0 && rnd() < 0.15 ? addHours(cursor, 8 + Math.floor(rnd() * 16)) : undefined;
			const start = firstProductiveHourFrom(pinnedStart ?? cursor, capacityAt);
			const hours = MIN_HOURS + Math.floor(rnd() * (MAX_HOURS - MIN_HOURS + 1));
			const end = endAfterWork(start, hours, capacityAt);
			const project = pick(PROJECTS);
			const block: Block = {
				id: `b${++blockCounter}`,
				machineId,
				orderNo: `ZAM/${new Date(start).getFullYear()}/${String(orderCounter++).padStart(5, '0')}`,
				projectNo: project.no,
				project: project.name,
				operation: pick(OPERATIONS),
				hours,
				start,
				end,
				programmerId: rnd() < 0.7 ? pick(programmers).id : undefined
			};
			if (pinnedStart !== undefined) block.pinnedStart = pinnedStart;
			own.push(block);
			cursor = end;
		}
		return own;
	};

	const blocks: Block[] = [];
	// najpierw zlecenia przypisane do maszyn: samodzielne maszyny, linia 9 (każde zlecenie na innej maszynie)
	// i kilka zleceń na jednej maszynie linii 3, które spowalniają zlecenia całej linii
	for (const machine of machines) {
		const line = lines.find((l) => l.machineIds.includes(machine.id));
		if (!line || line.id === `l${LINE_COUNT + 1}`) blocks.push(...fillQueue(machine.id));
	}
	blocks.push(...fillQueue('l3m3', [], 3));
	// potem zlecenia linii - linie przerabiają je szybciej, więc mają ich więcej
	for (const line of lines.slice(0, LINE_COUNT)) {
		const members = blocks.filter((b) => line.machineIds.includes(b.machineId));
		blocks.push(...fillQueue(line.id, members));
	}

	// plan na „teraz”: trwające awarie przesuwają zlecenia do bieżącej godziny, stare zlecenia idą do archiwum
	const state: PlanState = { machines, lines, programmers, blocks: reflow(blocks, resources, undefined, now), archive: [], calendar, breakdowns };
	return archiveOld(state, now);
}
