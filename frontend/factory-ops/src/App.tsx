import React from 'react';
import './App.css';
import ItemLists from './component/ItemList';

const FactoryOpsTimeline = React.lazy(() => import('./component/FactoryOpsTimeline'));

function App() {
	return (
		<div className="App">
			<FactoryOpsTimeline />
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
						<ItemLists />
					</tbody>
				</table>
			</>
		</div>
	);
}

export default App;
