import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backend = env.BACKEND_URL ?? 'http://localhost:3000';

  return {
    base: env.VITE_BASE_PATH ?? './',
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': backend,
        '/socket.io': { target: backend, ws: true },
      },
    },
    test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
  };
});
