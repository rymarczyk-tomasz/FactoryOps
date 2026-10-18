import { LineConflict } from '../domain/conflicts';

/**
 * Polecenia dla planu przekazywane w stanie nawigacji (router `state`) z innych widoków.
 * Plan obsługuje je raz i czyści stan - cofnięcie ani odświeżenie strony nie powtarza przewijania.
 */
export interface PlanNavigationState {
	/** Odsłonić maszynę awarii, przewinąć do jej początku i podświetlić wiersz. */
	revealBreakdown?: string;
	/** Rozwinąć linię konfliktu, przewinąć do jego początku, zaznaczyć zlecenie maszyny i podświetlić jej wiersz. */
	revealConflict?: LineConflict;
	/** Zaznaczyć zlecenie i przewinąć do niego plan. */
	showBlock?: string;
	/** Kilka zleceń z listy: wyróżnić jak wyniki wyszukiwania i przejść do pierwszego. */
	showBlocks?: string[];
}
