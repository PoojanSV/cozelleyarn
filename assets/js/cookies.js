

(() => {
 'use strict';
 const KEY = 'cozelle-cookies';
 try { if (localStorage.getItem(KEY)) return; } catch (e) {}

 const T = {
  title: 'Cookies & browser storage',
  text: 'We only use essential cookies and browser storage: to keep your bag, remember your delivery details and keep you logged in. We do not use advertising or tracking cookies.',
  ok: 'Got it',
  more: 'What we store',
  less: 'Hide details',
  items: [
   ['Your bag and delivery details', 'Saved on this device so they are still here when you come back.'],
   ['Your login', 'Kept by Firebase so you stay logged in, only if you create an account.'],
   ['This notice', 'Remembers that you have seen it.'],
   ['Fonts, photos and data', 'Loaded from Google Fonts, Cloudinary and Firebase to show the shop.']
  ]
 };
 const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

 const css = document.createElement('style');
 css.textContent = `
.ck{position:fixed;z-index:65;left:max(18px,env(safe-area-inset-left));bottom:max(18px,env(safe-area-inset-bottom));width:min(430px,calc(100vw - 36px));
 padding:22px 22px 18px;border-radius:26px;color:var(--cocoa,#4a2b1b);font-family:var(--sans,'Jost',system-ui,sans-serif);font-weight:300;
 background:rgba(244,232,211,.94);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);box-shadow:0 30px 60px -24px rgba(74,43,27,.55);
 opacity:0;transform:translateY(24px);visibility:hidden;transition:opacity .6s,transform .6s cubic-bezier(.2,.8,.2,1),visibility .6s}
.ck.show{opacity:1;transform:none;visibility:visible}
.ck h2{font-family:var(--serif,'Cormorant Garamond',Georgia,serif);font-weight:500;font-size:26px;line-height:1.1;color:var(--copper-d,#8e4a2a);margin-bottom:8px}
.ck p{font-size:14px;line-height:1.65;color:rgba(74,43,27,.82)}
.ck ul{list-style:none;margin:14px 0 0;padding:14px 16px;border-radius:18px;background:rgba(181,105,63,.1);display:grid;gap:10px}
.ck ul[hidden]{display:none}
.ck li{font-size:13px;line-height:1.5;color:rgba(74,43,27,.82)}
.ck li b{display:block;font-weight:500;color:var(--copper-d,#8e4a2a)}
.ck .row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 18px;margin-top:16px}
.ck button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
.ck .ok{padding:13px 30px;border-radius:30px;background:var(--copper,#b5693f);color:var(--cream,#f4e8d3);font-size:11px;letter-spacing:.26em;text-transform:uppercase;font-weight:500;transition:background .3s}
.ck .ok:hover{background:var(--copper-d,#8e4a2a)}
.ck .more{padding:8px 2px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--copper-d,#8e4a2a)}
.ck .more:hover{color:var(--copper,#b5693f)}
.ck button:focus-visible{outline:2px solid var(--copper,#b5693f);outline-offset:3px}
@media(max-width:600px){.ck{left:12px;right:12px;width:auto;bottom:max(12px,env(safe-area-inset-bottom));padding:18px 18px 14px;border-radius:22px}.ck h2{font-size:23px}.ck .ok{flex:1;text-align:center}}
@media(prefers-reduced-motion:reduce){.ck{transition:none;transform:none}}`;
 document.head.appendChild(css);

 const box = document.createElement('div');
 box.className = 'ck';
 box.setAttribute('role', 'dialog');
 box.setAttribute('aria-labelledby', 'ckT');
 box.innerHTML = `<h2 id="ckT">${esc(T.title)}</h2><p>${esc(T.text)}</p>
  <ul id="ckL" hidden>${T.items.map(i => `<li><b>${esc(i[0])}</b>${esc(i[1])}</li>`).join('')}</ul>
  <div class="row"><button type="button" class="ok" id="ckOk">${esc(T.ok)}</button><button type="button" class="more" id="ckMore" aria-expanded="false" aria-controls="ckL">${esc(T.more)}</button></div>`;
 document.body.appendChild(box);

 const list = box.querySelector('#ckL'), more = box.querySelector('#ckMore');
 more.addEventListener('click', () => {
  const open = list.hidden;
  list.hidden = !open;
  more.setAttribute('aria-expanded', String(open));
  more.textContent = open ? T.less : T.more;
 });
 box.querySelector('#ckOk').addEventListener('click', () => {
  try { localStorage.setItem(KEY, '1'); } catch (e) {}
  box.classList.remove('show');
  setTimeout(() => box.remove(), 700);
 });

 const loader = document.getElementById('loader');
 const wait = loader && !loader.classList.contains('done') ? 3200 : 900;
 setTimeout(() => box.classList.add('show'), wait);
})();
