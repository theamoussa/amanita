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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The data: data/ in the repository, or — once the site is edited in Amanita OS — what scripts/fetch-data.mjs
// downloaded from it (SITE_DATA points there).
const DATA = process.env.SITE_DATA ? path.resolve(process.env.SITE_DATA) : path.join(ROOT, 'data');
const OUT = path.join(ROOT, 'dist');
const BASE = (process.env.SITE_BASE || '/').replace(/\/?$/, '/');
const RELATIVE = BASE === './';                       // links relative to each page (for previews opened without a server)
const BLANK_MISSING = process.env.PREVIEW_MISSING === 'blank'; // previews: pictures without a local copy become plain boxes
let REL = './';
const SITE = JSON.parse(fs.readFileSync(path.join(DATA, 'site.json'), 'utf8'));
const SITE_URL = (process.env.SITE_URL || SITE.url).replace(/\/$/, '');
const TODAY = process.env.TODAY || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());

// ---------- load data ----------
const readDir = dir => fs.readdirSync(path.join(DATA, dir)).filter(f => f.endsWith('.json'))
  .map(f => JSON.parse(fs.readFileSync(path.join(DATA, dir, f), 'utf8')));
const exhibitions = readDir('exhibitions').sort((a, b) => (b.start || '').localeCompare(a.start || ''));
const artists = readDir('artists').sort((a, b) => surname(a.name).localeCompare(surname(b.name)));
const press = JSON.parse(fs.readFileSync(path.join(DATA, 'press.json'), 'utf8'));
const shop = JSON.parse(fs.readFileSync(path.join(DATA, 'shop.json'), 'utf8'));
const redirects = JSON.parse(fs.readFileSync(path.join(DATA, 'redirects.json'), 'utf8'));
const manifestPath = path.join(ROOT, 'images', 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
const exBySlug = Object.fromEntries(exhibitions.map(e => [e.slug, e]));
const artistBySlug = Object.fromEntries(artists.map(a => [a.slug, a]));

function surname(n) { const p = n.trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]) + ' ' + n; }

// ---------- helpers ----------
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = h => String(h ?? '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const u = p => {                                                                   // site-relative link
  const q = String(p).replace(/^\//, '');
  if (!RELATIVE) return BASE + q;
  const [path, hash] = q.split('#');
  return REL + (path === '' || path.endsWith('/') ? path + 'index.html' : path) + (hash ? '#' + hash : '');
};
const at = file => { REL = '../'.repeat(file.split('/').length - 1) || './'; };   // which page is being written
const abs = p => SITE_URL + '/' + String(p).replace(/^\//, '');                    // full address
const rich = h => String(h ?? '').replace(/href="(\/[^"]*)"/g, (m, p) => `href="${u(p)}"`)   // internal links in stored text
  .replace(/<a href="http/g, '<a rel="noopener" target="_blank" href="http');
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const d = iso => { const [y, m, dd] = iso.split('-').map(Number); return { y, m, d: dd }; };
function dateRange(start, end) {
  if (!start) return '';
  const a = d(start);
  if (!end) return `${MONTHS[a.m - 1]} ${a.d}, ${a.y}`;
  const b = d(end);
  if (a.y === b.y && a.m === b.m) return `${MONTHS[a.m - 1]} ${a.d} – ${b.d}, ${b.y}`;
  if (a.y === b.y) return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
  return `${MONTHS[a.m - 1]} ${a.d}, ${a.y} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
}
const status = e => !e.start ? 'past' : e.start > TODAY ? 'upcoming' : (!e.end || e.end >= TODAY) ? 'now' : 'past';
const yearOf = e => (e.start || '').slice(0, 4);
const placeLabel = e => e.kind === 'fair' ? (e.place || '') : (e.city === 'Fondazione Iris' ? 'Fondazione Iris' : e.city || e.place || '');
const showName = e => e.artists.length ? `${e.artists.join(' & ')}: ${e.title}` : e.title;
function showHeading(e, tag = 'span') {
  const who = e.artists.length && !e.artists.includes(e.title) ? `<${tag} class="who">${esc(e.artists.join(' & '))}:</${tag}> ` : '';
  return `${who}<em>${esc(e.title)}</em>`;
}

// Images: once `npm run images` has made web-sized copies they are used; until then the original file is.
function picture(src, alt, { sizes = '100vw', eager = false, cls = '' } = {}) {
  const m = manifest[src];
  const load = eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"';
  if (!m && BLANK_MISSING && /^https?:/.test(src)) return `<span class="ph ${cls}" role="img" aria-label="${esc(alt)}"></span>`;
  if (m) {
    const set = m.sizes.map(s => `${u('images/' + s.file)} ${s.w}w`).join(', ');
    const fallback = m.sizes[m.sizes.length - 1];
    return `<img class="${cls}" src="${u('images/' + fallback.file)}" srcset="${set}" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(alt)}" ${load}>`;
  }
  // a picture kept in the site itself (src/public/media/…) rather than on Google Cloud Storage
  return `<img class="${cls}" src="${esc(/^https?:/.test(src) ? src : u(src))}" alt="${esc(alt)}" ${load}>`;
}
// attributes for the picture that appears when hovering a name in a list: the full set of sizes, so a retina
// screen gets the sharp copy
function hoverImg(src) {
  if (!src) return '';
  if (!/^https?:/.test(src)) return ` data-img="${esc(u(src))}"`;
  const m = manifest[src];
  if (!m) return ` data-img="${esc(src)}"`;
  return ` data-img="${esc(u('images/' + m.sizes.at(-1).file))}" data-srcset="${esc(m.sizes.map(s => `${u('images/' + s.file)} ${s.w}w`).join(', '))}"`;
}
const firstImage = e => (e.images || [])[0]?.src;
// an upcoming show announced before there is a text: shown, but not clickable until its page has something to read
const linked = e => !(status(e) === 'upcoming' && !e.text.length && !e.pressRelease);
// the picture that stands for a show on the home page: its `cover` (an installation view) if it has one
const coverOf = e => e.cover || firstImage(e);
// the slideshow opens on the same picture that stands for the show in the lists (its cover), then the rest in their order
const slidesOf = e => { const i = e.images.findIndex(im => im.src === e.cover); return i > 0 ? [e.images[i], ...e.images.slice(0, i), ...e.images.slice(i + 1)] : e.images; };

