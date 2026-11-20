
const CLOUDINARY = {
  cloudName: 'qmjuurif',
  sitePreset: 'cozelle_site',
  paymentPreset: 'cozelle_payments'
};

const CLD_URL = /^(https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(.+)$/;
function cld(url, w, o) {
  if (typeof url !== 'string') return url;
  // a video used where a picture is expected (thumbnails, bag, orders) shows its first frame
  if (isCldVideo(url)) return cldPoster(url, w);
  const m = url.match(CLD_URL);
  if (!m || !/^v\d+\//.test(m[2])) return url;
  o = o || {};
  const t = ['f_auto', 'q_auto' + (o.eco ? ':eco' : '')];
  if (w) t.push('w_' + Math.round(w), 'c_limit');
  return m[1] + t.join(',') + '/' + m[2];
}
const isCld = u => typeof u === 'string' && CLD_URL.test(u);
// srcset for a Cloudinary picture ('' for anything else): the browser picks the width it needs
function cldSet(url, widths) {
  if (!isCld(url) || isCldVideo(url) || !/^v\d+\//.test(url.match(CLD_URL)[2])) return '';
  return widths.map(w => cld(url, w) + ' ' + Math.round(w) + 'w').join(', ');
}

// ---- Video helpers ----
const CLD_VIDEO = /^(https?:\/\/res\.cloudinary\.com\/[^\/]+\/video\/upload\/)(.+)$/;
const isCldVideo = u => typeof u === 'string' && CLD_VIDEO.test(u);
function cldVidParts(url) {
  if (typeof url !== 'string') return null;
  const m = url.match(CLD_VIDEO);
  if (!m || !/^v\d+\//.test(m[2])) return null;
  return { base: m[1], id: m[2].replace(/\.[a-z0-9]+$/i, '') };
}
// Playable video for any browser: MP4 + H.264, compressed, limited width.
// Non-Cloudinary links (a direct .mp4 for example) are returned unchanged.
function cldVideo(url, w) {
  const p = cldVidParts(url);
  if (!p) return url;
  const t = ['f_mp4', 'vc_h264', 'q_auto'];
  if (w) t.push('w_' + Math.round(w), 'c_limit');
  return p.base + t.join(',') + '/' + p.id + '.mp4';
}
// Still frame of the video, used as the poster and the thumbnail. '' when it cannot be made.
function cldPoster(url, w) {
  const p = cldVidParts(url);
  if (!p) return '';
  const t = ['so_0', 'f_jpg', 'q_auto'];
  if (w) t.push('w_' + Math.round(w), 'c_limit');
  return p.base + t.join(',') + '/' + p.id + '.jpg';
}

// Any video link: Cloudinary video, or a direct .mp4 / .webm / .mov / .m4v link
const isVideoUrl = u => typeof u === 'string' && (isCldVideo(u) || /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(u));
const _va = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
// Picture OR video for a card / preview. A video autoplays muted on a loop (media.js keeps it
// playing only while visible); it has no controls, tapping the card still opens the product.
function cldMedia(url, w, alt, cls, opt) {
  opt = opt || {};
  if (isVideoUrl(url)) {
    const poster = cldPoster(url, w);
    return '<video class="vid-auto' + (cls ? ' ' + cls : '') + '" src="' + _va(cldVideo(url, Math.min(w || 720, 720))) + '"' +
      (poster ? ' poster="' + _va(poster) + '"' : '') +
      ' muted loop playsinline autoplay preload="metadata" disablepictureinpicture disableremoteplayback tabindex="-1" aria-label="' + _va(alt || '') + '"></video>';
  }
  const set = w ? cldSet(url, [0.4, 0.6, 0.8, 1].map(k => w * k)) : '';
  return '<img' + (cls ? ' class="' + cls + '"' : '') + (opt.eager ? ' fetchpriority="high"' : ' loading="lazy"') + ' decoding="async" src="' + _va(cld(url, w)) + '"' +
    (set ? ' srcset="' + _va(set) + '" sizes="' + _va(opt.sizes || '(max-width:700px) 50vw, 380px') + '"' : '') + ' alt="' + _va(alt || '') + '">';
}

// Upload with real progress. opts.onProgress({loaded,total,pct,done}) is called while sending;
// done:true means the bytes are all sent and Cloudinary is now processing the file.
// opts.signal (AbortController signal) cancels the upload (error.code === 'abort').
async function cldUpload(file, opts) {
  opts = opts || {};
  const fd = new FormData();
  if (typeof file === 'string') fd.append('file', file);
  else fd.append('file', file, opts.filename || file.name || 'upload.jpg');
  fd.append('upload_preset', opts.preset || CLOUDINARY.sitePreset);
  if (opts.tags && opts.tags.length) fd.append('tags', opts.tags.join(','));
  const kind = opts.resource === 'video' ? 'video' : 'image';
  const url = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY.cloudName + '/' + kind + '/upload';
  const out = await new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    const fail = (msg, code) => { const e = new Error(msg); e.code = code; reject(e); };
    x.open('POST', url);
    if (x.upload && opts.onProgress) {
      x.upload.onprogress = ev => {
        if (!ev.lengthComputable) return;
        opts.onProgress({ loaded: ev.loaded, total: ev.total, pct: Math.min(100, Math.round(ev.loaded / ev.total * 100)), done: false });
      };
      x.upload.onload = () => opts.onProgress({ loaded: 1, total: 1, pct: 100, done: true });
    }
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch (e) {} resolve({ status: x.status, j }); };
    x.onerror = () => fail('Could not reach Cloudinary. Check your connection.', 'network');
    x.ontimeout = () => fail('The upload timed out. Please try again.', 'network');
    x.onabort = () => fail('Upload cancelled.', 'abort');
    if (opts.signal) {
      if (opts.signal.aborted) return fail('Upload cancelled.', 'abort');
      opts.signal.addEventListener('abort', () => x.abort());
    }
    x.send(fd);
  });
  const j = out.j;
  if (out.status < 200 || out.status >= 300 || !j.secure_url) {
    const err = new Error((j.error && j.error.message) || ('Cloudinary upload failed (' + out.status + ')'));
    err.code = 'cloudinary';
    throw err;
  }
  return j;
}
