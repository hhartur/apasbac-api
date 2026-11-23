import { buildAppQr, QR_MARGIN } from '@/lib/app-qr';

const RED = '#8b1a1a';
const RED_LIGHT = '#c0392b';
const CREAM = '#fff3d4';

/** QR Code do aplicativo: módulos arredondados, "olhos" estilizados e a logo da APASBAC no centro. */
export function AppQrCode({ className }: { className?: string }) {
  const qr = buildAppQr();
  const u = qr.unit;
  const at = (n: number) => (n + QR_MARGIN) * u;
  const { logo } = qr;
  const pad = u * 0.6;
  return (
    <svg
      viewBox={`0 0 ${qr.viewBox} ${qr.viewBox}`}
      className={className}
      role="img"
      aria-label="QR Code para baixar o aplicativo APASBAC"
      shapeRendering="geometricPrecision"
    >
      <defs>
        <linearGradient id="qr-ink" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={RED} />
          <stop offset="1" stopColor={RED_LIGHT} />
        </linearGradient>
      </defs>
      <rect width={qr.viewBox} height={qr.viewBox} rx={u * 3} fill="#ffffff" />
      <g fill="url(#qr-ink)">
        {qr.dots.map(([r, c]) => (
          <circle key={`${r}-${c}`} cx={at(c) + u / 2} cy={at(r) + u / 2} r={u * 0.43} />
        ))}
      </g>
      {qr.eyes.map(([r, c]) => (
        <g key={`eye-${r}-${c}`}>
          <rect x={at(c)} y={at(r)} width={u * 7} height={u * 7} rx={u * 2.2} fill={RED} />
          <rect x={at(c) + u} y={at(r) + u} width={u * 5} height={u * 5} rx={u * 1.5} fill="#ffffff" />
          <rect x={at(c) + u * 2} y={at(r) + u * 2} width={u * 3} height={u * 3} rx={u * 0.9} fill={RED_LIGHT} />
        </g>
      ))}
      <rect
        x={logo.x + pad / 2}
        y={logo.y + pad / 2}
        width={logo.width - pad}
        height={logo.height - pad}
        rx={u * 1.6}
        fill={CREAM}
        stroke={RED}
        strokeWidth={u * 0.35}
      />
      <image
        href="/logo/apasbac-logo.png"
        x={logo.x + pad * 1.4}
        y={logo.y + pad * 1.4}
        width={logo.width - pad * 2.8}
        height={logo.height - pad * 2.8}
        preserveAspectRatio="xMidYMid meet"
      />
    </svg>
  );
}
