import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, createOpenApiDocument } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // ── OpenAPI ──────────────────────────────────────────────────────────────
  const document = createOpenApiDocument(app);
  // Public, machine-readable contract used by the documentation site and AI agents.
  app.getHttpAdapter().get('/openapi.json', (_req, res: any) => res.json(document));

  // The Swagger UI was replaced by the Developer Platform (documentation/); /docs points to it.
  const docsUrl = process.env.DOCS_URL;
  app.getHttpAdapter().get('/docs', (_req, res: any) =>
    docsUrl ? res.redirect(302, docsUrl) : res.status(404).json({ success: false, statusCode: 404, error: 'Not Found',
      message: 'Documentação não configurada (DOCS_URL). Contrato: /openapi.json' }));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`\n🐾  APASBAC API: http://localhost:${port}/api/v1`);
  console.log(`📚  OpenAPI: http://localhost:${port}/openapi.json${docsUrl ? ` · Docs: ${docsUrl}` : ''}\n`);
}

bootstrap();
