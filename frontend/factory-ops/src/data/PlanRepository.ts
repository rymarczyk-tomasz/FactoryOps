import { PlanState } from '../domain/types';
import { createSeedState } from './seed';

/**
 * Źródło danych planu. Na czas demo dane trzymamy w przeglądarce;
 * po decyzji o backendzie wystarczy dopisać implementację korzystającą z API.
 */
export interface PlanRepository {
	load(): Promise<PlanState>;
	save(state: PlanState): Promise<void>;
	reset(): Promise<PlanState>;
}

const STORAGE_KEY = 'factoryops.plan.v8';

export class LocalStoragePlanRepository implements PlanRepository {
	async load(): Promise<PlanState> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) return JSON.parse(raw) as PlanState;
		} catch {
			// uszkodzone lub niedostępne dane - startujemy od danych przykładowych
		}
		return this.reset();
	}

	async save(state: PlanState): Promise<void> {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch {
			// np. tryb prywatny - demo działa dalej, tylko bez zapisu
		}
	}

	async reset(): Promise<PlanState> {
		const state = createSeedState(Date.now());
		await this.save(state);
		return state;
	}
}
