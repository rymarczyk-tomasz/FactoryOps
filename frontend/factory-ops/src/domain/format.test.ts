import { describe, expect, it } from 'vitest';
import { formatClockDuration, formatClockSpan, orderLabel } from './format';

const HOUR = 3600_000;

describe('formatClockDuration', () => {
	it('podaje dni i godziny zegarowe', () => {
		expect(formatClockDuration(6 * HOUR)).toBe('6 h');
		expect(formatClockDuration(26 * HOUR)).toBe('1 dzień 2 h');
		expect(formatClockDuration(102 * HOUR)).toBe('4 dni 6 h');
		expect(formatClockDuration(48 * HOUR)).toBe('2 dni');
	});
});

describe('orderLabel', () => {
	it('zlecenie rozpoznaje się po numerze projektu i stopniu', () => {
		expect(orderLabel({ projectNo: 'IMR-6001', project: 'Huanyon', operation: 'Stopień 3' })).toBe('IMR-6001 · Stopień 3');
		// bez numeru - nazwa projektu
		expect(orderLabel({ projectNo: '', project: 'Huanyon', operation: 'Wirnik' })).toBe('Huanyon · Wirnik');
	});
});

describe('formatClockSpan', () => {
	it('pokazuje dzień tygodnia i godzinę', () => {
		// pt 9.10.2026 14:00 → wt 13.10.2026 20:00
		expect(formatClockSpan(new Date(2026, 9, 9, 14).getTime(), new Date(2026, 9, 13, 20).getTime())).toBe('pt 14:00 → wt 20:00');
	});

	it('przy dłuższym okresie dodaje datę', () => {
		expect(formatClockSpan(new Date(2026, 9, 9, 14).getTime(), new Date(2026, 9, 20, 20).getTime())).toBe('pt 09.10 14:00 → wt 20.10 20:00');
	});
});
