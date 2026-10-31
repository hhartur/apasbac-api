// End-to-end tests against a real PostgreSQL database (the whole Nest app, real guards, pipes and Prisma).
// Only e-mail and Cloudinary are replaced by fakes. The database is RESET: E2E_DATABASE_URL must point to a
// database whose name ends with "_test".
//   E2E_DATABASE_URL=postgresql://user:pass@localhost:5432/apasbac_test npm run test:e2e
import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { execSync } from 'node:child_process';
import { after, before, describe, test } from 'node:test';

const url = process.env.E2E_DATABASE_URL ?? '';
if (!/\/[^/?]+_test(\?|$)/.test(url)) throw new Error('E2E_DATABASE_URL must point to a database named *_test (it will be reset)');
Object.assign(process.env, {
  DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'e2e-access-secret-0123456789abcdef', JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef',
  CLOUDINARY_CLOUD_NAME: 'apasbac-e2e',
});

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../../src/app.module';
import { configureApp, createOpenApiDocument } from '../../src/setup';
import { MailService } from '../../src/mail/mail.service';
import { StorageService } from '../../src/storage/storage.service';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
let app: INestApplication;
let base = '';
let prisma: PrismaClient;
const deleted: string[] = [];
const tokens: Record<string, string> = {};
const ids: Record<string, string> = {};

