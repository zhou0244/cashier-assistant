import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Search } from 'lucide-react';
import { writeFile } from 'node:fs/promises';
import { deflateSync } from 'node:zlib';

// Use the installed Lucide artwork for both the SVG favicon and raster install icons.
const artwork = renderToStaticMarkup(React.createElement(Search));
const content = artwork.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
await writeFile('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#173e36"/><g transform="translate(117.76 117.76) scale(11.52)" fill="none" stroke="#f6f7f3" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>\n`);

// The Search icon contains one circle and one straight handle. Rasterize those
// exact coordinates with antialiasing, without adding an image dependency.
const circle = artwork.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
const path = artwork.match(/<path d="m([\d.]+) ([\d.]+)(-[\d.]+)(-[\d.]+)"/);
if (!circle || !path || (content.match(/<(path|circle)\b/g) ?? []).length !== 2) throw new Error('Lucide Search geometry changed; update this focused rasterizer.');
const [cx, cy, radius] = circle.slice(1).map(Number);
const [x1, y1, dx, dy] = path.slice(1).map(Number);
function covered(x, y) {
  if (Math.abs(Math.hypot(x - cx, y - cy) - radius) <= 1) return true;
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(x - x1 - t * dx, y - y1 - t * dy) <= 1;
}
function chunk(type, data) {
  const name = Buffer.from(type); const bytes = Buffer.concat([name, data]);
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  const header = Buffer.alloc(4); header.writeUInt32BE(data.length);
  const footer = Buffer.alloc(4); footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([header, bytes, footer]);
}
for (const size of [192, 512]) {
  const stride = size * 4 + 1; const pixels = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let count = 0;
    for (let sy = 0; sy < 4; sy++) for (let sx = 0; sx < 4; sx++) {
      const u = ((x + (sx + .5) / 4) / size - .23) * 24 / .54;
      const v = ((y + (sy + .5) / 4) / size - .23) * 24 / .54;
      if (covered(u, v)) count++;
    }
    const offset = y * stride + 1 + x * 4;
    for (let c = 0; c < 3; c++) pixels[offset + c] = Math.round([23, 62, 54][c] + ([246, 247, 243][c] - [23, 62, 54][c]) * count / 16);
    pixels[offset + 3] = 255;
  }
  const info = Buffer.alloc(13); info.writeUInt32BE(size, 0); info.writeUInt32BE(size, 4); info[8] = 8; info[9] = 6;
  await writeFile(`public/icon-${size}.png`, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', info), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]));
}
console.log('Generated Lucide Search favicon and 192/512px install icons.');
