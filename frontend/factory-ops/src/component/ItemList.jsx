import { ITEM } from '../data';
import React from 'react';

export default function ItemLists() {
	return (
		<>
			{ITEM.map((item) => (
				<tr key={item.id}>
					<td>{item.id}</td>
					<td>{item.name}</td>
					<td>{item.startTime}</td>
					<td>{item.group}</td>
				</tr>
			))}
		</>
	);
}
