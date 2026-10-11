import { describe, expect, it } from 'vitest';
import { projectKey, withProjectColor } from './projects';
import { PlanState } from './types';

const state: PlanState = { machines: [], lines: [], programmers: [], blocks: [], archive: [], calendar: { overrides: {} }, breakdowns: [] };

describe('projekty', () => {
	it('kluczem jest numer projektu, a bez niego nazwa', () => {
		expect(projectKey({ projectNo: ' IMR-6001 ', project: 'Huanyon' })).toBe('IMR-6001');
		expect(projectKey({ projectNo: '', project: 'Huanyon' })).toBe('Huanyon');
	});

	it('kolor zapisuje się na projekcie', () => {
		const next = withProjectColor(state, 'IMR-6001', '#0d9488');
		expect(next.projects).toEqual({ 'IMR-6001': { color: '#0d9488' } });
		expect(withProjectColor(next, 'IMR-6002', '#2563eb').projects).toEqual({ 'IMR-6001': { color: '#0d9488' }, 'IMR-6002': { color: '#2563eb' } });
	});

	it('bez zmiany koloru zwraca ten sam stan', () => {
		const next = withProjectColor(state, 'IMR-6001', '#0d9488');
		expect(withProjectColor(next, 'IMR-6001', '#0d9488')).toBe(next);
		expect(withProjectColor(state, 'IMR-6001', undefined)).toBe(state);
		expect(withProjectColor(state, '', '#0d9488')).toBe(state);
	});
});
