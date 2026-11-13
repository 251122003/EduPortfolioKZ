import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // E2E tests talk to the real database, so they need DATABASE_URL from backend/.env.
    env: loadEnv(mode, process.cwd(), ''),
  },
}));
