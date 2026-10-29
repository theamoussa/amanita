// Downloads what has been published in Amanita OS and writes it out as the site's data files,
// in exactly the shape data/ has: `node scripts/fetch-data.mjs` → .os-data/
//
// The OS keeps every show, fair, event, artist, press article, store item and the site settings
// (Website section, owner only). Publish there snapshots the changes and starts this site's
// GitHub Action, which runs this script, then the build with SITE_DATA=.os-data.
//
// It reads only what was published, through website_export() — a public function that returns the
// public website, so the anon key is enough. Needs three settings (repository variables):
//   OS_SUPABASE_URL, OS_SUPABASE_ANON_KEY, OS_GALLERY_ID
//
// If any of them is missing, the OS cannot be reached, or nothing has been published yet, it
// writes nothing and says so: the build then uses data/ from the repository, so the site is
// never left empty by a hiccup.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fromOsExport } from '../src/fromOs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.os-data');
const { OS_SUPABASE_URL: url, OS_SUPABASE_ANON_KEY: key, OS_GALLERY_ID: gid } = process.env;

const bail = msg => { console.log(`fetch-data: ${msg} — building from data/ in the repository.`); process.exit(0); };
let exp;
if (process.env.OS_EXPORT_FILE) exp = JSON.parse(fs.readFileSync(process.env.OS_EXPORT_FILE, 'utf8'));   // for testing
else {
if (!url || !key || !gid) bail('OS_SUPABASE_URL, OS_SUPABASE_ANON_KEY or OS_GALLERY_ID not set');

let res;
try {
  res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/website_export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({ p_gallery_id: gid }),
  });
} catch (e) { bail(`could not reach the OS (${e.message})`); }
if (!res.ok) bail(`the OS answered ${res.status} ${await res.text()}`);
exp = await res.json();
}
if (!exp?.settings || !exp.items?.length) bail('nothing has been published from the OS yet');

const data = fromOsExport(exp);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'exhibitions'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'artists'), { recursive: true });
const write = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1) + '\n');

for (const e of data.exhibitions) write(`exhibitions/${e.slug}.json`, e);
for (const a of data.artists) write(`artists/${a.slug}.json`, a);
write('press.json', data.press);
write('shop.json', data.shop);
write('site.json', data.site);
// Old addresses are not edited in the OS: they come from the repository.
fs.copyFileSync(path.join(ROOT, 'data', 'redirects.json'), path.join(OUT, 'redirects.json'));

console.log(`fetch-data: ${data.exhibitions.length} shows, ${data.artists.length} artists, ${data.press.length} press, ${data.shop.length} store items (published ${exp.generatedAt}).`);
