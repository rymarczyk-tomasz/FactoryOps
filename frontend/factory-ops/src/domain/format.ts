import { roundUpHours } from './shifts';
import { BlockStatus, Programmer } from './types';

const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function formatDateTime(ms: number): string {
	return dateTimeFormat.format(ms);
}

export function formatHours(hours: number): string {
	const planned = roundUpHours(hours);
	const label = (h: number) => `${String(h).replace('.', ',')} h`;
	return planned === hours ? label(hours) : `${label(hours)} → ${label(planned)}`;
}

export function programmerName(programmer: Programmer | undefined): string {
	return programmer ? `${programmer.name} ${programmer.surname}` : '';
}

export const STATUS_LABELS: Record<BlockStatus, string> = {
	done: 'Zakończone',
	in_progress: 'W toku',
	planned: 'Zaplanowane'
};

const intlFormat = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pl-PL', options);
const LABEL_FORMATS: Record<string, [number, Intl.DateTimeFormat][]> = {
	year: [[0, intlFormat({ year: 'numeric' })]],
	month: [
		[0, intlFormat({ month: 'short' })],
		[120, intlFormat({ month: 'long', year: 'numeric' })]
	],
	day: [
		[0, intlFormat({ day: 'numeric' })],
		[50, intlFormat({ weekday: 'short', day: 'numeric' })],
		[150, intlFormat({ weekday: 'long', day: 'numeric', month: 'short' })]
	],
	hour: [[0, intlFormat({ hour: '2-digit', minute: '2-digit' })]],
	minute: [[0, intlFormat({ hour: '2-digit', minute: '2-digit' })]]
};

/** Etykiety nagłówków timeline po polsku (biblioteka ma wbudowany angielski dayjs). */
export function timelineLabel([start]: [{ valueOf(): number }, unknown], unit: string, labelWidth = 0): string {
	const formats = LABEL_FORMATS[unit] ?? LABEL_FORMATS.day;
	const [, format] = [...formats].reverse().find(([minWidth]) => labelWidth >= minWidth) ?? formats[0];
	return format.format(start.valueOf());
}

/** Wartość dla <input type="datetime-local"> w czasie lokalnym. */
export function toLocalInputValue(ms: number): string {
	const d = new Date(ms);
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInputValue(value: string): number {
	// format bez strefy jest interpretowany jako czas lokalny
	return new Date(value).getTime();
}
