# Amanita website

The gallery's website, rebuilt in October 2026. Everything on the site comes from small data files in `data/`;
one command turns them into the pages in `dist/`. Amanita OS will later write the same data files.

## What's where

| | |
|---|---|
| `data/exhibitions/*.json` | one file per exhibition or art fair: title, artists, venue, dates, pictures with captions, text, press release |
| `data/artists/*.json` | one file per artist: works with captions, bio, CV link, exhibitions |
| `data/press.json` | press articles |
| `data/shop.json` | store items (from Amanita OS: with their variants — sizes — each with an id and price) |
| `data/site.json` | locations, opening hours, email, Instagram, mailing list, how often Marcel appears |
| `data/redirects.json` | old addresses (`/Exhibitions/tostandbare.html` …) and the new page each one forwards to |
| `src/assets/` | the one stylesheet, the one script, Marcel's sprites |
| `scripts/build.mjs` | builds the site |
| `scripts/images.mjs` | makes web-sized copies of the pictures |
| `tools/` | the one-off scripts that read the old site; kept for reference only |

## Everyday commands (in Terminal, inside this folder)

```
npm run preview     # build and open on your computer at http://localhost:4321
npm run images      # make web copies of any new pictures (needs `npm install` once)
```

Publishing is automatic: every `git push` rebuilds and publishes the site, and it also rebuilds by itself every
morning so "Now on view" and "Upcoming" move along with the dates.

## Adding an exhibition by hand (until Amanita OS does it)

Copy an existing file in `data/exhibitions/`, rename it (the file name becomes the address), and change the fields.
Dates are `YYYY-MM-DD`. Captions may use `<em>` for titles. `kind` is `exhibition` or `fair`.
Then `npm run images`, commit, push.

- **`cover`** (optional): the picture that stands for the show on the home page, usually an installation view,
  e.g. `"cover": "https://storage.googleapis.com/spazioamanita/EvaBeresin/_GBE0114.jpg"`. Without it the first
  picture is used. The slideshow on the show's own page is not affected.
- **Announcing an upcoming show**: a file with a `start` date in the future appears on the home page under
  "Upcoming" until it opens, then moves to "Now on view" by itself. Only `title`, `artists`, `venue`, `city`,
  `start` and `end` are needed; `images` can be `[]` and `text` can be `[]`. `note` is a good place for the opening
  reception ("Opening reception Thursday, November 12, 6–8 pm"). It shows as a strip under "Now on view":
  its `cover` (or first picture) on the left, title and venue beside it; without a picture, just the text.

## Pictures

`npm run images` makes two WebP copies of every picture: 1000 and 2400 pixels wide, at quality 88. The browser picks
the one the screen needs; 2400 is sharp on a retina screen even when a slideshow picture fills the page. All copies
together come to roughly 600 MB, inside GitHub Pages' 1 GB limit, with room for years of shows. If the settings in
`scripts/images.mjs` change, the next run redoes every picture and removes the old copies.

Artists: `listImage` in each artist's file is the detail shot shown when you hover the name on the Artists page.

## Marcel

He appears on about one visit in three (`data/site.json` › `marcel.chance`), at most once per visit, and walks only along
the empty space between sections. Add `#marcel` to any address to call him straight away.

## Launch (when the preview is approved)

1. In this repository's Settings › Secrets and variables › Actions › Variables, add
   `SITE_BASE` = `/`, `SITE_URL` = `https://www.spazioamanita.com`, `CNAME` = `www.spazioamanita.com`.
2. Settings › Pages › Custom domain: `www.spazioamanita.com`.
3. Point the domain at this repository instead of the old one (the same DNS records the old site uses, at SiteGround),
   and remove the custom domain from the old `amanita` repository.
4. Old links keep working through the forwarding pages.

## Preview from Amanita OS

The pages are written by `src/render.mjs` (pure: data in, pages out) and Amanita OS's export is
turned into that data by `src/fromOs.mjs`. The build uses both, and publishes both under
`/assets/` so that `/preview/` — opened by the Preview button in Amanita OS — renders unpublished
changes with exactly the same templates. Change a template in `src/render.mjs` and the preview
follows on the next deploy.


## The store (30 Oct 2026)

`src/shop.mjs` writes the store's pages: `/shop/` (the list), `/shop/<item>/` (a page per product, its pictures in
the site's slideshow), `/shop/cart/` and `/shop/thanks/`. `src/assets/shop.js` runs the cart in the browser.

- **Two ways the store can be built.** When Amanita OS says online checkout is on (Store › Settings) *and* the
  build knows where the OS is (`OS_SUPABASE_URL`, `OS_GALLERY_ID` — the same repository variables fetch-data
  uses), products get **Add to cart** and the menu gets **cart (n)**. Otherwise — checkout off, or a build from
  `data/` — each product keeps its old Stripe **Buy** link. Switching it on or off in the OS rebuilds the site.
- **Nothing that costs money is decided in the browser.** The cart (kept in the browser, `localStorage`) asks the OS's
  `store` function for what is left of each variant, what the cart comes to and the shipping ($15 for the first
  item, $5 for each more, free from $120; free pick-up in New York), and Check out asks it for a Stripe Checkout
  page. Stripe sends the buyer back to `/shop/thanks/`, which shows the order number.
- **International buyers:** the line "Online checkout is available for US orders. For international shipping,
  please contact us for a quote." is under every product and in the cart; "contact us" opens an email listing
  what is in their cart. The OS records those orders and makes their payment link.
- The old addresses (`/shop/mannarainbook.html` …) now forward to the product pages.
