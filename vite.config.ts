/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// API calls go to /api/* on the same origin (so the SameSite=Strict session cookie works).
// The NestJS server itself serves the API under /api (backend/src/app.setup.ts), so the dev proxy
// forwards paths unchanged; in production the same server also serves this build (single origin).
// The prefix keeps SPA routes like /me and /v/:token from clashing with server paths.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // main.tsx only mounts <App /> into the real DOM; App itself is tested.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      // claude.md: coverage stays at 80% or above; the run fails below that.
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
