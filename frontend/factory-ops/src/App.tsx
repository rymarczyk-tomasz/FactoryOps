import React, { useState } from 'react';
import './App.css';
import ItemLists from './component/ItemList';
import DashBoard from './component/DashBoard';
const FactoryOpsTimeline = React.lazy(() => import('./component/FactoryOpsTimeline'));

function App() {
	const [view, setView] = useState('PLAN');

	const handleViewChange = (view) => {
		setView(view);
	};

	return (
		<div className="App row">
			<div className="col-1">
				<DashBoard onViewChange={handleViewChange} />
			</div>
			<div className={`col-11 ${view === 'PLAN' ? 'd-block' : 'd-none'}`}>
				<FactoryOpsTimeline />
			</div>
			<div className={`col-11 ${view === 'ITEM' ? 'd-block' : 'd-none'}`}>
				<ItemLists />
			</div>
		</div>
	);
}

export default App;
