import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-ext-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-ext-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-ext-600.css';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-ext-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-ext-500.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './theme.css';
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
