import { CSSProperties } from 'react';
import { projectKey } from '../domain/projects';
import { Block, PlanState } from '../domain/types';

/** Kolory projektów - bez czerwieni i zieleni „w toku”, które myliły się z awarią i statusem. */
export const PROJECT_COLORS = ['#2563eb', '#0d9488', '#d97706', '#7c3aed', '#db2777', '#65a30d', '#0891b2', '#4f46e5'];

/** Kolor z numeru projektu - dopóki planista nie wybierze innego. */
export function defaultProjectColor(key: string): string {
	let hash = 0;
	for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
	return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

type Projects = PlanState['projects'];

/** Kolor projektu zapisany na projekcie albo domyślny z jego numeru. */
export function projectColor(block: Pick<Block, 'projectNo' | 'project'>, projects: Projects): string {
	const key = projectKey(block);
	return projects?.[key]?.color ?? defaultProjectColor(key);
}

/** Kolor projektu jako zmienna CSS `--c` - odcienie (tło, ramka, tekst) liczy CSS przez color-mix. */
export const projectColorVar = (block: Pick<Block, 'projectNo' | 'project'>, projects: Projects): CSSProperties =>
	({ '--c': projectColor(block, projects) }) as CSSProperties;
