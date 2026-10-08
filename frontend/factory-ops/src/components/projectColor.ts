import { CSSProperties } from 'react';

/** Kolory projektów - bez czerwieni i zieleni „w toku”, które myliły się z awarią i statusem. */
export const PROJECT_COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#65a30d', '#0891b2', '#4f46e5'];

export function projectColor(project: string): string {
	let hash = 0;
	for (const char of project) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

/** Kolor projektu jako zmienna CSS `--c` - odcienie (tło, ramka, tekst) liczy CSS przez color-mix. */
export const projectColorVar = (project: string): CSSProperties => ({ '--c': projectColor(project) }) as CSSProperties;
