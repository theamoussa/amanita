/* Amanita — the site's one script: search, the archive list, the travelling letters, and Marcel. */
(() => {
  const BASE = document.body.dataset.base || '/';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k){ try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v){ try { sessionStorage.setItem(k, v); } catch {} },
  };

  /* ---------- search ---------- */
  let index = null;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  async function loadIndex(){
    if (index) return index;
    const r = await fetch(BASE + 'search-index.json');
    index = (await r.json()).map(o => ({ ...o, hay: norm([o.t, o.s, o.k].join(' ')) }));
    return index;
  }
  const href = u => /^https?:/.test(u) ? u : BASE + u + (BASE.startsWith('.') && u.endsWith('/') ? 'index.html' : '');
  function mark(text, terms){
    let h = esc(text);
    terms.forEach(t => { if (t) h = h.replace(new RegExp('(' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
    return h;
  }
  async function render(input, out){
    const raw = input.value.trim(), terms = norm(raw).split(/\s+/).filter(Boolean);
    if (!terms.length){ out.innerHTML = '<p class="hint">Try an artist, a show, a city, a year, or the title of a work.</p>'; return; }
    const idx = await loadIndex();
    if (input.value.trim() !== raw) return;
    const hits = idx.filter(o => terms.every(t => o.hay.includes(t)));
    if (!hits.length){ out.innerHTML = `<p class="hint">Nothing matches “${esc(raw)}”. Try an artist’s surname, a city or a year.</p>`; return; }
    const shown = raw.split(/\s+/);
    out.innerHTML = ['Artists', 'Exhibitions', 'Art Fairs', 'Works', 'Press'].map(g => {
      const items = hits.filter(h => h.g === g).slice(0, g === 'Works' ? 8 : 12);
      if (!items.length) return '';
      return `<section><h2>${g}</h2><ul>${items.map(h => `<li><a href="${esc(href(h.u))}"${/^https?:/.test(h.u) ? ' target="_blank" rel="noopener"' : ''}><span>${mark(h.t, shown)}</span><span>${esc(h.s || '')}</span></a></li>`).join('')}</ul></section>`;
    }).join('');
  }
  const box = document.getElementById('search');
  const q = document.getElementById('q'), results = document.getElementById('results');
  let lastFocus = null;
  function openSearch(){ lastFocus = document.activeElement; box.hidden = false; document.documentElement.style.overflow = 'hidden'; q.focus(); render(q, results); }
  function closeSearch(){ box.hidden = true; document.documentElement.style.overflow = ''; if (lastFocus) lastFocus.focus(); }
  document.querySelectorAll('[data-search]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); openSearch(); }));
  document.getElementById('closeSearch').addEventListener('click', closeSearch);
  q.addEventListener('input', () => render(q, results));
  box.addEventListener('click', e => { if (e.target === box) closeSearch(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !box.hidden) closeSearch();
    if (e.key === '/' && box.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)){ e.preventDefault(); openSearch(); }
  });
  const q2 = document.getElementById('q2');
  if (q2){ const r2 = document.getElementById('results2'); const p = new URLSearchParams(location.search).get('q'); if (p) q2.value = p; q2.addEventListener('input', () => render(q2, r2)); render(q2, r2); }

  /* ---------- archive lists: hover picture, filters ---------- */
  document.querySelectorAll('.arc').forEach(arc => {
    const list = arc.querySelector('[data-arc]'), img = arc.querySelector('[data-arc-img]'), cap = arc.querySelector('[data-arc-cap]');
    if (!list || !img) return;
    const links = [...list.querySelectorAll('a')];
    function show(a){
      links.forEach(l => l.classList.toggle('on', l === a));
      if (a.dataset.img){ if (a.dataset.srcset){ img.sizes = img.closest('.frame').offsetWidth + 'px'; img.srcset = a.dataset.srcset; } else img.removeAttribute('srcset'); img.src = a.dataset.img; } else { img.removeAttribute('srcset'); img.removeAttribute('src'); }
      cap.textContent = a.querySelector('.t').textContent.trim();
    }
    links.forEach(a => { a.addEventListener('mouseenter', () => show(a)); a.addEventListener('focus', () => show(a)); });
    const first = links.find(a => a.dataset.img); if (first) show(first);
    const filters = document.querySelector('[data-filters]');
    if (!filters) return;
    filters.hidden = false;
    let type = 'all', place = '';
    const apply = () => {
      const rows = [...list.children];
      rows.forEach(li => { if (li.dataset.group === undefined) li.hidden = (type !== 'all' && li.dataset.type !== type) || (place && li.dataset.place !== place); });
      rows.forEach((li, i) => { if (li.dataset.group !== undefined){ let j = i + 1, any = false; while (j < rows.length && rows[j].dataset.group === undefined){ if (!rows[j].hidden) any = true; j++; } li.hidden = !any; } });
      Fly.refresh();
    };
    filters.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { type = b.dataset.type; filters.querySelectorAll('[data-type]').forEach(x => x.setAttribute('aria-pressed', x === b)); apply(); }));
    filters.querySelectorAll('[data-place]').forEach(b => b.addEventListener('click', () => { place = b.dataset.place; filters.querySelectorAll('[data-place]').forEach(x => x.setAttribute('aria-pressed', x === b)); apply(); }));
  });

  /* ---------- home: rows that scroll sideways ----------
     Trackpads and phones scroll them natively; the arrows (shown only when there is more to see) move one card,
     and a mouse can drag them. */
  document.querySelectorAll('.rail-wrap').forEach(wrap => {
    const rail = wrap.querySelector('[data-rail]'), nav = wrap.querySelector('.railnav');
    if (!rail || !nav) return;
    const [prev, next] = nav.querySelectorAll('button');
    const step = () => { const c = rail.querySelector('.card'); return c ? c.offsetWidth + parseFloat(getComputedStyle(rail).columnGap || 28) : rail.clientWidth * .8; };
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      nav.hidden = max < 4;
      prev.disabled = rail.scrollLeft < 4;
      next.disabled = rail.scrollLeft > max - 4;
    };
    nav.addEventListener('click', e => { const b = e.target.closest('button'); if (b) rail.scrollBy({ left: step() * +b.dataset.dir, behavior: 'smooth' }); });
    rail.addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update);
    update();
    // drag with a mouse; a drag doesn't count as a click on the show
    let down = null, moved = false;
    rail.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' || e.button) return; down = { x: e.clientX, left: rail.scrollLeft }; moved = false; });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!moved && Math.abs(dx) > 6){ moved = true; rail.classList.add('drag'); }
      if (moved) rail.scrollLeft = down.left - dx;
    });
    addEventListener('pointerup', () => { if (!down) return; down = null; rail.classList.remove('drag'); });
    rail.addEventListener('click', e => { if (moved){ e.preventDefault(); moved = false; } }, true);
    rail.addEventListener('dragstart', e => e.preventDefault());
  });

  /* ---------- slideshows on exhibition and artist pages ----------
     One picture at a time. Click the right part of the picture (or →, or swipe left) for the next one,
     the left part for the previous one. "Index" shows every picture at once. */
  document.querySelectorAll('[data-slideshow]').forEach(show => {
    const stage = show.querySelector('.ss-stage');
    const slides = [...stage.querySelectorAll('.ss-slide')];
    if (slides.length < 2 && !slides[0]?.querySelector('figcaption')) return;
    show.classList.add('on');
    const n = slides.length;
    const bar = document.createElement('div'); bar.className = 'ss-bar';
    bar.innerHTML = `<p class="ss-cap" aria-live="polite"></p><div class="ss-nav">${n > 1 ? `<span class="ss-count"></span><button type="button" data-go="-1">Previous</button><button type="button" data-go="1">Next</button><button type="button" data-index aria-pressed="false">Index</button>` : ''}</div>`;
    const index = document.createElement('div'); index.className = 'ss-index'; index.hidden = true;
    show.append(bar, index);
    const cap = bar.querySelector('.ss-cap'), count = bar.querySelector('.ss-count'), idxBtn = bar.querySelector('[data-index]');
    let cur = 0;
    const eager = i => { const img = slides[(i + n) % n].querySelector('img'); if (img && img.loading === 'lazy') img.loading = 'eager'; };
    function go(i){
      cur = (i + n) % n;
      slides.forEach((s, k) => { s.classList.toggle('on', k === cur); s.setAttribute('aria-hidden', k !== cur); });
      const fc = slides[cur].querySelector('figcaption');
      cap.innerHTML = fc ? fc.innerHTML : '';
      if (count) count.textContent = `${cur + 1} / ${n}`;
      eager(cur); eager(cur + 1); eager(cur - 1);
      index.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', k === cur));
    }
    function setIndex(on){
      show.classList.toggle('indexing', on); index.hidden = !on; if (idxBtn) idxBtn.setAttribute('aria-pressed', on);
      if (on && !index.childElementCount){
        index.innerHTML = slides.map((s, k) => {
          const img = s.querySelector('img'), ph = s.querySelector('.ph');
          const label = (s.querySelector('figcaption')?.textContent || `Image ${k + 1}`).trim();
          return `<button type="button" aria-label="${esc(label)}">${img ? `<img src="${esc(img.currentSrc || img.src)}" alt="" loading="lazy">` : '<span class="ph"></span>'}</button>`;
        }).join('');
        index.querySelectorAll('button').forEach((b, k) => b.addEventListener('click', () => { go(k); setIndex(false); show.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }); }));
        go(cur);
      }
    }
    bar.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => go(cur + +b.dataset.go)));
    if (idxBtn) idxBtn.addEventListener('click', () => setIndex(!show.classList.contains('indexing')));
    // click zones: left third goes back, the rest goes forward
    const zone = e => { const r = stage.getBoundingClientRect(); return (e.clientX - r.left) < r.width / 3 ? -1 : 1; };
    stage.addEventListener('mousemove', e => stage.classList.toggle('back', zone(e) < 0));
    stage.addEventListener('click', e => { if (n > 1) go(cur + zone(e)); });
    // swipe
    let sx = null, sy = null;
    stage.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
    stage.addEventListener('touchend', e => {
      if (sx === null) return; const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy; sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) go(cur + (dx < 0 ? 1 : -1));
    });
    // arrow keys while the slideshow is on screen
    document.addEventListener('keydown', e => {
      if (!box.hidden || /input|textarea|select/i.test(document.activeElement.tagName) || show.classList.contains('indexing')) return;
      const r = show.getBoundingClientRect(); if (r.bottom < 80 || r.top > innerHeight - 80) return;
      if (e.key === 'ArrowRight'){ go(cur + 1); e.preventDefault(); }
      if (e.key === 'ArrowLeft'){ go(cur - 1); e.preventDefault(); }
    });
    go(0);
  });

  /* ---------- the travelling letters: on inner pages the logo's letters drop into a column on the right and mark how far down you are ---------- */
  const Fly = (() => {
    const svg = document.querySelector('.wm .logo');
    const on = document.body.hasAttribute('data-letters') && svg;
    if (!on) return { refresh(){} };
    const VB_H = svg.viewBox.baseVal.height, VB_W = svg.viewBox.baseVal.width;
    const paths = [...svg.querySelectorAll('path')];
    const letters = paths.map(p => {
      const x = +(p.getAttribute('transform').match(/translate\(([-\d.]+)/) || [0, 0])[1];
      return { x, w: p.getBBox().width, d: p.getAttribute('d') };
    });
    const els = letters.map(l => {
      const d = document.createElement('div'); d.className = 'fly'; d.setAttribute('aria-hidden', 'true');
      d.innerHTML = `<svg viewBox="0 0 ${l.w} ${VB_H}"><path d="${l.d}"/></svg>`;
      document.body.appendChild(d); return d;
    });
    let starts = [], maxW = 0;
    function measure(){
      const y = scrollY; window.scrollTo(0, 0);
      const r = svg.getBoundingClientRect(), k = r.width / VB_W;
      starts = letters.map(l => ({ x: r.left + l.x * k, y: r.top, w: l.w * k }));
      maxW = Math.max(...starts.map(s => s.w));
      els.forEach((e, i) => { e.style.height = r.height + 'px'; e.style.width = starts[i].w + 'px'; });
      window.scrollTo(0, y);
    }
    function update(){
      const vh = innerHeight, vw = document.documentElement.clientWidth;
      const lead = vh * .25, p = clamp(scrollY / lead);
      const gut = parseFloat(getComputedStyle(document.body).paddingRight) || 16;
      const colX = vw - gut - maxW;
      const top = Math.max(84, vh * .16), bottom = vh - 90, step = (bottom - top) / (els.length - 1);
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - vh - lead);
      const q = clamp((scrollY - lead) / maxScroll), active = p < 1 ? -1 : Math.round(q * (els.length - 1));
      els.forEach((el, i) => {
        const s = starts[i], k = reduce ? (p >= .5 ? 1 : 0) : ease(clamp((p - i * .03) / .6));
        const sx = s.x, sy = s.y - scrollY, tx = colX + (maxW - s.w) / 2 - (i === active ? 10 : 0), ty = top + i * step;
        el.style.transform = `translate(${(sx + (tx - sx) * k).toFixed(1)}px,${(sy + (ty - sy) * k).toFixed(1)}px)`;
        el.classList.toggle('dim', active >= 0 && i !== active);
      });
      document.body.classList.toggle('mode-fly', true);
    }
    measure(); update();
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', () => { measure(); update(); });
    addEventListener('load', () => { measure(); update(); });
    return { refresh: update };
  })();

  /* ---------- Marcel, the gallery dog ----------
     On about one visit in three he turns up once: he walks along the empty space between sections (never over pictures),
     sometimes sits down, looks at you and tilts his head, then wanders off. Every frame comes from clips of the real Marcel. */
  const Marcel = (() => {
    const cfg = JSON.parse(document.body.dataset.marcel || '{}');
    const FW = 209, FH = 200, FEET = .965, WALK_N = 16, SIT_N = 61, SIT_COLS = 8, SIT_ROWS = 8, STEP = 18 / 712;
    let el, spr, W = 100, H = 96, active = false, raf = 0, last = 0, timer = 0, tries = 0;
    let perch = null, x = 0, face = -1, sheet = 'walk', frame = 0, queue = [], cur = null, alpha = 0;
    const rand = (a, b) => a + Math.random() * (b - a);
    const pick = a => a[Math.floor(Math.random() * a.length)];
    function make(){
      el = document.createElement('button');
      el.type = 'button'; el.className = 'marcel gone'; el.hidden = true;
      el.setAttribute('aria-label', 'Marcel, the gallery dog');
      el.innerHTML = '<span class="m-tag">Marcel</span><span class="m-shadow"></span><span class="m-sprite m-walk"></span>';
      document.body.appendChild(el);
      spr = el.querySelector('.m-sprite');
      el.addEventListener('click', () => { if (!active) return; if (cur) queue.unshift(cur); cur = A.hello(); });
    }
    function sizeDog(){ H = innerWidth < 700 ? 74 : 98; W = H * FW / FH; el.style.setProperty('--mw', W + 'px'); }
    const span = () => [0, perch.getBoundingClientRect().width - W];
    function draw(){
      const r = perch.getBoundingClientRect();
      el.style.left = (r.left + scrollX + x) + 'px';
      el.style.top = (r.top + scrollY - H * FEET) + 'px';
      if (sheet === 'walk'){
        const f = Math.floor(frame) % WALK_N;
        spr.className = 'm-sprite m-walk'; spr.style.backgroundPosition = `${f / (WALK_N - 1) * 100}% 0`;
      } else {
        const f = Math.max(0, Math.min(SIT_N - 1, Math.round(frame)));
        spr.className = 'm-sprite m-sit';
        spr.style.backgroundPosition = `${(f % SIT_COLS) / (SIT_COLS - 1) * 100}% ${Math.floor(f / SIT_COLS) / (SIT_ROWS - 1) * 100}%`;
      }
      spr.style.transform = face > 0 ? 'scaleX(-1)' : '';
      el.style.opacity = alpha;
    }
    const speed = () => STEP * W * 24;
    const A = {
      walk: tx => ({ kind: 'walk', tx, step(dt){
        sheet = 'walk'; const d = this.tx - x; if (Math.abs(d) < 1) return true;
        face = Math.sign(d); const mv = Math.min(Math.abs(d), speed() * dt);
        x += face * mv; frame += mv / (STEP * W); return false; } }),
      stop: () => ({ kind: 'stop', step(){ frame = Math.round(frame / WALK_N) * WALK_N; return true; } }),
      sit: hold => ({ kind: 'sit', t: 0, hold, step(dt){
        sheet = 'sit'; this.t += dt;
        const down = (SIT_N - 1) / 14, up = (SIT_N - 1) / 18;
        if (this.t < down) frame = this.t * 14;
        else if (this.t < down + this.hold) frame = SIT_N - 1 - 6 + 6 * (0.5 + 0.5 * Math.cos((this.t - down) * 1.6));
        else if (this.t < down + this.hold + up) frame = SIT_N - 1 - (this.t - down - this.hold) * 18;
        else { sheet = 'walk'; frame = 0; return true; }
        return false; } }),
      hello: () => ({ kind: 'hello', dur: 2.2, step(dt){
        if (this.dur === 2.2) el.classList.add('tag');
        this.dur -= dt; if (this.dur <= 0){ el.classList.remove('tag'); return true; } return false; } }),
    };
    function plan(){
      const [a, b] = span(), q = [], fromLeft = Math.random() < .5;
      x = fromLeft ? a : b; face = fromLeft ? 1 : -1; sheet = 'walk'; frame = 0;
      const lo = a + W * .6, hi = b - W * .6;
      const stops = hi > lo ? [...Array(Math.random() < .6 ? 1 : 2)].map(() => rand(lo, hi)).sort((p, r) => fromLeft ? p - r : r - p) : [];
      stops.forEach(p => { q.push(A.walk(p)); q.push(A.stop()); q.push(A.sit(rand(2, 4))); });
      q.push(A.walk(fromLeft ? b : a));
      return q;
    }
    function loop(now){
      if (!active) return;
      const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
      if (!perch.isConnected || !perch.offsetParent){ dismiss(); return; }
      const [a, b] = span(); alpha = clamp(Math.min(x - a, b - x) / (W * .3));
      if (!cur) cur = queue.shift();
      if (!cur){ dismiss(); store.set('marcel', 'seen'); return; }
      if (cur.step(dt)) cur = null;
      draw(); raf = requestAnimationFrame(loop);
    }
    function choosePerch(){
      const vis = [...document.querySelectorAll('[data-perch]')].filter(e => {
        if (!e.offsetParent) return false;
        const r = e.getBoundingClientRect();
        return r.width >= W * 3 && r.top > H * 1.1 && r.top < innerHeight - 30;
      });
      if (!vis.length) return false;
      perch = pick(vis); return true;
    }
    function spawn(){
      if (!el) make();
      dismiss(true); sizeDog();
      if (!choosePerch()){ if (++tries < 12) timer = setTimeout(spawn, 3500); return; }
      tries = 0;
      queue = plan(); cur = null; active = true; last = 0; alpha = 0;
      el.hidden = false; el.classList.remove('gone', 'tag');
      if (reduce){ sheet = 'sit'; frame = SIT_N - 1; x = rand(0, Math.max(0, span()[1])); alpha = 1; active = false; draw(); timer = setTimeout(() => dismiss(), 10000); store.set('marcel', 'seen'); return; }
      const sit = new Image(); sit.src = BASE + 'assets/marcel/marcel-sit.webp';
      draw(); raf = requestAnimationFrame(loop);
    }
    function dismiss(quick){
      active = false; cancelAnimationFrame(raf); clearTimeout(timer);
      if (!el) return;
      el.classList.add('gone'); el.classList.remove('tag');
      if (quick) el.hidden = true; else setTimeout(() => { if (!active) el.hidden = true; }, 450);
    }
    addEventListener('resize', () => { if (active) dismiss(); });
    // once per visit: decide on the first page whether Marcel comes; if he does, he appears once, on some page
    let fate = store.get('marcel');
    const forced = /[?&]marcel\b/.test(location.search) || location.hash === '#marcel';   // ?marcel or #marcel brings him straight away (for reviewing)
    if (!fate){ fate = Math.random() < (cfg.chance ?? .33) ? 'yes' : 'no'; store.set('marcel', fate); }
    if (forced || fate === 'yes'){
      const pre = new Image(); pre.src = BASE + 'assets/marcel/marcel-walk.webp';
      timer = setTimeout(spawn, forced ? 1500 : rand(cfg.minDelay ?? 6000, cfg.maxDelay ?? 25000));
    }
    return { spawn, dismiss };
  })();
  window.amanita = { marcel: Marcel };
})();
