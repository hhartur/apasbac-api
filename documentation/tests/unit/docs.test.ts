import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { document, operations, opHref, TAGS, tags, fieldRows, requestExample } from '../../lib/openapi';
import { buildSnippets, LANGUAGES } from '../../lib/snippets';
import { allDocs, headings, parseFrontmatter, toPlainMarkdown } from '../../lib/content';
import { flatNav, navigation } from '../../lib/navigation';
import { buildLlmsFull, buildLlmsTxt, agentsMarkdown } from '../../lib/llms';
import { buildSearchIndex } from '../../lib/search';
import { rank } from '../../lib/search-score';
import { buildUrl, curlFor, needsConfirmation } from '../../lib/playground';

test('OpenAPI: every operation is reachable, uniquely addressed and tagged', () => {
  assert.ok(operations.length >= 50, `only ${operations.length} operations`);
  const hrefs = operations.map(opHref);
  assert.equal(new Set(hrefs).size, hrefs.length, 'duplicate operation URLs');
  for (const op of operations) assert.ok(TAGS[op.tag], `tag without docs mapping: ${op.tag}`);
  assert.ok(tags.includes('Events') && tags.includes('Audit'));
});

test('OpenAPI: protected operations declare security, public ones are flagged', () => {
  for (const op of operations) {
    if (op.roles.length) assert.equal(op.isPublic, false, `${op.id} has roles but is public`);
  }
  const login = operations.find((o) => o.path === '/api/v1/auth/login')!;
  assert.equal(login.isPublic, true);
  const audit = operations.find((o) => o.path === '/api/v1/admin/audit-logs')!;
  assert.deepEqual(audit.roles, ['ADMIN']);
  const animals = operations.find((o) => o.path === '/api/v1/animals' && o.method === 'GET')!;
  assert.equal(animals.optionalAuth, true);
  assert.equal(document.info.version, '1.1.0');
});

test('snippets: 7 languages per operation, consistent URL and body, no leaked placeholders', () => {
  for (const op of operations) {
    const snippets = buildSnippets(op);
    assert.deepEqual(snippets.map((s) => s.id), LANGUAGES.map((l) => l.id));
    const path = op.path.replace(/\{\w+\}/g, '');
    for (const s of snippets) {
      assert.ok(!/undefined|\[object Object\]/.test(s.code), `${op.id}/${s.id}: ${s.code}`);
      for (const part of path.split('/').filter(Boolean)) assert.ok(s.code.includes(part), `${op.id}/${s.id} misses ${part}`);
      if (!op.isPublic) assert.ok(/Bearer|Authorization|access_token|accessToken/.test(s.code), `${op.id}/${s.id} lacks auth`);
    }
    const body = requestExample(op);
    if (body) for (const key of Object.keys(body)) assert.ok(snippets.every((s) => s.code.includes(key)), `${op.id}: field ${key} missing in a snippet`);
  }
});

test('snippets never invent body fields', () => {
  for (const op of operations) {
    const body = requestExample(op);
    if (!body) continue;
    const allowed = new Set(fieldRows(op.bodySchema).map((r) => r.name));
    for (const key of Object.keys(body)) assert.ok(allowed.has(key), `${op.id}: ${key} not in schema`);
  }
});

test('navigation: every docs link has a page and every page is in the navigation', () => {
  const docs = new Set(allDocs().map((d) => d.href));
  for (const item of flatNav) {
    if (item.href.startsWith('/docs/')) assert.ok(docs.has(item.href), `missing page for ${item.href}`);
  }
  const navHrefs = new Set(flatNav.map((i) => i.href));
  for (const d of docs) assert.ok(navHrefs.has(d), `page not in navigation: ${d}`);
  assert.equal(navigation.length, 9);
});

