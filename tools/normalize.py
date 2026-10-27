"""One-off: turn the raw extraction into the site's data files (data/exhibitions/*.json, data/artists/*.json,
data/press.json, data/shop.json, data/redirects.json). Hand corrections live in OVERRIDES below."""
import json, re, sys, os, glob, unicodedata, html
from datetime import date
from bs4 import BeautifulSoup
from dateutil import parser as dp

D = sys.argv[1]
OLD = sys.argv[2]


def slugify(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode()
    return re.sub(r'-+', '-', re.sub(r'[^a-zA-Z0-9]+', '-', s).strip('-').lower())


def text_of(h):
    return BeautifulSoup(h, 'html.parser').get_text(' ', strip=True)


DATE_RE = re.compile(r'(\b(19|20)\d\d\b)')
MONTHS = r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)'


def is_date_line(s):
    return bool(DATE_RE.search(s) and re.search(MONTHS, s, re.I))


def parse_range(s):
    s = s.replace('–', '-').replace('—', '-')
    s = re.sub(r'(?i)opening\s*', '', s)
    s = re.sub(r',?\s*\d{1,2}(:\d\d)?\s*-\s*\d{1,2}(:\d\d)?\s*(AM|PM)', '', s, flags=re.I)
    parts = [p.strip(' ,') for p in re.split(r'\s+-\s+', s) if p.strip(' ,')]
    start = dp.parse(parts[0], fuzzy=True)
    end = dp.parse(parts[1], fuzzy=True, default=start) if len(parts) > 1 else None
    if end and end < start:
        end = end.replace(year=end.year + 1)
    if len(parts) > 1 and not DATE_RE.search(parts[0]) and end:   # "June 10 - July 31, 2024"
        start = start.replace(year=end.year)
        if start > end: start = start.replace(year=end.year - 1)
    return start.date().isoformat(), (end.date().isoformat() if end else None)


ARTIST_FIX = {'eva-beresinn': 'eva-beresin'}


def artist_key(k):
    k = re.sub(r'[^a-z0-9-]', '', k.lower())
    return ARTIST_FIX.get(k, k)


raw_ex = json.load(open(f'{D}/../tools/raw/_raw_exhibitions.json'))
raw_ar = json.load(open(f'{D}/../tools/raw/_raw_artists.json'))
roster = {a['slug']: a['name'] for a in raw_ar}
by_name = {v.lower(): k for k, v in roster.items()}

# ---- the unlisted Liste 2026 page ----
sys.argv_old = OLD
from importlib.machinery import SourceFileLoader

FAIRS = {'NADA25', 'ContemporaryIstanbul25', 'Liste2025', 'Liste2026', 'TEFAF2025', 'Artissima2024', 'Artissima2023', 'DAF2024'}

OVERRIDES = {
    'DAF2024': dict(title='Dallas Art Fair 2024', artists=['Andrew Piedilato'], venue='Dallas Art Fair'),
    'TEFAF2025': dict(title='TEFAF Maastricht 2025', artists=['Alessandro Twombly', 'Francesco Cima']),
    'Liste2025': dict(title='Liste Art Fair Basel 2025', artists=['Daniele Milvio', 'Leonardo Meoni']),
    'Liste2026': dict(title='Liste Art Fair Basel 2026'),
    'NADA25': dict(artists=['Ben Werther']),
    'Artissima2024': dict(artists=['Adrian Schachter', 'Francesco Cima', 'Leonardo Meoni', 'Marco Scarpi']),
    'Artissima2023': dict(artists=['Leonardo Meoni']),
    'Palai2023': dict(subtitle=None, venue='Palazzo Tamborino Cezzi', artists=[], related=['Daniele Milvio', 'Francesco Cima', 'Leonardo Meoni']),
    'IrisNava': dict(title='Robert Nava', artists=['Robert Nava'], venue='Fondazione Iris'),
    'AlessandroTwombly': dict(title='Alessandro Twombly', artists=['Alessandro Twombly']),
    'AlessandroTwomblyFA': dict(title='Alessandro Twombly', artists=['Alessandro Twombly']),
    'Blueprint': dict(subtitle='Yale Photography MFA 2023', artists=[]),
    'LBT': dict(artists=[]),
    'WakingLife': dict(artists=[], related=['Adrian Schachter', 'Eva Beresin', 'Francesco Cima']),
    'Will-O-Wisp': dict(artists=[], related=['Adrian Schachter', 'Eva Beresin', 'Marco Scarpi']),
    'TheLoneliestSport': dict(artists=[], related=['Adrian Schachter', 'Eva Beresin', 'Marco Scarpi']),
    'PostFataResurgo': dict(artists=[], related=['Adrian Schachter', 'Eva Beresin', 'Marco Scarpi']),
    'Sprezzatura': dict(artists=[], related=['Adrian Schachter', 'Ben Werther', 'Marco Scarpi']),
}

