import { NavLink, useNavigate } from 'react-router-dom';
import { usePlan } from '../data/PlanContext';
import { isOngoing, lineOfMachine, resourceName } from '../domain/calendar';
import { Breakdown } from '../domain/types';
import { PlanNavigationState } from './planNavigation';
import { breakdownImpact, ordersLabel } from './planSelectors';

const HOUR = 3600_000;

const Logo = () => (
	<svg width="22" height="22" viewBox="0 0 26 26" aria-hidden="true">
		<rect x="1" y="1" width="24" height="24" rx="6" fill="#2563eb" />
		<rect x="5" y="7" width="10" height="3" rx="1.5" fill="#fff" />
		<rect x="9" y="12" width="12" height="3" rx="1.5" fill="#93c5fd" />
		<rect x="5" y="17" width="7" height="3" rx="1.5" fill="#fff" />
	</svg>
);

const LINKS = [
	{ to: '/', label: 'Plan', short: 'P', end: true },
	{ to: '/list', label: 'Lista zleceń', short: 'L' },
	{ to: '/load', label: 'Obciążenie', short: 'O' },
	{ to: '/machines', label: 'Maszyny', short: 'M' }
];

const timeFormat = new Intl.DateTimeFormat('pl-PL', { hour: '2-digit', minute: '2-digit' });
const dateTimeFormat = new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });

/** „od 04:00 · 3 h” - sama godzina jest jednoznaczna, gdy awaria trwa krócej niż dobę. */
function since(breakdown: Breakdown, now: number): string {
	const hours = Math.max(0, Math.floor((now - breakdown.start) / HOUR));
	const from = hours < 24 ? timeFormat.format(breakdown.start) : dateTimeFormat.format(breakdown.start);
	return `od ${from} · ${hours < 1 ? '< 1' : hours} h`;
}

interface AppRailProps {
	onReset: () => void;
}

/** Menu boczne: nawigacja, trwające awarie i reset demo. */
const AppRail = ({ onReset }: AppRailProps) => {
	const { state, now } = usePlan();
	const navigate = useNavigate();
	const ongoing = state.breakdowns.filter(isOngoing).sort((a, b) => a.start - b.start);
	const impact = (breakdown: Breakdown) => {
		const count = breakdownImpact(state, breakdown, now).length;
		return count > 0 ? `wydłuża ${ordersLabel(count)}` : '';
	};

	return (
		<aside className="app-rail">
			<NavLink to="/" className="rail-brand">
				<Logo />
				<span className="rail-label">FactoryOps</span>
			</NavLink>
			<nav className="rail-nav">
				{LINKS.map((link) => (
					<NavLink key={link.to} to={link.to} end={link.end} className="rail-link" title={link.label}>
						<span className="rail-short" aria-hidden="true">
							{link.short}
						</span>
						<span className="rail-label">{link.label}</span>
					</NavLink>
				))}
			</nav>
			{ongoing.length > 0 && (
				<section className="rail-breakdowns" aria-label="Trwające awarie">
					<div className="rail-section-label">
						<span className="rail-label">Awarie teraz · </span>
						{ongoing.length}
					</div>
					<div className="rail-breakdown-list">
						{ongoing.map((breakdown) => {
							const line = lineOfMachine(state.lines, breakdown.machineId);
							const name = resourceName(state, breakdown.machineId);
							const reveal: PlanNavigationState = { revealBreakdown: breakdown.id };
							return (
								<button
									key={breakdown.id}
									type="button"
									className="rail-breakdown"
									title={`${name}${line ? ` · ${line.name}` : ''} - pokaż na planie`}
									onClick={() => navigate('/', { state: reveal })}>
									<span className="rail-breakdown-head">
										<span className="status-dot danger" />
										<span className="rail-breakdown-name mono">{name}</span>
										<span className="rail-breakdown-where">{line ? line.name : 'maszyna'}</span>
									</span>
									<span className="rail-breakdown-since">{since(breakdown, now)}</span>
									{impact(breakdown) && <span className="rail-breakdown-since">{impact(breakdown)}</span>}
								</button>
							);
						})}
					</div>
				</section>
			)}
			<button type="button" className="rail-reset" onClick={onReset}>
				<span className="rail-label">Resetuj demo</span>
				<span className="rail-short" aria-hidden="true">
					↺
				</span>
			</button>
		</aside>
	);
};

export default AppRail;
