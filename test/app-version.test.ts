import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ExecutionContext, HttpException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { parseManifest, UPDATE_MANIFEST_URL, UPDATE_CACHE_KEY } from '../src/app-version/update-manifest';
import { ConfigAppService } from '../src/config-app/config-app.service';
import { AppVersionService } from '../src/app-version/app-version.service';
import { AppVersionInterceptor } from '../src/app-version/app-version.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaService } from '../src/prisma/prisma.service';

const fixture = () => ({ schemaVersion: 1, channel: 'stable', versionCode: 12,
  versionName: '1.10.0', minimumSupportedVersionCode: 8, mandatory: false,
  apkUrl: 'https://github.com/APASBAC/apasbac-app/releases/download/v1.10.0/app-release.apk',
  sha256: 'a'.repeat(64), sizeBytes: 100, publishedAt: '2026-09-17T20:00:00Z', releaseNotes: ['Correções'] });
const prisma = (cached?: unknown) => ({ appConfig: {
  findUnique: async () => cached ? { value: JSON.stringify(cached) } : null,
  upsert: async () => undefined,
} }) as unknown as PrismaService;

test('strict manifest parser ignores future fields and rejects unsafe fields', () => {
  assert.equal(parseManifest({ ...fixture(), future: true }).versionCode, 12);
  for (const patch of [{ versionCode: '12' }, { minimumSupportedVersionCode: 13 },
    { sha256: 'bad' }, { mandatory: 'true' }, { sizeBytes: 0 }, { apkUrl: 'https://evil.example/a.apk' }]) {
    assert.throws(() => parseManifest({ ...fixture(), ...patch }));
  }
});

test('cache coalesces simultaneous requests and survives GitHub errors', async () => {
  const original = global.fetch;
  let calls = 0;
  global.fetch = async () => { calls++; return new Response(JSON.stringify(fixture())); };
  try {
    const service = new AppVersionService(prisma());
    const replies = await Promise.all([service.latest(), service.latest(), service.latest()]);
    assert.equal(calls, 1);
    assert.equal(replies[0]?.versionCode, 12);
    await service.latest(); assert.equal(calls, 1);
    global.fetch = async () => { calls++; throw new Error('offline'); };
    const restored = new AppVersionService(prisma(fixture()));
    assert.equal((await restored.latest())?.versionCode, 12);
    await restored.latest(); assert.equal(calls, 2);
  } finally { global.fetch = original; }
});

test('404, 500 and invalid JSON cannot replace persistent cache', async () => {
  const original = global.fetch;
  try {
    for (const status of [404, 500, 200]) {
      global.fetch = async () => new Response('invalid JSON', { status });
      assert.equal((await new AppVersionService(prisma(fixture())).latest())?.versionCode, 12);
    }
    global.fetch = async () => { throw new Error('DNS'); };
    assert.equal(await new AppVersionService(prisma()).latest(), undefined);
  } finally { global.fetch = original; }
});

const context = (code: string | undefined, platform = 'android', user: unknown = { id: 'not-logged' }) => ({
  switchToHttp: () => ({ getRequest: () => ({ user, headers: { 'x-app-platform': platform, 'x-app-version-code': code } }) }),
  getHandler: () => () => undefined, getClass: () => AppVersionInterceptor,
}) as unknown as ExecutionContext;

test('authenticated unsupported Android client receives structured 426', async () => {
  const service = { latest: async () => parseManifest(fixture()) } as AppVersionService;
  const interceptor = new AppVersionInterceptor(service, new Reflector());
  await assert.rejects(interceptor.intercept(context('7'), { handle: () => of('ok') }), (error: HttpException) => {
    assert.equal(error.getStatus(), 426);
    assert.deepEqual(error.getResponse(), { error: 'APP_UPDATE_REQUIRED',
      message: 'Esta versão do aplicativo não é mais suportada.', latestVersionCode: 12,
      latestVersionName: '1.10.0', minimumSupportedVersionCode: 8, updateManifestUrl: UPDATE_MANIFEST_URL });
    return true;
  });
});

test('supported, newer, public and non-Android callers remain compatible', async () => {
  const interceptor = new AppVersionInterceptor({ latest: async () => parseManifest(fixture()) } as AppVersionService, new Reflector());
  for (const ctx of [context('8'), context('12'), context('13'), context(undefined, 'web'), context('1', 'android', null)]) {
    let handled = false;
    await interceptor.intercept(ctx, { handle: () => { handled = true; return of('ok'); } });
    assert.equal(handled, true);
  }
});

test('global exception filter preserves update metadata', () => {
  let status = 0;
  let body: Record<string, unknown> = {};
  const error = new HttpException({ error: 'APP_UPDATE_REQUIRED', message: 'Atualize',
    latestVersionCode: 12, latestVersionName: '1.10.0', minimumSupportedVersionCode: 8, updateManifestUrl: UPDATE_MANIFEST_URL }, 426);
  const response = { status: (value: number) => { status = value; return response; }, json: (value: Record<string, unknown>) => { body = value; } };
  new HttpExceptionFilter().catch(error, { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ url: '/api/v1/users/me' }) }) } as never);
  assert.equal(status, 426); assert.equal(body.minimumSupportedVersionCode, 8);
  assert.equal(body.updateManifestUrl, UPDATE_MANIFEST_URL);
});

test('derived cache cannot be edited as a separate policy', async () => {
  const config = new ConfigAppService(prisma(fixture()));
  await assert.rejects(config.findOne(UPDATE_CACHE_KEY));
  await assert.rejects(config.create({ key: UPDATE_CACHE_KEY, value: '{}' }));
  await assert.rejects(config.update(UPDATE_CACHE_KEY, { value: '{}' }));
  await assert.rejects(config.remove(UPDATE_CACHE_KEY));
});
