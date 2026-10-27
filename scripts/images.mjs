// Makes small, fast copies of every picture the site uses: `npm run images`.
//
// The originals stay where they are (Google Cloud Storage). For each one this downloads it once, writes two
// web-sized WebP copies (800 and 1600 pixels wide) into images/, and records them in images/manifest.json.
// The next `npm run build` uses those copies instead of the originals.
//
// It only does pictures it hasn't done yet, so it is safe to stop and run again, and to run after adding a show.
// Needs `npm install` once (for sharp).

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'images');
const WIDTHS = [800, 1600];
const QUALITY = 78;
const PARALLEL = 4;

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

// every picture the site shows
const urls = new Set();
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
for (const f of fs.readdirSync(path.join(DATA, 'exhibitions'))) { const e = read(path.join(DATA, 'exhibitions', f)); e.images.forEach(i => urls.add(i.src)); if (e.cover) urls.add(e.cover); }
for (const f of fs.readdirSync(path.join(DATA, 'artists'))) read(path.join(DATA, 'artists', f)).works.forEach(w => urls.add(w.src));
read(path.join(DATA, 'shop.json')).forEach(s => [s.image, ...(s.images || [])].forEach(u => urls.add(u)));
read(path.join(DATA, 'site.json')).locations.forEach(l => urls.add(l.image));

const todo = [...urls].filter(u => u && /^https?:/.test(u) && !manifest[u]);
console.log(`${urls.size} pictures in the site, ${Object.keys(manifest).length} already done, ${todo.length} to do.`);

let done = 0, failed = [];
const save = () => fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 0));

async function one(url) {
  const id = crypto.createHash('md5').update(url).digest('hex').slice(0, 12);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const img = sharp(buf, { failOn: 'none' }).rotate();
  const meta = await img.metadata();
  const w0 = meta.autoOrient?.width || meta.width, h0 = meta.autoOrient?.height || meta.height;
  const sizes = [];
  for (const w of WIDTHS) {
    const width = Math.min(w, w0);
    const file = `${id}-${w}.webp`;
    await sharp(buf, { failOn: 'none' }).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: QUALITY }).toFile(path.join(OUT, file));
    sizes.push({ file, w: width });
    if (width === w0) break;                    // the original is smaller than the next size
  }
  const big = sizes.at(-1).w;
  manifest[url] = { w: big, h: Math.round(h0 * big / w0), sizes };
}

const queue = [...todo];
await Promise.all([...Array(PARALLEL)].map(async () => {
  while (queue.length) {
    const url = queue.shift();
    try { await one(url); } catch (e) { failed.push([url, e.message]); }
    done++;
    if (done % 10 === 0 || !queue.length) { save(); process.stdout.write(`\r${done} / ${todo.length}`); }
  }
}));
save();
console.log(`\nDone. ${Object.keys(manifest).length} pictures have web-sized copies.`);
if (failed.length) {
  console.log(`${failed.length} could not be downloaded (they keep using the original):`);
  failed.forEach(([u, m]) => console.log(`  ${m}  ${u}`));
}
