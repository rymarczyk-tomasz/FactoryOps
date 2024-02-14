import { ITEM } from '../data';
import React from 'react';

export default function ItemLists() {
	return (
		<>
			<table className="table">
				<thead>
					<tr>
						<th>Date</th>
						<th>Project</th>
						<th>Machine</th>
						<th>Machine Group</th>
						<th>Programmer</th>
					</tr>
				</thead>
				<tbody>
					{ITEM.map((item) => (
						<tr key={item.id}>
							<td>{item.date}</td>
							<td>{item.project}</td>
							<td>{item.machine}</td>
							<td>{item.machine_gropu}</td>
							<td>{item.programmer}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
}
