// Builds sitemap.xml from your LIVE Firestore products (public read, same as the website).
// Run after adding/removing products:   node tools/generate-sitemap.js https://your-domain.com
// Node 18+ needed. Then deploy:         firebase deploy --only hosting
const fs = require('fs'), path = require('path');
const ORIGIN = (process.argv[2] || 'https://cozelleyarn.shop').replace(/\/$/, '');
const PROJECT = 'ems-45c2c';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
(async () => {
  let products = [];
  try {
    let tok = '';
    do {
      const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/products?pageSize=300${tok ? '&pageToken=' + tok : ''}`);
      if (!r.ok) throw new Error(r.status + ' ' + await r.text());
      const j = await r.json();
      (j.documents || []).forEach(d => {
        const f = d.fields || {}, id = d.name.split('/').pop();
        if (f.active && f.active.booleanValue === false) return;
        const v = k => f[k] && (f[k].stringValue ?? f[k].integerValue ?? f[k].doubleValue);
        products.push({ id, image: v('image'), upd: d.updateTime, name: v('name'), category: v('category'), price: Number(v('price')) || 0, discount: Number(v('discount')) || 0, desc: v('description'), order: Number(v('order')) || 0 });
      });
      tok = j.nextPageToken || '';
    } while (tok);
  } catch (e) { console.error('Could not read Firestore:', e.message);
    if (process.env.CI) process.exit(1);   // in automation never overwrite a good sitemap with defaults
    products = ['cable-knit-throw','cloud-merino-yarn','cream-wool-skeins','hand-spun-wool','plaited-wool-rug','ivory-knit-pullover','cloud-knit-sweater','sunday-lounge-knit'].map(id => ({ id })); }
  const today = new Date().toISOString().slice(0, 10);
  const u = (loc, pr, ch, last, img) => `  <url><loc>${esc(ORIGIN + loc)}</loc>${last ? `<lastmod>${last}</lastmod>` : ''}<changefreq>${ch}</changefreq><priority>${pr}</priority>${img && /^https?:/.test(img) && !/unsplash\.com/.test(img) ? `<image:image><image:loc>${esc(img)}</image:loc></image:image>` : ''}</url>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    [u('/', '1.0', 'weekly'), u('/collection', '0.9', 'daily'), u('/about', '0.5', 'monthly'), u('/contact', '0.5', 'monthly'),
     ...products.map(p => u('/product?id=' + encodeURIComponent(p.id), '0.8', 'weekly', p.upd && p.upd.slice(0, 10), p.image))].join('\n') + '\n</urlset>\n';
  fs.writeFileSync(path.join(__dirname, '..', 'sitemap.xml'), xml);
  const named = products.filter(p => p.name).sort((a, b) => a.order - b.order);
  if (named.length) {
    const txt = `# Cozelle - product catalogue\n\nIndian online store for wool yarn, throws, rugs and knitwear. Free delivery across India, 7-day returns, pay by UPI. Prices in INR (include GST).\nStore: ${ORIGIN}/\n\n` +
      named.map(p => { const now = p.discount > 0 && p.discount < 100 ? Math.round(p.price * (100 - p.discount) / 100) : p.price;
        return `## ${p.name}\n- Category: ${p.category || '-'}\n- Price: Rs. ${now}${now !== p.price ? ` (MRP Rs. ${p.price}, ${p.discount}% off)` : ''}\n- URL: ${ORIGIN}/product?id=${encodeURIComponent(p.id)}\n${p.desc ? '- About: ' + String(p.desc).replace(/\s+/g, ' ') + '\n' : ''}`; }).join('\n');
    fs.writeFileSync(path.join(__dirname, '..', 'llms-full.txt'), txt);
  }
  console.log('sitemap.xml written with', products.length, 'products');
})();
