// Derives the web assets from the official APASBAC logo (assets/apasbac-logo-official.png,
// taken from APASBAC/apasbac-app assets/images/apasbac_logo.png). Run: npm run assets
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const SRC = 'assets/apasbac-logo-official.png';
const CREAM = '#FFF3D4';
mkdirSync('public/logo', { recursive: true });
mkdirSync('app', { recursive: true });

// Transparent margins removed so the logo aligns with text in the header.
const trimmed = await sharp(SRC).trim({ threshold: 1 }).png().toBuffer();
await sharp(trimmed).toFile('public/logo/apasbac-logo.png');

async function square(size, padding, file) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(trimmed).resize({ width: inner, height: inner, fit: 'inside' }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: CREAM } })
    .composite([{ input: logo, gravity: 'center' }]).png().toFile(file);
}
await square(512, 0.06, 'app/icon.png');
await square(180, 0.06, 'app/apple-icon.png');
const meta = await sharp(trimmed).metadata();
console.log(`assets ok: logo ${meta.width}x${meta.height}`);
