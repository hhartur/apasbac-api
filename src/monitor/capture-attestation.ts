import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Atestado de captura das mídias do monitoramento.
 *
 * Ao abrir a tela de envio, o app recebe uma sessão de captura (token + chave
 * temporária) amarrada ao monitoramento e ao tutor. Cada foto/vídeo gravado
 * pela câmera do app é assinado na hora com essa chave:
 *   HMAC-SHA256(chave, "kind|md5|capturedAt|monitoringId")
 * No envio, a API refaz a chave a partir do token (só ela conhece o segredo),
 * confere cada assinatura, se a captura aconteceu depois de a sessão existir e
 * se o MD5 bate com o arquivo realmente guardado no Cloudinary (etag). Arquivo
 * da galeria, de outro app ou trocado depois da captura não passa.
 */
export const CAPTURE_TTL_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export interface CapturePayload { m: string; u: string; iat: number; exp: number; n: string }
export interface CapturedMedia { url: string; kind: 'image' | 'video'; md5: string; capturedAt: string; signature: string }

export class CaptureError extends Error {}

function secret(): string {
  const s = process.env.MEDIA_ATTEST_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!s) throw new CaptureError('Segredo de atestado não configurado (MEDIA_ATTEST_SECRET ou JWT_ACCESS_SECRET).');
  return s;
}

const hmac = (key: string, data: string) => createHmac('sha256', key).update(data).digest('hex');

function sameHex(a: string, b: string): boolean {
  if (!/^[a-f0-9]+$/.test(a) || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function captureKey(token: string): string {
  return hmac(secret(), `key|${token}`);
}

export function issueCaptureSession(monitoringId: string, userId: string, now = Date.now()) {
  const payload: CapturePayload = { m: monitoringId, u: userId, iat: now, exp: now + CAPTURE_TTL_MS, n: randomBytes(12).toString('base64url') };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${body}.${hmac(secret(), `token|${body}`)}`;
  return { captureToken: token, captureKey: captureKey(token), expiresAt: new Date(payload.exp).toISOString() };
}

export function verifyCaptureToken(token: string, monitoringId: string, userId: string, now = Date.now()): CapturePayload {
  const [body, sig] = String(token ?? '').split('.');
  if (!body || !sig || !sameHex(sig, hmac(secret(), `token|${body}`))) throw new CaptureError('Sessão de captura inválida.');
  let payload: CapturePayload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw new CaptureError('Sessão de captura inválida.'); }
  if (payload.m !== monitoringId || payload.u !== userId) throw new CaptureError('Sessão de captura de outro monitoramento.');
  if (now > payload.exp) throw new CaptureError('Sessão de captura expirada. Grave as fotos e o vídeo novamente.');
  return payload;
}

export function mediaSignature(key: string, m: Pick<CapturedMedia, 'kind' | 'md5' | 'capturedAt'>, monitoringId: string): string {
  return hmac(key, `${m.kind}|${m.md5}|${m.capturedAt}|${monitoringId}`);
}

/** Confere a assinatura e o horário de uma mídia (o conteúdo é conferido à parte, pelo etag). */
export function verifyMedia(m: CapturedMedia, token: string, payload: CapturePayload, now = Date.now()): void {
  if (!/^[a-f0-9]{32}$/.test(m.md5)) throw new CaptureError('Mídia sem identificação válida.');
  const expected = mediaSignature(captureKey(token), m, payload.m);
  if (!sameHex(m.signature, expected)) throw new CaptureError('As fotos e o vídeo precisam ser gravados pela câmera do aplicativo.');
  const at = Date.parse(m.capturedAt);
  if (Number.isNaN(at) || at < payload.iat - CLOCK_SKEW_MS || at > now + CLOCK_SKEW_MS) {
    throw new CaptureError('As fotos e o vídeo precisam ser gravados agora, pela câmera do aplicativo.');
  }
}
