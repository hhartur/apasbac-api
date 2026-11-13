import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { sanitizeMetadata, AuditService } from '../src/audit/audit.service';
import { httpLogger, accessLine } from '../src/common/http-logger';
import { assertImages, detectImageType, imageSource, toStringArray } from '../src/common/uploads';
import { StorageService } from '../src/storage/storage.service';
import { slugify } from '../src/events/events.service';
import { AuthService, REUSE_GRACE_MS, sha256 } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { AnimalsService } from '../src/animals/animals.service';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { esc } from '../src/mail/mail.service';
import { isDisposableEmail } from '../src/common/disposable-email';
import { DISPOSABLE_DOMAINS_COUNT } from '../src/common/disposable-domains.generated';

process.env.JWT_ACCESS_SECRET = 'test-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(20)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20)]);
const file = (buffer: Buffer, originalname: string, mimetype: string) => ({ buffer, originalname, mimetype, size: buffer.length }) as Express.Multer.File;

test('audit metadata never keeps credentials, tokens or personal data', () => {
  const out = sanitizeMetadata({ password: 'x', refreshToken: 'y', nested: { cpf: '1', email: 'a@b', phone: '9', name: 'ok' }, fields: ['password'] }) as any;
  assert.equal(out.password, '[redacted]');
  assert.equal(out.refreshToken, '[redacted]');
  assert.deepEqual(out.nested, { cpf: '[redacted]', email: '[redacted]', phone: '[redacted]', name: 'ok' });
  assert.deepEqual(out.fields, ['password']); // field names are allowed, values are not
});

test('uploads are validated by content, not by extension or declared MIME', () => {
  assert.equal(detectImageType(JPEG), 'image/jpeg');
  assert.equal(detectImageType(PNG), 'image/png');
  assert.equal(detectImageType(Buffer.from('<?php echo 1; ?>          ')), null);
  assert.doesNotThrow(() => assertImages([file(JPEG, 'a.jpg', 'image/jpeg'), file(PNG, 'b.png', 'application/octet-stream')]));
  assert.throws(() => assertImages([file(Buffer.from('<script>alert(1)</script>'), 'x.jpg', 'image/jpeg')]));
  assert.throws(() => assertImages([file(JPEG, 'x.png', 'image/png')])); // extension/MIME lie about the content
  assert.throws(() => assertImages([file(JPEG, 'x.svg', 'image/jpeg')]));
});

test('signed upload policy: folders per role, no overwrite/public_id for non-staff', () => {
  const s = new StorageService();
  assert.doesNotThrow(() => s.assertUploadAllowed({ folder: 'monitoring/images', resource_type: 'image' }, 'TUTOR'));
  assert.doesNotThrow(() => s.assertUploadAllowed({ folder: 'monitoring/videos', resource_type: 'video' }, 'USER'));
  assert.doesNotThrow(() => s.assertUploadAllowed({ folder: 'animals/photos', resource_type: 'image', public_id: 'x' }, 'STAFF'));
  for (const [dto, role] of [
    [{ folder: 'animals/photos', resource_type: 'image' }, 'TUTOR'],
    [{ resource_type: 'image' }, 'USER'],
    [{ folder: '../etc', resource_type: 'image' }, 'ADMIN'],
    [{ folder: 'monitoring/images', resource_type: 'raw' }, 'TUTOR'],
    [{ folder: 'monitoring/images', resource_type: 'image', overwrite: true }, 'TUTOR'],
    [{ folder: 'monitoring/images', resource_type: 'image', public_id: 'animals/photos/x' }, 'TUTOR'],
  ] as const) {
    assert.throws(() => s.assertUploadAllowed(dto as any, role), /permitid|restritos/);
  }
});

test('owned media URLs are restricted to the configured Cloudinary account', () => {
  process.env.CLOUDINARY_CLOUD_NAME = 'apasbac';
  const s = new StorageService();
  assert.equal(s.isOwnedUrl('https://res.cloudinary.com/apasbac/image/upload/v1/x.jpg'), true);
  assert.equal(s.isOwnedUrl('https://res.cloudinary.com/other/image/upload/v1/x.jpg'), false);
  assert.equal(s.isOwnedUrl('https://evil.example/apasbac/x.jpg'), false);
  assert.equal(s.isOwnedUrl('http://res.cloudinary.com/apasbac/x.jpg'), false);
  delete process.env.CLOUDINARY_CLOUD_NAME;
});

