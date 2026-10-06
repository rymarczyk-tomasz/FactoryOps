import { addBlock } from '../domain/schedule';
import { firstWorkingShiftFrom, nextShiftStart } from '../domain/shifts';
import { Block, Machine, PlanState, Programmer } from '../domain/types';

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

	const machines: Machine[] = MACHINE_NAMES.map((name, i) => ({ id: `m${i + 1}`, name }));
	const programmers: Programmer[] = PROGRAMMERS.map((p, i) => ({ ...p, id: `p${i + 1}` }));

	let blocks: Block[] = [];
	let orderCounter = 412;
	const planStart = firstWorkingShiftFrom(now - 4 * 24 * 3600_000, calendar);

	for (const machine of machines) {
		let cursor = planStart;
		for (let i = 0, count = 6 + Math.floor(rnd() * 6); i < count; i++) {
			// czasem przerwa między zleceniami
			if (rnd() < 0.25) cursor = nextShiftStart(nextShiftStart(cursor));
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
				calendar,
				now
			);
			cursor = blocks.find((b) => b.id === id)!.end;
		}
	}

	return { machines, programmers, blocks, calendar };
}