CITY_RULES = [
    (r'(?i)Bowery|Freeman|Crosby Street|New York', 'New York'),
    (r'Banchi Vecchi', 'Rome'),
    (r'Fondazione Iris|Bassano', 'Fondazione Iris'),
    (r'Sassetti|Firenze|Florence', 'Florence'),
]


def city_of(lines):
    s = ' '.join(lines)
    for pat, c in CITY_RULES:
        if re.search(pat, s): return c
    return ''


def place_of(lines):
    """A short place for lists: e.g. 'Basel', 'Turin', 'Los Angeles'."""
    s = ' '.join(lines)
    for pat, name in [(r'Basel', 'Basel'), (r'Turin', 'Turin'), (r'Maastricht', 'Maastricht'), (r'Miami', 'Miami'),
                      (r'Istanbul', 'Istanbul'), (r'Dallas', 'Dallas'), (r'Los Angeles|Venice, CA|West Hollywood|Hollywood', 'Los Angeles'),
                      (r'Lecce', 'Lecce'), (r'St\. Moritz', 'St. Moritz'), (r'S-chanf', 'S-chanf'), (r'Milano', 'Milan'),
                      (r'Ortisei', 'Ortisei'), (r'Firenze|Florence', 'Florence'), (r'Bassano', 'Bassano in Teverina'),
                      (r'New York', 'New York'), (r'Roma|Rome|Banchi', 'Rome')]:
        if re.search(pat, s): return name
    return ''


# include Liste 2026 from its page
if not any(e['old'] == 'Liste2026' for e in raw_ex):
    p = BeautifulSoup(open(f'{OLD}/Exhibitions/Liste2026.html', encoding='utf-8').read(), 'html.parser')
    c = p.select_one('.content')
    addr = [t.strip() for pp in c.find_all('p') if not pp.find('a', href=lambda h: h and 'mailto' in h)
            for t in pp.get_text('\n').split('\n') if t.strip()]
    imgs = [{'src': s.find('img')['src'], 'caption': ''} for s in p.select('.slides .slide') if s.find('img')]
    tc = p.select_one('.text-container')
    raw_ex.append(dict(old='Liste2026', h1='Liste Art Fair Basel', h3='', list_title='Liste Art Fair', venue='Basel',
                       address=addr, images=imgs, text=[tc.get_text(' ', strip=True)] if tc and tc.get_text(strip=True) else [],
                       pdfs=[], artist_links=[], links=[]))

used_slugs = set()
out = []
for e in raw_ex:
    o = OVERRIDES.get(e['old'], {})
    addr = [l for l in e['address'] if not re.search(r'(?i)^inquire', l)]
    date_lines = [l for l in addr if is_date_line(l)]
    venue_lines = [l for l in addr if l not in date_lines and not re.search(r'(?i)open by appointment|^open ', l)]
    note_lines = [l for l in addr if re.search(r'(?i)open by appointment|^open ', l)]
    start, end = parse_range(date_lines[0]) if date_lines else (None, None)
    if e['old'].lower() == 'tostandbare': start, end = '2026-09-12', '2026-12-12'
    if e['old'].lower() == 'foolsprivilege': start, end = '2026-09-17', '2026-11-13'
    title = o.get('title', e['h1'])
    h3 = e['h3']
    subtitle = o.get('subtitle', h3 if re.match(r'(?i)curated|yale|palazzo', h3 or '') else None)
    if 'artists' in o:
        artists = o['artists']
    elif h3 and not subtitle:
        artists = [a.strip() for a in re.split(r'\s*(?:,|&| and )\s*', h3) if a.strip()]
    else:
        artists = []
    # gallery artists linked from the text join the list for cross-linking
    linked = [roster[artist_key(k)] for k in e.get('artist_links', []) if artist_key(k) in roster]
    roster_artists = [a for a in dict.fromkeys(artists + o.get('related', []) + linked)]
    kind = 'fair' if e['old'] in FAIRS else 'exhibition'
    venue = o.get('venue', venue_lines[0] if venue_lines else e['venue'])
    slug_base = slugify(' '.join(artists[:2] + [title]) if artists and kind == 'exhibition' and title not in artists else title)
    slug = slug_base
    i = 2
    while slug in used_slugs:
        slug = f'{slug_base}-{i}'; i += 1
    used_slugs.add(slug)
    press_release = next((p['url'] for p in e['pdfs'] if re.search(r'(?i)press|release|pr\b', p['url'] + p['label'])), None)
    other_pdfs = [p for p in e['pdfs'] if p['url'] != press_release]
    out.append(dict(
        slug=slug, old=e['old'], kind=kind, title=title, subtitle=subtitle, artists=artists,
        relatedArtists=[slugify(a) for a in roster_artists if slugify(a) in roster],
        venue=venue, address=venue_lines[1:] if len(venue_lines) > 1 else [], note=' '.join(note_lines) or None,
        city=city_of(venue_lines) if kind == 'exhibition' else '', place=place_of(venue_lines),
        start=start, end=end, images=e['images'], text=e['text'],
        pressRelease=press_release, files=other_pdfs,
    ))

