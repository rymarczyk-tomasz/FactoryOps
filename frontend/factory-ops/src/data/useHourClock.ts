import { useEffect, useState } from 'react';
import { hourStartAtOrBefore, nextHourStart } from '../domain/shifts';

/** Zapas po pełnej godzinie, żeby timer odpalony minimalnie za wcześnie nie trafił jeszcze w starą godzinę. */
const TICK_DELAY_MS = 1000;

/**
 * „Teraz” dla widoków planu, odświeżane co pełną godzinę. Zlecenia, awarie i doby zaczynają się
 * i kończą na pełnych godzinach, więc częstsze odświeżanie niczego by nie zmieniło. Po powrocie
 * do karty (np. po uśpieniu laptopa, gdy timery stoją) sprawdzamy godzinę od razu.
 */
export function useHourClock(): number {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>;
		// w tej samej godzinie zostawiamy poprzednią wartość - bez przerysowania planu
		const refresh = () => {
			const current = Date.now();
			setNow((previous) => (hourStartAtOrBefore(previous) === hourStartAtOrBefore(current) ? previous : current));
		};
		const schedule = () => {
			timer = setTimeout(() => {
				refresh();
				schedule();
			}, nextHourStart(Date.now()) - Date.now() + TICK_DELAY_MS);
		};
		const onVisible = () => {
			if (document.visibilityState !== 'visible') return;
			refresh();
			clearTimeout(timer);
			schedule();
		};
		schedule();
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('visibilitychange', onVisible);
		};
	}, []);

	return now;
}
