/* Amanita — the store's cart (30 Oct 2026).
   The cart lives in this browser (localStorage). Everything with a number in it — what is left,
   what the cart costs, shipping — comes from Amanita OS's `store` function, never from here:
   this script only shows it and sends the buyer to Stripe's checkout page.
   Loaded on every page while online checkout is on (body[data-shop] says where to ask). */
(() => {
  const cfg = (() => { try { return JSON.parse(document.body.dataset.shop || 'null'); } catch { return null; } })();
  if (!cfg?.api) return;
  const BASE = document.body.dataset.base || '/';
  const KEY = 'amanita-cart';
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
  const url = p => BASE + p + (BASE.startsWith('.') && p.endsWith('/') ? 'index.html' : '');

  /* ---------- the cart, kept in this browser ---------- */
  const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY) || '{}'); return { lines: Array.isArray(c.lines) ? c.lines : [], delivery: c.delivery || 'ship', checkout: c.checkout || null }; } catch { return { lines: [], delivery: 'ship', checkout: null }; } };
  const write = c => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* private mode: the cart lasts this page */ } count(); };
  const items = c => c.lines.reduce((n, l) => n + l.q, 0);
  function count(){
    const n = items(read());
    document.querySelectorAll('[data-cartlink]').forEach(a => { a.hidden = n === 0 && !document.querySelector('[data-cart-page]'); });
    document.querySelectorAll('[data-cartcount]').forEach(s => { s.textContent = n ? `(${n})` : ''; });
  }
  count();
  addEventListener('storage', e => { if (e.key === KEY) count(); });

  /* ---------- talking to Amanita OS ---------- */
  let live = null;
  const status = () => (live ??= fetch(`${cfg.api}?gallery=${encodeURIComponent(cfg.gallery)}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).catch(() => null));
  const post = (body) => fetch(cfg.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gallery_id: cfg.gallery, ...body }) })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok && !j.quote) throw new Error(j.error || 'Something went wrong. Please try again.'); return j; });

  /* ---------- the store list: Sold out, live ---------- */
  const tags = document.querySelectorAll('[data-soldout]');
  if (tags.length) status().then(st => {
    if (!st?.variants) return;
    tags.forEach(t => {
      const ids = t.dataset.soldout.split(' ').filter(Boolean);
      if (ids.length) t.hidden = !ids.every(id => st.variants[id]?.soldOut ?? true);
    });
  });

  /* ---------- a product: choose, how many, add ---------- */
  document.querySelectorAll('[data-add]').forEach(form => {
    let variants = [];
    try { variants = JSON.parse(form.dataset.variants); } catch { return; }
    const qty = form.querySelector('input[name=quantity]'), btn = form.querySelector('[data-addbtn]'), msg = form.querySelector('[data-added]'), price = form.querySelector('[data-price]');
    const chosen = () => (form.querySelector('input[name=variant]:checked') || form.querySelector('input[name=variant][type=hidden]'))?.value;
    const avail = {};      // variant id → how many more this browser may add (null = not counted)
    const inCart = id => read().lines.filter(l => l.v === id).reduce((n, l) => n + l.q, 0);
    const room = id => (avail[id] == null ? 20 : Math.max(0, avail[id] - inCart(id)));
    function refresh(){
      const id = chosen(), v = variants.find(x => x.id === id);
      if (v && price) price.textContent = v.price || '';
      const left = id ? room(id) : 0;
      qty.value = String(Math.max(1, Math.min(left || 1, parseInt(qty.value, 10) || 1)));
      btn.disabled = !id || left <= 0;
      btn.textContent = !id ? 'Sold out' : left <= 0 ? (inCart(id) ? 'All in your cart' : 'Sold out') : 'Add to cart';
    }
    status().then(st => {
      if (!st?.variants) return;
      variants.forEach(v => {
        const s = st.variants[v.id];
        avail[v.id] = !s ? 0 : s.available;
        const input = form.querySelector(`input[name=variant][value="${v.id}"]`);
        const off = !s || s.soldOut;
        if (input && input.type === 'radio'){ input.disabled = off; input.closest('label')?.classList.toggle('off', off); if (off && input.checked){ input.checked = false; const next = form.querySelector('input[name=variant]:not(:disabled)'); if (next) next.checked = true; } }
      });
      refresh();
    });
    form.addEventListener('change', refresh);
    form.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { qty.value = String((parseInt(qty.value, 10) || 1) + Number(b.dataset.step)); refresh(); }));
    qty.addEventListener('input', () => { if (qty.value !== '') refresh(); });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const id = chosen(), v = variants.find(x => x.id === id); if (!v) return;
      const q = Math.max(1, Math.min(room(id), parseInt(qty.value, 10) || 1)); if (!q) return;
      const c = read();
      const line = c.lines.find(l => l.v === id);
      if (line) line.q += q;
      else c.lines.push({ v: id, q, t: form.dataset.title, n: variants.length > 1 ? v.name : '', p: v.amount, img: form.dataset.image, slug: form.dataset.slug });
      write(c);
      msg.innerHTML = `Added to your cart. <a href="${url('shop/cart/')}">View cart</a>`;
      refresh();
    });
    refresh();
  });

  /* ---------- the international line: an email listing the cart ---------- */
  function intlMail(a, lines){
    if (!lines.length) return;
    const list = lines.map(l => `– ${l.q > 1 ? `${l.q} × ` : ''}${l.t}${l.n ? ` (${l.n})` : ''}`).join('\n');
    const u = new URL(a.href);
    const to = u.pathname;
    a.href = `mailto:${to}?subject=${encodeURIComponent('Store — international order')}&body=${encodeURIComponent(`Hello,\n\nI would like to order:\n\n${list}\n\nPlease send me a shipping quote to:\n[your address]\n\nThank you,\n`)}`;
  }

  /* ---------- the cart page ---------- */
  const page = document.querySelector('[data-cart-page]');
  if (page) {
    const linesEl = page.querySelector('[data-lines]'), totals = page.querySelector('[data-totals]'), toFree = page.querySelector('[data-tofree]');
    const go = page.querySelector('[data-checkout]'), err = page.querySelector('[data-error]');
    const intl = page.querySelector('[data-intl]');
    const PROBLEM = { gone: 'No longer available', sold_out: 'Sold out', not_enough: 'Fewer left', no_price: 'Not available online' };
    let quote = null, seq = 0;

    const c0 = read();
    const radio = page.querySelector(`input[name=delivery][value="${c0.delivery}"]`) || page.querySelector('input[name=delivery]');
    if (radio) radio.checked = true;
    const delivery = () => page.querySelector('input[name=delivery]:checked')?.value || 'ship';

    function draw(){
      const c = read();
      if (intl) intlMail(intl, c.lines);
      if (!c.lines.length){
        linesEl.innerHTML = `<p class="empty">Your cart is empty. <a href="${url('shop/')}">Go to the store</a></p>`;
        totals.innerHTML = ''; toFree.textContent = ''; go.disabled = true; return;
      }
      const byV = Object.fromEntries((quote?.lines || []).map(l => [l.variant_id, l]));
      linesEl.innerHTML = `<ul class="clines">${c.lines.map(l => {
        const q = byV[l.v], bad = q?.problem;
        const each = q?.unit_price ?? l.p;
        return `<li class="cline${bad ? ' bad' : ''}" data-v="${esc(l.v)}">
          ${l.img ? `<a class="cimg" href="${url(`shop/${l.slug}/`)}"><img src="${esc(l.img)}" alt="" loading="lazy"></a>` : '<span class="cimg"></span>'}
          <div class="cinfo"><a href="${url(`shop/${l.slug}/`)}">${esc(l.t)}</a>${l.n ? `<span class="meta">${esc(l.n)}</span>` : ''}
            ${bad ? `<span class="warn">${PROBLEM[bad] || 'Unavailable'}${bad === 'not_enough' && q.available ? ` — ${q.available} left` : ''}</span>` : ''}
            <span class="qty sm"><button type="button" data-d="-1" aria-label="One fewer">−</button><span>${l.q}</span><button type="button" data-d="1" aria-label="One more"${q?.available != null && l.q >= q.available ? ' disabled' : ''}>+</button></span>
            <button type="button" class="rm" data-rm>Remove</button></div>
          <span class="camt">${each != null ? money(each * l.q) : ''}</span>
        </li>`; }).join('')}</ul>`;
      if (quote && !quote.error){
        const shipLabel = delivery() === 'pickup' ? 'Pick-up' : 'Shipping';
        totals.innerHTML = `<dt>Subtotal</dt><dd>${money(quote.subtotal)}</dd><dt>${shipLabel}</dt><dd>${Number(quote.shipping) > 0 ? money(quote.shipping) : 'Free'}</dd><dt class="t">Total</dt><dd class="t">${money(quote.total)}</dd>`;
        toFree.textContent = quote.to_free > 0 ? `Add ${money(quote.to_free)} more for free shipping.` : '';
        go.disabled = !quote.ok;
        err.textContent = quote.ok ? '' : 'Some items have changed — adjust your cart to continue.';
      }
    }
    async function requote(){
      const c = read(), mine = ++seq;
      c.delivery = delivery(); write(c);
      if (!c.lines.length){ quote = null; draw(); return; }
      go.disabled = true;
      try { const q = await post({ action: 'quote', delivery: c.delivery, lines: c.lines.map(l => ({ variant_id: l.v, quantity: l.q })) }); if (mine === seq) quote = q; }
      catch (e) { if (mine === seq){ quote = { error: true }; err.textContent = e.message; } }
      if (mine === seq) draw();
    }
    linesEl.addEventListener('click', e => {
      const li = e.target.closest('[data-v]'); if (!li) return;
      const c = read(), l = c.lines.find(x => x.v === li.dataset.v); if (!l) return;
      if (e.target.closest('[data-rm]')) c.lines = c.lines.filter(x => x !== l);
      else if (e.target.closest('[data-d]')) { l.q += Number(e.target.closest('[data-d]').dataset.d); if (l.q < 1) c.lines = c.lines.filter(x => x !== l); }
      else return;
      write(c); draw(); requote();
    });
    page.querySelectorAll('input[name=delivery]').forEach(r => r.addEventListener('change', requote));
    go.addEventListener('click', async () => {
      const c = read();
      go.disabled = true; go.textContent = 'Opening checkout…'; err.textContent = '';
      try {
        const r = await post({ action: 'checkout', delivery: delivery(), replace: c.checkout, return_url: new URL(BASE, location.href).href, lines: c.lines.map(l => ({ variant_id: l.v, quantity: l.q })) });
        if (r.url){ c.checkout = r.checkout_id; write(c); location.href = r.url; return; }
        quote = r.quote || quote; draw();
        err.textContent = (r.quote?.problems || []).some(p => typeof p === 'string' && p.length > 12) ? r.quote.problems[0] : 'Some items have changed — adjust your cart to continue.';
      } catch (e) { err.textContent = e.message; }
      go.textContent = 'Check out'; go.disabled = !quote?.ok;
    });
    draw(); requote();
  } else {
    // product pages and the store: the "contact us" email lists what is in the cart, if anything
    const c = read();
    document.querySelectorAll('[data-intl]').forEach(a => { if (/international/i.test(decodeURIComponent(a.href))) intlMail(a, c.lines); });
  }

  /* ---------- back from Stripe ---------- */
  const thanks = document.querySelector('[data-thanks]');
  if (thanks) {
    const session = new URLSearchParams(location.search).get('session');
    write({ lines: [], delivery: read().delivery, checkout: null });
    const line = thanks.querySelector('[data-thanks-line]'), next = thanks.querySelector('[data-thanks-next]');
    let tries = 0;
    const look = async () => {
      if (!session) return;
      try {
        const o = await post({ action: 'order', session_id: session });
        if (o.number){
          line.textContent = `Your order #${o.number} is confirmed. A receipt is on its way to your email.`;
          next.textContent = o.delivery === 'pickup' ? 'We will email you when it is ready to pick up.' : 'We will email you when it ships.';
          return;
        }
      } catch { /* the receipt still comes */ }
      if (++tries < 6) setTimeout(look, 2000);
    };
    look();
  }
})();
