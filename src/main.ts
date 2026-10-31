import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'node:path';
import { AppModule } from './app.module';
import { configureApp, createOpenApiDocument } from './setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  // ── OpenAPI ──────────────────────────────────────────────────────────────
  const document = createOpenApiDocument(app);
  // Public, machine-readable contract used by the documentation site and AI agents.
  app.getHttpAdapter().get('/openapi.json', (_req, res: any) => res.json(document));

  // Developer Platform (static export in public/, see scripts/build-docs.mjs) served at the root.
  // On Vercel the CDN serves public/** before this function; this covers local and Docker runs.
  app.useStaticAssets(join(process.cwd(), 'public'));
  // The Swagger UI was replaced by the Developer Platform; /docs (no page of its own) goes to its home.
  app.getHttpAdapter().get('/docs', (_req, res: any) => res.redirect(302, process.env.DOCS_URL || '/'));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🐾  APASBAC API: http://localhost:${port}/api/v1`);
  console.log(`📚  Documentação: http://localhost:${port}/ · OpenAPI: http://localhost:${port}/openapi.json\n`);
}

bootstrap();
