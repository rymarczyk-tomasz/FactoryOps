import React, { useMemo } from 'react';
import { Badge, Form, Table } from 'react-bootstrap';
import { usePlan } from '../data/PlanContext';
import { formatDateTime, formatHours, programmerName, STATUS_LABELS } from '../domain/format';
import { blockStatus } from '../domain/schedule';
import { BlockStatus } from '../domain/types';

const STATUS_VARIANTS: Record<BlockStatus, string> = { done: 'secondary', in_progress: 'success', planned: 'primary' };

const ListPage = () => {
	const { state, updateBlock } = usePlan();
	const machineNames = useMemo(() => new Map(state.machines.map((m) => [m.id, m.name])), [state.machines]);
	const blocks = useMemo(() => [...state.blocks].sort((a, b) => a.start - b.start), [state.blocks]);
	const now = Date.now();

	return (
		<Table hover responsive className="align-middle mb-0">
			<thead>
				<tr>
					<th>Start</th>
					<th>Koniec</th>
					<th>Nr zamówienia</th>
					<th>Projekt</th>
					<th>Operacja</th>
					<th>Maszyna</th>
					<th>Czas</th>
					<th>Status</th>
					<th>Programista</th>
				</tr>
			</thead>
			<tbody>
				{blocks.map((block) => {
					const status = blockStatus(block, now);
					return (
						<tr key={block.id}>
							<td className="text-nowrap">{formatDateTime(block.start)}</td>
							<td className="text-nowrap">{formatDateTime(block.end)}</td>
							<td>{block.orderNo}</td>
							<td>{block.project}</td>
							<td>{block.operation}</td>
							<td>{machineNames.get(block.machineId)}</td>
							<td className="text-nowrap">{formatHours(block.hours)}</td>
							<td>
								<Badge bg={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
							</td>
							<td>
								<Form.Select
									size="sm"
									aria-label="Programista"
									value={block.programmerId ?? ''}
									onChange={(e) => updateBlock(block.id, { programmerId: e.target.value || undefined })}>
									<option value="">— nie przypisano —</option>
									{state.programmers.map((p) => (
										<option key={p.id} value={p.id}>
											{programmerName(p)}
										</option>
									))}
								</Form.Select>
							</td>
						</tr>
					);
				})}
			</tbody>
		</Table>
	);
};

export default ListPage;
