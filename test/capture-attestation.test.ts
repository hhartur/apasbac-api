import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { HttpException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  captureKey, issueCaptureSession, mediaSignature, uploadSignature, verifyCaptureToken, verifyMedia, CaptureError,
} from '../src/monitor/capture-attestation';
import { SubmitMonitoringDto } from '../src/monitor/dto/submit-monitoring.dto';
import { MonitorService } from '../src/monitor/monitor.service';

process.env.MEDIA_ATTEST_SECRET = 'segredo-de-teste';
const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const VIDEO = 'https://res.cloudinary.com/apasbac/video/upload/v1/monitoring/videos/v.mp4';
const IMAGES = [1, 2, 3, 4, 5].map((i) => `https://res.cloudinary.com/apasbac/image/upload/v1/monitoring/images/f${i}.jpg`);

/** Simula o app: grava pela câmera e assina cada mídia com a chave da sessão. */
function appSubmit(session: { captureToken: string; captureKey: string }, id: string, at = new Date().toISOString()) {
  const sign = (url: string, kind: 'image' | 'video') => {
    const m = { url, kind, md5: md5(url), capturedAt: at };
    return { ...m, signature: mediaSignature(session.captureKey, m, id) };
  };
  return { videoUrl: VIDEO, imageUrls: IMAGES, captureToken: session.captureToken,
    media: [sign(VIDEO, 'video'), ...IMAGES.map((u) => sign(u, 'image'))] };
}

function service(etags: Record<string, string> | null = null, status = 'PENDING') {
  const prisma = { monitoring: {
    findUnique: async () => ({ id: 'm1', userId: 'u1', status }),
    update: async ({ data }: any) => ({ id: 'm1', ...data }),
  } };
  const storage = { isOwnedUrl: () => true, etagOf: async (url: string) => (etags ? etags[url] ?? 'x' : null) };
  return new MonitorService(prisma as any, storage as any, {} as any, {} as any, {} as any);
}

test('sessão: token amarrado ao monitoramento, ao tutor e ao prazo', () => {
  const s = issueCaptureSession('m1', 'u1', 1_000_000);
  assert.equal(s.captureKey, captureKey(s.captureToken));
  assert.equal(verifyCaptureToken(s.captureToken, 'm1', 'u1', 1_000_001).m, 'm1');
  assert.throws(() => verifyCaptureToken(s.captureToken, 'm2', 'u1', 1_000_001), CaptureError);
  assert.throws(() => verifyCaptureToken(s.captureToken, 'm1', 'u2', 1_000_001), CaptureError);
  assert.throws(() => verifyCaptureToken(s.captureToken, 'm1', 'u1', 1_000_000 + 25 * 3600_000), /expirada/);
  assert.throws(() => verifyCaptureToken(s.captureToken.replace(/.$/, '0'), 'm1', 'u1'), CaptureError);
});

test('mídia: assinatura, conteúdo e horário', () => {
  const s = issueCaptureSession('m1', 'u1');
  const p = verifyCaptureToken(s.captureToken, 'm1', 'u1');
  const m = { url: VIDEO, kind: 'video' as const, md5: md5('a'), capturedAt: new Date().toISOString() };
  const ok = { ...m, signature: mediaSignature(s.captureKey, m, 'm1') };
  verifyMedia(ok, s.captureToken, p);
  assert.throws(() => verifyMedia({ ...ok, md5: md5('b') }, s.captureToken, p), /câmera do aplicativo/);
  assert.throws(() => verifyMedia({ ...ok, kind: 'image' }, s.captureToken, p), CaptureError);
  // Arquivo antigo (capturado antes da sessão existir) não passa.
  const old = { ...m, capturedAt: new Date(p.iat - 3600_000).toISOString() };
  assert.throws(() => verifyMedia({ ...old, signature: mediaSignature(s.captureKey, old, 'm1') }, s.captureToken, p), /gravados agora/);
});

test('envio: aceita mídias gravadas pelo app e confere o arquivo no Cloudinary', async () => {
  const s = issueCaptureSession('m1', 'u1');
  const dto = appSubmit(s, 'm1');
  const etags = Object.fromEntries(dto.media.map((m) => [m.url, m.md5]));
  const updated: any = await service(etags).submitMonitoring('m1', dto, { id: 'u1' });
  assert.equal(updated.status, 'IN_REVIEW');
  // Arquivo trocado depois da captura (etag diferente) é recusado.
  await assert.rejects(service({ ...etags, [IMAGES[2]]: md5('outro') }).submitMonitoring('m1', dto, { id: 'u1' }),
    (e: HttpException) => e.getStatus() === 400 && /não é a que foi tirada/.test(e.message));
});

