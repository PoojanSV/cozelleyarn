#!/usr/bin/env node
/* Build step. Run it after editing any .js, .css or image, then deploy.
 *
 *   cd tools && npm install     (first time only)
 *   node tools/build.js
 *
 * 1. Minifies every assets/js/*.js (and vendor/qrcode.js) into a *.min.js file next to it.
 *    The readable files stay the ones you edit; the pages load the .min.js files.
 * 2. Rewrites the asset links in every .html page to  file?v=<hash>  (and points scripts at
 *    their .min.js). The hash changes only when the file changes, so the files can be cached
 *    for a year (see firebase.json / _headers) and visitors still get an update straight away.
 */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
let terser;
try { terser = require('terser'); } catch (e) { console.error('terser is missing. Run: cd tools && npm install'); process.exit(1); }

const root = path.join(__dirname, '..');
const jsDir = path.join(root, 'assets', 'js');
const sources = fs.readdirSync(jsDir).filter(f => f.endsWith('.js') && !f.endsWith('.min.js')).concat(['vendor/qrcode.js']);

const hash = file => crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex').slice(0, 8);
const kb = n => (n / 1024).toFixed(1) + ' KB';

(async () => {
  let before = 0, after = 0;
  for (const f of sources) {
    const src = path.join(jsDir, f), out = src.replace(/\.js$/, '.min.js');
    const code = fs.readFileSync(src, 'utf8');
    // top-level names are NOT renamed: the page scripts share globals (D, cld, Account ...)
    const r = await terser.minify(code, { compress: { passes: 2 }, mangle: true, format: { comments: /license|copyright|@preserve/i } });
    if (r.error || !r.code) { console.error('minify failed:', f, r.error); process.exit(1); }
    fs.writeFileSync(out, r.code);
    before += Buffer.byteLength(code); after += Buffer.byteLength(r.code);
    console.log('  min  ' + f.padEnd(24) + kb(Buffer.byteLength(code)).padStart(9) + ' -> ' + kb(Buffer.byteLength(r.code)).padStart(8));
  }
  console.log('  scripts total ' + kb(before) + ' -> ' + kb(after));

  const REF = /(["'(])((?:\.\/)?assets\/(?:js|css|img)\/[A-Za-z0-9_\-./]+?\.(?:js|css|png|jpe?g|webp|svg))(\?v=[0-9a-f]{6,})?(?=["')])/g;
  const pages = fs.readdirSync(root).filter(f => f.endsWith('.html'));
  for (const page of pages) {
    const file = path.join(root, page);
    const html = fs.readFileSync(file, 'utf8');
    const next = html.replace(REF, (all, q, ref) => {
      let p = ref.replace(/^\.\//, '');
      if (/\.js$/.test(p) && !/\.min\.js$/.test(p)) { const m = p.replace(/\.js$/, '.min.js'); if (fs.existsSync(path.join(root, m))) p = m; }
      const abs = path.join(root, p);
      return fs.existsSync(abs) ? q + p + '?v=' + hash(abs) : all;
    });
    if (next !== html) { fs.writeFileSync(file, next); console.log('  link ' + page + ' updated'); }
  }
})();
