
const CLOUDINARY = {
  cloudName: 'qmjuurif',
  sitePreset: 'cozelle_site',
  paymentPreset: 'cozelle_payments'
};

const CLD_URL = /^(https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(.+)$/;
function cld(url, w, o) {
  if (typeof url !== 'string') return url;
  const m = url.match(CLD_URL);
  if (!m || !/^v\d+\//.test(m[2])) return url;
  o = o || {};
  const t = ['f_auto', 'q_auto' + (o.eco ? ':eco' : '')];
  if (w) t.push('w_' + Math.round(w), 'c_limit');
  return m[1] + t.join(',') + '/' + m[2];
}
const isCld = u => typeof u === 'string' && CLD_URL.test(u);

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

async function cldUpload(file, opts) {
  opts = opts || {};
  const fd = new FormData();
  if (typeof file === 'string') fd.append('file', file);
  else fd.append('file', file, opts.filename || file.name || 'upload.jpg');
  fd.append('upload_preset', opts.preset || CLOUDINARY.sitePreset);
  if (opts.tags && opts.tags.length) fd.append('tags', opts.tags.join(','));
  let r, j = {};
  try {
    const kind = opts.resource === 'video' ? 'video' : 'image';
    r = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY.cloudName + '/' + kind + '/upload', { method: 'POST', body: fd });
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
