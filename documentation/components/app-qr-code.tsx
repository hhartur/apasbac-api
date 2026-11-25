import { buildAppQr, QR_MARGIN } from '@/lib/app-qr';

const RED = '#8b1a1a';
const CORAL = '#e0533d';
const PINK = '#f6c3b8';
const CREAM = '#fff3d4';

/** Patinha (almofada + 4 dedinhos) centralizada em (cx, cy), com largura aproximada 2·s. */
function Paw({ cx, cy, s, fill }: { cx: number; cy: number; s: number; fill: string }) {
  return (
    <g fill={fill}>
      <path
        d={`M ${cx} ${cy - s * 0.05}
            C ${cx + s * 0.55} ${cy - s * 0.05} ${cx + s * 0.85} ${cy + s * 0.55} ${cx + s * 0.55} ${cy + s * 0.78}
            C ${cx + s * 0.3} ${cy + s * 0.95} ${cx + s * 0.12} ${cy + s * 0.78} ${cx} ${cy + s * 0.78}
            C ${cx - s * 0.12} ${cy + s * 0.78} ${cx - s * 0.3} ${cy + s * 0.95} ${cx - s * 0.55} ${cy + s * 0.78}
            C ${cx - s * 0.85} ${cy + s * 0.55} ${cx - s * 0.55} ${cy - s * 0.05} ${cx} ${cy - s * 0.05} Z`}
      />
      <ellipse cx={cx - s * 0.78} cy={cy - s * 0.12} rx={s * 0.2} ry={s * 0.26} transform={`rotate(-25 ${cx - s * 0.78} ${cy - s * 0.12})`} />
      <ellipse cx={cx - s * 0.3} cy={cy - s * 0.55} rx={s * 0.21} ry={s * 0.28} transform={`rotate(-8 ${cx - s * 0.3} ${cy - s * 0.55})`} />
      <ellipse cx={cx + s * 0.3} cy={cy - s * 0.55} rx={s * 0.21} ry={s * 0.28} transform={`rotate(8 ${cx + s * 0.3} ${cy - s * 0.55})`} />
      <ellipse cx={cx + s * 0.78} cy={cy - s * 0.12} rx={s * 0.2} ry={s * 0.26} transform={`rotate(25 ${cx + s * 0.78} ${cy - s * 0.12})`} />
    </g>
  );
}

/** Orelha de gatinho (externa em gradiente, interna rosada). `flip` espelha para o lado direito. */
function Ear({ q, top, flip }: { q: number; top: number; flip?: boolean }) {
  const x = (v: number) => (flip ? q - v * q : v * q);
  const base = top + 70;
  return (
    <g>
      <path
        d={`M ${x(0.1)} ${base} C ${x(0.1)} ${top + 30} ${x(0.14)} ${top + 6} ${x(0.19)} ${top + 2}
            C ${x(0.24)} ${top - 2} ${x(0.33)} ${top + 30} ${x(0.42)} ${base} Z`}
        fill="url(#qr-ink)"
      />
      <path
        d={`M ${x(0.16)} ${base} C ${x(0.16)} ${top + 40} ${x(0.18)} ${top + 22} ${x(0.205)} ${top + 20}
            C ${x(0.235)} ${top + 18} ${x(0.29)} ${top + 40} ${x(0.35)} ${base} Z`}
        fill={PINK}
      />
    </g>
  );
}

/**
 * QR Code do aplicativo com tema de bichinho: orelhas de gatinho, módulos fluidos
 * em gradiente, "olhos" arredondados, selo com patinha no centro e plaquinha de
 * coleira. Os olhos e a margem branca seguem o padrão para qualquer câmera ler.
 */
