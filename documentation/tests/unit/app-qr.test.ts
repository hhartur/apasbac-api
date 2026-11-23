import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import jsQR from 'jsqr';
import { APP_DOWNLOAD_URL, buildAppQr, QR_MARGIN } from '../../lib/app-qr';

/** Rasteriza o QR como ele é desenhado (pontos, olhos e área da logo em branco) e lê com um decodificador real. */
function decode(text: string): string | undefined {
  const qr = buildAppQr(text, 1);
  const scale = 8;
  const side = qr.size + QR_MARGIN * 2;
  const px = side * scale;
  const data = new Uint8ClampedArray(px * px * 4).fill(255);
  const paint = (r: number, c: number) => {
    for (let y = 0; y < scale; y++) for (let x = 0; x < scale; x++) {
      const i = (((r + QR_MARGIN) * scale + y) * px + (c + QR_MARGIN) * scale + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
  };
  for (const [r, c] of qr.dots) paint(r, c);
  for (const [er, ec] of qr.eyes) {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (ring || core) paint(er + r, ec + c);
    }
  }
  return jsQR(data, px, px)?.data;
}

test('QR do app aponta para o download fixo da API e continua legível com a logo', () => {
  assert.equal(APP_DOWNLOAD_URL, 'https://apasbac-api.vercel.app/api/v1/app/download');
  assert.equal(decode(APP_DOWNLOAD_URL), APP_DOWNLOAD_URL);
});

test('área da logo fica bem abaixo da capacidade de correção (30%)', () => {
  const qr = buildAppQr();
  assert.ok(qr.cleared < 0.1, `logo cobre ${(qr.cleared * 100).toFixed(1)}%`);
  assert.ok(qr.version < 7, 'sem padrão de alinhamento no centro');
  assert.ok(qr.logo.width > qr.logo.height);
});
