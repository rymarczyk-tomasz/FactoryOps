import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
	base: '/',
	plugins: [react()],
	build: {
		rolldownOptions: {
			output: {
				// biblioteki zmieniają się rzadziej niż kod aplikacji - osobne pliki dłużej zostają w cache przeglądarki
				codeSplitting: {
					groups: [
						{ name: 'react', test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/ },
						{ name: 'ui', test: /node_modules[\\/](react-bootstrap|react-hook-form)[\\/]/ },
						// bez CSS - style biblioteki muszą zostać w głównym pliku po index.css, jak przed Vite 8
						{ name: 'timeline', test: /node_modules[\\/]react-calendar-timeline[\\/].*\.js$/ }
					]
				}
			}
		}
	}
});
