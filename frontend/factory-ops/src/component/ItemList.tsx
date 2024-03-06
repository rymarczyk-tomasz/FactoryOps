import React, { useEffect, useState } from 'react';
import { mockedData } from '../data';
import { ItemListModel } from '../models/ItemListModel';
import { Programmer } from '../models/Programmer';

const ItemLists: React.FC = () => {
	const [programmers, setProgrammers] = useState<Programmer[]>([]);
	const [mockData, setMockData] = useState<ItemListModel[]>([]);

	useEffect(() => {
		async function fetchData() {
			setProgrammers(programmers);
			setMockData(mockedData);
		}
		fetchData();
	}, []);

	return (
		<>
			<table className="table">
				<thead>
					<tr>
						<th>Start Date</th>
						<th>Project</th>
						<th>Machine</th>
						<th>Machine Group</th>
						<th>Time</th>
						<th>Programmer</th>
					</tr>
				</thead>
				<tbody>
					{mockData.map((item) => (
						<tr key={item.id}>
							<td>{item.startDate}</td>
							<td>{item.project}</td>
							<td>{item.machine}</td>
							<td>{item.machine_group}</td>
							<td>{item.lengthOfHours} godzin</td>
							<td>
								<select>
									<option>Select Programmer</option>
									{programmers.map((programmer, index) => (
										<option key={index}>
											{programmer.name} {programmer.surname}
										</option>
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