// One picture at a time, caption and counter underneath, an index of all of them on request.
// Without JavaScript the pictures simply follow one another.
function slideshow(items, label) {
  if (!items.length) return '';
  return `<section class="slideshow" data-slideshow aria-roledescription="carousel" aria-label="${esc(label)}">
  <div class="ss-stage">
${items.map((it, k) => `    <figure class="ss-slide" aria-roledescription="slide" aria-label="${k + 1} of ${items.length}">${picture(it.src, it.alt, { sizes: '(max-width:1240px) 100vw, 1240px', eager: k === 0 })}${it.caption ? `<figcaption>${rich(it.caption)}</figcaption>` : ''}</figure>`).join('\n')}
  </div>
</section>`;
}

// ---------- the logo: Amanita's own wordmark, one path per letter ----------
const LOGO = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'logo.json'), 'utf8'));
const logoSvg = `<svg class="logo" viewBox="0 0 ${LOGO.w} ${LOGO.h}" role="img" aria-label="Amanita">${LOGO.letters.map(l => `<path transform="translate(${l.x} 0)" d="${l.d}"/>`).join('')}</svg>`;

// ---------- page shell ----------
const NAV = [
  ['exhibitions', 'exhibitions', 'exhibitions/'],
  ['fairs', 'fairs', 'art-fairs/'],
  ['artists', 'artists', 'artists/'],
  ...(SITE.pressPage ? [['press', 'press', 'press/']] : []),
  ['shop', 'store', 'shop/'],
  ['about', 'about', 'about/'],
];