async function call(method: string, path: string, opts: { token?: string; body?: unknown; form?: FormData; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: opts.form ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
}

async function login(email: string, password = 'Senha@123') {
  const r = await call('POST', '/api/v1/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  return r.body.data;
}

before(async () => {
  execSync('npx prisma migrate reset --force --skip-seed', { stdio: 'ignore', env: process.env });
  prisma = new PrismaClient();
  const password = await bcrypt.hash('Senha@123', 4);
  for (const [key, role] of [['admin', 'ADMIN'], ['staff', 'STAFF'], ['tutor', 'TUTOR'], ['user', 'USER']] as const) {
    const u = await prisma.user.create({ data: { fullName: key, email: `${key}@e2e.test`, cpf: String(10000000000 + key.length * 7 + key.charCodeAt(0)), phone: '1', password, role } });
    ids[key] = u.id;
  }
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MailService).useValue({ sendWelcome: async () => {}, sendPasswordReset: async () => {}, sendMonitoringResult: async () => {} })
    .overrideProvider(StorageService).useValue(Object.assign(Object.create(StorageService.prototype), {
      upload: async (_f: unknown, folder: string) => `https://res.cloudinary.com/apasbac-e2e/image/upload/v1/${folder}/${Math.random().toString(36).slice(2)}.jpg`,
      uploadMany: async (files: unknown[], folder: string) => files.map((_, i) => `https://res.cloudinary.com/apasbac-e2e/image/upload/v1/${folder}/${i}.jpg`),
      delete: async (u: string) => { deleted.push(u); }, deleteMany: async (us: string[]) => { deleted.push(...us); },
    }))
    .compile();
  app = moduleRef.createNestApplication();
  configureApp(app);
  const doc = createOpenApiDocument(app);
  app.getHttpAdapter().get('/openapi.json', (_req, res: any) => res.json(doc));
  await app.listen(0);
  base = await app.getUrl();
  base = base.replace('[::1]', 'localhost');
  for (const key of ['admin', 'staff', 'tutor', 'user']) tokens[key] = (await login(`${key}@e2e.test`)).accessToken;
});

after(async () => { await app?.close(); await prisma?.$disconnect(); });

describe('platform', () => {
  test('OpenAPI is public and security headers / request id are set', async () => {
    const r = await call('GET', '/openapi.json');
    assert.equal(r.status, 200);
    assert.ok(r.body.paths['/api/v1/events']);
    const h = await call('GET', '/api/v1/events', { headers: { 'X-Request-Id': 'e2e-request-0001' } });
    assert.equal(h.headers.get('x-request-id'), 'e2e-request-0001');
    assert.equal(h.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(h.headers.get('x-powered-by'), null);
  });
});

describe('authentication', () => {
  test('register returns a session and never the password; duplicates are rejected', async () => {
    const body = { fullName: 'Nova Pessoa', phone: '+55 44 90000-0000', cpf: '98765432100', email: 'nova@e2e.test', password: 'Senha@123', confirmPassword: 'Senha@123' };
    const r = await call('POST', '/api/v1/auth/register', { body });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.user.password, undefined);
    assert.equal(r.body.data.user.role, 'USER');
    assert.ok(r.body.data.accessToken && r.body.data.refreshToken);
    assert.equal((await call('POST', '/api/v1/auth/register', { body })).status, 400);
    assert.equal((await call('POST', '/api/v1/auth/register', { body: { ...body, email: 'x@e2e.test', cpf: '11122233344', role: 'ADMIN' } })).status, 400, 'mass assignment of role');
  });

  test('wrong credentials: 401 with the same message, audited as failure', async () => {
    const a = await call('POST', '/api/v1/auth/login', { body: { email: 'user@e2e.test', password: 'Errada@123' } });
    const b = await call('POST', '/api/v1/auth/login', { body: { email: 'ninguem@e2e.test', password: 'Errada@123' } });
    assert.equal(a.status, 401); assert.equal(b.status, 401);
    assert.equal(a.body.message, b.body.message, 'no user enumeration');
    const logs = await prisma.auditLog.findMany({ where: { action: 'AUTH_LOGIN_FAILED' } });
    assert.ok(logs.length >= 2);
    assert.ok(!JSON.stringify(logs).includes('Errada@123'), 'password never audited');
  });

  test('missing, invalid and expired access tokens are refused', async () => {
    assert.equal((await call('GET', '/api/v1/users/me')).status, 401);
    assert.equal((await call('GET', '/api/v1/users/me', { token: 'abc.def.ghi' })).status, 401);
    const expired = new JwtService().sign({ sub: ids.user, exp: Math.floor(Date.now() / 1000) - 60 }, { secret: process.env.JWT_ACCESS_SECRET });
    assert.equal((await call('GET', '/api/v1/users/me', { token: expired })).status, 401);
    const forged = new JwtService().sign({ sub: ids.admin, role: 'ADMIN' }, { secret: 'not-the-secret' });
    assert.equal((await call('GET', '/api/v1/users', { token: forged })).status, 401);
  });

  test('refresh rotates the token; the old one cannot be used again; logout ends the session', async () => {
    const s = await login('user@e2e.test');
    const r1 = await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: s.refreshToken } });
    assert.equal(r1.status, 200);
    assert.notEqual(r1.body.data.refreshToken, s.refreshToken);
    assert.equal((await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: s.refreshToken } })).status, 401);
    const stored = await prisma.refreshToken.findMany({ where: { userId: ids.user } });
    assert.ok(!stored.some((t) => t.token === r1.body.data.refreshToken), 'refresh tokens stored hashed');
    assert.equal((await call('POST', '/api/v1/auth/logout', { token: r1.body.data.accessToken, body: { refreshToken: r1.body.data.refreshToken } })).status, 200);
    assert.equal((await call('POST', '/api/v1/auth/refresh', { body: { refreshToken: r1.body.data.refreshToken } })).status, 401);
  });
});

