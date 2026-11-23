// Builds the Developer Platform (documentation/) as a static site into public/, which the API serves at the root:
// Vercel serves public/** from its CDN; locally main.ts serves it with useStaticAssets.
// Skipped when documentation/ is absent (e.g. Docker builds, where .dockerignore excludes it).
import { copyFileSync, cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
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
// Hosting providers (Vercel) restore node_modules from the build cache: reinstall whenever the lockfile changed,
// otherwise new or upgraded dependencies are silently missing and the build fails.
const lockHash = createHash('sha256').update(readFileSync(join(docs, 'package-lock.json'))).digest('hex');
const stamp = join(docs, 'node_modules', '.apasbac-lock.sha256');
const installed = existsSync(stamp) ? readFileSync(stamp, 'utf8').trim() : '';
if (installed !== lockHash) {
  run('npm ci --include=dev --no-audit --no-fund');
  writeFileSync(stamp, lockHash);
}
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
