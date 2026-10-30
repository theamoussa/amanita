// Builds the Amanita website from the files in data/ into dist/.
// No dependencies: `node scripts/build.mjs`.
//
//   SITE_BASE  path the site lives under ("/" at launch, "/amanita-new/" on the GitHub preview)
//   SITE_URL   full address used in links Google and social media read
//   CNAME      the domain to serve on (set only at launch)
//   TODAY      YYYY-MM-DD, to build "as of" another day (defaults to today in New York)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../src/render.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The data: data/ in the repository, or — once the site is edited in Amanita OS — what scripts/fetch-data.mjs
// downloaded from it (SITE_DATA points there).
const DATA = process.env.SITE_DATA ? path.resolve(process.env.SITE_DATA) : path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'dist');
const BASE = (process.env.SITE_BASE || '/').replace(/\/?$/, '/');
const SITE = JSON.parse(fs.readFileSync(path.join(DATA, 'site.json'), 'utf8'));
const TODAY = process.env.TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

// ---------- load data ----------
const readDir = dir => fs.readdirSync(path.join(DATA, dir)).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(DATA, dir, f), 'utf8')));
const read = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const manifestPath = path.join(ROOT, 'images', 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const logo = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'logo.json'), 'utf8'));
const redirects = read('redirects.json');
// The store's rules, from Amanita OS (absent in data/: the store then keeps its Buy links). The cart
// asks the OS's `store` function for stock and checkout — its address from the same two variables
// fetch-data uses.
const store = fs.existsSync(path.join(DATA, 'store.json')) ? read('store.json') : null;
const { OS_SUPABASE_URL, OS_GALLERY_ID } = process.env;
const shopApi = OS_SUPABASE_URL && OS_GALLERY_ID ? { url: `${OS_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/store`, gallery: OS_GALLERY_ID } : null;

// ---------- pages: src/render.mjs, the same templates Amanita OS previews with ----------
const pages = render({
  site: SITE, exhibitions: readDir('exhibitions'), artists: readDir('artists'), press: read('press.json'), shop: read('shop.json'), store, shopApi,
  redirects, manifest, logo, today: TODAY, base: BASE, siteUrl: process.env.SITE_URL || SITE.url,
  cname: process.env.CNAME || '', previewMissing: process.env.PREVIEW_MISSING === 'blank',
});

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
for (const [p, html] of pages) {
  const f = path.join(OUT, p);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html);
}
const copy = (from, to) => { if (fs.existsSync(from)) fs.cpSync(from, to, { recursive: true }); };
copy(path.join(ROOT, 'src', 'assets'), path.join(OUT, 'assets'));
copy(path.join(ROOT, 'src', 'public'), OUT);
// The preview of unpublished changes (/preview/, opened from Amanita OS) renders with these very files.
fs.copyFileSync(path.join(ROOT, 'src', 'render.mjs'), path.join(OUT, 'assets', 'render.mjs'));
fs.copyFileSync(path.join(ROOT, 'src', 'fromOs.mjs'), path.join(OUT, 'assets', 'fromOs.mjs'));
fs.copyFileSync(path.join(ROOT, 'src', 'shop.mjs'), path.join(OUT, 'assets', 'shop.mjs'));
fs.writeFileSync(path.join(OUT, 'assets', 'preview-data.json'), JSON.stringify({ manifest, logo }));
if (fs.existsSync(path.join(ROOT, 'images'))) {
  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'images'))) if (f.endsWith('.webp') || f.endsWith('.jpg')) fs.copyFileSync(path.join(ROOT, 'images', f), path.join(OUT, 'images', f));
}
console.log(`Built ${pages.length} files into dist/ (base ${BASE}, as of ${TODAY}, store ${store?.checkout && shopApi ? 'with cart and checkout' : 'with Buy links'}${Object.keys(manifest).length ? `, ${Object.keys(manifest).length} web-sized images` : ', original images'}).`);

