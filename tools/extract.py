"""One-off: read the old hand-written site (theamoussa/amanita) and write the new site's data files.
After this runs once, data/ is the source of truth; this script is kept only for reference."""
import json, re, sys, os, unicodedata, html
from datetime import date
from bs4 import BeautifulSoup, NavigableString, Tag
from dateutil import parser as dp

OLD = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(f'{OUT}/exhibitions', exist_ok=True)
os.makedirs(f'{OUT}/artists', exist_ok=True)


def soup(path):
    return BeautifulSoup(open(path, encoding='utf-8', errors='replace').read(), 'html.parser')


def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    s = re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower()
    return re.sub(r'-+', '-', s)


def norm_space(s):
    return re.sub(r'\s+', ' ', s).strip()


# ---------- old file name -> new slug maps (filled as we go) ----------
old_ex_to_slug = {}      # 'tostandbare' -> 'vittorio-marella-to-stand-bare'
old_artist_to_slug = {}  # 'leonardo-meoni' -> 'leonardo-meoni'


def old_key(href):
    """'../Exhibitions/IusedtobeaMountain.html' -> ('ex','iusedtobeamountain')"""
    m = re.search(r'(Exhibitions|Artists)/([^/?#]+?)(?:\.html)?(?:[?#].*)?$', href or '', re.I)
    if not m:
        return None
    return ('ex' if m.group(1).lower() == 'exhibitions' else 'ar', m.group(2).lower())


# ---------- rich text cleaning ----------
ALLOWED = {'em': 'em', 'i': 'em', 'b': 'strong', 'strong': 'strong', 'a': 'a', 'br': 'br'}


def clean_inline(node, pdfs, links):
    """Return sanitised inline HTML for node's children. Collect PDF links separately."""
    out = []
    for c in node.children:
        if isinstance(c, NavigableString):
            if c.__class__.__name__ in ('Comment', 'Doctype', 'Declaration'):
                continue
            out.append(html.escape(str(c), quote=False))
            continue
        if not isinstance(c, Tag):
            continue
        n = c.name.lower()
        if n in ('script', 'style', 'svg', 'nav', 'iframe', 'img', 'button', 'form', 'input'):
            continue
        if n == 'div' and 'seperator' in (c.get('class') or []):
            out.append('<br><br>')
            continue
        if n == 'br':
            out.append('<br>')
            continue
        if n in ('p', 'div', 'h2', 'h3', 'h4'):
            inner = clean_inline(c, pdfs, links)
            out.append('<br><br>' + inner + '<br><br>')
            continue
        if n == 'a':
            href = (c.get('href') or '').strip()
            text = clean_inline(c, pdfs, links)
            if href.lower().endswith('.pdf'):
                pdfs.append({'label': norm_space(BeautifulSoup(text, 'html.parser').get_text()), 'url': href})
                continue
            k = old_key(href)
            if k:
                links.append(k)
                out.append(f'<a data-old="{k[0]}:{k[1]}">{text}</a>')
            elif href.startswith('mailto:') or href.startswith('http'):
                out.append(f'<a href="{html.escape(href)}">{text}</a>')
            else:
                out.append(text)
            continue
        tag = ALLOWED.get(n)
        inner = clean_inline(c, pdfs, links)
        out.append(f'<{tag}>{inner}</{tag}>' if tag else inner)
    return ''.join(out)


def to_paragraphs(raw):
    raw = re.sub(r'\s+', ' ', raw)
    raw = re.sub(r'(\s*<br>\s*){2,}', '\n\n', raw)
    paras = []
    for p in raw.split('\n\n'):
        p = re.sub(r'^(\s*<br>\s*)+|(\s*<br>\s*)+$', '', p).strip()
        p = re.sub(r'<(em|strong)>\s*</\1>', '', p)
        if BeautifulSoup(p, 'html.parser').get_text().strip():
            paras.append(p)
    return paras


def caption_html(node):
    if not node:
        return ''
    pdfs, links = [], []
    s = clean_inline(node, pdfs, links)
    s = re.sub(r'(\s*<br>\s*)+', ' ', s)
    return norm_space(s)


# ---------- dates ----------
def parse_range(s, year_hint=None):
    s = s.replace('–', '-').replace('—', '-')
    s = re.sub(r'(?i)opening\s*', '', s)
    s = re.sub(r',?\s*\d{1,2}(:\d\d)?\s*-\s*\d{1,2}(:\d\d)?\s*(AM|PM)', '', s, flags=re.I)
    parts = [p.strip(' ,') for p in re.split(r'\s+-\s+', s) if p.strip(' ,')]
    try:
        start = dp.parse(parts[0], fuzzy=True, default=dp.parse(f'{year_hint or 2000}-01-01'))
        end = dp.parse(parts[1], fuzzy=True, default=start) if len(parts) > 1 else None
    except Exception:
        return None, None
    if end and end < start:
        end = end.replace(year=end.year + 1)
    return start.date().isoformat(), (end.date().isoformat() if end else None)


