// The preview page (/preview/): shows the site with Amanita OS's unpublished changes, rendered by the
// very templates the site is built with (render.mjs) — so it looks exactly as it will once published.
//
// Amanita OS opens this page and, when told it is ready, sends what its Website section holds now
// (drafts included). Nothing is saved or published: the drafts stay in this tab. Only Amanita OS's
// own address is listened to. Links inside the preview move around the previewed site.

import { render } from './render.mjs';
import { fromOsExport } from './fromOs.mjs';

const OS_ORIGINS = ['https://team.spazioamanita.com', 'http://localhost:5173', 'http://localhost:4173'];
const SITE_BASE = new URL('../', import.meta.url).pathname;     // where the site lives ("/")
const frame = document.getElementById('page');
const wait = document.getElementById('wait');
const where = document.getElementById('where');
const refresh = document.getElementById('refresh');

let pages = null;
let current = decodeURIComponent(location.hash.slice(1));
let os = null;   // { source, origin } of the Amanita OS tab that opened this one

const todayNY = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const fileFor = (p) => {
  let q = String(p || '').split('#')[0].replace(/^\/+/, '');
  if (SITE_BASE !== '/' && ('/' + q).startsWith(SITE_BASE)) q = ('/' + q).slice(SITE_BASE.length);
  return q === '' || q.endsWith('/') ? q + 'index.html' : (/\.\w+$/.test(q) ? q : q + '/index.html');
};

let shared = null;
const sharedData = async () => (shared ??= fetch(new URL('preview-data.json', import.meta.url), { cache: 'no-cache' }).then(r => r.json()));

function show(path) {
  if (!pages) return;
  current = path || '';
  const html = pages.get(fileFor(current)) ?? pages.get('404.html');
  frame.srcdoc = html;
  frame.hidden = false; wait.hidden = true;
  history.replaceState(null, '', '#' + current);
  where.textContent = `Not published · ${current ? '/' + current.replace(/^\/+/, '') : 'Home'}`;
}

// Inside the preview, a link to another page of the site opens that page of the preview.
frame.addEventListener('load', () => {
  const doc = frame.contentDocument;
  if (!doc) return;
  doc.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    if (!a || a.target === '_blank' || e.metaKey || e.ctrlKey) return;
    const url = new URL(a.getAttribute('href'), location.origin);
    if (url.origin !== location.origin || !pages?.has(fileFor(url.pathname))) return;
    e.preventDefault();
    show(url.pathname.slice(SITE_BASE.length) + url.hash);
    frame.contentWindow?.scrollTo(0, 0);
  });
});

window.addEventListener('message', async (e) => {
  if (!OS_ORIGINS.includes(e.origin) || e.data?.type !== 'amanita-preview' || !e.data.exp) return;
  os = { source: e.source, origin: e.origin };
  try {
    const { manifest, logo } = await sharedData();
    const data = fromOsExport(e.data.exp);
    if (!data.site) throw new Error('The site settings did not come through.');
    const built = render({ ...data, shopApi: { preview: true }, manifest, logo, redirects: {}, today: todayNY(), base: SITE_BASE, siteUrl: location.origin });
    pages = new Map(built.filter(([p]) => p.endsWith('.html')));
    refresh.hidden = false;
    show(e.data.path ?? current);
  } catch (err) {
    wait.hidden = false; frame.hidden = true;
    wait.textContent = `The preview could not be made: ${err.message}`;
  }
});

// Ask again: Amanita OS sends the latest. Keeps the page you are on.
refresh.addEventListener('click', () => os?.source?.postMessage({ type: 'amanita-preview-ready', path: current }, os.origin));

// Tell the tab that opened this one that it can send.
if (window.opener) window.opener.postMessage({ type: 'amanita-preview-ready', path: current }, '*');
