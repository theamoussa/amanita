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

const strip = ({ section, sortOrder, ...rest }) => rest;
const SHOW_KIND = { exhibition: 'exhibition', fair: 'fair', event: 'event' };
const by = s => exp.items.filter(i => i.section === s);

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'exhibitions'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'artists'), { recursive: true });
const write = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1) + '\n');

// Shows, fairs and events: one file each, as data/exhibitions/ has them.
const shows = exp.items.filter(i => SHOW_KIND[i.section]);
for (const i of shows) {
  write(`exhibitions/${i.slug}.json`, {
    old: null, subtitle: null, artists: [], relatedArtists: [], venue: '', address: [], note: null, city: '', place: '',
    start: null, end: null, images: [], text: [], pressRelease: null, files: [],
    ...strip(i), kind: SHOW_KIND[i.section],
  });
}

// Artists: their shows with the gallery are the ones that name them, plus any listed by hand.
for (const a of by('artist')) {
  const named = shows.filter(s => (s.relatedArtists || []).includes(a.slug)).map(s => s.slug);
  write(`artists/${a.slug}.json`, {
    old: null, bio: [], cv: null, works: [], ...strip(a),
    exhibitions: [...new Set([...(a.exhibitions || []), ...named])].filter(s => shows.some(x => x.slug === s)),
  });
}

write('press.json', by('press').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(strip).map(({ slug, ...p }) => p));
// Store pictures are {src} in the OS (so they can be dragged into order) and addresses on the site.
const srcOf = (i) => (typeof i === 'string' ? i : i?.src);
write('shop.json', by('store').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(strip)
  .map((s) => { const images = (s.images || []).map(srcOf).filter(Boolean); return { ...s, images, image: s.image || images[0] || null }; }));
write('site.json', exp.settings);
// Old addresses are not edited in the OS: they come from the repository.
fs.copyFileSync(path.join(ROOT, 'data', 'redirects.json'), path.join(OUT, 'redirects.json'));

console.log(`fetch-data: ${shows.length} shows, ${by('artist').length} artists, ${by('press').length} press, ${by('store').length} store items (published ${exp.generatedAt}).`);