test('envio: sem atestado (app antigo ou envio de fora) é recusado', async () => {
  const svc = service();
  await assert.rejects(svc.submitMonitoring('m1', { videoUrl: VIDEO, imageUrls: IMAGES }, { id: 'u1' }),
    (e: HttpException) => e.getStatus() === 400 && /Atualize o aplicativo/.test(e.message));
  const s = issueCaptureSession('m1', 'u1');
  const forged = appSubmit({ captureToken: s.captureToken, captureKey: 'f'.repeat(64) }, 'm1');
  await assert.rejects(svc.submitMonitoring('m1', forged, { id: 'u1' }), (e: HttpException) => e.getStatus() === 400);
  const other = appSubmit(issueCaptureSession('m2', 'u1'), 'm2');
  await assert.rejects(svc.submitMonitoring('m1', other, { id: 'u1' }), (e: HttpException) => e.getStatus() === 400);
});

test('sessão de captura só para o tutor dono e monitoramento pendente', async () => {
  assert.ok((await service().captureSession('m1', { id: 'u1' })).captureKey);
  await assert.rejects(service().captureSession('m1', { id: 'u2' }), (e: HttpException) => e.getStatus() === 403);
  await assert.rejects(service(null, 'IN_REVIEW').captureSession('m1', { id: 'u1' }), (e: HttpException) => e.getStatus() === 400);
});

test('DTO exige atestado com mensagem para atualizar o app', async () => {
  const errors = await validate(plainToInstance(SubmitMonitoringDto, { videoUrl: VIDEO, imageUrls: IMAGES }));
  const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));
  assert.ok(messages.some((m) => /Atualize o aplicativo/.test(m)));
  const s = issueCaptureSession('m1', 'u1');
  assert.equal((await validate(plainToInstance(SubmitMonitoringDto, appSubmit(s, 'm1')))).length, 0);
});

test('envio: etag do Cloudinary diferente do MD5, atestado pelo app no upload, é aceito', async () => {
  const s = issueCaptureSession('m1', 'u1');
  const dto: any = appSubmit(s, 'm1');
  // O Cloudinary devolveu um etag que não é o MD5 do celular; o app assina a ligação.
  const cloud = (url: string) => md5(`nuvem:${url}`);
  dto.media = dto.media.map((m: any) => ({ ...m, uploadEtag: cloud(m.url),
    uploadSignature: uploadSignature(s.captureKey, m, cloud(m.url), 'm1') }));
  const etags = Object.fromEntries(dto.media.map((m: any) => [m.url, cloud(m.url)]));
  const updated: any = await service(etags).submitMonitoring('m1', dto, { id: 'u1' });
  assert.equal(updated.status, 'IN_REVIEW');
  // Assinatura do upload forjada (sem a chave) é recusada.
  const forged = { ...dto, media: dto.media.map((m: any) => ({ ...m, uploadSignature: 'f'.repeat(64) })) };
  await assert.rejects(service(etags).submitMonitoring('m1', forged, { id: 'u1' }), (e: HttpException) => e.getStatus() === 400);
  // Arquivo trocado no Cloudinary depois do upload é recusado.
  await assert.rejects(service({ ...etags, [VIDEO]: md5('trocado') }).submitMonitoring('m1', dto, { id: 'u1' }),
    (e: HttpException) => e.getStatus() === 400 && /vídeo enviado/.test(e.message));
});

test('vídeo sem etag na Admin API: MD5 calculado do arquivo guardado, em fluxo', async () => {
  const { StorageService } = await import('../src/storage/storage.service');
  const prev = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = 'apasbac';
  try {
    const s = new StorageService();
    const body = Buffer.alloc(300_000, 7);
    const fake = (async () => new Response(new Blob([body]).stream())) as unknown as typeof fetch;
    const url = 'https://res.cloudinary.com/apasbac/video/upload/v1/monitoring/videos/v.mp4';
    assert.equal(await s.md5OfStored(url, body.length, fake), createHash('md5').update(body).digest('hex'));
    // Maior que o tamanho informado pelo Cloudinary: recusa.
    await assert.rejects(s.md5OfStored(url, 10, fake), /maior que o esperado/);
    // Fora da conta da API: recusa sem baixar.
    await assert.rejects(s.md5OfStored('https://evil.example/v.mp4', undefined, fake), /fora da conta/);
  } finally {
    process.env.CLOUDINARY_CLOUD_NAME = prev;
  }
});