test('slugify produces URL-safe slugs from Portuguese titles', () => {
  assert.equal(slugify('Feira de Adoção — Primavera 2026!'), 'feira-de-adocao-primavera-2026');
  assert.equal(slugify('   '), 'evento');
});

test('e-mail templates escape user-controlled text', () => {
  assert.equal(esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
});

// ── Refresh token rotation ───────────────────────────────────────────────────

function authFixture() {
  const tokens: any[] = [];
  const audits: any[] = [];
  const user = { id: 'u1', email: 'a@b.c', role: 'USER', fullName: 'A', password: '' };
  const prisma: any = {
    user: { findUnique: async () => user },
    refreshToken: {
      create: async ({ data }) => { const t = { id: String(tokens.length + 1), revokedAt: null, createdAt: new Date(), ...data }; tokens.push(t); return t; },
      findFirst: async ({ where }) => tokens.find((t) => where.token.in.includes(t.token)) ?? null,
      updateMany: async ({ where, data }) => {
        const hit = tokens.filter((t) => (where.id ? t.id === where.id : true) && (where.familyId ? t.familyId === where.familyId : true)
          && (where.userId ? t.userId === where.userId : true) && (where.revokedAt === null ? t.revokedAt === null : true));
        hit.forEach((t) => Object.assign(t, data));
        return { count: hit.length };
      },
    },
  };
  const audit: any = { record: async (e) => { audits.push(e); } };
  const service = new AuthService(prisma, new JwtService(), {} as any, audit);
  return { service, tokens, audits, user };
}

test('refresh tokens are unique, stored hashed and rotated', async () => {
  const { service, tokens, user } = authFixture();
  const a = await (service as any).issueTokens(user);
  const b = await (service as any).issueTokens(user);
  assert.notEqual(a.refreshToken, b.refreshToken);
  assert.equal(tokens[0].token, sha256(a.refreshToken));
  assert.ok(!tokens.some((t) => t.token === a.refreshToken), 'plain refresh token must not be stored');
  const next = await service.refresh(a.refreshToken);
  assert.ok(next.refreshToken && next.refreshToken !== a.refreshToken);
  assert.ok(tokens[0].revokedAt, 'used token is revoked');
  assert.equal(tokens[2].familyId, tokens[0].familyId, 'rotation keeps the session family');
});

test('reusing a rotated refresh token revokes the whole session', async () => {
  const { service, tokens, audits, user } = authFixture();
  const first = await (service as any).issueTokens(user);
  const second = await service.refresh(first.refreshToken);
  tokens[0].revokedAt = new Date(Date.now() - REUSE_GRACE_MS - 1000);
  await assert.rejects(service.refresh(first.refreshToken), (e: HttpException) => e.getStatus() === 401);
  assert.ok(audits.some((a) => a.action === 'AUTH_REFRESH_REUSE_DETECTED'));
  await assert.rejects(service.refresh(second.refreshToken), (e: HttpException) => e.getStatus() === 401);
});

test('a parallel refresh inside the grace window is refused without killing the session', async () => {
  const { service, audits, user } = authFixture();
  const first = await (service as any).issueTokens(user);
  const second = await service.refresh(first.refreshToken);
  await assert.rejects(service.refresh(first.refreshToken));
  assert.ok(!audits.some((a) => a.action === 'AUTH_REFRESH_REUSE_DETECTED'));
  assert.ok(await service.refresh(second.refreshToken));
});

test('invalid and forged refresh tokens are rejected', async () => {
  const { service } = authFixture();
  await assert.rejects(service.refresh('not-a-jwt'), (e: HttpException) => e.getStatus() === 401);
  const forged = new JwtService().sign({ sub: 'u1' }, { secret: 'attacker' });
  await assert.rejects(service.refresh(forged), (e: HttpException) => e.getStatus() === 401);
});

// ── Authorization rules ──────────────────────────────────────────────────────

test('users: no IDOR, STAFF cannot edit ADMIN, ADMIN cannot change own role or delete self', async () => {
  const prisma: any = { user: {
    findUnique: async ({ where }) => (where.id === 'admin' ? { role: 'ADMIN' } : { role: 'USER' }),
    update: async ({ where, data }) => ({ id: where.id, password: 'hash', ...data }),
    delete: async () => undefined,
  } };
  const users = new UsersService(prisma);
  await assert.rejects(users.update('other', { fullName: 'X' }, { id: 'me', role: 'USER' }), (e: HttpException) => e.getStatus() === 403);
  await assert.rejects(users.update('admin', { fullName: 'X' }, { id: 'staff', role: 'STAFF' }), (e: HttpException) => e.getStatus() === 403);
  const own = await users.update('me', { fullName: 'Eu' }, { id: 'me', role: 'USER' });
  assert.equal(own.password, undefined, 'password hash never leaves the service');
  await assert.rejects(users.updateRole('admin', { role: 'USER' as any }, { id: 'admin', role: 'ADMIN' }));
  await assert.rejects(users.remove('admin', { id: 'admin', role: 'ADMIN' }));
});

test('RolesGuard denies missing or wrong roles', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (role?: string) => ({
    getHandler: () => undefined, getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  }) as unknown as ExecutionContext;
  (guard as any).reflector = { getAllAndOverride: () => ['ADMIN'] };
  assert.equal(guard.canActivate(ctx('ADMIN')), true);
  assert.equal(guard.canActivate(ctx('STAFF')), false);
  assert.equal(guard.canActivate(ctx()), false);
});