# sort newest first
out.sort(key=lambda x: (x['start'] or '0000'), reverse=True)
old2slug = {e['old'].lower(): e['slug'] for e in out}


def relink(h):
    """Old internal links become links to the new pages; links to pages that no longer exist become plain text."""
    def rep(m):
        kind, key, inner = m.group(1), m.group(2), m.group(3)
        if kind == 'ex' and key in old2slug: return f'<a href="/exhibitions/{old2slug[key]}/">{inner}</a>'
        if kind == 'ar' and artist_key(key) in roster: return f'<a href="/artists/{artist_key(key)}/">{inner}</a>'
        return inner
    return re.sub(r'<a data-old="(ex|ar):([^"]+)">(.*?)</a>', rep, h, flags=re.S)


for e in out:
    e['text'] = [relink(t) for t in e['text']]
for f in glob.glob(f'{D}/exhibitions/*.json'): os.remove(f)
for e in out:
    json.dump(e, open(f"{D}/exhibitions/{e['slug']}.json", 'w'), ensure_ascii=False, indent=1)

# ---- artists ----
for f in glob.glob(f'{D}/artists/*.json'): os.remove(f)
for a in raw_ar:
    exs = [e['slug'] for e in out if a['slug'] in e['relatedArtists']]
    exs += [old2slug[k.lower()] for k in a['ex_links'] if k.lower() in old2slug and old2slug[k.lower()] not in exs]
    order = {e['slug']: e['start'] or '' for e in out}
    exs = sorted(dict.fromkeys(exs), key=lambda s: order.get(s, ''), reverse=True)
    json.dump(dict(slug=a['slug'], old=a['old'], name=a['name'], bio=[relink(b) for b in a['bio']], cv=a['cv'],
                   works=a['works'], exhibitions=exs), open(f"{D}/artists/{a['slug']}.json", 'w'), ensure_ascii=False, indent=1)

# ---- press ----
press = []
for p in json.load(open(f'{D}/../tools/raw/_raw_press.json')):
    m = re.match(r'^(.*?),\s*([^,]+),\s*([A-Za-z]+\.? ?\d{0,2},? ?\d{4})$', p['meta'])
    author, outlet, when = (m.group(1), m.group(2), m.group(3)) if m else ('', p['meta'], '')
    try:
        d = dp.parse(when, default=dp.parse('2000-01-01')).date().isoformat() if when else None
    except Exception:
        d = None
    title = p['title']
    if title.isupper(): title = title.title()
    blob = (title + ' ' + p['excerpt']).lower()
    press.append(dict(title=title, author=author.title() if author.isupper() else author,
                      outlet=outlet.title() if outlet.isupper() else outlet, date=d, url=p['url'], image=p['image'],
                      artists=[s for s, n in roster.items() if n.lower() in blob or n.split()[-1].lower() in blob]))
press.sort(key=lambda x: x['date'] or '', reverse=True)
json.dump(press, open(f'{D}/press.json', 'w'), ensure_ascii=False, indent=1)

# ---- shop ----
shop = []
for s in json.load(open(f'{D}/../tools/raw/_raw_shop.json')):
    slug = slugify(text_of(s['title_html']))
    shop.append(dict(slug=slug, title=s['title_html'], blurb=s['blurb_html'], price=s['price'], buy=s['buy'],
                     image=s['image'], images=s.get('images', [s['image']]), specs=s.get('specs', {})))
json.dump(shop, open(f'{D}/shop.json', 'w'), ensure_ascii=False, indent=1)

# ---- old URLs -> new ----
red = {}
for e in out:
    for v in (e['old'], e['old'].lower()):
        red[f'Exhibitions/{v}.html'] = f"/exhibitions/{e['slug']}/"
        red[f'Exhibitions/{v}'] = f"/exhibitions/{e['slug']}/"
for a in raw_ar:
    red[f"Artists/{a['old']}.html"] = f"/artists/{a['slug']}/"
    red[f"Artists/{a['old']}"] = f"/artists/{a['slug']}/"
for old, new in [('exhibitions.html', '/exhibitions/'), ('Artists.html', '/artists/'), ('Press.html', '/press/'),
                 ('About.html', '/about/'), ('shop.html', '/shop/'), ('Artists', '/artists/'), ('Press', '/press/'),
                 ('About', '/about/'), ('shop', '/shop/'), ('exhibitions2.html', '/exhibitions/'), ('xindex.html', '/')]:
    red[old] = new
for s in shop:
    pass
json.dump(red, open(f'{D}/redirects.json', 'w'), indent=1)
print(len(out), 'exhibitions', len(raw_ar), 'artists', len(press), 'press', len(shop), 'shop', len(red), 'redirects')
