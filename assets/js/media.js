/* Shared by every shop page.
   1. Autoplaying videos (<video class="vid-auto">): muted, looping, play only while on screen.
   2. Scroll guard: opening / closing the bag, menu or filters never throws the page back to the top.
   3. Ux.keepScroll(fn): run any re-render without losing the scroll position.            */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 1. autoplay while visible ----------
  const wanted = new WeakMap();           // video -> true when the visitor has NOT paused it
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (wanted.get(v) !== false) play(v); }
    else v.pause();
  }), { threshold: 0.35 }) : null;

  function play(v) {
    if (reduce && !v.dataset.userPlay) return;
    v.muted = true; v.defaultMuted = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  }
  function arm(v) {
    if (v._armed) return; v._armed = true;
    v.muted = true; v.loop = true; v.playsInline = true;
    v.removeAttribute('controls');
    v.addEventListener('contextmenu', e => e.preventDefault());
    if (io) io.observe(v); else play(v);
  }
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches('video.vid-auto')) arm(root);
    root.querySelectorAll && root.querySelectorAll('video.vid-auto').forEach(arm);
  }
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(scan))).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('DOMContentLoaded', () => scan(document.body));
  // pause everything while the tab is hidden, resume what was playing
  document.addEventListener('visibilitychange', () => {
    document.querySelectorAll('video.vid-auto').forEach(v => {
      if (document.hidden) v.pause();
      else if (wanted.get(v) !== false) {
        const r = v.getBoundingClientRect();
        if (r.bottom > 0 && r.top < innerHeight) play(v);
      }
    });
  });

  // ---------- 2. scroll guard ----------
  let lastY = scrollY, locked = false;
  addEventListener('scroll', () => { if (!locked) lastY = scrollY; }, { passive: true });
  const LOCK = /\b(menu-open|cart-open|filters-open|lock)\b/;
  new MutationObserver(() => {
    const now = LOCK.test(document.body.className);
    if (now && !locked) { locked = true; }
    else if (!now && locked) {
      locked = false;
      // some browsers reset the scroll when body overflow is toggled: put it back
      if (scrollY <= 1 && lastY > 50) scrollTo({ top: lastY, behavior: 'instant' });
    }
  }).observe(document.body || document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // ---------- 3. keep scroll across a re-render ----------
  function keepScroll(fn) {
    const y = scrollY, hold = document.getElementById('sections');
    if (hold) hold.style.minHeight = hold.offsetHeight + 'px';
    const r = fn();
    if (scrollY !== y) scrollTo({ top: y, behavior: 'instant' });
    if (hold) requestAnimationFrame(() => { hold.style.minHeight = ''; });
    return r;
  }

  window.Ux = { keepScroll, playVideo: play, wanted };
})();
