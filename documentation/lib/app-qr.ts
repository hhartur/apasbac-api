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
  /** Lado total do viewBox, com margem. */
  viewBox: number;
  /** Módulos de dados (fora dos olhos e da área da logo). */
  dots: Array<[number, number]>;
  /** Cantos superiores esquerdos dos três "olhos" (em módulos). */
  eyes: Array<[number, number]>;
  /** Área livre central para a logo (em unidades do viewBox). */
  logo: { x: number; y: number; width: number; height: number };
  /** Fração dos módulos removidos para a logo (deve ficar bem abaixo de 30%). */
  cleared: number;
}

const MARGIN = 3;

/**
 * Monta um QR Code com correção de erro alta (H, recupera até 30%) e reserva
 * um espaço central para a logo, retirando só os módulos cobertos por ela.
 */
export function buildAppQr(text: string = APP_DOWNLOAD_URL, unit = 10): AppQr {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const size = qr.modules.size;
  const eyes: Array<[number, number]> = [[0, 0], [0, size - 7], [size - 7, 0]];
  const inEye = (r: number, c: number) =>
    eyes.some(([er, ec]) => r >= er && r < er + 7 && c >= ec && c < ec + 7);

  // Logo da APASBAC (proporção ~2:1) centralizada, com folga de 1 módulo.
  const logoW = Math.round(size * 0.36) | 1;
  const logoH = Math.round(size * 0.2) | 1;
  const r0 = Math.floor((size - logoH) / 2), c0 = Math.floor((size - logoW) / 2);
  const inLogo = (r: number, c: number) => r >= r0 && r < r0 + logoH && c >= c0 && c < c0 + logoW;

  const dots: Array<[number, number]> = [];
  let removed = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!qr.modules.get(r, c) || inEye(r, c)) continue;
      if (inLogo(r, c)) { removed++; continue; }
      dots.push([r, c]);
    }
  }
  return {
    size, version: qr.version, unit, viewBox: (size + MARGIN * 2) * unit, dots, eyes,
    logo: { x: (c0 + MARGIN) * unit, y: (r0 + MARGIN) * unit, width: logoW * unit, height: logoH * unit },
    cleared: (logoW * logoH) / (size * size),
  };
}

export const QR_MARGIN = MARGIN;