describe('authorization', () => {
  test('IDOR and privilege escalation are blocked', async () => {
    assert.equal((await call('GET', '/api/v1/users', { token: tokens.user })).status, 403);
    assert.equal((await call('GET', `/api/v1/users/${ids.tutor}`, { token: tokens.user })).status, 403);
    assert.equal((await call('PATCH', `/api/v1/users/${ids.tutor}`, { token: tokens.user, body: { fullName: 'Hack' } })).status, 403);
    assert.equal((await call('PATCH', `/api/v1/users/${ids.user}/role`, { token: tokens.user, body: { role: 'ADMIN' } })).status, 403);
    assert.equal((await call('PATCH', `/api/v1/users/${ids.user}`, { token: tokens.user, body: { role: 'ADMIN' } })).status, 400);
    assert.equal((await call('PATCH', `/api/v1/users/${ids.admin}`, { token: tokens.staff, body: { fullName: 'Hack' } })).status, 403);
    assert.equal((await call('PATCH', `/api/v1/users/${ids.admin}/role`, { token: tokens.admin, body: { role: 'USER' } })).status, 400);
    assert.equal((await call('GET', '/api/v1/configs', { token: tokens.tutor })).status, 403);
    assert.equal((await call('GET', '/api/v1/admin/audit-logs', { token: tokens.staff })).status, 403);
  });

  test('signed upload refuses folders outside the role policy', async () => {
    const r = await call('POST', '/api/v1/storage/signed-upload', { token: tokens.tutor, body: { folder: 'animals/photos', resource_type: 'image' } });
    assert.equal(r.status, 403);
    const o = await call('POST', '/api/v1/storage/signed-upload', { token: tokens.tutor, body: { folder: 'monitoring/images', resource_type: 'image', overwrite: true } });
    assert.equal(o.status, 403);
  });

  test('public animal list hides QR uuid and adopter data', async () => {
    await prisma.animal.create({ data: { name: 'Bolt', description: 'd', breed: 'SRD', sex: 'MALE', size: 'SMALL', vaccines: [], temperament: 't',
      isAdopted: true, adoptedById: ids.tutor } });
    const anon = await call('GET', '/api/v1/animals');
    assert.equal(anon.status, 200);
    assert.equal(anon.body.data.data[0].uuid, undefined);
    assert.equal(anon.body.data.data[0].adoptedBy, null);
    const own = await call('GET', '/api/v1/animals', { token: tokens.tutor });
    assert.ok(own.body.data.data[0].uuid);
    assert.equal((await call('GET', '/api/v1/animals', { token: 'bad.token.value' })).status, 401);
  });
});