FAIR_WORDS = ['NADA', 'Contemporary Istanbul', 'Liste', 'TEFAF', 'Artissima', 'Dallas Art Fair', 'Felix', 'Frieze',
              'Art Basel', 'Independent', 'Palai']


def city_of(venue, address=''):
    v = f'{venue} {address}'
    if re.search(r'Bowery|Freeman', v): return 'New York'
    if re.search(r'Banchi Vecchi|Roma\b|Rome', v): return 'Rome'
    if re.search(r'Fondazione Iris|Bassano', v): return 'Bassano in Teverina'
    return ''


# ---------- exhibitions: list page gives order, venue and dates ----------
ix = soup(f'{OLD}/exhibitions.html')
entries = []
for item in ix.select('.exhibition-item'):
    a = item.select_one('a.exhibition-title')
    if not a:
        continue
    p = item.select_one('p')
    lines = [norm_space(t) for t in (p.get_text('\n').split('\n') if p else []) if norm_space(t)]
    sec = item.find_parent(class_='year-section')
    year = sec.get('id', '').replace('year-', '') if sec else 'current'
    href = a['href']
    entries.append(dict(list_title=a.get_text(' ', strip=True), href=href, venue=lines[0] if lines else '',
                        dates=lines[1] if len(lines) > 1 else '', year=year))

KNOWN_DATES = {  # current shows: the list only says "Opening …"
    'tostandbare': ('2026-09-12', '2026-12-12'),
    'foolsprivilege': ('2026-09-17', '2026-11-13'),
}

exhibitions = []
for e in entries:
    fn = re.sub(r'\.html$', '', e['href'].split('/')[-1])
    path = f'{OLD}/Exhibitions/{fn}.html'
    if not os.path.exists(path):
        print('missing page', path, file=sys.stderr)
        continue
    s = soup(path)
    c = s.select_one('.content')
    h1 = norm_space(c.select_one('h1').get_text(' ')) if c and c.select_one('h1') else e['list_title']
    h3 = norm_space(c.select_one('h3').get_text(' ')) if c and c.select_one('h3') else ''
    # venue lines from the page (full address), minus the inquiry line
    address = []
    if c:
        for pp in c.find_all('p'):
            if pp.find('a', href=lambda h: h and h.startswith('mailto:info')):
                continue
            for t in pp.get_text('\n').split('\n'):
                t = norm_space(t)
                if t:
                    address.append(t)
    images = []
    for sl in s.select('.slides .slide'):
        im = sl.find('img')
        if not im or not im.get('src'):
            continue
        images.append({'src': im['src'].strip(), 'caption': caption_html(sl.select_one('.caption'))})
    pdfs, links, text = [], [], []
    heading = None
    for tc in s.select('.text-container'):
        prev = tc.find_previous_sibling()
        raw = clean_inline(tc, pdfs, links)
        text += to_paragraphs(raw)
    # some pages carry the press-release link outside the text container
    for a in s.find_all('a', href=True):
        if a['href'].lower().endswith('.pdf') and not any(p['url'] == a['href'] for p in pdfs):
            pdfs.append({'label': norm_space(a.get_text(' ')) or 'Download', 'url': a['href']})
    text = [t for t in text if not re.fullmatch(r'(?i)\s*(<em>)?\s*download.*', BeautifulSoup(t, 'html.parser').get_text().strip() + '')]
    yr_hint = None if e['year'] == 'current' else int(e['year'])
    start, end = KNOWN_DATES.get(fn.lower(), (None, None))
    if not start:
        start, end = parse_range(e['dates'], yr_hint)
    is_fair = any(w.lower() in (e['list_title'] + ' ' + h1 + ' ' + e['venue']).lower() for w in FAIR_WORDS) or \
        e['venue'] in ('Los Angeles', 'Basel', 'Istanbul', 'NADA Miami', 'TEFAF Maastricht')
    artist_links = sorted({k[1] for k in links if k[0] == 'ar'})
    exhibitions.append(dict(
        old=fn, h1=h1, h3=h3, list_title=e['list_title'], venue=e['venue'], address=address,
        start=start, end=end, kind='fair' if is_fair else 'exhibition', city=city_of(e['venue'], ' '.join(address)),
        images=images, text=text, pdfs=pdfs, artist_links=artist_links, links=links,
    ))