export function AppQrCode({ className }: { className?: string }) {
  const qr = buildAppQr();
  const u = qr.unit;
  const q = qr.viewBox;
  const earTop = 4;
  const top = 58; // espaço das orelhas acima do cartão
  const tag = 58; // plaquinha abaixo do cartão
  const at = (n: number) => (n + QR_MARGIN) * u;
  const r = u * 0.5;
  const { badge } = qr;
  return (
    <svg
      viewBox={`0 0 ${q} ${top + q + tag}`}
      className={className}
      role="img"
      aria-label="QR Code para baixar o aplicativo APASBAC"
      shapeRendering="geometricPrecision"
    >
      <defs>
        {/* Um único gradiente sobre o desenho todo (e não um por pontinho). */}
        <linearGradient id="qr-ink" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={q} y2={top + q}>
          <stop offset="0" stopColor={RED} />
          <stop offset="1" stopColor={CORAL} />
        </linearGradient>
        <filter id="qr-shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor={RED} floodOpacity="0.18" />
        </filter>
      </defs>

      <Ear q={q} top={earTop} />
      <Ear q={q} top={earTop} flip />

      <g transform={`translate(0 ${top})`}>
        <rect width={q} height={q} rx={u * 4.5} fill="#ffffff" stroke={CREAM} strokeWidth={u * 0.6} filter="url(#qr-shadow)" />

        {/* Módulos fluidos: círculos unidos aos vizinhos formam traços arredondados. */}
        <g fill="url(#qr-ink)">
          {qr.dots.map(([row, col]) => (
            <circle key={`d${row}-${col}`} cx={at(col) + u / 2} cy={at(row) + u / 2} r={r} />
          ))}
          {qr.blocks.map(([row, col]) => (
            <rect key={`b${row}-${col}`} x={at(col) + u / 2} y={at(row) + u / 2} width={u} height={u} />
          ))}
          {qr.bridges.map(({ r: row, c: col, dir }) =>
            dir === 'right' ? (
              <rect key={`h${row}-${col}`} x={at(col) + u / 2} y={at(row) + u / 2 - r} width={u} height={r * 2} />
            ) : (
              <rect key={`v${row}-${col}`} x={at(col) + u / 2 - r} y={at(row) + u / 2} width={r * 2} height={u} />
            ),
          )}
        </g>

        {/* Olhos arredondados, com pupila de "bolinha". */}
        {qr.eyes.map(([row, col]) => (
          <g key={`e${row}-${col}`}>
            <rect x={at(col)} y={at(row)} width={u * 7} height={u * 7} rx={u * 2.6} fill="url(#qr-ink)" />
            <rect x={at(col) + u} y={at(row) + u} width={u * 5} height={u * 5} rx={u * 1.8} fill="#ffffff" />
            <rect x={at(col) + u * 2} y={at(row) + u * 2} width={u * 3} height={u * 3} rx={u * 1.25} fill={RED} />
            <circle cx={at(col) + u * 2.85} cy={at(row) + u * 2.85} r={u * 0.42} fill="#ffffff" opacity="0.85" />
          </g>
        ))}

        {/* Selo central com patinha. */}
        <circle cx={badge.cx} cy={badge.cy} r={badge.r - u * 0.3} fill="#ffffff" />
        <circle cx={badge.cx} cy={badge.cy} r={badge.r - u * 1.1} fill="url(#qr-ink)" />
        <Paw cx={badge.cx} cy={badge.cy - u * 0.2} s={badge.r * 0.42} fill="#ffffff" />
      </g>

      {/* Plaquinha de coleira em forma de coração. */}
      <g transform={`translate(${q / 2} ${top + q + tag / 2 - 4})`}>
        <line x1="0" y1={-tag / 2 - 2} x2="0" y2={-tag / 2 + 12} stroke={RED} strokeWidth="4" strokeLinecap="round" />
        <path
          d="M 0 20 C -30 0 -26 -20 -12 -20 C -5 -20 -1 -15 0 -11 C 1 -15 5 -20 12 -20 C 26 -20 30 0 0 20 Z"
          fill="url(#qr-ink)"
        />
        <Paw cx={0} cy={-3} s={7.5} fill={CREAM} />
      </g>
    </svg>
  );
}

/** Patinha decorativa avulsa (fora do QR), para enfeitar a área ao redor. */
export function PawMark({ className }: { className?: string }) {
  return (
    <svg viewBox="-20 -20 40 40" className={className} aria-hidden>
      <Paw cx={0} cy={0} s={14} fill="currentColor" />
    </svg>
  );
}
