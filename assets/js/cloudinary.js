/* Cozelle + Cloudinary. Every image on the site is uploaded to and delivered from Cloudinary.
   Shared by every page and by admin.html. Load it BEFORE cozelle-data.js.

   Only PUBLIC values live here (cloud name + unsigned upload preset names). Never put your
   Cloudinary API secret in any file of this site. See README.md, "Cloudinary setup". */
const CLOUDINARY = {
  cloudName: 'qmjuurif',
  sitePreset: 'cozelle_site',         /* unsigned preset used by admin.html (logo, products, hero, about, gallery) */
  paymentPreset: 'cozelle_payments'   /* unsigned preset used by checkout for payment screenshots */
};

/* ---------- delivery: turn a stored Cloudinary URL into an optimised one ----------
   cld(url, 900)  ->  .../image/upload/f_auto,q_auto,w_900,c_limit/v123/cozelle/site/abc.jpg
   f_auto = best format for the browser (AVIF/WebP/JPEG), q_auto = smart compression, c_limit = never upscale.
   Anything that is not a Cloudinary upload URL (old Firebase/Unsplash links, local files) is returned unchanged,
   so the site keeps working until you press "Move images to Cloudinary" once in admin.html. */
const CLD_URL = /^(https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(.+)$/;
function cld(url, w, o) {
  if (typeof url !== 'string') return url;
  const m = url.match(CLD_URL);
  if (!m || !/^v\d+\//.test(m[2])) return url;   /* not ours, or it already carries its own transformation */
  o = o || {};
  const t = ['f_auto', 'q_auto' + (o.eco ? ':eco' : '')];
  if (w) t.push('w_' + Math.round(w), 'c_limit');
  return m[1] + t.join(',') + '/' + m[2];
}
const isCld = u => typeof u === 'string' && CLD_URL.test(u);

/* ---------- upload: browser -> Cloudinary (unsigned preset) ----------
   file: a File/Blob, or a public http(s) URL (Cloudinary fetches it itself; used to migrate old images).
   Resolves with Cloudinary's JSON; use .secure_url. Rejects with Error(message) and code 'cloudinary'. */
async function cldUpload(file, opts) {
  opts = opts || {};
  const fd = new FormData();
  if (typeof file === 'string') fd.append('file', file);
  else fd.append('file', file, opts.filename || file.name || 'upload.jpg');
  fd.append('upload_preset', opts.preset || CLOUDINARY.sitePreset);
  if (opts.tags && opts.tags.length) fd.append('tags', opts.tags.join(','));
  let r, j = {};
  try {
    r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY.cloudName + '/image/upload', { method: 'POST', body: fd });
    j = await r.json().catch(() => ({}));
  } catch (e) {
    const err = new Error('Could not reach Cloudinary. Check your connection.');
    err.code = 'network';
    throw err;
  }
  if (!r.ok || !j.secure_url) {
    const err = new Error((j.error && j.error.message) || ('Cloudinary upload failed (' + r.status + ')'));
    err.code = 'cloudinary';
    throw err;
  }
  return j;
}
