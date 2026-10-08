import { KeyboardEvent } from 'react';

const NEXT = ['ArrowRight', 'ArrowDown'];
const PREVIOUS = ['ArrowLeft', 'ArrowUp'];

/**
 * Klawiatura w grupie radio (segmented, karty-radio): strzałki zmieniają wybór i przenoszą fokus,
 * Home/End - pierwsza/ostatnia opcja. Fokus trafia do grupy tylko na wybraną opcję (`tabIndex` w komponencie).
 */
export function radioKeyDown<T>(values: readonly T[], current: T, onChange: (value: T) => void) {
	return (e: KeyboardEvent<HTMLElement>) => {
		const index = values.indexOf(current);
		let next: number;
		if (NEXT.includes(e.key)) next = (index + 1) % values.length;
		else if (PREVIOUS.includes(e.key)) next = (index - 1 + values.length) % values.length;
		else if (e.key === 'Home') next = 0;
		else if (e.key === 'End') next = values.length - 1;
		else return;
		e.preventDefault();
		onChange(values[next]);
		e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
	};
}
