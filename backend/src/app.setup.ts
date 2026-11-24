import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/** Every API route lives under this prefix, in development (Vite proxy) and in production. */
export const API_PREFIX = 'api';

// Shared by main.ts and the e2e tests, so the tests call the same paths as the browser.
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX);
}

/** Where the built frontend is: STATIC_DIR, or the repository's dist/ next to backend/. */
export function frontendDir(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.STATIC_DIR;
  return fromEnv !== undefined && fromEnv !== ''
    ? fromEnv
    : join(import.meta.dirname, '..', '..', 'dist');
}

/**
 * SPA fallback: browser routes such as /me, /login and /v/:token get index.html,
 * so React Router can open them. API paths are never touched: an unknown /api/... path
 * still gets the JSON 404 from the exception filter.
 */
export function spaFallback(
  indexFile: string,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    const isPageRequest = req.method === 'GET' || req.method === 'HEAD';
    const isApi = req.path === `/${API_PREFIX}` || req.path.startsWith(`/${API_PREFIX}/`);
    if (!isPageRequest || isApi) {
      next();
      return;
    }
    res.sendFile(indexFile);
  };
}

/**
 * Single origin: the API and the built React app are served by one server.
 * Does nothing when there is no build (normal `npm run start:dev` with the Vite dev server).
 * Returns true when the frontend is served.
 */
export function serveFrontend(app: NestExpressApplication, dir: string): boolean {
  const indexFile = join(dir, 'index.html');
  if (!existsSync(indexFile)) {
    return false;
  }
  app.useStaticAssets(dir);
  app.use(spaFallback(indexFile));
  return true;
}
