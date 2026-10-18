import { Blocks, FileCheck, LucideIcon } from 'lucide-react';
import { Block, ReadinessFlag } from '../domain/types';

export const READINESS: { flag: ReadinessFlag; label: string; missing: string; Icon: LucideIcon }[] = [
	{ flag: 'materialReady', label: 'Materiał gotowy', missing: 'Brak materiału', Icon: Blocks },
	{ flag: 'programReady', label: 'Program gotowy', missing: 'Brak programu', Icon: FileCheck }
];

/** Opis gotowości do podpowiedzi: „materiał gotowy · brak programu”. */
export function readinessText(block: Block): string {
	return READINESS.map(({ flag, label, missing }) => (block[flag] ? label : missing).toLowerCase()).join(' · ');
}

interface ReadinessIconsProps {
	block: Pick<Block, ReadinessFlag>;
	/** Ukrywa ikony wyłączonych flag (np. w widoku miesiąca). */
	hideOff?: boolean;
	size?: number;
}

/** Ikony gotowości: klocki - materiał, kartka - program; wyłączona flaga jest wyszarzona. */
export const ReadinessIcons = ({ block, hideOff, size = 12 }: ReadinessIconsProps) => (
	<span className="readiness-icons">
		{READINESS.filter(({ flag }) => !hideOff || block[flag]).map(({ flag, label, missing, Icon }) => (
			<Icon key={flag} size={size} strokeWidth={2} className={`readiness-icon ${block[flag] ? 'is-on' : 'is-off'}`} aria-label={block[flag] ? label : missing} />
		))}
	</span>
);
