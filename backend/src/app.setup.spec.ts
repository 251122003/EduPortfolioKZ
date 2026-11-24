import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { configureApp, frontendDir, serveFrontend, spaFallback } from './app.setup.js';

function fakeReq(method: string, path: string): Request {
  return { method, path } as unknown as Request;
}

describe('configureApp', () => {
  it('puts every route under /api', () => {
    const app = { setGlobalPrefix: vi.fn() };
    configureApp(app as unknown as NestExpressApplication);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api');
  });
});

describe('frontendDir', () => {
  it('uses STATIC_DIR when set', () => {
    expect(frontendDir({ STATIC_DIR: '/srv/web' })).toBe('/srv/web');
  });

  it('defaults to the repository dist/ next to backend/', () => {
    expect(frontendDir({})).toMatch(/dist$/);
  });
});

describe('spaFallback', () => {
  const handler = spaFallback('/app/dist/index.html');

  it.each([
    ['GET', '/me'],
    ['GET', '/v/abc123'],
    ['HEAD', '/login'],
  ])('answers %s %s with index.html', (method, path) => {
    const res = { sendFile: vi.fn() };
    const next = vi.fn();
    handler(fakeReq(method, path), res as unknown as Response, next);
    expect(res.sendFile).toHaveBeenCalledWith('/app/dist/index.html');
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', '/api'],
    ['GET', '/api/health'],
    ['GET', '/api/nope'],
    ['POST', '/login'],
  ])('passes %s %s on to the API', (method, path) => {
    const res = { sendFile: vi.fn() };
    const next = vi.fn();
    handler(fakeReq(method, path), res as unknown as Response, next);
    expect(next).toHaveBeenCalled();
    expect(res.sendFile).not.toHaveBeenCalled();
  });
});

describe('serveFrontend', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'edu-web-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('does nothing when there is no build', () => {
    const app = { useStaticAssets: vi.fn(), use: vi.fn() };
    expect(serveFrontend(app as unknown as NestExpressApplication, dir)).toBe(false);
    expect(app.useStaticAssets).not.toHaveBeenCalled();
    expect(app.use).not.toHaveBeenCalled();
  });

  it('serves the files and the SPA fallback when index.html exists', () => {
    writeFileSync(join(dir, 'index.html'), '<!doctype html>');
    const app = { useStaticAssets: vi.fn(), use: vi.fn() };
    expect(serveFrontend(app as unknown as NestExpressApplication, dir)).toBe(true);
    expect(app.useStaticAssets).toHaveBeenCalledWith(dir);
    expect(app.use).toHaveBeenCalledWith(expect.any(Function));
  });
});
