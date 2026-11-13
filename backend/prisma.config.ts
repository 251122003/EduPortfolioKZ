import { defineConfig, env } from 'prisma/config';

// Prisma 7 does not read .env by itself. Node's built-in loader fills process.env
// from backend/.env when the file exists (it is absent in CI, where variables are set directly).
try {
  process.loadEnvFile();
} catch {
  // No .env file: rely on variables already set in the environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
