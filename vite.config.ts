import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The API runs as Vercel functions in production. In development `npm run dev:api` serves the
// same Hono app on port 8787 and Vite proxies to it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8787',
      '/cal': 'http://localhost:8787',
    },
  },
  build: {
    sourcemap: false,
    target: 'es2022',
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
});
