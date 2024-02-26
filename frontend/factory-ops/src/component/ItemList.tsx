import React from 'react';
import { mixedObject, programmers } from '../data';

const ItemLists: React.FC = () => {
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
					{mixedObject.map((item, index) => (
						<tr key={index}>
							<td>{item.startDate}</td>
							<td>{item.project}</td>
							<td>{item.machine}</td>
							<td>{item.machine_group}</td>
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
};

export default ItemLists;