function layout({ title, description, canonical, section = '', body, image, jsonld, letters = false, pageClass = '' }) {
  const fullTitle = title ? `${title} · Amanita` : 'Amanita';
  const desc = description || SITE.description;
  const og = image ? (manifest[image] ? abs('images/' + manifest[image].sizes.at(-1).file) : /^https?:/.test(image) ? image : abs(image)) : null;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${abs(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Amanita">
<meta property="og:title" content="${esc(title || 'Amanita')}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${abs(canonical)}">
${og ? `<meta property="og:image" content="${esc(og)}">\n<meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
<link rel="icon" type="image/png" sizes="32x32" href="${u('favicon-32x32.png')}">
<link rel="icon" type="image/png" sizes="16x16" href="${u('favicon-16x16.png')}">
<link rel="apple-touch-icon" sizes="180x180" href="${u('apple-touch-icon.png')}">
<link rel="manifest" href="${u('site.webmanifest')}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@0,300..700;1,300..700&display=swap">
<link rel="stylesheet" href="${u('assets/site.css')}?v=${BUILD_ID}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
${/^[A-Z0-9-]+$/i.test(SITE.analytics || '') ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${SITE.analytics}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${SITE.analytics}');</script>
` : ''}</head>
<body class="${pageClass}"${letters ? ' data-letters' : ''} data-base="${RELATIVE ? REL : BASE}" data-marcel='${JSON.stringify(SITE.marcel)}'>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="wm" href="${u('')}" aria-label="Amanita, home">${logoSvg}</a>
  <nav class="menu" aria-label="Main">
    ${NAV.map(([key, label, href]) => `<a href="${u(href)}"${section === key ? ' aria-current="page"' : ''}>${label}</a>`).join('\n    ')}
    <a class="s" href="${u('search/')}" data-search>search</a>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="foot" data-perch>
${SITE.locations.map(l => `  <div><b>${esc(l.name)}</b>${esc(l.lines.join(', '))}<br>${esc(l.hoursShort)}</div>`).join('\n')}
  <div><b><a href="mailto:${SITE.email}">${SITE.email}</a></b><a href="${SITE.instagram}" rel="noopener" target="_blank">Instagram ${SITE.instagramHandle}</a><br><a href="${u('about/')}#mailing-list">Mailing list</a></div>
</footer>
<div class="search" id="search" hidden role="dialog" aria-modal="true" aria-label="Search">
  <div class="search-in">
    <input id="q" type="search" placeholder="Search artists, exhibitions, works, press" autocomplete="off" spellcheck="false" aria-label="Search">
    <button type="button" id="closeSearch">Close</button>
  </div>
  <div class="results" id="results" aria-live="polite"></div>
</div>
<script src="${u('assets/site.js')}?v=${BUILD_ID}" defer></script>
</body>
</html>
`;
}
const BUILD_ID = Date.now().toString(36);

// ---------- pages ----------
const pages = [];                                      // [path, html]
const add = (p, html) => pages.push([p, html]);
const page = (p, make) => { at(p); add(p, make()); };

const galleryLd = {
  '@context': 'https://schema.org', '@type': 'ArtGallery', name: 'Amanita', url: SITE_URL, email: SITE.email,
  sameAs: [SITE.instagram],
  location: SITE.locations.map(l => ({
    '@type': 'Place', name: `Amanita, ${l.name}`, telephone: l.phone, openingHours: l.openingHours,
    address: { '@type': 'PostalAddress', streetAddress: l.street, addressLocality: l.locality, addressRegion: l.region, postalCode: l.postalCode, addressCountry: l.country },
  })),
};

function card(e, { big = false, sizes } = {}) {
  const img = coverOf(e);
  const kicker = placeLabel(e);
  return `<article class="card${big ? ' big' : ''}">
  <a href="${u(`exhibitions/${e.slug}/`)}">
    ${img ? picture(img, showName(e), { sizes: sizes || (big ? '(max-width:700px) 100vw, 50vw' : '(max-width:900px) 50vw, 25vw'), eager: big }) : '<div class="noimg"></div>'}
    <div class="cap">
      ${big ? `<p class="kicker">${esc(kicker)}</p>` : ''}
      <${big ? 'h2' : 'h3'}>${showHeading(e)}</${big ? 'h2' : 'h3'}>
      <p class="meta">${esc(e.kind === 'fair' ? e.place : e.venue.replace(/,\s*(New York|NY).*$/i, ''))} · ${esc(dateRange(e.start, e.end))}</p>
    </div>
  </a>
</article>`;
}

// An upcoming show on the home page: a quiet strip under Now on view — picture, what and where.
// Works with only a title and dates (shows are often announced before there are pictures); the note (e.g. the
// opening reception) is added when there is one. It only links to its page once that page has a text.
function nextShow(e) {
  const img = coverOf(e);
  const s = d(e.start);
  const where = e.venue.replace(/,\s*(New York|NY).*$/i, '') + (e.city && !e.venue.includes(e.city) ? `, ${e.city}` : '');
  const inside = `
    ${img ? `<div class="next-img">${picture(img, showName(e), { sizes: '(max-width:700px) 34vw, 360px' })}</div>` : ''}
    <div class="next-text">
      <p class="kicker">Upcoming · Opening ${MONTHS[s.m - 1]} ${s.d}</p>
      <h3>${showHeading(e)}</h3>
      <p class="meta">${esc(where)}${e.end ? ` · ${esc(dateRange(e.start, e.end))}` : ''}${e.note ? `<br>${esc(e.note)}` : ''}</p>
    </div>`;
  return `<article class="next-show${img ? '' : ' noimg'}">
  ${linked(e) ? `<a href="${u(`exhibitions/${e.slug}/`)}">${inside}
    <span class="go" aria-hidden="true">View →</span>
  </a>` : `<div class="next-in">${inside}</div>`}
</article>`;
}

// Home: what's on now, what's next, then the most recent shows.
// "Now on view" and "Recently" are rows that scroll sideways, so three or four shows at once stay large.
function rail(id, label, items, { big = false, hideLabel = false } = {}) {
  return `<section class="rail-wrap${big ? ' big' : ''}${items.length === 1 ? ' single' : ''}" data-perch aria-labelledby="${id}">
  <div class="railhead"><h2 class="sec${hideLabel ? ' vh' : ''}" id="${id}">${esc(label)}</h2><div class="railnav" hidden><button type="button" data-dir="-1" aria-label="Previous">←</button><button type="button" data-dir="1" aria-label="Next">→</button></div></div>
  <div class="rail" data-rail tabindex="-1">
${items.map(e => card(e, { big, sizes: big ? (items.length === 1 ? '(max-width:700px) 100vw, 1240px' : '(max-width:700px) 86vw, 780px') : '(max-width:700px) 62vw, 320px' })).join('\n')}
  </div>
</section>`;
}
{
  // Now on view: in the order set in the OS (homeOrder), then the most recent first.
  const now = exhibitions.filter(e => status(e) === 'now').sort((a, b) => (a.homeOrder ?? 1e9) - (b.homeOrder ?? 1e9));
  const upcoming = exhibitions.filter(e => status(e) === 'upcoming').reverse();
  const past = exhibitions.filter(e => status(e) === 'past');
  const lead = now.length ? now : past.slice(0, 2);
  const recent = (now.length ? past : past.slice(2)).slice(0, 10);
  at('index.html');
  const body = `
${rail('h-now', now.length ? 'Now on view' : 'Recent exhibitions', lead, { big: true, hideLabel: true })}
${upcoming.length ? `<section class="next" data-perch aria-label="Upcoming">${upcoming.map(nextShow).join('\n')}</section>` : ''}
${rail('h-rec', 'Past', recent)}`;
  page('index.html', () => layout({ title: '', canonical: '/', body, image: coverOf(lead[0] || {}), jsonld: galleryLd, pageClass: 'p-home' }));
}

// Exhibitions archive (and the Art Fairs view of it)
function archive({ fairs }) {
  const list = exhibitions.filter(e => fairs ? e.kind === 'fair' : true);
  const groups = [];
  for (const e of list) {
    const g = status(e) === 'now' ? 'Now on view' : status(e) === 'upcoming' ? 'Upcoming' : yearOf(e);
    if (!groups.length || groups.at(-1).label !== g) groups.push({ label: g, items: [] });
    groups.at(-1).items.push(e);
  }
  const places = ['New York', 'Rome', 'Fondazione Iris'];
  const filters = fairs ? '' : `
    <div class="filters" data-filters hidden>
      <div class="grp" role="group" aria-label="Type">
        <button type="button" data-type="all" aria-pressed="true">All</button>
        <button type="button" data-type="exhibition" aria-pressed="false">Exhibitions</button>
        <a href="${u('art-fairs/')}">Fairs</a>
      </div>
      <span class="sep" aria-hidden="true"></span>
      <div class="grp" role="group" aria-label="Place">
        ${places.map(p => `<button type="button" data-place="${p}" aria-pressed="false">${p}</button>`).join('\n        ')}
      </div>
    </div>`;
  const body = `
<div class="inner">
  <div class="pagehead">
    <h1 class="vh">${fairs ? 'Fairs' : 'Exhibitions'}</h1>${filters}
  </div>
  <div class="arc">
    <ol class="list" data-arc>
${groups.map(g => `      <li class="yr" data-group>${esc(g.label)}</li>
${g.items.map(e => `      <li data-type="${e.kind}" data-place="${esc(e.city)}"><${linked(e) ? `a href="${u(`exhibitions/${e.slug}/`)}"` : 'span class="nolink"'}${hoverImg(coverOf(e))} data-date="${esc(dateRange(e.start, e.end))}" data-cap="${esc(e.kind === 'fair' ? [e.place, dateRange(e.start, e.end)].filter(Boolean).join(' · ') : [e.venue.replace(/,\s*(New York|NY).*$/i, ''), dateRange(e.start, e.end)].filter(Boolean).join(' · '))}">
        <span class="t">${showHeading(e)}</span>
      </${linked(e) ? 'a' : 'span'}></li>`).join('\n')}`).join('\n')}
    </ol>
    <div class="view" aria-hidden="true"><figure class="frame"><img alt="" data-arc-img></figure><p class="arccap" data-arc-cap></p></div>
  </div>
</div>`;
  return layout({ title: fairs ? 'Fairs' : 'Exhibitions', canonical: fairs ? '/art-fairs/' : '/exhibitions/', section: fairs ? 'fairs' : 'exhibitions', body, letters: true, pageClass: 'p-archive' });
}
page('exhibitions/index.html', () => archive({ fairs: false }));
page('art-fairs/index.html', () => archive({ fairs: true }));

// One exhibition
const pressFor = (names, title) => press.filter(p => {
  const blob = (p.title + ' ').toLowerCase();
  return (title && blob.includes(title.toLowerCase())) || names.some(n => p.artists.includes(n));
});
exhibitions.forEach((e, i) => {
  at(`exhibitions/${e.slug}/index.html`);
  const st = status(e);
  const related = e.relatedArtists.map(s => artistBySlug[s]).filter(Boolean);
  const subject = encodeURIComponent(`Inquiry | ${showName(e)}`);
  const newer = exhibitions.slice(0, i).reverse().find(linked), older = exhibitions.slice(i + 1).find(linked);
  const showPress = press.filter(p => p.title.toLowerCase().includes(e.title.toLowerCase()) && e.title.length > 5);
  const body = `
<article class="inner ex">
  <header class="exhead">
    <h1>${showHeading(e)}</h1>
    ${e.subtitle ? `<p class="sub">${esc(e.subtitle)}</p>` : ''}
  </header>
  ${slideshow(slidesOf(e).map(im => ({ src: im.src, caption: im.caption, alt: strip(im.caption) || `${showName(e)}, installation view` })), `Images of ${showName(e)}`)}
  <div class="exinfo">
    <p class="meta">${[esc(e.venue), ...e.address.map(esc)].join('<br>')}<br>${esc(dateRange(e.start, e.end))}${e.note ? `<br>${esc(e.note)}` : ''}</p>
    <p class="actions"><a href="mailto:${SITE.email}?subject=${subject}">Inquire</a>${e.pressRelease ? ` <a href="${esc(e.pressRelease)}" target="_blank" rel="noopener">Press release</a>` : ''}${e.files.map(f => ` <a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.label || 'Download')}</a>`).join('')}</p>
  </div>
  ${e.text.length ? `<div class="text" data-perch>${e.text.map(p => `<p>${rich(p)}</p>`).join('\n')}</div>` : ''}
  ${related.length || showPress.length ? `<aside class="more" data-perch>
    ${related.length ? `<div><h2 class="sec">Artists</h2><ul>${related.map(a => `<li><a href="${u(`artists/${a.slug}/`)}">${esc(a.name)}</a></li>`).join('')}</ul></div>` : ''}
    ${showPress.length ? `<div><h2 class="sec">Press</h2><ul>${showPress.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a> <span class="meta">${esc(p.outlet)}</span></li>`).join('')}</ul></div>` : ''}
  </aside>` : ''}
  <nav class="pager" aria-label="More exhibitions">
    ${newer ? `<a rel="prev" href="${u(`exhibitions/${newer.slug}/`)}"><span class="meta">Newer</span>${showHeading(newer)}</a>` : '<span></span>'}
    ${older ? `<a rel="next" href="${u(`exhibitions/${older.slug}/`)}"><span class="meta">Older</span>${showHeading(older)}</a>` : '<span></span>'}
  </nav>
</article>`;
  const ld = {
    '@context': 'https://schema.org', '@type': e.kind === 'fair' ? 'Event' : 'ExhibitionEvent', name: showName(e),
    url: abs(`exhibitions/${e.slug}/`), startDate: e.start, endDate: e.end || e.start,
    location: { '@type': 'Place', name: e.venue, address: [e.venue, ...e.address].join(', ') },
    organizer: { '@type': 'ArtGallery', name: 'Amanita', url: SITE_URL },
    image: firstImage(e) ? [firstImage(e)] : undefined,
    description: strip(e.text[0] || '').slice(0, 300) || undefined,
  };
  add(`exhibitions/${e.slug}/index.html`, layout({
    title: showName(e), canonical: `/exhibitions/${e.slug}/`, section: e.kind === 'fair' ? 'fairs' : 'exhibitions',
    description: strip(e.text.find(t => strip(t).length > 80) || '').slice(0, 160) || `${showName(e)}, ${e.venue}, ${dateRange(e.start, e.end)}`,
    body, image: firstImage(e), jsonld: ld, letters: true, pageClass: 'p-ex',
  }));
});

// Artists
{
  at('artists/index.html');
  const body = `
<div class="inner">
  <div class="pagehead"><h1 class="vh">Artists</h1></div>
  <ul class="list names">
${artists.filter(a => a.listed !== false).map(a => `    <li><a href="${u(`artists/${a.slug}/`)}"><span class="t">${esc(a.name)}</span></a></li>`).join('\n')}
  </ul>
</div>`;
  add('artists/index.html', layout({ title: 'Artists', canonical: '/artists/', section: 'artists', body, letters: true, pageClass: 'p-archive p-artists' }));
}
artists.forEach(a => {
  at(`artists/${a.slug}/index.html`);
  const shows = a.exhibitions.map(s => exBySlug[s]).filter(Boolean).filter(linked).sort((x, y) => (y.start || '').localeCompare(x.start || ''));
  const ap = press.filter(p => p.artists.includes(a.slug));
  const body = `
<article class="inner artist">
  <header class="exhead"><h1>${esc(a.name)}</h1>
    <p class="actions"><a href="mailto:${SITE.email}?subject=${encodeURIComponent('Inquiry | ' + a.name)}">Inquire</a>${a.cv ? ` <a href="${esc(a.cv)}" target="_blank" rel="noopener">CV</a>` : ''}</p>
  </header>
  ${slideshow(a.works.map(w => ({ src: w.src, caption: w.caption, alt: strip(w.caption) || a.name })), `Works by ${a.name}`)}
  ${a.bio.length ? `<div class="text" data-perch>${a.bio.map(p => `<p>${rich(p)}</p>`).join('\n')}</div>` : ''}
  <aside class="more" data-perch>
    ${shows.length ? `<div><h2 class="sec">Exhibitions with Amanita</h2><ul>${shows.map(e => `<li><a href="${u(`exhibitions/${e.slug}/`)}">${showHeading(e)}</a> <span class="meta">${esc([placeLabel(e), yearOf(e)].filter(Boolean).join(', '))}</span></li>`).join('')}</ul></div>` : ''}
    ${ap.length ? `<div><h2 class="sec">Press</h2><ul>${ap.map(p => `<li><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a> <span class="meta">${esc([p.outlet, p.date?.slice(0, 4)].filter(Boolean).join(', '))}</span></li>`).join('')}</ul></div>` : ''}
  </aside>
</article>`;
  add(`artists/${a.slug}/index.html`, layout({
    title: a.name, canonical: `/artists/${a.slug}/`, section: 'artists', body, image: a.works[0]?.src, letters: true, pageClass: 'p-artist',
    description: strip(a.bio[0] || '').slice(0, 160) || `${a.name} at Amanita`,
    jsonld: { '@context': 'https://schema.org', '@type': 'Person', name: a.name, url: abs(`artists/${a.slug}/`), affiliation: { '@type': 'ArtGallery', name: 'Amanita' } },
  }));
});

// Press
{
  if (SITE.pressPage) {
  at('press/index.html');
  const years = [...new Set(press.map(p => (p.date || '').slice(0, 4)))];
  const body = `
<div class="inner">
  <div class="pagehead"><h1 class="vh">Press</h1></div>
  <ol class="presslist">
${years.map(y => `    <li class="yr">${esc(y || 'Earlier')}</li>
${press.filter(p => (p.date || '').slice(0, 4) === y).map(p => `    <li><a href="${esc(p.url)}" target="_blank" rel="noopener">
      <span class="t">${esc(p.title)}</span>
      <span class="v">${esc([p.outlet, p.author].filter(Boolean).join(' · '))}</span>
      <span class="dt">${p.date ? esc(dateRange(p.date)) : ''}</span>
    </a></li>`).join('\n')}`).join('\n')}
  </ol>
</div>`;
  add('press/index.html', layout({ title: 'Press', canonical: '/press/', section: 'press', body, letters: true, pageClass: 'p-press' }));
  }
}

// Shop
// a store item's details: a list of {label, value} (from the OS, which keeps their order) or an object (older data/)
const specsOf = s => Array.isArray(s.specs) ? s.specs.filter(x => x && x.label).map(x => [x.label, x.value ?? '']) : Object.entries(s.specs || {});
{
  at('shop/index.html');
  const body = `
<div class="inner">
  <div class="pagehead"><h1 class="vh">Store</h1></div>
  <div class="shop">
${shop.map(s => `    <article class="product" id="${s.slug}">
      ${picture(s.image, strip(s.title), { sizes: '(max-width:700px) 100vw, 33vw' })}
      <h2>${s.title}</h2>
      <p class="blurb">${s.blurb}</p>
      ${specsOf(s).length ? `<details><summary>Details</summary><dl>${specsOf(s).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>` : ''}
      <p class="buy"><span class="price">${esc(s.price)}</span>${s.buy ? `<a class="btn" href="${esc(s.buy)}" target="_blank" rel="noopener">Buy</a>` : ''}</p>
    </article>`).join('\n')}
  </div>
  <p class="note" data-perch>For international orders or special requests, write to <a href="mailto:${SITE.email}?subject=Store">${SITE.email}</a>.</p>
</div>`;
  add('shop/index.html', layout({ title: 'Store', canonical: '/shop/', section: 'shop', body, pageClass: 'p-shop' }));
}

// About
{
  at('about/index.html');
  const ml = SITE.mailingList;
  const body = `
<div class="inner ab">
  <h1 class="vh">About</h1>
  <div class="ab-grid">
    <div class="locs">
${SITE.locations.map(l => `      <section class="loc">
        ${l.image ? `<figure>${picture(l.image, l.imageAlt || '', { sizes: '(max-width:760px) 100vw, 36vw' })}</figure>` : ''}
        <div class="loc-text">
          <h2>${esc(l.name)}</h2>
          <p class="meta">${[esc((l.lines || []).join(', ')), esc(l.hours || ''), l.phone ? `<a href="tel:${l.phone.replace(/[^+\d]/g, '')}">${esc(l.phone)}</a>` : ''].filter(Boolean).join('<br>')}</p>
          ${l.map ? `<a class="dir" href="${esc(l.map)}" target="_blank" rel="noopener">Directions</a>` : ''}
        </div>
      </section>`).join('\n')}
    </div>
    <aside class="contact" data-perch>
      <div class="crow"><span>Email</span><a href="mailto:${SITE.email}">${SITE.email}</a></div>
      <div class="crow"><span>Instagram</span><a href="${SITE.instagram}" target="_blank" rel="noopener">${SITE.instagramHandle}</a></div>
      <div class="crow" id="mailing-list"><span>Mailing list</span>
        <form class="join" action="${esc(ml.action)}" method="post" target="_blank">
          <input type="email" name="EMAIL" placeholder="Your email address" autocomplete="email" aria-label="Email address" required>
          <div aria-hidden="true" style="position:absolute;left:-5000px"><input type="text" name="${ml.honeypot}" tabindex="-1" value=""></div>
          <button type="submit">Join</button>
        </form>
      </div>
    </aside>
  </div>
</div>`;
  add('about/index.html', layout({ title: 'About', canonical: '/about/', section: 'about', body, jsonld: galleryLd, pageClass: 'p-about' }));
}

// Search: the page works without the overlay too
page('search/index.html', () => layout({
  title: 'Search', canonical: '/search/', body: `<div class="inner"><div class="pagehead"><h1 class="vh">Search</h1></div><div class="search-page"><input id="q2" type="search" placeholder="Search artists, exhibitions, works, press" aria-label="Search" autofocus><div class="results" id="results2"></div></div></div>`, pageClass: 'p-search',
}));

page('404.html', () => layout({
  title: 'Page not found', canonical: '/404.html', pageClass: 'p-404',
  body: `<div class="inner nf" data-perch><h1>This page isn’t here.</h1><p class="meta">It may have moved when the site was redesigned. Try the <a href="${u('exhibitions/')}">exhibitions</a>, the <a href="${u('artists/')}">artists</a>, or <a href="${u('search/')}">search</a>.</p></div>`,
}));

// Old addresses keep working
const redirectPage = to => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Amanita</title><link rel="canonical" href="${abs(to)}"><meta name="robots" content="noindex"><meta http-equiv="refresh" content="0; url=${u(to)}"></head><body><p><a href="${u(to)}">This page has moved.</a></p></body></html>`;
const oldShop = { 'shop/mannarainbook.html': 'shop/#rita-ackermann-manna-rain', 'shop/etruscanpaintingbook.html': 'shop/#alessandro-twombly-etruscan-painting', 'shop/benwertherbook.html': 'shop/#when-you-can-no-longer-speak-sing-me-a-song', 'shop/bardinibook.html': 'shop/#leonardo-meoni-gli-altri-colori-purtroppo-sono-tutti-caduti' };
const moved = { ...redirects, ...oldShop };
if (!SITE.pressPage) for (const k in moved) if (moved[k] === '/press/') moved[k] = '/';
const generated = new Set(pages.map(([p]) => p.toLowerCase()));
for (const [from, to] of Object.entries(moved)) {
  const file = /\.html$/.test(from) ? from : from + '.html';
  if (!generated.has(file.toLowerCase())) page(file, () => redirectPage(to));
}

// Search index
{
  const idx = [];
  artists.filter(a => a.listed !== false).forEach(a => idx.push({ g: 'Artists', t: a.name, s: 'Artist', u: `artists/${a.slug}/` }));
  exhibitions.filter(linked).forEach(e => idx.push({ g: e.kind === 'fair' ? 'Fairs' : 'Exhibitions', t: showName(e), s: [placeLabel(e), yearOf(e)].filter(Boolean).join(', '), u: `exhibitions/${e.slug}/`, k: [e.venue, e.city, e.place, e.subtitle, dateRange(e.start, e.end)].filter(Boolean).join(' ') }));
  const seenWork = new Set();
  const work = (cap, url, where) => {
    const t = strip(cap); if (!t) return;
    const m = cap.match(/<em>(.*?)<\/em>/); const name = m ? strip(m[1]) : '';
    const by = t.split(',')[0];
    const key = (by + name).toLowerCase(); if (!name || seenWork.has(key)) return; seenWork.add(key);
    idx.push({ g: 'Works', t: `${name}`, s: `${by === name ? '' : by + ', '}${where}`, u: url, k: t });
  };
  exhibitions.forEach(e => e.images.forEach(im => work(im.caption, `exhibitions/${e.slug}/`, e.title)));
  artists.forEach(a => a.works.forEach(w => work(w.caption, `artists/${a.slug}/`, a.name)));
  if (SITE.pressPage) press.forEach(p => idx.push({ g: 'Press', t: p.title, s: [p.outlet, (p.date || '').slice(0, 4)].filter(Boolean).join(', '), u: p.url, k: p.author }));
  fs.mkdirSync(OUT, { recursive: true });
  pages.push(['search-index.json', JSON.stringify(idx)]);
}

// sitemap & robots
pages.push(['sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${['/', '/exhibitions/', '/art-fairs/', '/artists/', ...(SITE.pressPage ? ['/press/'] : []), '/shop/', '/about/', ...exhibitions.filter(linked).map(e => `/exhibitions/${e.slug}/`), ...artists.map(a => `/artists/${a.slug}/`)].map(p => `<url><loc>${abs(p)}</loc></url>`).join('\n')}\n</urlset>\n`]);
pages.push(['robots.txt', `User-agent: *\nAllow: /\nSitemap: ${abs('sitemap.xml')}\n`]);
pages.push(['.nojekyll', '']);
if (process.env.CNAME) pages.push(['CNAME', process.env.CNAME + '\n']);

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
if (fs.existsSync(path.join(ROOT, 'images'))) {
  fs.mkdirSync(path.join(OUT, 'images'), { recursive: true });
  for (const f of fs.readdirSync(path.join(ROOT, 'images'))) if (f.endsWith('.webp') || f.endsWith('.jpg')) fs.copyFileSync(path.join(ROOT, 'images', f), path.join(OUT, 'images', f));
}
console.log(`Built ${pages.length} files into dist/ (base ${BASE}, as of ${TODAY}${Object.keys(manifest).length ? `, ${Object.keys(manifest).length} web-sized images` : ', original images'}).`);
