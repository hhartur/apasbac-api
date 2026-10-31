import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { sanitizeMetadata } from '../src/audit/audit.service';
import { assertImages, detectImageType, imageSource, toStringArray } from '../src/common/uploads';
import { StorageService } from '../src/storage/storage.service';
import { slugify } from '../src/events/events.service';
import { AuthService, REUSE_GRACE_MS, sha256 } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { AnimalsService } from '../src/animals/animals.service';
import { RolesGuard } from '../src/common/guards/roles.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { esc } from '../src/mail/mail.service';

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
