import React from 'react';
import './App.css';

const FactoryOpsTimeline = React.lazy(() => import('./component/FactoryOpsTimeline'));



function App() {
	return (
		<div className="App">
			<FactoryOpsTimeline />
		</div>
	);
}

export default App;
