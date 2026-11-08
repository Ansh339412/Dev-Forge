import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// In Docker the backend is reachable as http://backend:3000 (set via BACKEND_URL).
const backend = process.env.BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/socket.io': { target: backend, ws: true },
    },
  },
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
});
