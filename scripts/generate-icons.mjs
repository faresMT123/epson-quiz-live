/**
 * Génère les icônes PWA / Capacitor à partir du logo officiel fourni
 * (`client/assets/logoepsonnoir.png`). Le logo n'est jamais recoloré :
 * il est posé sur un fond blanc avec une marge de dégagement.
 *
 * Usage : npm run icons
 */
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const logoPath = path.join(root, 'client/src/assets/epson-logo-black.png');
const iconsDir = path.join(root, 'client/public/icons');
const assetsDir = path.join(root, 'client/assets');

const logoSvg = await readFile(logoPath);

async function icon(size, ratio, destination) {
  const logoWidth = Math.round(size * ratio);
  const logo = await sharp(logoSvg)
    .resize({ width: logoWidth, fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: '#ffffff',
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(destination);
  console.log(`✓ ${path.relative(root, destination)}`);
}

await mkdir(iconsDir, { recursive: true });
await mkdir(assetsDir, { recursive: true });

await icon(192, 0.72, path.join(iconsDir, 'icon-192.png'));
await icon(512, 0.72, path.join(iconsDir, 'icon-512.png'));
await icon(512, 0.56, path.join(iconsDir, 'maskable-512.png'));
await icon(180, 0.72, path.join(iconsDir, 'apple-touch-icon.png'));
await icon(64, 0.8, path.join(iconsDir, 'favicon-64.png'));
await icon(1024, 0.7, path.join(assetsDir, 'icon-only.png'));

// Splash 2732×2732 pour @capacitor/assets (logo centré sur fond blanc).
const splashLogo = await sharp(logoSvg)
  .resize({ width: 700, fit: 'inside' })
  .png()
  .toBuffer();
await sharp({
  create: { width: 2732, height: 2732, channels: 4, background: '#ffffff' },
})
  .composite([{ input: splashLogo, gravity: 'center' }])
  .png()
  .toFile(path.join(assetsDir, 'splash.png'));
console.log(`✓ ${path.relative(root, path.join(assetsDir, 'splash.png'))}`);
