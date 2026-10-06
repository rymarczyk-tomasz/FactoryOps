import React from 'react';
import ReactDOM from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { PlanProvider } from './data/PlanContext';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
	<React.StrictMode>
		{/* na GitHub Pages aplikacja leży w podkatalogu (/FactoryOps/) - base ustawia build */}
		<BrowserRouter basename={import.meta.env.BASE_URL}>
			<PlanProvider>
				<App />
			</PlanProvider>
		</BrowserRouter>
	</React.StrictMode>
);
