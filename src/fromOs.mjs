// What Amanita OS exports (website_export, or the unpublished drafts for a preview) turned into the
// site's data, in exactly the shape data/ has. Pure: scripts/fetch-data.mjs writes the result out
// as files for the build; Amanita OS's preview (/preview/) hands it straight to render().
//
//   fromOsExport(exp) → { site, exhibitions: [...], artists: [...], press: [...], shop: [...], store }
//   store: the store's rules (online checkout on/off, shipping, pick-up, the international line)

const strip = ({ section, sortOrder, ...rest }) => rest;
const SHOW_KIND = { exhibition: 'exhibition', fair: 'fair', event: 'event' };
// Store pictures are {src} in the OS (so they can be dragged into order) and addresses on the site.
const srcOf = (i) => (typeof i === 'string' ? i : i?.src);

export function fromOsExport(exp) {
  const items = exp?.items ?? [];
  const by = s => items.filter(i => i.section === s);

  // Shows, fairs and events: one record each, as data/exhibitions/ has them.
  const shows = items.filter(i => SHOW_KIND[i.section]);
  const exhibitions = shows.map(i => ({
    old: null, subtitle: null, artists: [], relatedArtists: [], venue: '', address: [], note: null, city: '', place: '',
    start: null, end: null, images: [], text: [], pressRelease: null, files: [],
    ...strip(i), kind: SHOW_KIND[i.section],
  }));

  // Artists: their shows with the gallery are the ones that name them, plus any listed by hand.
  const artists = by('artist').map(a => {
    const named = shows.filter(s => (s.relatedArtists || []).includes(a.slug)).map(s => s.slug);
    return {
      old: null, bio: [], cv: null, works: [], ...strip(a),
      exhibitions: [...new Set([...(a.exhibitions || []), ...named])].filter(s => shows.some(x => x.slug === s)),
    };
  });

  const press = by('press').sort((a, b) => (b.date || '').localeCompare(a.date || '') || (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(strip).map(({ slug, ...p }) => p);
  const shop = by('store').sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(strip)
    .map((s) => { const images = (s.images || []).map(srcOf).filter(Boolean); return { ...s, images, image: s.image || images[0] || null }; });

  return { site: exp?.settings ?? null, exhibitions, artists, press, shop, store: exp?.store ?? null };
}
