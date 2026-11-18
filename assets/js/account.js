
(() => {
 'use strict';
 const auth = (() => { try { return firebase.auth(); } catch (e) { console.warn('Firebase Auth unavailable', e); return null; } })();
 const A = () => D.acct;
 const q = (s, r) => (r || document).querySelector(s);
 const PIN_RE = /^\d{6}$/;
 const STEPS = ['new', 'confirmed', 'shipped', 'delivered'];

 const isCust = em => typeof em === 'string' && em.toLowerCase().endsWith('@' + CUSTOMER_DOMAIN);
 const me = () => { const u = auth && auth.currentUser; return u && isCust(u.email) ? u : null; };
 const phoneOf = u => u.email.split('@')[0];
 const emailOf = digits => digits + '@' + CUSTOMER_DOMAIN;

 function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10) d = '91' + d;
  return d.length >= 11 && d.length <= 15 ? d : '';
 }
 const fmt = d => d.length === 12 && d.startsWith('91') ? '+91 ' + d.slice(2, 7) + ' ' + d.slice(7) : '+' + d;
 const initial = u => ((u && u.displayName) || cust.name || '').trim().charAt(0) || '✓';

 function errMsg(e, ctx) {
  const t = A().err, c = (e && e.code) || '';
  if (c === 'auth/email-already-in-use') return ctx === 'checkout' ? t.existsWrong : t.exists;
  if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return ctx === 'checkout' ? t.existsWrong : t.wrong;
  if (c === 'auth/too-many-requests') return t.tooMany;
  if (c === 'auth/network-request-failed') return t.network;
  if (c === 'auth/weak-password' || c === 'auth/password-does-not-meet-requirements') return t.policy;
  if (/operation-not-allowed|configuration-not-found|admin-restricted/.test(c)) { console.error('Enable Email/Password in Firebase Authentication', e); return t.unavailable; }
  console.error('account error', e);
  return t.generic;
 }

 async function signup(phone, pin, name) {
  const u = (await auth.createUserWithEmailAndPassword(emailOf(phone), pin)).user;
  if (name) { try { await u.updateProfile({ displayName: name.slice(0, 60) }); } catch (e) { console.warn('name not saved', e); } }
  saveProfile({ name });
  renderAll(true);
  return u;
 }
 const login = async (phone, pin) => (await auth.signInWithEmailAndPassword(emailOf(phone), pin)).user;
 async function logout() {
  B.classList.remove('menu-open');
  try { await auth.signOut(); } catch (e) { console.warn(e); }
 }

 async function saveProfile(d) {
  const u = me();
  if (!u || !db) return;
  try {
   const p = { phone: phoneOf(u), updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
   ['name', 'address', 'city', 'pincode'].forEach(k => { if (d && d[k]) p[k] = String(d[k]).slice(0, 300); });
   await db.collection('customers').doc(u.uid).set(p, { merge: true });
  } catch (e) { console.warn('profile not saved', e); }
 }
 async function loadProfile(u) {
  if (!db) return;
  let p = {};
  try { const s = await db.collection('customers').doc(u.uid).get(); if (s.exists) p = s.data(); } catch (e) { console.warn('profile not loaded', e); }
  const now = me();
  if (!now || now.uid !== u.uid) return;
  let changed = false;
  const put = (k, v) => { if (v && !cust[k]) { cust[k] = v; changed = true; } };
  put('name', p.name || u.displayName); put('phone', fmt(phoneOf(u))); put('address', p.address); put('city', p.city); put('pincode', p.pincode);
  if (changed) { try { localStorage.setItem('cozelle-customer', JSON.stringify(cust)); } catch (e) {} renderFields(); }
 }
 function wipe() {
  Object.keys(cust).forEach(k => delete cust[k]);
  try { localStorage.removeItem('cozelle-customer'); localStorage.removeItem('cozelle-pending'); } catch (e) {}
  renderFields();
 }

 let orders = null, ordErr = false, unsub = null;
 const stamp = o => o.createdAt && o.createdAt.toMillis ? o.createdAt.toMillis() : 0;
 function stopOrders() { if (unsub) { unsub(); unsub = null; } orders = null; ordErr = false; }
 function startOrders(u) {
  stopOrders();
  if (!db) { orders = []; ordErr = true; renderOrders(); return; }
  unsub = db.collection('orders').where('uid', '==', u.uid).onSnapshot(s => {
   orders = s.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }) })).sort((a, b) => stamp(b) - stamp(a));
   ordErr = false;
   renderOrders();
  }, e => {
   console.warn('orders not loaded', e);
   orders = []; ordErr = true;
   renderOrders();
  });
 }
 function orderCard(o) {
  const t = A(), st = STEPS.indexOf(o.status) >= 0 || o.status === 'cancelled' ? o.status : 'new', at = STEPS.indexOf(st), pm = o.payment || {};
  const date = stamp(o) ? new Date(stamp(o)).toLocaleDateString(D.site.locale || 'en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const items = (o.items || []).map(i => {
   const p = (D.products || []).find(x => x.id === i.id), qty = Number(i.qty) || 1, price = Number(i.price) || 0;
   return `<div class="o-it"><div class="th">${p && p.image ? `<img loading="lazy" src="${esc(cld(p.image, 120))}" alt="">` : ''}</div><div><b>${esc(i.name)}</b><span>${money(price)} × ${qty}</span></div><em>${money(price * qty)}</em></div>`;
  }).join('');
  const pr = o.pricing, T2 = D.tax || {}, sub = pr ? [pr.discount > 0 ? [T2.discount, '−' + money(pr.discount)] : null, pr.gst > 0 ? (pr.gstMode === 'exclusive' ? [T2.gst, '+' + money(pr.gst)] : [T2.gstIncl, money(pr.gst)]) : null].filter(Boolean).map(x => `<div class="o-sub"><span>${esc(x[0])}</span><span>${x[1]}</span></div>`).join('') : '';
  const track = st === 'cancelled' ? '' : `<div class="o-track">${t.steps.map((s, k) => `<div class="o-step${k <= at ? ' on' : ''}${k === at ? ' now' : ''}">${esc(s)}</div>`).join('')}</div>`;
  return `<article class="o-card"><div class="o-top"><div><div class="o-ref">${esc(pm.ref || o.id.slice(0, 8))}</div><span class="o-date">${esc(date)}</span></div><span class="o-chip${st === 'cancelled' ? ' bad' : st === 'delivered' ? ' good' : ''}">${esc(t.status[st])}</span></div>${track}<div class="o-items">${items}</div>${sub}<div class="o-foot"><span>${esc(t.total)}</span><strong>${money(o.total)}</strong></div>${pm.utr ? `<div class="o-utr">${esc(t.utr)}: ${esc(pm.utr)}</div>` : ''}</article>`;
 }
 function renderOrders() {
  const box = $('ordList'), t = A();
  if (!box) return;
  if (ordErr) box.innerHTML = `<p class="o-msg">${esc(t.ordersErr)}</p>`;
  else if (orders === null) box.innerHTML = `<p class="o-msg">${esc(t.loadingOrders)}</p>`;
  else if (!orders.length) box.innerHTML = `<div class="o-empty"><p>${esc(t.noOrders)}</p><button type="button" class="co" data-acct="shop">${esc(t.browse)}</button></div>`;
  else box.innerHTML = orders.map(orderCard).join('');
 }

 const menuBox = document.createElement('div');
 menuBox.className = 'acct-menu'; menuBox.id = 'menuAcct';
 q('#menu nav').after(menuBox);

 const panel = document.createElement('aside');
 panel.className = 'panel'; panel.id = 'acct';
 panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true');
 panel.innerHTML = '<div class="ph-head"><h2 id="acctTitle"></h2><button type="button" class="x" data-close>×</button></div><div class="acct-body" id="acctBody"></div>';
 B.appendChild(panel);

 const form = $('coForm'), gate = document.createElement('div');
 gate.className = 'gate'; gate.id = 'gate';
 form.insertBefore(gate, q('button[type=submit]', form));

 let tab = 'login', needLogin = false, gateKey = null, panelKey = null;
 const keyOf = () => { const u = me(); return u ? u.uid : ''; };

 function renderMenu() {
  const t = A(), b = (v, l) => `<button type="button" data-acct="${v}">${esc(l)}</button>`;
  menuBox.innerHTML = me() ? b('orders', t.orders) + b('logout', t.logout) : b('login', t.menuLogin) + b('orders', t.orders);
 }
 function pinField(auto) {
  const t = A();
  return `<div class="pin-wrap"><input name="pin" class="pin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="${auto}" placeholder=" " title="${esc(t.err.pin)}"><button type="button" class="pin-eye" data-eye>${esc(t.show)}</button></div>`;
 }
 function renderGate(force) {
  const k = keyOf();
  if (!force && k === gateKey) return;
  gateKey = k;
  const t = A(), u = me();
  if (u) { gate.innerHTML = `<p class="gate-as">${esc(t.orderingAs)} <b>${esc(fmt(phoneOf(u)))}</b></p><button type="button" class="cof-back" data-acct="logout">${esc(t.notYou)}</button>`; return; }
  gate.innerHTML = `<label><span>${esc(t.pinNew)}</span><div class="pin-wrap"><input id="gatePin" class="pin" type="password" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="new-password" placeholder=" " title="${esc(t.err.pin)}"><button type="button" class="pin-eye" data-eye>${esc(t.show)}</button></div></label><p class="gate-hint">${esc(t.gateHint)}</p><p class="acct-err" id="gateErr" role="alert"></p>`;
 }
 function renderPanel(force) {
  const t = A(), u = me(), k = (u ? u.uid : 'out') + '|' + tab + '|' + needLogin, body = $('acctBody');
  if (!force && k === panelKey) { renderOrders(); return; }
  panelKey = k;
  $('acctTitle').textContent = u ? t.title : tab === 'signup' ? t.signupTitle : t.loginTitle;
  if (u) {
   body.innerHTML = `<div class="acct-me"><div class="acct-av">${esc(initial(u))}</div><div class="acct-who"><b>${esc(u.displayName || '')}</b><span>${esc(fmt(phoneOf(u)))}</span></div><button type="button" class="acct-out" data-acct="logout">${esc(t.logout)}</button></div><h3 class="acct-h">${esc(t.ordersTitle)}</h3><div id="ordList"></div>`;
   renderOrders();
   return;
  }
  const signup = tab === 'signup';
  const phoneIn = `<input name="phone" type="tel" inputmode="tel" autocomplete="username" pattern="[0-9+ ]{10,15}" required placeholder=" " value="${esc(cust.phone || '')}" title="${esc(t.err.phone)}">`;
  body.innerHTML = `${needLogin ? `<p class="acct-note">${esc(t.needLogin)}</p>` : ''}
   <div class="acct-tabs"><button type="button" data-tab="login" class="${signup ? '' : 'on'}">${esc(t.login)}</button><button type="button" data-tab="signup" class="${signup ? 'on' : ''}">${esc(t.signup)}</button></div>
   <form class="acct-form" id="aForm" data-mode="${signup ? 'signup' : 'login'}">
    ${signup ? `<label class="af"><span>${esc(t.name)}</span><input name="name" type="text" autocomplete="name" required placeholder=" " value="${esc(cust.name || '')}"></label>` : ''}
    <label class="af"><span>${esc(t.phone)}</span>${phoneIn}</label>
    <label class="af"><span>${esc(signup ? t.pinNew : t.pin)}</span>${pinField(signup ? 'new-password' : 'current-password')}</label>
    <p class="acct-hint">${esc(signup ? t.signupHint + ' ' + t.pinHint : t.pinHint)}</p>
    <p class="acct-err" role="alert"></p>
    <button class="co" type="submit">${esc(signup ? t.signupBtn : t.loginBtn)}</button>
    ${signup ? '' : `<a class="acct-link" target="_blank" rel="noopener" href="https://wa.me/${esc(D.site.whatsapp)}?text=${encodeURIComponent(t.forgotMsg)}">${esc(t.forgot)}</a>`}
   </form>`;
 }
 function renderAll(force) { renderMenu(); renderGate(force); renderPanel(force); }

 function open(view) {
  B.classList.remove('menu-open', 'cart-open', 'filters-open');
  needLogin = view === 'orders' && !me();
  tab = view === 'signup' ? 'signup' : 'login';
  renderPanel(true);
  B.classList.add('acct-open');
  panel.scrollTop = 0;
  if (!me()) setTimeout(() => { const f = q('#acctBody input'); if (f && !f.value) f.focus(); }, 450);
 }
 const closePanel = () => B.classList.remove('acct-open');

 let ensuring = false;
 async function ensure() {
  if (me()) return true;
  const t = A(), say = m => { const e = $('gateErr'); if (e) e.textContent = m || ''; };
  say('');
  if (!auth) { say(t.err.unavailable); return false; }
  const ph = q('[name="phone"]', form), nm = q('[name="name"]', form), pinEl = $('gatePin');
  const phone = normPhone(ph && ph.value), pin = (pinEl && pinEl.value) || '';
  if (!phone) { say(t.err.phone); if (ph) ph.focus(); return false; }
  if (!PIN_RE.test(pin)) { say(t.err.pin); if (pinEl) pinEl.focus(); return false; }
  if (ensuring) return false;
  ensuring = true;
  const go = q('button[type=submit]', form), label = go.textContent;
  go.disabled = true; go.textContent = t.creating;
  try {
   try { await signup(phone, pin, ((nm && nm.value) || '').trim()); }
   catch (e) {
    if (e && e.code === 'auth/email-already-in-use') await login(phone, pin);
    else throw e;
   }
   return !!me();
  } catch (e) {
   say(errMsg(e, 'checkout'));
   return false;
  } finally {
   ensuring = false; go.disabled = false; go.textContent = label;
  }
 }

 let busy = false;
 document.addEventListener('click', e => {
  const eye = e.target.closest('[data-eye]');
  if (eye) {
   const i = q('input', eye.parentElement), show = i.type === 'password';
   i.type = show ? 'text' : 'password';
   eye.textContent = show ? A().hide : A().show;
   return;
  }
  const a = e.target.closest('[data-acct]');
  if (a) {
   const v = a.dataset.acct;
   if (v === 'logout') logout();
   else if (v === 'shop') { closePanel(); const s = $('shop'); if (s) s.scrollIntoView(); else location.href = 'collection'; }
   else open(v);
   return;
  }
  const tb = e.target.closest('#acct [data-tab]');
  if (tb) { tab = tb.dataset.tab; needLogin = false; renderPanel(true); return; }
  if (e.target.closest('#acct [data-close]') || e.target.id === 'scrim') closePanel();
 });
 document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanel(); });
 document.addEventListener('input', e => {
  const el = e.target;
  if (el.classList && el.classList.contains('pin')) { const v = el.value.replace(/\D/g, '').slice(0, 6); if (v !== el.value) el.value = v; }
 });
 panel.addEventListener('submit', async e => {
  const f = e.target.closest('#aForm');
  if (!f) return;
  e.preventDefault();
  if (busy) return;
  const t = A(), mode = f.dataset.mode, say = f.querySelector('.acct-err'), go = f.querySelector('button[type=submit]');
  const val = n => { const el = f.elements.namedItem(n); return el ? el.value : ''; };
  const phone = normPhone(val('phone')), pin = val('pin'), name = mode === 'signup' ? val('name').trim() : '';
  say.textContent = '';
  if (!auth) { say.textContent = t.err.unavailable; return; }
  if (mode === 'signup' && !name) { say.textContent = t.err.name; return; }
  if (!phone) { say.textContent = t.err.phone; return; }
  if (!PIN_RE.test(pin)) { say.textContent = t.err.pin; return; }
  busy = true;
  const label = go.textContent;
  go.disabled = true; go.textContent = mode === 'signup' ? t.creating : t.loggingIn;
  try { if (mode === 'signup') await signup(phone, pin, name); else await login(phone, pin); }
  catch (err) { say.textContent = errMsg(err, mode); go.disabled = false; go.textContent = label; }
  busy = false;
 });

 let lastUid = null;
 if (auth) auth.onAuthStateChanged(u => {
  const c = u && isCust(u.email) ? u : null, was = lastUid;
  lastUid = c ? c.uid : null;
  if (c) { if (was !== c.uid) { startOrders(c); loadProfile(c); } }
  else { stopOrders(); if (was) wipe(); }
  renderAll();
 });
 renderAll(true);

 window.Account = {
  user: me,
  open,
  ensure,
  afterOrder: d => saveProfile(d)
 };
})();