test('content: every page has title and description; headings get stable ids', () => {
  for (const d of allDocs()) {
    assert.ok(d.meta.title, `${d.href} without title`);
    assert.ok(d.meta.description, `${d.href} without description`);
  }
  assert.deepEqual(headings('## Datas e horários\n```\n## not a heading\n```\n### `x-roles`'), [
    { depth: 2, text: 'Datas e horários', id: 'datas-e-horarios' }, { depth: 3, text: 'x-roles', id: 'x-roles' }]);
  assert.equal(parseFrontmatter('---\ntitle: "A: B"\n---\nbody').meta.title, 'A: B');
  assert.match(toPlainMarkdown('<Endpoint method="GET" path="/events" />'), /`GET \/events`/);
});

test('content: no page documents an endpoint path that does not exist', () => {
  const known = new Set(operations.map((o) => `${o.method} ${o.path.replace('/api/v1', '')}`));
  for (const d of allDocs()) {
    for (const m of d.body.matchAll(/<Endpoint method="(\w+)" path="([^"]+)"/g)) {
      assert.ok(known.has(`${m[1]} ${m[2]}`), `${d.href} references unknown endpoint ${m[1]} ${m[2]}`);
    }
  }
});

test('AI files: llms.txt and llms-full.txt cover every endpoint; AGENTS.md has the mandatory sections', () => {
  const txt = buildLlmsTxt();
  const full = buildLlmsFull();
  for (const op of operations) {
    const line = `${op.method} ${op.path.replace('/api/v1', '')}`;
    assert.ok(txt.includes(line), `llms.txt misses ${line}`);
    assert.ok(full.includes(`## ${line}`), `llms-full.txt misses ${line}`);
  }
  assert.ok(full.length > txt.length * 5);
  const agents = agentsMarkdown();
  for (const h of ['## Papel da IA', '## Regras', '## Processo de integração', '## Adaptação tecnológica']) assert.ok(agents.includes(h), h);
  assert.equal((agents.match(/^\d+\. /gm) ?? []).length >= 27, true, 'rules and process steps');
  assert.ok(existsSync(join(process.cwd(), 'public', 'openapi.json')));
});

test('search: index covers pages, endpoints and schemas; ranking finds them', () => {
  const index = buildSearchIndex();
  assert.ok(index.some((i) => i.kind === 'page') && index.some((i) => i.kind === 'endpoint') && index.some((i) => i.kind === 'schema'));
  assert.equal(rank(index, 'refresh')[0].title.toLowerCase().includes('refresh'), true);
  assert.ok(rank(index, 'POST login').some((i) => i.method === 'POST' && i.href.includes('/autenticacao/login')));
  assert.ok(rank(index, 'categoryId').length > 0, 'body parameters are searchable');
  assert.ok(rank(index, '409').length > 0, 'error codes are searchable');
  assert.deepEqual(rank(index, 'xyzzy-inexistente'), []);
  assert.ok(rank(index, 'autenticacao').length > 0, 'accent-insensitive');
});

test('playground: requests stay on the selected origin and require confirmation for mutations', () => {
  const url = buildUrl('http://localhost:3000', '/api/v1/events/{id}', { id: '3' }, { when: 'upcoming', q: '' });
  assert.equal(url.toString(), 'http://localhost:3000/api/v1/events/3?when=upcoming');
  assert.equal(buildUrl('http://localhost:3000', '/api/v1/events/slug/{slug}', { slug: '../../x?y' }, {}).pathname, '/api/v1/events/slug/..%2F..%2Fx%3Fy');
  assert.throws(() => buildUrl('http://localhost:3000', '/api/v1/users/{id}', {}, {}), /parâmetro/);
  assert.throws(() => buildUrl('http://localhost:3000', '//evil.example/x', {}, {}), /Destino/);
  assert.equal(needsConfirmation('GET'), false);
  for (const m of ['POST', 'PATCH', 'DELETE']) assert.equal(needsConfirmation(m), true);
  const curl = curlFor('POST', 'http://localhost:3000/api/v1/auth/logout', { auth: true, json: "{\"a\":\"it's\"}" });
  assert.match(curl, /\$APASBAC_ACCESS_TOKEN/);
  assert.ok(!curl.includes('eyJ'), 'cURL never contains a real token');
});
