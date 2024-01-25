import React from 'react';
import './App.css';
import ItemLists from './component/ItemList';

const FactoryOpsTimeline = React.lazy(() => import('./component/FactoryOpsTimeline'));

function App() {
	return (
		<div className="App">
			<FactoryOpsTimeline />
			<ItemLists />
		</div>
	);
}

export default App;
