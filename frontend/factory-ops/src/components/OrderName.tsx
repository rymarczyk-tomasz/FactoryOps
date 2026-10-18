import { projectKey } from '../domain/projects';
import { Block } from '../domain/types';

/** „IMR-6001 · Stopień 3” w tekście - pismem mono tylko numer projektu (w mono spacje stopnia byłyby za szerokie). */
const OrderName = ({ block }: { block: Pick<Block, 'projectNo' | 'project' | 'operation'> }) => {
	const operation = block.operation.trim();
	return (
		<span className="order-name">
			<span className="mono">{projectKey(block)}</span>
			{operation && ` · ${operation}`}
		</span>
	);
};

export default OrderName;
