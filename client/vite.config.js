import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The React app talks to the Express API on :8000 through this dev proxy, so the
// front end can call plain relative paths (`fetch('/burgers')`).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/burgers': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
});
