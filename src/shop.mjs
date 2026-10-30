// The store's pages (Thea, 30 Oct 2026: "I want to have a cart and everything").
//
// Pure, like render.mjs, which calls it with its own helpers so the store looks like the rest of
// the site (and Amanita OS's preview renders it the same way; /assets/shop.mjs is this file).
//
//   /shop/            every product: picture, title, price, "Sold out"
//   /shop/<slug>/     a product: its pictures (the site's slideshow), text, details, the variant
//                     (size…), how many, Add to cart — or, while online checkout is off, the old
//                     Stripe Buy links
//   /shop/cart/       the cart: lines, US shipping or free pick-up in New York, the line for
//                     international buyers with "Email us", Check out → Stripe
//   /shop/thanks/     where Stripe sends buyers back: the order number
//
// Everything a buyer can change (the cart, what is left, the price of the cart) is done by
// /assets/shop.js against Amanita OS's `store` function: the pages carry the store's rules and
// each variant's id, the browser asks for the live numbers. Without JavaScript a product page
// still says its price and the email address to order by.

export function shopPages({ shop, store, cart, esc, strip, rich, u, at, picture, slideshow, layout, abs, thumbOf = (x) => x, SITE }) {
  const pages = [];
  const on = !!cart;                                  // the cart and checkout are live on this build
  const email = store?.email || SITE.email;
  const intl = store?.international || 'For international orders, write to us.';
  const contactLink = (subject) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;
  // "…please contact us for a quote." → "contact us" is the email link
  const intlLine = (subject) => {
    const t = esc(intl);
    return /contact us/i.test(t) ? t.replace(/contact us/i, m => `<a href="${contactLink(subject)}" data-intl>${m}</a>`) : `${t} <a href="${contactLink(subject)}" data-intl>${esc(email)}</a>`;
  };
  const variantsOf = s => (Array.isArray(s.variants) ? s.variants : []);
  const priceOf = s => {
    const vs = variantsOf(s);
    const prices = [...new Set((vs.length ? vs.map(v => v.price || s.price) : [s.price]).filter(Boolean))];
    return prices.length > 1 ? prices.join(' / ') : prices[0] || '';
  };
  const soldOut = s => variantsOf(s).length > 0 && variantsOf(s).every(v => v.soldOut);
  const imagesOf = s => [...new Set([s.image, ...(s.images || [])].filter(Boolean))];
  // a store item's details: a list of {label, value} (from the OS, which keeps their order) or an object (older data/)
  const specsOf = s => Array.isArray(s.specs) ? s.specs.filter(x => x && x.label).map(x => [x.label, x.value ?? '']) : Object.entries(s.specs || {});
  const ids = s => variantsOf(s).map(v => v.id).filter(Boolean).join(' ');

  // The old way (online checkout off, or a build from data/): one Buy link per variant.
  const buyLink = (href, label) => `<a class="btn" href="${esc(href)}" target="_blank" rel="noopener">${esc(label)}</a>`;
  const struck = (name) => name
    ? `<span class="btn off" aria-disabled="true" title="${esc(name)}: sold out">${esc(name)}</span>`
    : '<span class="btn off whole" aria-disabled="true">Sold out</span>';
  function buyLine(s) {
    const vs = variantsOf(s);
    if (!vs.length) return `<p class="buy"><span class="price">${esc(s.price)}</span>${s.buy ? buyLink(s.buy, 'Buy') : ''}</p>`;
    if (vs.length === 1) return `<p class="buy"><span class="price">${esc(vs[0].price || s.price)}</span>${vs[0].soldOut ? struck() : vs[0].buy ? buyLink(vs[0].buy, 'Buy') : ''}</p>`;
    return `<p class="buy"><span class="price">${esc(priceOf(s))}</span>${soldOut(s) ? struck() : `<span class="variants">${vs.map(v => v.soldOut ? struck(v.name) : v.buy ? buyLink(v.buy, v.name) : '').join('')}</span>`}</p>`;
  }

  // The cart way: choose the variant and how many, add to the cart.
  function addForm(s) {
    const vs = variantsOf(s).filter(v => v.id);
    if (!vs.length) return buyLine(s);
    const data = vs.map(v => ({ id: v.id, name: v.name, price: v.price || s.price, amount: v.amount, soldOut: !!v.soldOut }));
    const all = data.every(v => v.soldOut);
    const first = data.find(v => !v.soldOut) || data[0];
    return `<form class="add" data-add data-slug="${esc(s.slug)}" data-title="${esc(strip(s.title))}" data-image="${esc(imagesOf(s)[0] ? thumbOf(imagesOf(s)[0]) : '')}" data-variants="${esc(JSON.stringify(data))}">
        <p class="price" data-price>${esc(first.price)}</p>
        ${data.length > 1 ? `<fieldset class="pick"><legend class="vh">Choose</legend>${data.map(v => `<label class="chip${v.soldOut ? ' off' : ''}"><input type="radio" name="variant" value="${esc(v.id)}"${v.id === first.id && !v.soldOut ? ' checked' : ''}${v.soldOut ? ' disabled' : ''}><span>${esc(v.name)}</span></label>`).join('')}</fieldset>` : `<input type="hidden" name="variant" value="${esc(first.id)}">`}
        <div class="addrow">
          <span class="qty" data-qty><button type="button" data-step="-1" aria-label="One fewer">−</button><input name="quantity" inputmode="numeric" value="1" aria-label="How many"><button type="button" data-step="1" aria-label="One more">+</button></span>
          <button type="submit" class="btn solid" data-addbtn${all ? ' disabled' : ''}>${all ? 'Sold out' : 'Add to cart'}</button>
        </div>
        <p class="added meta" data-added aria-live="polite"></p>
      </form>`;
  }

  // ---------- /shop/ ----------
  {
    at('shop/index.html');
    const body = `
<div class="inner">
  <div class="pagehead"><h1 class="vh">Store</h1></div>
  <div class="shop">
${shop.map(s => `    <article class="product" id="${s.slug}">
      <a class="plink" href="${u(`shop/${s.slug}/`)}">
        ${picture(imagesOf(s)[0], strip(s.title), { sizes: '(max-width:700px) 100vw, 33vw' })}
        <h2>${s.title}</h2>
      </a>
      <p class="buy"><span class="price">${esc(priceOf(s))}</span><span class="tag" data-soldout="${ids(s)}"${soldOut(s) ? '' : ' hidden'}>Sold out</span></p>
    </article>`).join('\n')}
  </div>
  <p class="note" data-perch>${on ? intlLine('Store — international order') : `For international orders or special requests, write to <a href="${contactLink('Store')}">${esc(email)}</a>.`}</p>
</div>`;
    pages.push(['shop/index.html', layout({ title: 'Store', canonical: '/shop/', section: 'shop', body, pageClass: 'p-shop' })]);
  }

  // ---------- /shop/<slug>/ ----------
  for (const s of shop) {
    const file = `shop/${s.slug}/index.html`;
    at(file);
    const imgs = imagesOf(s);
    const specs = specsOf(s);
    const body = `
<div class="inner">
  <p class="crumb meta"><a href="${u('shop/')}">Store</a></p>
  <div class="pdp">
    <div class="pdp-pics">${imgs.length ? slideshow(imgs.map((src, i) => ({ src, alt: `${strip(s.title)}${imgs.length > 1 ? `, ${i + 1} of ${imgs.length}` : ''}` })), strip(s.title)) : '<div class="noimg"></div>'}</div>
    <div class="pdp-info" data-perch>
      <h1>${s.title}</h1>
      ${s.blurb ? `<div class="blurb">${rich(s.blurb)}</div>` : ''}
      ${on ? addForm(s) : buyLine(s)}
      ${specs.length ? `<dl class="specs">${specs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>` : ''}
      <p class="intl meta">${on ? intlLine(`Store — ${strip(s.title)}`) : `For international orders, write to <a href="${contactLink(`Store — ${strip(s.title)}`)}">${esc(email)}</a>.`}</p>
    </div>
  </div>
</div>`;
    const offers = variantsOf(s).length ? variantsOf(s) : [{ price: s.price, soldOut: false }];
    const jsonld = {
      '@context': 'https://schema.org', '@type': 'Product', name: strip(s.title), description: strip(s.blurb), image: imgs.slice(0, 3).map(i => /^https?:/.test(i) ? i : abs(i)),
      brand: { '@type': 'Brand', name: 'Amanita' }, url: abs(`shop/${s.slug}/`),
      offers: offers.map(v => ({ '@type': 'Offer', priceCurrency: store?.currency || 'USD', price: String(v.amount ?? String(v.price || s.price || '').replace(/[^0-9.]/g, '')), availability: v.soldOut ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock', url: abs(`shop/${s.slug}/`) })),
    };
    pages.push([file, layout({ title: strip(s.title), description: strip(s.blurb), canonical: `/shop/${s.slug}/`, section: 'shop', body, image: imgs[0], jsonld, pageClass: 'p-product' })]);
  }

  // ---------- /shop/cart/ and /shop/thanks/ ----------
  if (on) {
    at('shop/cart/index.html');
    const ship = store.ship, pickup = store.pickup;
    const body = `
<div class="inner">
  <div class="pagehead"><h1>Cart</h1></div>
  <div class="cart" data-cart-page>
    <div class="cart-lines" data-lines><p class="meta">Loading your cart…</p></div>
    <aside class="cart-sum" data-perch>
      <fieldset class="deliv" data-delivery>
        <legend class="kicker">Delivery</legend>
        ${ship ? `<label><input type="radio" name="delivery" value="ship" checked> <span><b>${esc(ship.label)}</b> · US addresses<br><span class="meta">$${esc(ship.first)} for the first item, $${esc(ship.extra)} for each more${ship.freeFrom != null ? `. Free from $${esc(ship.freeFrom)}` : ''}.</span></span></label>` : ''}
        ${pickup ? `<label><input type="radio" name="delivery" value="pickup"${ship ? '' : ' checked'}> <span><b>${esc(pickup.label)}</b><br><span class="meta" data-pickup>${esc(pickup.address || '')}${pickup.note ? `. ${esc(pickup.note)}` : ''}</span></span></label>` : ''}
      </fieldset>
      <dl class="totals" data-totals></dl>
      <p class="meta free" data-tofree></p>
      <button type="button" class="btn solid wide" data-checkout disabled>Check out</button>
      <p class="meta err" data-error aria-live="polite"></p>
      ${store.taxNote ? `<p class="meta">${esc(store.taxNote)}</p>` : ''}
      <p class="intl meta">${intlLine('Store — international order')}</p>
    </aside>
  </div>
</div>`;
    pages.push(['shop/cart/index.html', layout({ title: 'Cart', canonical: '/shop/cart/', section: 'shop', body, pageClass: 'p-cart', noindex: true })]);

    at('shop/thanks/index.html');
    pages.push(['shop/thanks/index.html', layout({
      title: 'Thank you', canonical: '/shop/thanks/', section: 'shop', pageClass: 'p-thanks', noindex: true,
      body: `<div class="inner nf" data-perch data-thanks><h1>Thank you.</h1><p class="meta" data-thanks-line>Your payment went through. A receipt is on its way to your email.</p><p class="meta" data-thanks-next></p><p><a href="${u('shop/')}">Back to the store</a></p></div>`,
    })]);
  }
  return pages;
}

// Product pages for the sitemap and the search.
export const shopPaths = shop => shop.map(s => `/shop/${s.slug}/`);
