// Builds the Developer Platform (documentation/) as a static site into public/, which the API serves at the root:
// Vercel serves public/** from its CDN; locally main.ts serves it with useStaticAssets.
// Skipped when documentation/ is absent (e.g. Docker builds, where .dockerignore excludes it).
import { copyFileSync, cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const docs = join(root, 'documentation');
if (!existsSync(join(docs, 'package.json'))) {
  console.log('documentation/ ausente: build da documentação ignorado.');
  process.exit(0);
}
const run = (cmd) => execSync(cmd, { cwd: docs, stdio: 'inherit', env: { ...process.env, DOCS_EXPORT: '1', NEXT_TELEMETRY_DISABLED: '1' } });
// --include=dev: hosting builds often run with NODE_ENV=production, which would skip Tailwind/TypeScript.
if (!existsSync(join(docs, 'node_modules'))) run('npm ci --include=dev --no-audit --no-fund');
run('npx next build');
rmSync(join(root, 'public'), { recursive: true, force: true });
cpSync(join(docs, 'out'), join(root, 'public'), { recursive: true });

// Next 16 exports prefetch segments as folders (__next.docs/$c$slug/__PAGE__.txt) but the client requests the
// flattened name (__next.docs.$c$slug.__PAGE__.txt); without a Next server, write that name too.
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
for (const file of walk(join(root, 'public'))) {
  const parts = relative(join(root, 'public'), file).split(sep);
  const i = parts.findIndex((p) => p.startsWith('__next.'));
  if (i >= 0 && i < parts.length - 1) copyFileSync(file, join(root, 'public', ...parts.slice(0, i), parts.slice(i).join('.')));
}
console.log('Documentação exportada para public/');
