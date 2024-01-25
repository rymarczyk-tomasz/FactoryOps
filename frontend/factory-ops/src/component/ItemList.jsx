import { ITEM } from '../data';
import React from 'react';

export default function ItemLists() {
	return (
		<>
			<table className="table">
				<thead>
					<tr>
						<th>ID</th>
						<th>Name</th>
						<th>Start Time</th>
						<th>Grupa</th>
					</tr>
				</thead>
				<tbody>
					{ITEM.map((item) => (
						<tr key={item.id}>
							<td>{item.id}</td>
							<td>{item.name}</td>
							<td>{item.startTime}</td>
							<td>{item.group}</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
}
