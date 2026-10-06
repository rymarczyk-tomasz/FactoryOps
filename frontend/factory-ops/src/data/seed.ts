import { calendarLookup } from '../domain/calendar';
import { addBlock } from '../domain/schedule';
import { addHours, firstWorkingHourFrom } from '../domain/shifts';
import { Block, Machine, PlanState, Programmer, WorkMode } from '../domain/types';

const MACHINE_NAMES = [
	'HSTM 305',
	'HSTM 308',
	'HSTM 502',
	'HSTM 505',
	'DMU 125',
	'DMU 210',
	'CTX 1250',
	'Mazak Integrex i-400',
	'Okuma MU-8000V',
	'Haas VF-4'
];

/** Te maszyny chodzą w systemie 4-brygadowym (24/7), reszta pon-pt. */
const CONTINUOUS_MACHINES = ['HSTM 305', 'HSTM 308'];

const PROGRAMMERS: Omit<Programmer, 'id'>[] = [
	{ name: 'Jan', surname: 'Kowalski' },
	{ name: 'Anna', surname: 'Nowak' },
	{ name: 'Piotr', surname: 'Wiśniewski' },
	{ name: 'Katarzyna', surname: 'Wójcik' }
];

const PROJECTS = ['Manzanillo', 'Kosovo', 'HPC', 'Bergen', 'Rotterdam', 'Gdańsk Port'];
const OPERATIONS = ['Stopień 1', 'Stopień 2', 'Stopień 3', 'Wirnik', 'Korpus', 'Wał', 'Pokrywa'];
const HOURS = [4, 6, 8, 8, 12, 16, 16, 20, 24, 30, 40];

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

	const machines: Machine[] = MACHINE_NAMES.map((name, i) => {
		const workMode: WorkMode = CONTINUOUS_MACHINES.includes(name) ? 'continuous' : 'weekdays';
		return { id: `m${i + 1}`, name, workMode };
	});
	const programmers: Programmer[] = PROGRAMMERS.map((p, i) => ({ ...p, id: `p${i + 1}` }));

	let blocks: Block[] = [];
	let orderCounter = 412;
	const calendars = calendarLookup({ calendar, machines });

	for (const machine of machines) {
		let cursor = firstWorkingHourFrom(now - 4 * 24 * 3600_000, calendars(machine.id));
		for (let i = 0, count = 6 + Math.floor(rnd() * 6); i < count; i++) {
			// czasem przerwa między zleceniami
			if (rnd() < 0.25) cursor = addHours(cursor, 4 + Math.floor(rnd() * 12));
			const id = `b${blocks.length + 1}`;
			blocks = addBlock(
				blocks,
				{
					machineId: machine.id,
					orderNo: `ZAM/2026/${String(orderCounter++).padStart(4, '0')}`,
					project: pick(PROJECTS),
					operation: pick(OPERATIONS),
					hours: pick(HOURS),
					programmerId: rnd() < 0.7 ? pick(programmers).id : undefined,
					start: cursor
				},
				id,
				calendars,
				now
			);
			cursor = blocks.find((b) => b.id === id)!.end;
		}
	}

	return { machines, programmers, blocks, calendar };
}
