import './App.css';
import React from 'react';
import { Route, Routes } from 'react-router-dom';
import TimelinePage from './pages/TimelinePage';
import ListPage from './pages/ListPage';

function App() {
	return (
		<>
			<Routes>
				<Route path="/" element={<TimelinePage />} />
				<Route path="/list" element={<ListPage />} />
			</Routes>
		</>
	);
}

export default App;
