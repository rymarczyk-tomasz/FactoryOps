export const SHIFT_HOURS = 8;
/** Zmiany: 6-14, 14-22, 22-6. Zmiana nocna należy do dnia, w którym się zaczyna. */
export const SHIFT_START_HOURS = [6, 14, 22] as const;

/** Dodaje godziny „zegarowo” (zmiana czasu letni/zimowy nie przesuwa granic zmian). */
function addWallHours(ms: number, hours: number): number {
	const d = new Date(ms);
	d.setHours(d.getHours() + hours);
	return d.getTime();
}

export function dayKey(date: Date): string {
	const m = String(date.getMonth() + 1).padStart(2, '0');
	const d = String(date.getDate()).padStart(2, '0');
	return `${date.getFullYear()}-${m}-${d}`;
}

export function isWeekend(date: Date): boolean {
	const day = date.getDay();
	return day === 0 || day === 6;
}

/** Czy dany dzień (licząc od zmiany 6:00) jest pracujący - kalendarz konkretnej maszyny. */
export type IsWorkingDay = (date: Date) => boolean;

export function shiftsForHours(hours: number): number {
	return Math.max(1, Math.ceil(hours / SHIFT_HOURS));
}

/** Początek zmiany, w której wypada podany moment. */
export function shiftStartAtOrBefore(ms: number): number {
	const d = new Date(ms);
	const h = d.getHours();
	const startHour = [...SHIFT_START_HOURS].reverse().find((s) => h >= s);
	if (startHour === undefined) {
		// 0:00-5:59 to jeszcze nocna zmiana z poprzedniego dnia
		return new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 22).getTime();
	}
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), startHour).getTime();
}

/** Najbliższa granica zmiany (do przyciągania przy przeciąganiu). */
export function nearestShiftStart(ms: number): number {
	const floor = shiftStartAtOrBefore(ms);
	const next = addWallHours(floor, SHIFT_HOURS);
	return ms - floor < next - ms ? floor : next;
}

export function nextShiftStart(shiftStart: number): number {
	return addWallHours(shiftStart, SHIFT_HOURS);
}

export function isWorkingShift(shiftStart: number, isWorkingDay: IsWorkingDay): boolean {
	return isWorkingDay(new Date(shiftStart));
}

/** Pierwsza pracująca zmiana zaczynająca się nie wcześniej niż `ms` (od granicy zmiany w górę). */
export function firstWorkingShiftFrom(ms: number, isWorkingDay: IsWorkingDay): number {
	let s = shiftStartAtOrBefore(ms);
	if (s < ms) s = nextShiftStart(s);
	// zabezpieczenie przed nieskończoną pętlą przy kalendarzu bez dni pracujących
	for (let i = 0; i < 3 * 366; i++) {
		if (isWorkingShift(s, isWorkingDay)) return s;
		s = nextShiftStart(s);
	}
	return s;
}

/** Koniec bloku zajmującego `shifts` pracujących zmian, licząc od pracującej zmiany `start`. */
export function endAfterShifts(start: number, shifts: number, isWorkingDay: IsWorkingDay): number {
	let s = start;
	let counted = 0;
	for (let i = 0; i < 3 * 366 * 5; i++) {
		if (isWorkingShift(s, isWorkingDay)) counted++;
		if (counted >= shifts) break;
		s = nextShiftStart(s);
	}
	return nextShiftStart(s);
}

/** Początek doby zmianowej (6:00), do której należy podany moment - np. 3:00 w nocy to jeszcze poprzednia doba. */
export function shiftDayStart(ms: number): number {
	const shift = new Date(shiftStartAtOrBefore(ms));
	return new Date(shift.getFullYear(), shift.getMonth(), shift.getDate(), SHIFT_START_HOURS[0]).getTime();
}
