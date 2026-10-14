import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const manifest = JSON.parse(await readFile('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.start_url, '/');
for (const size of ['192x192', '512x512']) {
  const icon = manifest.icons.find(icon => icon.sizes === size); assert(icon, `Missing ${size} icon`);
  const png = await readFile(`dist${icon.src}`); assert.equal(png.readUInt32BE(16), Number(size.split('x')[0])); assert.equal(png.readUInt32BE(20), Number(size.split('x')[1]));
}
const worker = await readFile('dist/sw.js', 'utf8');
assert(worker.includes('index.html'), 'App shell must be precached');
assert(worker.includes('createHandlerBoundToURL'), 'Navigation must fall back to cached shell');
for (const file of await readdir('dist/assets')) if (/\.(js|css|woff2)$/.test(file)) assert(worker.includes(`assets/${file}`), `Offline precache missing ${file}`);
assert((await readdir('dist/assets')).some(file => file.endsWith('.woff2')), 'Bundled Inter font is missing');
assert(!worker.includes('product-image-references'), 'Removed product photo cache must not be registered');
console.log('PWA artifact checks passed: manifest, PNG dimensions, all JS/CSS/font assets, navigation fallback.');
console.log('Actual offline reload and installation still require browser/device testing.');