describe('events', () => {
  let categoryId = 0;
  let eventId = 0;
  const base = { title: 'Feira de Adoção de Primavera', description: 'Venha adotar.', startsAt: '2099-11-21T13:00:00.000Z',
    endsAt: '2099-11-21T19:00:00.000Z', city: 'Assis Chateaubriand', state: 'PR', latitude: -24.41, longitude: -53.52 };

  test('categories are managed by ADMIN only and listed publicly', async () => {
    assert.equal((await call('POST', '/api/v1/events/categories', { token: tokens.staff, body: { name: 'Adoção' } })).status, 403);
    const c = await call('POST', '/api/v1/events/categories', { token: tokens.admin, body: { name: 'Adoção' } });
    assert.equal(c.status, 201); assert.equal(c.body.data.slug, 'adocao');
    categoryId = c.body.data.id;
    const list = await call('GET', '/api/v1/events/categories');
    assert.equal(list.status, 200); assert.equal(list.body.data.length, 1);
  });

  test('only staff create events; validation rejects bad data', async () => {
    assert.equal((await call('POST', '/api/v1/events', { body: { ...base, categoryId } })).status, 401);
    assert.equal((await call('POST', '/api/v1/events', { token: tokens.user, body: { ...base, categoryId } })).status, 403);
    assert.equal((await call('POST', '/api/v1/events', { token: tokens.staff, body: { ...base, categoryId, endsAt: '2099-11-20T00:00:00Z' } })).status, 400);
    assert.equal((await call('POST', '/api/v1/events', { token: tokens.staff, body: { ...base, categoryId, latitude: 200 } })).status, 400);
    assert.equal((await call('POST', '/api/v1/events', { token: tokens.staff, body: { ...base, categoryId, coverImageUrl: 'http://insecure.example/x.jpg' } })).status, 400, 'https only');
    assert.equal((await call('POST', '/api/v1/events', { token: tokens.staff, body: { ...base, categoryId: 999 } })).status, 404);
    const r = await call('POST', '/api/v1/events', { token: tokens.staff, body: { ...base, categoryId } });
    assert.equal(r.status, 201);
    assert.equal(r.body.data.status, 'DRAFT');
    assert.equal(r.body.data.slug, 'feira-de-adocao-de-primavera');
    eventId = r.body.data.id;
  });

  test('drafts are never public; published events are', async () => {
    assert.equal((await call('GET', `/api/v1/events/${eventId}`)).status, 404);
    assert.equal((await call('GET', '/api/v1/events')).body.data.total, 0);
    assert.equal((await call('GET', '/api/v1/admin/events', { token: tokens.staff })).body.data.total, 1);
    const p = await call('PATCH', `/api/v1/events/${eventId}`, { token: tokens.staff, body: { status: 'PUBLISHED' } });
    assert.equal(p.status, 200); assert.ok(p.body.data.publishedAt);
    const pub = await call('GET', '/api/v1/events?when=upcoming&category=adocao');
    assert.equal(pub.body.data.total, 1);
    assert.equal(pub.body.data.data[0].createdById, undefined, 'internal author hidden publicly');
    assert.equal((await call('GET', '/api/v1/events/slug/feira-de-adocao-de-primavera')).status, 200);
    assert.equal((await call('GET', '/api/v1/events?when=past')).body.data.total, 0);
    assert.equal((await call('GET', '/api/v1/events?status=DRAFT')).status, 400);
  });

  test('cover image upload validates content and replaces the old file', async () => {
    const bad = new FormData(); bad.append('image', new Blob(['not an image']), 'x.jpg');
    assert.equal((await call('POST', `/api/v1/events/${eventId}/image`, { token: tokens.staff, form: bad })).status, 400);
    const form = () => { const f = new FormData(); f.append('image', new Blob([JPEG], { type: 'image/jpeg' }), 'capa.jpg'); return f; };
    const first = await call('POST', `/api/v1/events/${eventId}/image`, { token: tokens.staff, form: form() });
    assert.equal(first.status, 201, JSON.stringify(first.body));
    const second = await call('POST', `/api/v1/events/${eventId}/image`, { token: tokens.staff, form: form() });
    assert.notEqual(second.body.data.coverImageUrl, first.body.data.coverImageUrl);
    assert.ok(deleted.includes(first.body.data.coverImageUrl), 'replaced file is deleted: ' + JSON.stringify({ deleted, first: first.body.data.coverImageUrl }));
    assert.equal((await call('POST', `/api/v1/events/${eventId}/image`, { token: tokens.user, form: form() })).status, 403);
  });

  test('event images: URL or files, never both', async () => {
    const jpeg = () => new Blob([JPEG], { type: 'image/jpeg' });
    const fields = (f: FormData) => { for (const [k, v] of Object.entries({ ...base, categoryId })) f.append(k, String(v)); return f; };

    const both = fields(new FormData()); both.append('cover', jpeg(), 'c.jpg'); both.append('coverImageUrl', 'https://img.example/c.jpg');
    const r1 = await call('POST', '/api/v1/events', { token: tokens.staff, form: both });
    assert.equal(r1.status, 400); assert.match(String(r1.body.message), /não os dois/);

    const both2 = fields(new FormData()); both2.append('gallery', jpeg(), 'g.jpg'); both2.append('galleryUrls', 'https://img.example/g.jpg');
    assert.equal((await call('POST', '/api/v1/events', { token: tokens.staff, form: both2 })).status, 400);

    const files = fields(new FormData()); files.append('cover', jpeg(), 'c.jpg'); files.append('gallery', jpeg(), 'g1.jpg'); files.append('gallery', jpeg(), 'g2.jpg');
    const r2 = await call('POST', '/api/v1/events', { token: tokens.staff, form: files });
    assert.equal(r2.status, 201, JSON.stringify(r2.body));
    assert.match(r2.body.data.coverImageUrl, /res\.cloudinary\.com\/apasbac-e2e\/.*events\/covers/);
    assert.equal(r2.body.data.galleryUrls.length, 2);

    const fake = fields(new FormData()); fake.append('cover', new Blob(['<svg/>']), 'c.jpg');
    assert.equal((await call('POST', '/api/v1/events', { token: tokens.staff, form: fake })).status, 400, 'content is verified');

    const r3 = await call('PATCH', `/api/v1/events/${r2.body.data.id}`, { token: tokens.staff, body: { coverImageUrl: 'https://img.example/nova.jpg' } });
    assert.equal(r3.status, 200);
    assert.equal(r3.body.data.coverImageUrl, 'https://img.example/nova.jpg');
    assert.ok(deleted.includes(r2.body.data.coverImageUrl), 'replaced cover deleted');
  });

  test('animal photos: URL or files, never both', async () => {
    const jpeg = () => new Blob([JPEG], { type: 'image/jpeg' });
    const animal = { name: 'Mel', description: 'd', breed: 'SRD', sex: 'FEMALE', size: 'SMALL', vaccines: 'V10', temperament: 't', escapeTendency: 'false' };
    const fields = () => { const f = new FormData(); for (const [k, v] of Object.entries(animal)) f.append(k, v); return f; };

    const both = fields(); both.append('photos', jpeg(), 'a.jpg'); both.append('photoUrls', 'https://img.example/a.jpg');
    assert.equal((await call('POST', '/api/v1/animals', { token: tokens.staff, form: both })).status, 400);

    const files = fields(); files.append('photos', jpeg(), 'a.jpg');
    const r = await call('POST', '/api/v1/animals', { token: tokens.staff, form: files });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.match(r.body.data.photos[0], /animals\/photos/);

    const urls = await call('POST', '/api/v1/animals', { token: tokens.staff,
      body: { ...animal, vaccines: ['V10'], escapeTendency: false, photoUrls: ['https://img.example/b.jpg'] } });
    assert.equal(urls.status, 201);
    assert.deepEqual(urls.body.data.photos, ['https://img.example/b.jpg']);

    const upd = await call('PATCH', `/api/v1/animals/${r.body.data.id}`, { token: tokens.staff, body: { photoUrls: ['https://img.example/c.jpg'] } });
    assert.equal(upd.status, 200, JSON.stringify(upd.body));
    assert.deepEqual(upd.body.data.photos, ['https://img.example/c.jpg']);
    assert.ok(deleted.includes(r.body.data.photos[0]), 'replaced photo deleted');

    const bothUpd = new FormData(); bothUpd.append('photos', jpeg(), 'a.jpg'); bothUpd.append('photoUrls', 'https://img.example/d.jpg');
    assert.equal((await call('PATCH', `/api/v1/animals/${r.body.data.id}`, { token: tokens.staff, form: bothUpd })).status, 400);
  });

  test('cancelled events stay public with a reason; category in use cannot be deleted', async () => {
    const c = await call('PATCH', `/api/v1/events/${eventId}`, { token: tokens.staff, body: { status: 'CANCELLED', cancellationReason: 'Chuva' } });
    assert.equal(c.body.data.status, 'CANCELLED');
    const pub = await call('GET', `/api/v1/events/${eventId}`);
    assert.equal(pub.body.data.cancellationReason, 'Chuva');
    assert.equal((await call('DELETE', `/api/v1/events/categories/${categoryId}`, { token: tokens.admin })).status, 409);
    assert.equal((await call('DELETE', `/api/v1/events/${eventId}`, { token: tokens.staff })).status, 403);
  });
});

describe('audit', () => {
  test('mutations are audited without sensitive values and logs are append-only', async () => {
    const r = await call('GET', '/api/v1/admin/audit-logs?action=EVENT_CREATE', { token: tokens.admin });
    assert.equal(r.status, 200);
    assert.ok(r.body.data.total >= 1);
    const log = r.body.data.data[0];
    assert.equal(log.actorId, ids.staff); assert.equal(log.actorRole, 'STAFF'); assert.ok(log.requestId); assert.ok(log.ipAddress);
    assert.ok((await call('GET', `/api/v1/admin/audit-logs?resource=event&resourceId=${log.resourceId}`, { token: tokens.admin })).body.data.total >= 2);
    await assert.rejects(prisma.$executeRawUnsafe('DELETE FROM audit_logs'), /append-only/);
    await assert.rejects(prisma.$executeRawUnsafe(`UPDATE audit_logs SET action = 'X'`), /append-only/);
  });
});

describe('rate limiting', () => {
  test('login is throttled per IP', async () => {
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await call('POST', '/api/v1/auth/login', { body: { email: 'x@e2e.test', password: 'Errada@123' } })).status;
    assert.equal(last, 429);
  });
});
