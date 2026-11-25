import QRCode from 'qrcode';
import { site } from './site';

/**
 * Endereço fixo do download do aplicativo Android. A API redireciona para o
 * APK da versão mais recente (manifesto do GitHub), então este link e o QR
 * Code nunca mudam, mesmo impressos, e sempre entregam a última versão.
 */
export const APP_DOWNLOAD_URL = `${site.apiBase}/app/download`;
export const APP_VERSION_URL = `${site.apiBase}/app/version`;

export interface AppQr {
  /** Quantidade de módulos por lado (sem a margem). */
  size: number;
  version: number;
  /** Unidade do viewBox por módulo. */
  unit: number;
  /** Lado total do QR no viewBox, com a margem branca. */
  viewBox: number;
  /** Módulos escuros de dados (fora dos olhos e do selo central), em [linha, coluna]. */
  dots: Array<[number, number]>;
  /** Pares de módulos vizinhos (direita/baixo) que viram uma forma contínua. */
  bridges: Array<{ r: number; c: number; dir: 'right' | 'down' }>;
  /** Blocos 2×2 totalmente escuros (canto superior esquerdo), preenchidos sem frestas. */
  blocks: Array<[number, number]>;
  /** Cantos superiores esquerdos dos três "olhos" (em módulos). */
  eyes: Array<[number, number]>;
  /** Selo central (em unidades do viewBox). */
  badge: { cx: number; cy: number; r: number };
  /** Fração dos módulos cobertos pelo selo (deve ficar bem abaixo de 30%). */
  cleared: number;
}

export const QR_MARGIN = 3;

/**
 * Monta o QR Code com correção de erro alta (H, recupera até 30%) e um espaço
 * central quadrado para o selo com a patinha, removendo só os módulos cobertos.
 */
export function buildAppQr(text: string = APP_DOWNLOAD_URL, unit = 10): AppQr {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const eyes: Array<[number, number]> = [[0, 0], [0, size - 7], [size - 7, 0]];
  const inEye = (r: number, c: number) =>
    eyes.some(([er, ec]) => r >= er && r < er + 7 && c >= ec && c < ec + 7);

  const side = Math.round(size * 0.27) | 1; // ímpar: fica exatamente no centro
  const start = (size - side) / 2;
  const inBadge = (r: number, c: number) => r >= start && r < start + side && c >= start && c < start + side;

  const isDot = (r: number, c: number) =>
    r >= 0 && c >= 0 && r < size && c < size && qr.modules.get(r, c) === 1 && !inEye(r, c) && !inBadge(r, c);

  const dots: Array<[number, number]> = [];
  const bridges: AppQr['bridges'] = [];
  const blocks: AppQr['blocks'] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isDot(r, c)) continue;
      dots.push([r, c]);
      if (isDot(r, c + 1)) bridges.push({ r, c, dir: 'right' });
      if (isDot(r + 1, c)) bridges.push({ r, c, dir: 'down' });
      if (isDot(r, c + 1) && isDot(r + 1, c) && isDot(r + 1, c + 1)) blocks.push([r, c]);
    }
  }
  const center = (QR_MARGIN + size / 2) * unit;
  return {
    size, version: qr.version, unit, viewBox: (size + QR_MARGIN * 2) * unit, dots, bridges, blocks, eyes,
    badge: { cx: center, cy: center, r: (side / 2) * unit },
    cleared: (side * side) / (size * size),
  };
}
