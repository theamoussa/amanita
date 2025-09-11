// Safe GA helper (won't crash if gtag isn't present)
function track(eventName, params){ try{ gtag('event', eventName, params||{}); }catch(_){} }

// ==== Product data (replace stripe links + images) ====
const PRODUCTS = [
  {
    id: "manna-rain",
    title: "Manna Rain — Rita Ackermann",
    blurb: "Hardcover catalogue, 200+ pages. Essay by Pamela Kort.",
    description: "Catalogue of Rita Ackermann’s Manna Rain at Fondazione Iris, with full plates, installation views, and an essay by Pamela Kort.",
    price: 75, currency: "USD",
    stripe: "https://buy.stripe.com/REPLACE_ME_1",
    category: "BOOKS",
    images: [
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/BOOKS/AMANITA-9-2-20260265.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/BOOKS/AMANITA-9-2-20260266.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/BOOKS/AMANITA-9-2-20260267.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/BOOKS/AMANITA-9-2-20260268.jpg"
    ],
    cover: "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/BOOKS/AMANITA-9-2-20260264.jpg"
  },
  {
    id: "leonardo-meoni",
    title: "Leonardo Meoni — Catalogue",
    blurb: "Plates, process, and texts from recent works on velvet.",
    description: "Focused publication on Meoni’s velvet works with studio photography, details, and essays on process.",
    price: 60, currency: "USD",
    stripe: "https://buy.stripe.com/REPLACE_ME_2",
    category: "BOOKS",
    images: [
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/meoni-1.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/meoni-2.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/meoni-3.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/meoni-4.jpg"
    ],
    cover: "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/meoni-1.jpg"
  },
  {
    id: "amanita-annual",
    title: "Amanita Annual 2022–2024",
    blurb: "Highlights from exhibitions at 313 Bowery and beyond.",
    description: "Survey of Amanita Gallery programs 2022–2024 with documentation, texts, and selected highlights.",
    price: 45, currency: "USD",
    stripe: "https://buy.stripe.com/REPLACE_ME_3",
    category: "BOOKS",
    images: [
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/annual-1.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/annual-2.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/annual-3.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/annual-4.jpg"
    ],
    cover: "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/annual-1.jpg"
  },
  {
    id: "amanita-tote",
    title: "Amanita Tote",
    blurb: "Heavyweight cotton tote with Amanita mark.",
    description: "Durable cotton tote suitable for books and everyday use.",
    price: 25, currency: "USD",
    stripe: "https://buy.stripe.com/REPLACE_ME_4",
    category: "MERCH",
    images: [
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/tote-1.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/tote-2.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/tote-3.jpg",
      "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/tote-4.jpg"
    ],
    cover: "https://storage.googleapis.com/spazioamanita/Website%20Image%20Database/shop/tote-1.jpg"
  }
];

// ===== Rendering =====
function formatPrice(amount, currency){
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `$${Number(amount).toFixed(2)}`; }
}

function productCard(p){
  const el = document.createElement('div');
  el.className = 'product';
  el.innerHTML = `
    <a class="imgWrap" href="${p.stripe}" target="_blank" rel="noopener" aria-label="Buy ${p.title}">
      <img src="${p.cover || (p.images && p.images[0])}" alt="${p.title}">
    </a>
    <div class="title">${p.title}</div>
    <div class="blurb">${p.blurb ?? ''}</div>
    <div class="price">${formatPrice(p.price, p.currency || 'USD')}</div>
    <div class="actions">
      <a class="btn-buy" href="${p.stripe}" target="_blank" rel="noopener">Buy</a>
      <button class="btn-secondary btn-preview" type="button">Preview</button>
    </div>
  `;
  el.querySelector('.btn-buy').addEventListener('click', () => {
    track('buy_click', { item_id: p.id, item_name: p.title, value: p.price, currency: p.currency || 'USD' });
  });
  el.querySelector('.btn-preview').addEventListener('click', () => openProductModal(p));
  return el;
}

function renderGrid(filter='ALL'){
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = '';
  const items = PRODUCTS.filter(p => filter === 'ALL' ? true : p.category === filter);
  if (!items.length) {
    grid.innerHTML = '<p>No products available.</p>';
    return;
  }
  items.forEach(p => grid.appendChild(productCard(p)));
}

// ===== Modal / Carousel =====
function openProductModal(p){
  document.getElementById('productModalLabel').textContent = p.title;
  document.getElementById('productDescription').textContent = p.description || p.blurb || '';
  document.getElementById('productPrice').textContent = formatPrice(p.price, p.currency || 'USD');

  const buy = document.getElementById('productBuyLink');
  buy.href = p.stripe;
  buy.setAttribute('aria-label', `Buy ${p.title}`);
  buy.onclick = () => track('buy_click_modal', { item_id: p.id, item_name: p.title, value: p.price, currency: p.currency || 'USD' });

  // Build slides
  const inner = document.getElementById('productCarouselInner');
  const indicators = document.getElementById('productCarouselIndicators');
  inner.innerHTML = '';
  indicators.innerHTML = '';

  (p.images || []).forEach((src, idx) => {
    const item = document.createElement('div');
    item.className = `carousel-item ${idx === 0 ? 'active' : ''}`;
    item.innerHTML = `<img src="${src}" alt="${p.title} image ${idx+1}">`;
    inner.appendChild(item);

    const ind = document.createElement('button');
    ind.type = 'button';
    ind.setAttribute('data-bs-target', '#productCarousel');
    ind.setAttribute('data-bs-slide-to', String(idx));
    ind.setAttribute('aria-label', `Slide ${idx+1}`);
    if (idx === 0) ind.className = 'active';
    indicators.appendChild(ind);
  });

  const multiple = (p.images || []).length > 1;
  document.querySelector('#productCarousel .carousel-control-prev').style.display = multiple ? '' : 'none';
  document.querySelector('#productCarousel .carousel-control-next').style.display = multiple ? '' : 'none';
  indicators.style.display = multiple ? '' : 'none';

  const carouselEl = document.getElementById('productCarousel');
  const carousel = bootstrap.Carousel.getInstance(carouselEl) || new bootstrap.Carousel(carouselEl, { interval: false });
  carousel.to(0);

  const modalEl = document.getElementById('productModal');
  const modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
  modal.show();
}

// ===== Tabs =====
function wireTabs(){
  const tabs = document.querySelectorAll('#shop .tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      renderGrid(tab.getAttribute('data-tab'));
    });
  });
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  wireTabs();
  renderGrid('ALL');
});
