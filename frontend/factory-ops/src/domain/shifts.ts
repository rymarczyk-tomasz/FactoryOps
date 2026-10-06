/**
 * Zmiany: 6-14, 14-22, 22-6. Planujemy z dokładnością do pełnej godziny, ale doba zakładu
 * zaczyna się o 6:00 - nocna zmiana należy do dnia, w którym się zaczyna (piątkowa noc to jeszcze piątek).
 */
export const SHIFT_START_HOURS = [6, 14, 22] as const;

const MINUTE = 60_000;

/** Dodaje godziny „zegarowo” (zmiana czasu letni/zimowy nie przesuwa pełnych godzin). */
export function addHours(ms: number, hours: number): number {
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

/** Czy dany dzień (licząc od 6:00) jest pracujący - kalendarz konkretnej maszyny. */
export type IsWorkingDay = (date: Date) => boolean;

/** Czas zlecenia na planie: godziny zaokrąglone w górę do pełnej godziny, minimum 1 h. */
export function roundUpHours(hours: number): number {
	return Math.max(1, Math.ceil(hours));
}

export function hourStartAtOrBefore(ms: number): number {
	const d = new Date(ms);
	d.setMinutes(0, 0, 0);
	return d.getTime();
}

/** Najbliższa pełna godzina (do przyciągania przy przeciąganiu). */
export function nearestHourStart(ms: number): number {
	const floor = hourStartAtOrBefore(ms);
	return ms - floor < 30 * MINUTE ? floor : addHours(floor, 1);
}

/** Początek doby (6:00), do której należy podany moment - np. 3:00 w nocy to jeszcze poprzednia doba. */
export function shiftDayStart(ms: number): number {
	const d = new Date(ms);
	const firstShift = SHIFT_START_HOURS[0];
	const dayOffset = d.getHours() < firstShift ? -1 : 0;
	return new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayOffset, firstShift).getTime();
}

export function isWorkingHour(hourStart: number, isWorkingDay: IsWorkingDay): boolean {
	return isWorkingDay(new Date(shiftDayStart(hourStart)));
}

/** Pierwsza pracująca pełna godzina nie wcześniej niż `ms`. */
export function firstWorkingHourFrom(ms: number, isWorkingDay: IsWorkingDay): number {
	let h = hourStartAtOrBefore(ms);
	if (h < ms) h = addHours(h, 1);
	// zabezpieczenie przed nieskończoną pętlą przy kalendarzu bez dni pracujących
	for (let i = 0; i < 24 * 366; i++) {
		if (isWorkingHour(h, isWorkingDay)) return h;
		h = addHours(h, 1);
	}
	return h;
}

/** Koniec zlecenia zajmującego `hours` pracujących godzin od pracującej godziny `start` - dni wolne są pomijane. */
export function endAfterHours(start: number, hours: number, isWorkingDay: IsWorkingDay): number {
	const needed = roundUpHours(hours);
	let h = start;
	let counted = 0;
	for (let i = 0; i < 24 * 366 * 5; i++) {
		if (isWorkingHour(h, isWorkingDay)) counted++;
		if (counted >= needed) break;
		h = addHours(h, 1);
	}
	return addHours(h, 1);
}