test('public animal list hides QR uuid and adopter from anyone but staff and the tutor', async () => {
  const rows = [
    { id: 1, uuid: 'u-1', qrCodeUrl: 'q1', adoptedById: 'tutor', adoptedBy: { id: 'tutor', fullName: 'Tutor' }, isAdopted: true },
    { id: 2, uuid: 'u-2', qrCodeUrl: 'q2', adoptedById: null, adoptedBy: null, isAdopted: false },
  ];
  const prisma: any = { animal: { findMany: async () => rows.map((r) => ({ ...r })), count: async () => rows.length } };
  const animals = new AnimalsService(prisma, {} as any, {} as any);
  const anon = await animals.findAll(1, 20, undefined, null);
  assert.ok(anon.data.every((a: any) => a.uuid === undefined && a.qrCodeUrl === undefined && a.adoptedBy === null && a.adoptedById === null));
  const tutor = await animals.findAll(1, 20, undefined, { id: 'tutor', role: 'TUTOR' });
  assert.equal((tutor.data[0] as any).uuid, 'u-1');
  assert.equal((tutor.data[1] as any).uuid, undefined);
  const staff = await animals.findAll(1, 20, undefined, { id: 's', role: 'STAFF' });
  assert.ok(staff.data.every((a: any) => a.uuid));
});

test('linking an adopter never demotes staff', async () => {
  const updates: any[] = [];
  const prisma: any = {
    user: { findUnique: async () => ({ id: 's', role: 'STAFF' }), update: async (a) => { updates.push(a); } },
    animal: { findUnique: async () => ({ id: 1 }), update: async () => ({ id: 1 }) },
  };
  await new AnimalsService(prisma, {} as any, {} as any).linkAdopter(1, 's');
  assert.equal(updates.length, 0);
});

test('Prisma errors map to 404/409 with the request id', () => {
  let status = 0; let body: any;
  const response: any = { status: (s: number) => { status = s; return response; }, json: (b: any) => { body = b; } };
  const host: any = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ url: '/x', requestId: 'req-12345678' }) }) };
  const err = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: '5' });
  new HttpExceptionFilter().catch(err('P2025'), host); assert.equal(status, 404); assert.equal(body.requestId, 'req-12345678');
  new HttpExceptionFilter().catch(err('P2003'), host); assert.equal(status, 409);
  new HttpExceptionFilter().catch(new Error('db password=secret'), host); assert.equal(status, 500);
  assert.equal(body.message, 'Erro interno do servidor', 'internal errors never leak details');
});

test('staff image fields accept URL or files, never both', () => {
  const f = [file(JPEG, 'a.jpg', 'image/jpeg')];
  assert.equal(imageSource(undefined, [], 'photoUrls', 'photos'), 'none');
  assert.equal(imageSource(['https://x/a.jpg'], [], 'photoUrls', 'photos'), 'url');
  assert.equal(imageSource([], f, 'photoUrls', 'photos'), 'file');
  assert.throws(() => imageSource(['https://x/a.jpg'], f, 'photoUrls', 'photos'), /não os dois/);
  assert.throws(() => imageSource('https://x/c.jpg', f, 'coverImageUrl', 'cover'), /cover/);
  assert.deepEqual(toStringArray({ value: 'https://x/a.jpg' }), ['https://x/a.jpg']);
  assert.deepEqual(toStringArray({ value: '["https://x/a.jpg","https://x/b.jpg"]' }), ['https://x/a.jpg', 'https://x/b.jpg']);
  assert.deepEqual(toStringArray({ value: ['a'] }), ['a']);
});

