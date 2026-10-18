import React, { useMemo, useRef, useState } from 'react';

type Range = { start: number; end: number };

type Props = {
	/** Widoczny zakres planu. */
	range: Range;
	/** Cały zakres, po którym da się przewijać (od najwcześniejszego do najpóźniejszego zlecenia z zapasem). */
	extent: Range;
	onChange: (range: Range) => void;
	/** Szerokość kolumny zasobów - pasek zaczyna się tam, gdzie oś czasu. */
	sidebarWidth: number;
};

/** Najwęższy uchwyt [px] - przy zakresie z kilku lat i widoku jednej doby uchwyt byłby niewidoczny. */
const MIN_THUMB = 28;

/**
 * Poziomy pasek przewijania planu. Przeciąganie uchwytu przesuwa widok, klik w pasek przenosi widok w to miejsce.
 * Zakres paska obejmuje też aktualny widok, więc uchwyt nigdy nie wypada poza pasek.
 */
const PlanScrollbar = ({ range, extent, onChange, sidebarWidth }: Props) => {
	const trackRef = useRef<HTMLDivElement>(null);
	const drag = useRef<{ x: number; range: Range; total: number; width: number } | undefined>(undefined);
	// w trakcie przeciągania zakres paska stoi w miejscu - inaczej uchwyt "uciekałby" spod kursora
	const [frozen, setFrozen] = useState<Range>();

	const full = frozen ?? { start: Math.min(extent.start, range.start), end: Math.max(extent.end, range.end) };
	const total = full.end - full.start;
	const span = range.end - range.start;
	const left = ((range.start - full.start) / total) * 100;
	const width = (span / total) * 100;

	// początki miesięcy - punkty orientacyjne na pasku
	const months = useMemo(() => {
		const result: number[] = [];
		const d = new Date(full.start);
		d.setDate(1);
		d.setHours(0, 0, 0, 0);
		for (d.setMonth(d.getMonth() + 1); d.getTime() < full.end; d.setMonth(d.getMonth() + 1)) result.push(d.getTime());
		return result;
	}, [full.start, full.end]);

	const startDrag = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return;
		e.preventDefault();
		e.stopPropagation();
		e.currentTarget.setPointerCapture(e.pointerId);
		drag.current = { x: e.clientX, range, total, width: trackRef.current?.clientWidth ?? 1 };
		setFrozen(full);
	};
	const moveDrag = (e: React.PointerEvent<HTMLDivElement>) => {
		const d = drag.current;
		if (!d) return;
		const delta = ((e.clientX - d.x) / d.width) * d.total;
		onChange({ start: d.range.start + delta, end: d.range.end + delta });
	};
	const endDrag = () => {
		drag.current = undefined;
		setFrozen(undefined);
	};

	// klik w pasek poza uchwytem: środek widoku w klikniętym miejscu
	const jump = (e: React.PointerEvent<HTMLDivElement>) => {
		if (e.button !== 0 || !trackRef.current) return;
		const rect = trackRef.current.getBoundingClientRect();
		const center = full.start + ((e.clientX - rect.left) / rect.width) * total;
		onChange({ start: center - span / 2, end: center + span / 2 });
	};

	return (
		<div className="plan-scrollbar" style={{ paddingLeft: sidebarWidth }}>
			<div className="plan-scrollbar-track" ref={trackRef} onPointerDown={jump}>
				{months.map((month) => {
					const x = ((month - full.start) / total) * 100;
					const isYear = new Date(month).getMonth() === 0;
					return <span key={month} className={`plan-scrollbar-tick${isYear ? ' is-year' : ''}`} style={{ left: `${x}%` }} />;
				})}
				<div
					className={`plan-scrollbar-thumb${frozen ? ' is-dragging' : ''}`}
					style={{ left: `min(${left}%, calc(100% - max(${width}%, ${MIN_THUMB}px)))`, width: `max(${width}%, ${MIN_THUMB}px)` }}
					onPointerDown={startDrag}
					onPointerMove={moveDrag}
					onPointerUp={endDrag}
					onPointerCancel={endDrag}
				/>
			</div>
		</div>
	);
};

export default PlanScrollbar;
