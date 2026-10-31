// Writes the OpenAPI document generated from the Nest decorators to the documentation app.
// Usage: npm run openapi:export        (write)
//        npm run openapi:check         (fail if the committed file is outdated)
import 'reflect-metadata';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configureApp, createOpenApiDocument } from '../src/setup';

const TARGETS = ['documentation/openapi/openapi.json', 'documentation/public/openapi.json'];

async function main() {
  // preview: providers are not instantiated, so no database or external service is needed.
  const app = await NestFactory.create(AppModule, { preview: true, logger: false, abortOnError: false });
  configureApp(app);
  const json = JSON.stringify(createOpenApiDocument(app), null, 2) + '\n';
  await app.close();
  const root = join(__dirname, '..');
  if (process.argv.includes('--check')) {
    // Line endings are normalized: Windows checkouts may convert the committed file to CRLF.
    const stale = TARGETS.filter((t) => { try { return readFileSync(join(root, t), 'utf8').replace(/\r\n/g, '\n') !== json; } catch { return true; } });
    if (stale.length) { console.error(`OpenAPI desatualizado: ${stale.join(', ')}. Rode npm run openapi:export.`); process.exit(1); }
    console.log('OpenAPI atualizado.');
    return;
  }
  for (const t of TARGETS) { mkdirSync(dirname(join(root, t)), { recursive: true }); writeFileSync(join(root, t), json); }
  console.log(`OpenAPI exportado para ${TARGETS.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
