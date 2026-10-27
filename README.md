# Amanita website

The gallery's website, rebuilt in October 2026. Everything on the site comes from small data files in `data/`;
one command turns them into the pages in `dist/`. Amanita OS will later write the same data files.

## What's where

| | |
|---|---|
| `data/exhibitions/*.json` | one file per exhibition or art fair: title, artists, venue, dates, pictures with captions, text, press release |
| `data/artists/*.json` | one file per artist: works with captions, bio, CV link, exhibitions |
| `data/press.json` | press articles |
| `data/shop.json` | shop items with their Stripe Buy links |
| `data/site.json` | locations, opening hours, email, Instagram, mailing list, how often Marcel appears |
| `data/redirects.json` | old addresses (`/Exhibitions/tostandbare.html` …) and the new page each one forwards to |
| `src/assets/` | the one stylesheet, the one script, Marcel's sprites |
| `scripts/build.mjs` | builds the site |
| `scripts/images.mjs` | makes web-sized copies of the pictures |
| `tools/` | the one-off scripts that read the old site; kept for reference only |

## Everyday commands (in Terminal, inside this folder)

```
npm run preview     # build and open on your computer at http://localhost:4321
npm run images      # make web-sized copies of any new pictures (needs `npm install` once)
```

Publishing is automatic: every `git push` rebuilds and publishes the site, and it also rebuilds by itself every
morning so "Now on view" and "Upcoming" move along with the dates.

## Adding an exhibition by hand (until Amanita OS does it)

Copy an existing file in `data/exhibitions/`, rename it (the file name becomes the address), and change the fields.
Dates are `YYYY-MM-DD`. Captions may use `<em>` for titles. `kind` is `exhibition` or `fair`.
Then `npm run images`, commit, push.

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
