import { useEffect, useState } from 'react';

/** Czy pasuje zapytanie CSS (np. „(max-width: 1439.98px)”) - aktualizuje się przy zmianie rozmiaru okna. */
export function useMediaQuery(query: string): boolean {
	const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
	useEffect(() => {
		const list = window.matchMedia(query);
		const update = () => setMatches(list.matches);
		update();
		list.addEventListener('change', update);
		return () => list.removeEventListener('change', update);
	}, [query]);
	return matches;
}

/** Poniżej tej szerokości strony układają się ciaśniej (Obciążenie, Lista). */
export const NARROW_SCREEN = '(max-width: 1439.98px)';
