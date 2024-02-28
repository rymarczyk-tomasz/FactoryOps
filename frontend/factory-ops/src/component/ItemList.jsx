import React, { useEffect, useState } from 'react';
import { ProgrammerService } from '../services/ProgrammerService';
import { mockedData } from '../data';

export default function ItemLists() {
	const [programmers, setProgrammers] = useState([]);
	const [mockData, setMockData] = useState([]);

	useEffect(() => {
		async function fetchData(){
			const programmers = await ProgrammerService.getAllProgrammers();
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
							<td>
								<select>
									<option>Select Programmer</option>
									{programmers.map((programmer, index) => (
										<option key={index}>{programmer.name} {programmer.surname}</option>
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