test('disposable e-mail domains are detected, including subdomains; real providers pass', () => {
  assert.ok(DISPOSABLE_DOMAINS_COUNT > 5000);
  for (const e of ['a@mailinator.com', 'a@YOPMAIL.COM', 'a@guerrillamail.com', 'a@10minutemail.com', 'a@x.mailinator.com', 'a@mailinator.com.']) {
    assert.equal(isDisposableEmail(e), true, e);
  }
  for (const e of ['a@gmail.com', 'a@outlook.com', 'a@hotmail.com', 'a@uol.com.br', 'a@bol.com.br', 'a@apasbac.org.br', 'a@com', 'sem-arroba']) {
    assert.equal(isDisposableEmail(e), false, e);
  }
});

test('access log line carries only routing data — never body, query string or PII', () => {
  const line = accessLine(
    { requestId: 'r1', method: 'POST', originalUrl: '/api/v1/auth/login?email=a@b.com',
      user: { id: 'u1', role: 'ADMIN' }, ip: '203.0.113.1', body: { password: 'secret', email: 'a@b.com' } },
    200, 12,
  );
  assert.equal(line.path, '/api/v1/auth/login'); // query string dropped
  assert.equal(line.actorId, 'u1');
  assert.equal(line.actorRole, 'ADMIN');
  const text = JSON.stringify(line);
  for (const leak of ['secret', 'a@b.com', 'password', 'email']) assert.ok(!text.includes(leak), leak);
});

test('http logger audits denied/throttled/failed requests, skips ok, 401 and non-API paths', () => {
  const records: any[] = [];
  const audit = { record: async (e: any) => { records.push(e); } } as unknown as AuditService;
  const run = (url: string, status: number, user?: any) => {
    let finish = () => {};
    const req: any = { originalUrl: url, method: 'GET', ip: '203.0.113.9', requestId: 'r', user, headers: {} };
    const res: any = { statusCode: status, on: (ev: string, cb: () => void) => { if (ev === 'finish') finish = cb; } };
    httpLogger(audit)(req, res, () => {});
    finish();
  };
  run('/api/v1/users/1', 403, { id: 'u1', role: 'USER' }); // privilege escalation attempt
  run('/api/v1/animals', 429);                              // rate limited
  run('/api/v1/events', 500);                               // server error
  run('/api/v1/animals', 200);                              // ok -> not audited
  run('/api/v1/auth/login', 401);                           // recorded by the auth service, not here
  run('/docs', 403);                                        // non-API -> skipped entirely
  assert.deepEqual(records.map((r) => r.action), ['HTTP_FORBIDDEN', 'HTTP_RATE_LIMITED', 'HTTP_SERVER_ERROR']);
  assert.equal(records[0].actorId, 'u1');
  assert.ok(records.every((r) => r.outcome === 'FAILURE' && r.resource === 'http'));
});

test('security overview aggregates failures by action and the top failing IPs', async () => {
  const prisma: any = { auditLog: {
    groupBy: async (args: any) => (args.by[0] === 'action'
      ? [{ action: 'HTTP_FORBIDDEN', _count: { _all: 3 } }, { action: 'AUTH_LOGIN_FAILED', _count: { _all: 5 } }]
      : [{ ipAddress: '203.0.113.9', _count: { _all: 7 } }]),
    count: async () => 8,
  } };
  const o = await new AuditService(prisma).securityOverview(12);
  assert.equal(o.windowHours, 12);
  assert.equal(o.totalFailures, 8);
  assert.equal(o.byAction.HTTP_FORBIDDEN, 3);
  assert.equal(o.byAction.AUTH_LOGIN_FAILED, 5);
  assert.equal(o.byAction.HTTP_SERVER_ERROR, 0); // present but zero when absent in the window
  assert.deepEqual(o.topFailingIps, [{ ip: '203.0.113.9', count: 7 }]);
});
