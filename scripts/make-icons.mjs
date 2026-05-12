// One-off icon generator. Renders a simple "$" mark on a rounded square,
// then exports 192x192 and 512x512 PNGs into public/.
//
// Run with: node scripts/make-icons.mjs
//
// Requires: sharp (installed as dev dep)

import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve('public');
mkdirSync(out, { recursive: true });

function svg(size) {
    const r = Math.round(size * 0.22);
    const fontSize = Math.round(size * 0.62);
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
  <text x="50%" y="54%" font-family="Inter, Arial, Helvetica, sans-serif" font-weight="800"
        font-size="${fontSize}" fill="#0a0a0a" text-anchor="middle" dominant-baseline="middle">$</text>
</svg>`;
}

async function emit(size, filename) {
    const buf = Buffer.from(svg(size));
    const png = await sharp(buf).png().toBuffer();
    writeFileSync(path.join(out, filename), png);
    console.log(`wrote ${filename} (${size}x${size}, ${png.length} bytes)`);
}

await emit(192, 'icon-192x192.png');
await emit(512, 'icon-512x512.png');
await emit(180, 'apple-touch-icon.png');
writeFileSync(path.join(out, 'icon.svg'), svg(512));
console.log('wrote icon.svg');
