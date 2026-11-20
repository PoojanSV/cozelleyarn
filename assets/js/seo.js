/* Cozelle SEO layer - invisible to visitors. Sets title, description, canonical, robots,
   Open Graph / Twitter tags and JSON-LD structured data once the page data has loaded.
   The ONLY thing to edit here is SEO_ORIGIN (or run tools/set-domain.sh). */
const SEO_ORIGIN = 'https://cozelleyarn.shop';

const Seo = (() => {
  const DEF = {
    home: {
      title: 'Cozelle | Merino Wool Yarn, Knitwear, Throws & Rugs - Free Delivery India',
      desc: 'Shop Cozelle for soft merino & wool yarn, cable-knit throws, wool rugs and knitwear. Natural fibres, finished by hand. Free delivery across India, 7-day returns.'
    },
    collection: {
      title: 'Shop Wool Yarn, Knitwear, Throws & Rugs Online India | Cozelle',
      desc: 'Browse the Cozelle collection: merino and hand-spun wool yarn, cable-knit throws, plaited wool rugs and cosy knitwear. Free delivery across India and 7-day easy returns.'
    },
    about: {
      title: 'About Cozelle | Natural Wool Yarn, Knitwear & Home Textiles',
      desc: 'The story behind Cozelle: natural-fibre wool yarn, throws, rugs and knitwear that are finished by hand, checked with care and made to last for years.'
    },
    contact: {
      title: 'Contact Cozelle | Order Help & Enquiries on WhatsApp',
      desc: 'Questions about an order, a yarn or a piece you have in mind? Message Cozelle on WhatsApp and we will get back to you soon.'
    }
  };
  const PATH = { home: '/', collection: '/collection', about: '/about', contact: '/contact' };
  const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
  const abs = u => !u ? '' : /^https?:\/\//i.test(u) ? u : SEO_ORIGIN + '/' + String(u).replace(/^\.?\//, '');
  const img = (u, w) => abs(typeof cld === 'function' ? cld(u, w) : u);

  function meta(attr, key, val) {
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!val) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
    el.setAttribute('content', val);
  }
  function link(rel, href, extra) {
    let el = document.head.querySelector(`link[rel="${rel}"]${extra ? `[hreflang="${extra}"]` : ''}`);
    if (!el) { el = document.createElement('link'); el.rel = rel; if (extra) el.hreflang = extra; document.head.appendChild(el); }
    el.href = href;
  }
  function ld(id, obj) {
    let el = document.getElementById(id);
    if (!obj) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = id; document.head.appendChild(el); }
    el.textContent = JSON.stringify(obj);
  }
  const crumbs = items => ({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c[0], item: SEO_ORIGIN + c[1] }))
  });

  function productLd(D, P) {
    const cur = 'INR';
    const photos = [P.image, ...(P.gallery || []).map(g => g && g.image)].filter(u => u && !/\.(mp4|webm|mov)(\?|$)/i.test(u) && !/\/video\/upload\//.test(u)).slice(0, 6).map(u => img(u, 1200));
    const inStock = typeof Stock !== 'undefined' ? Stock.available(P) : true;
    const price = typeof Price !== 'undefined' ? Price.unit(P) : P.price;
    const until = new Date(); until.setFullYear(until.getFullYear() + 1);
    return {
      '@context': 'https://schema.org', '@type': 'Product',
      '@id': SEO_ORIGIN + '/product?id=' + encodeURIComponent(P.id) + '#product',
      name: P.name, sku: P.id, category: P.category || undefined,
      description: clip(P.description || P.name, 500),
      image: photos, brand: { '@type': 'Brand', name: D.site.name || 'Cozelle' },
      offers: {
        '@type': 'Offer', url: SEO_ORIGIN + '/product?id=' + encodeURIComponent(P.id),
        priceCurrency: cur, price: String(price), priceValidUntil: until.toISOString().slice(0, 10),
        itemCondition: 'https://schema.org/NewCondition',
        availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: D.site.name || 'Cozelle' },
        shippingDetails: {
          '@type': 'OfferShippingDetails',
          shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'INR' },
          shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IN' }
        },
        hasMerchantReturnPolicy: {
          '@type': 'MerchantReturnPolicy', applicableCountry: 'IN',
          returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow', merchantReturnDays: 7
        }
      }
    };
  }

  function page(D, kind, P) {
    try {
      const name = (D.site && D.site.name) || 'Cozelle';
      const o = D.seo && D.seo[kind] || {};           // optional overrides stored in Firestore: seo.home.title ...
      let title, desc, path = PATH[kind], image = '', robots = 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1', type = 'website', graph = null, bc = null;
      if (kind === 'product') {
        if (!P) { title = name; desc = DEF.home.desc; path = '/collection'; robots = 'noindex,follow'; }
        else {
          path = '/product?id=' + encodeURIComponent(P.id);
          title = clip(`${P.name}${P.category ? ' - ' + P.category : ''} | ${name}`, 70);
          desc = clip(`${P.description || P.name} ${name}: natural fibres, free delivery across India, 7-day easy returns.`, 160);
          image = P.image; type = 'product'; graph = productLd(D, P);
          bc = crumbs([['Home', '/'], ['Collection', '/collection'], [P.name, path]]);
        }
      } else {
        title = o.title || DEF[kind].title;
        desc = o.desc || DEF[kind].desc;
        if (kind === 'about' && D.about && D.about.image) image = D.about.image;
        if (kind === 'home') image = (D.hero && D.hero.modelImage) || '';
        if (!image && D.site && D.site.logo) image = D.site.logo;
        if (kind === 'collection') {
          if (new URLSearchParams(location.search).get('q')) robots = 'noindex,follow';
          const ps = (D.products || []).filter(p => p.active !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          graph = {
            '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description: desc, url: SEO_ORIGIN + '/collection',
            mainEntity: { '@type': 'ItemList', numberOfItems: ps.length, itemListElement: ps.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SEO_ORIGIN + '/product?id=' + encodeURIComponent(p.id), name: p.name })) }
          };
        }
        if (kind === 'about') graph = { '@context': 'https://schema.org', '@type': 'AboutPage', name: title, url: SEO_ORIGIN + '/about', description: desc };
        if (kind === 'contact') graph = { '@context': 'https://schema.org', '@type': 'ContactPage', name: title, url: SEO_ORIGIN + '/contact', description: desc };
        if (kind !== 'home') bc = crumbs([['Home', '/'], [kind[0].toUpperCase() + kind.slice(1), path]]);
      }
      const url = SEO_ORIGIN + path;
      document.title = title;
      meta('name', 'description', desc);
      meta('name', 'robots', robots);
      link('canonical', url);
      link('alternate', url, 'en-IN');
      link('alternate', url, 'x-default');
      meta('property', 'og:type', type);
      meta('property', 'og:site_name', name);
      meta('property', 'og:locale', 'en_IN');
      meta('property', 'og:title', title);
      meta('property', 'og:description', desc);
      meta('property', 'og:url', url);
      meta('property', 'og:image', image ? img(image, 1200) : '');
      meta('property', 'og:image:alt', P ? P.name : name);
      meta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
      meta('name', 'twitter:title', title);
      meta('name', 'twitter:description', desc);
      meta('name', 'twitter:image', image ? img(image, 1200) : '');
      if (P) { meta('property', 'product:price:amount', String(typeof Price !== 'undefined' ? Price.unit(P) : P.price)); meta('property', 'product:price:currency', 'INR'); }
      ld('seo-ld', graph);
      ld('seo-bc', bc);
    } catch (e) { console.warn('SEO', e); }
  }
  return { page };
})();
