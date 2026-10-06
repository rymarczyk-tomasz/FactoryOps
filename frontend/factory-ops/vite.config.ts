import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

// https://vitejs.dev/config/
export default defineConfig({
	base: '/',
	plugins: [react()],
	build: {
		rollupOptions: {
			output: {
				// biblioteki zmieniają się rzadziej niż kod aplikacji - osobne pliki dłużej zostają w cache przeglądarki
				manualChunks: {
					react: ['react', 'react-dom', 'react-router-dom'],
					ui: ['react-bootstrap', 'react-hook-form'],
					timeline: ['react-calendar-timeline']
				}
			}
		}
	}
});
