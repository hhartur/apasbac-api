// Verifies every internal link and #anchor in the prerendered pages (run after `next build`).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const APP = '.next/server/app';
if (!existsSync(APP)) { console.error('Rode `npm run build` antes.'); process.exit(1); }

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const pages = new Map();
for (const file of walk(APP).filter((f) => f.endsWith('.html'))) {
  let route = '/' + relative(APP, file).split(sep).join('/').replace(/\.html$/, '');
  route = route === '/index' ? '/' : route;
  pages.set(route, readFileSync(file, 'utf8'));
}
// Route handlers and metadata files emitted as static bodies, plus public/.
const extra = new Set(['/llms.txt', '/llms-full.txt', '/AGENTS.md', '/openapi.json', '/search-index.json', '/sitemap.xml', '/robots.txt', '/icon.png', '/apple-icon.png']);
for (const f of walk('public')) extra.add('/' + relative('public', f).split(sep).join('/'));

const ids = (html) => new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
const errors = [];
let checked = 0;
for (const [route, html] of pages) {
  for (const [, raw] of html.matchAll(/<a[^>]+href="([^"]+)"/g)) {
    const href = raw.replace(/&amp;/g, '&');
    if (!href.startsWith('/') && !href.startsWith('#')) continue;
    checked++;
    const [path, hash] = href.startsWith('#') ? [route, href.slice(1)] : href.split('#');
    const clean = path.split('?')[0].replace(/\/$/, '') || '/';
    if (!pages.has(clean) && !extra.has(clean)) { errors.push(`${route} → ${href} (página inexistente)`); continue; }
    if (hash && pages.has(clean) && !ids(pages.get(clean)).has(decodeURIComponent(hash))) errors.push(`${route} → ${href} (âncora inexistente)`);
  }
}
if (errors.length) { console.error(`${errors.length} link(s) quebrado(s):\n` + [...new Set(errors)].join('\n')); process.exit(1); }
console.log(`OK: ${checked} links internos em ${pages.size} páginas.`);