json.dump(exhibitions, open(f'{OUT}/../tools/raw/_raw_exhibitions.json', 'w'), ensure_ascii=False, indent=1)

# ---------- artists ----------
artists = []
ai = soup(f'{OLD}/Artists.html')
for a in ai.select('a[href*="Artists/"]'):
    fn = re.sub(r'\.html$', '', a['href'].split('/')[-1])
    path = f'{OLD}/Artists/{fn}.html'
    if not os.path.exists(path):
        continue
    s = soup(path)
    name = norm_space(s.select_one('h1').get_text(' '))
    works = []
    for sl in s.select('.slides .slide'):
        im = sl.find('img')
        if im and im.get('src'):
            works.append({'src': im['src'].strip(), 'caption': caption_html(sl.select_one('.caption'))})
    pdfs, links = [], []
    bio = []
    tc = s.select_one('.text-container')
    if tc:
        # bio = the paragraphs before the first h2
        parts = []
        for ch in tc.children:
            if isinstance(ch, Tag) and ch.name == 'h2':
                break
            parts.append(ch)
        frag = BeautifulSoup('', 'html.parser').new_tag('div')
        for ch in parts:
            frag.append(ch.__copy__() if isinstance(ch, Tag) else NavigableString(str(ch)))
        bio = to_paragraphs(clean_inline(frag, pdfs, []))
        clean_inline(tc, pdfs, links)
    bio = [b for b in bio if 'cv' not in BeautifulSoup(b, 'html.parser').get_text().lower() or len(b) > 120]
    cv = next((p['url'] for p in pdfs if 'cv' in p['url'].lower() or 'curriculum' in p['url'].lower() or 'cv' in p['label'].lower()), None)
    ex_links = [k[1] for k in links if k[0] == 'ex']
    slug = slugify(name)
    old_artist_to_slug[fn.lower()] = slug
    artists.append(dict(old=fn, slug=slug, name=name, works=works, bio=bio, cv=cv, ex_links=ex_links))

json.dump(artists, open(f'{OUT}/../tools/raw/_raw_artists.json', 'w'), ensure_ascii=False, indent=1)

# ---------- press ----------
s = soup(f'{OLD}/Press.html')
press = []
for t in s.select('h3.press-card-title-secondary'):
    a = t.find_parent('a')
    url = a['href'] if a else None
    block = t.find_parent(class_=re.compile('col'))
    img = block.find('img') if block else None
    if not img:
        row = t.find_parent(class_='row')
        img = row.find('img') if row else None
    d = block.select_one('.press-card-date') if block else None
    meta = norm_space(d.find(string=True)) if d else ''
    quote = d.find('strong') if d else None
    press.append(dict(title=norm_space(t.get_text(' ')), url=url, meta=meta,
                      excerpt=norm_space(quote.get_text(' ')) if quote else '',
                      image=img['src'] if img and img.get('src') else None))
json.dump(press, open(f'{OUT}/../tools/raw/_raw_press.json', 'w'), ensure_ascii=False, indent=1)

# ---------- shop ----------
s = soup(f'{OLD}/shop.html')
shop = []
for p in s.select('article.product'):
    link = p.select_one('a.imgWrap')
    detail = {}
    if link and os.path.exists(f"{OLD}/{link['href']}"):
        d = soup(f"{OLD}/{link['href']}")
        for sc in d(['script', 'style', 'nav']):
            sc.decompose()
        imgs = [i['src'] for i in d.find_all('img') if 'logo' not in i.get('src', '').lower()]
        txt = d.body.get_text('\n', strip=True)
        specs = dict(re.findall(r'^(Publisher|Publication date|Designer|Format|Dimensions|Pages|Language|ISBN):\s*(.+)$', txt, re.M))
        detail = {'images': list(dict.fromkeys(imgs)), 'specs': specs}
    shop.append(dict(
        title_html=caption_html(p.select_one('.title')),
        blurb_html=caption_html(p.select_one('.blurb')),
        price=norm_space(p.select_one('.price').get_text()) if p.select_one('.price') else '',
        buy=p.select_one('a.btn-buy')['href'] if p.select_one('a.btn-buy') else None,
        image=p.find('img')['src'], **detail))
json.dump(shop, open(f'{OUT}/../tools/raw/_raw_shop.json', 'w'), ensure_ascii=False, indent=1)
print(len(exhibitions), 'exhibitions;', len(artists), 'artists;', len(press), 'press;', len(shop), 'shop items')
