/**
 * Polecenia dla planu przekazywane w stanie nawigacji (router `state`) z innych widoków.
 * Plan obsługuje je raz i czyści stan - cofnięcie ani odświeżenie strony nie powtarza przewijania.
 */
export interface PlanNavigationState {
	/** Odsłonić maszynę awarii, przewinąć do jej początku i podświetlić wiersz. */
	revealBreakdown?: string;
	/** Zaznaczyć zlecenie i przewinąć do niego plan. */
	showBlock?: string;
}
