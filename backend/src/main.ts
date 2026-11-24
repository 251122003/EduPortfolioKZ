import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp, frontendDir, serveFrontend } from './app.setup.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  if (serveFrontend(app, frontendDir())) {
    new Logger('Bootstrap').log('Serving the built frontend from the same origin');
  }
  // 0.0.0.0: reachable from outside the container (Render, docker run). Render sets PORT.
  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
await bootstrap();
