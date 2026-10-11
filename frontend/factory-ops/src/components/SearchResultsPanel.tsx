import { usePlan } from '../data/PlanContext';
import { resourceName } from '../domain/calendar';
import { formatDateTime } from '../domain/format';
import { Block, Id } from '../domain/types';
import OrderName from './OrderName';
import { projectColorVar } from './projectColor';

/** Tyle wyników rysujemy naraz - wyszukanie samego „IMR” trafia w tysiące zleceń. */
const RESULTS_LIMIT = 200;

interface SearchResultsPanelProps {
	title: string;
	results: Block[];
	activeId?: Id;
	/** Początek dzisiejszej doby - wyniki zaczynają się od zleceń, które trwają dziś lub później. */
	from: number;
	onPick: (block: Block) => void;
	onClose: () => void;
}

/** Wyniki wyszukiwania (albo zlecenia wybrane na liście) w kolumnie obok planu - w miejscu panelu zlecenia. */
const SearchResultsPanel = ({ title, results, activeId, from, onPick, onClose }: SearchResultsPanelProps) => {
	const { state } = usePlan();
	// najpierw od dziś, starsze pod „Wcześniejsze” (najnowsze z nich na górze)
	const upcoming = results.filter((b) => b.end > from);
	const earlier = results.filter((b) => b.end <= from).reverse();
	const upcomingShown = upcoming.slice(0, RESULTS_LIMIT);
	const earlierShown = earlier.slice(0, Math.max(0, RESULTS_LIMIT - upcomingShown.length));
	const item = (block: Block) => (
		<button
			key={block.id}
			type="button"
			className={`queue-item results-item ${block.id === activeId ? 'is-current' : ''}`}
			style={projectColorVar(block, state.projects)}
			aria-current={block.id === activeId}
			onClick={() => onPick(block)}>
			<span className="queue-bar" />
			<span className="queue-text">
				<span className="queue-title">
					<OrderName block={block} />
				</span>
				<span className="queue-when mono">
					{resourceName(state, block.machineId) || 'Bez maszyny'} · {formatDateTime(block.start)}
				</span>
			</span>
		</button>
	);
	return (
		<aside className="details-panel results-panel" aria-label={title}>
			<header className="results-header">
				<span className="results-title">
					{title} · <span className="mono">{results.length}</span>
				</span>
				<button type="button" className="btn-close ms-auto" aria-label="Zamknij listę wyników" onClick={onClose} />
			</header>
			<div className="results-list">
				{upcomingShown.map(item)}
				{earlierShown.length > 0 && <div className="results-section">Wcześniejsze</div>}
				{earlierShown.map(item)}
				{results.length > RESULTS_LIMIT && <p className="results-more">i {results.length - RESULTS_LIMIT} więcej - zawęź wyszukiwanie</p>}
				{results.length === 0 && <p className="results-more">Brak wyników</p>}
			</div>
		</aside>
	);
};

export default SearchResultsPanel;
