import { capacityLookup } from '../domain/calendar';
import { addBlock } from '../domain/schedule';
import { addHours, hourStartAtOrBefore, shiftDayStart } from '../domain/shifts';
import { Block, Breakdown, Machine, PlanState, Programmer } from '../domain/types';

/** Linie produkcyjne: po 3 jednakowe maszyny, system 4-brygadowy (24/7). */
const LINE_COUNT = 8;
const LINE_UNITS = 3;

/** Pojedyncze maszyny pracujące pon-pt. */
const MACHINE_NAMES = [
	'HSTM 301',
	'HSTM 302',
	'HSTM 303',
	'HSTM 305',
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

const PROJECTS = ['Manzanillo', 'Kosovo', 'HPC', 'Bergen', 'Rotterdam', 'Gdańsk Port'];
const OPERATIONS = ['Stopień 1', 'Stopień 2', 'Stopień 3', 'Wirnik', 'Korpus', 'Wał', 'Pokrywa'];
/** Godziny pracy jednej maszyny z przewodnika. */
const MACHINE_HOURS = [4, 6, 8, 8, 12, 16, 16, 20, 24, 30, 40];
/** Na linii godziny dzielą się na 3 maszyny, więc zlecenia są większe. */
const LINE_HOURS = [24, 30, 36, 48, 48, 60, 72, 90];

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

	const machines: Machine[] = [
		...Array.from({ length: LINE_COUNT }, (_, i): Machine => ({ id: `l${i + 1}`, name: `Linia ${i + 1}`, workMode: 'continuous', units: LINE_UNITS })),
		...MACHINE_NAMES.map((name, i): Machine => ({ id: `m${i + 1}`, name, workMode: 'weekdays' }))
	];
	const programmers: Programmer[] = PROGRAMMERS.map((p, i) => ({ ...p, id: `p${i + 1}` }));

	// przykładowe awarie: na linii stoi część maszyn, zwykła maszyna stoi całkiem
	const today = hourStartAtOrBefore(now);
	const tomorrow = addHours(shiftDayStart(now), 24);
	const breakdowns: Breakdown[] = [
		{ id: 'a1', machineId: 'l2', units: [1], start: addHours(today, 2), end: addHours(today, 14) },
		{ id: 'a2', machineId: 'l5', units: [0, 2], start: tomorrow, end: addHours(tomorrow, 12) },
		{ id: 'a3', machineId: 'm11', units: [0], start: tomorrow, end: addHours(tomorrow, 8) }
	];
	const capacities = capacityLookup({ calendar, machines, breakdowns });

	let orderCounter = 412;
	const blocks: Block[] = [];
	for (const machine of machines) {
		const hours = machine.units ? LINE_HOURS : MACHINE_HOURS;
		// każda maszyna liczona osobno - kolejki maszyn są od siebie niezależne
		let queue: Block[] = [];
		// dane tworzą też historię, więc liczymy je od początku planu, nie od „teraz”
		const planStart = now - 4 * 24 * 3600_000;
		let start: number | undefined = planStart;
		// linie przerabiają zlecenia 3 razy szybciej, więc mają ich więcej, żeby plan sięgał podobnie daleko
		const minCount = machine.units ? 16 : 6;
		for (let i = 0, count = minCount + Math.floor(rnd() * 6); i < count; i++) {
			// czasem zlecenie czeka z przerwą (np. na materiał) - dostaje własny termin
			const lastEnd = queue.length ? queue[queue.length - 1].end : undefined;
			if (lastEnd !== undefined) start = rnd() < 0.15 ? addHours(lastEnd, 8 + Math.floor(rnd() * 16)) : undefined;
			const id = `b${blocks.length + queue.length + 1}`;
			queue = addBlock(
				queue,
				{
					machineId: machine.id,
					orderNo: `ZAM/2026/${String(orderCounter++).padStart(4, '0')}`,
					project: pick(PROJECTS),
					operation: pick(OPERATIONS),
					hours: pick(hours),
					programmerId: rnd() < 0.7 ? pick(programmers).id : undefined,
					start
				},
				id,
				capacities,
				planStart
			).sort((a, b) => a.start - b.start);
		}
		blocks.push(...queue);
	}

	return { machines, programmers, blocks, calendar, breakdowns };
}
