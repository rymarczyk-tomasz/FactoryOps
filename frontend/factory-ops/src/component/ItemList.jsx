import { mixedObject } from '../data';
import React from 'react';
import { programmers } from '../data';

export default function ItemLists() {
	return (
		<>
			<table className="table">
				<thead>
					<tr>
						<th>Start Date</th>
						<th>Project</th>
						<th>Machine</th>
						<th>Machine Group</th>
						<th>Programmer</th>
					</tr>
				</thead>
				<tbody>
					{mixedObject.map((item) => (
						<tr key={item.id}>
							<td>{item.startDate}</td>
							<td>{item.project}</td>
							<td>{item.machine}</td>
							<td>{item.machine_gropu}</td>
							<td>
								<select>
									<option>Select Programmer</option>
									{programmers.map((programmer, index) => (
										<option key={index}>{programmer}</option>
									))}
								</select>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</>
	);
}
