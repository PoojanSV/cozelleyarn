
(() => {
 'use strict';
 const auth = (() => { try { return firebase.auth(); } catch (e) { console.warn('Firebase Auth unavailable', e); return null; } })();
 const A = () => D.acct;
 const q = (s, r) => (r || document).querySelector(s);
 const PW_RE = /^.{6,128}$/;   // password: at least 6 characters (Firebase minimum)
 const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
 const STEPS = ['new', 'confirmed', 'shipped', 'delivered'];

 // Old accounts log in as <phone digits>@cozelle-phone.com + 6-digit PIN. New accounts use a real email + password.
 // Customers can log in with either an email or a phone number. After a phone login they are asked to add an email; the old account is upgraded in place (same Firebase uid), so its orders and saved details stay with it.
 const isLegacy = em => typeof em === 'string' && em.toLowerCase().endsWith('@' + CUSTOMER_DOMAIN);
 let custUser = null, myPhone = '', holdAuth = false, lastUid = null, skipEmail = false;
 const me = () => custUser;
 const phoneOf = u => isLegacy(u.email) ? u.email.split('@')[0] : myPhone;
 const emailOf = digits => digits + '@' + CUSTOMER_DOMAIN;

 function normPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '').replace(/^0+/, '');
  if (d.length === 10) d = '91' + d;
  return d.length >= 11 && d.length <= 15 ? d : '';
 }
 const fmt = d => d.length === 12 && d.startsWith('91') ? '+91 ' + d.slice(2, 7) + ' ' + d.slice(7) : '+' + d;
 const initial = u => ((u && u.displayName) || cust.name || '').trim().charAt(0) || (u && !isLegacy(u.email) && u.email ? u.email.charAt(0).toUpperCase() : '✓');

 const CRED = /invalid-credential|wrong-password|user-not-found|invalid-login/;
 const credErr = e => CRED.test((e && e.code) || '');
 const fail = code => Object.assign(new Error(code), { code });

 function errMsg(e, ctx) {
  const t = A().err, c = (e && e.code) || '';
  if (c === 'cz/verify-sent') return t.verifySent;
  if (c === 'cz/phone-taken') return t.phoneTaken;
  if (c === 'auth/requires-recent-login') return t.recent;
  if (c === 'auth/email-already-in-use') return ctx === 'upgrade' ? t.emailTaken : t.existsWrong;
  if (c === 'auth/invalid-email') return t.email;
  if (CRED.test(c)) return t.wrong;
  if (c === 'auth/too-many-requests') return t.tooMany;
  if (c === 'auth/network-request-failed') return t.network;
  if (c === 'auth/weak-password' || c === 'auth/password-does-not-meet-requirements') return t.policy;
  if (/operation-not-allowed|configuration-not-found|admin-restricted/.test(c)) { console.error('Enable Email/Password in Firebase Authentication', e); return t.unavailable; }
  console.error('account error', e);
  return t.generic;
 }

 const TS = () => firebase.firestore.FieldValue.serverTimestamp();
 const prof = (uid, data) => db ? db.collection('customers').doc(uid).set({ ...data, updatedAt: TS() }, { merge: true }) : Promise.resolve();
 const signIn = (email, pw) => auth.signInWithEmailAndPassword(email, pw).then(r => r.user);

 // Old phone + PIN account -> same account, new login email. The uid never changes, so orders and details stay.
 async function toNewEmail(u, email, phone) {
  myPhone = phone;
  try { await prof(u.uid, { phone }); } catch (e) { console.warn('phone not pinned to profile', e); }   // phone is kept on the profile before the login email changes
  try { await u.updateEmail(email); }
  catch (e) {
   if (e && e.code === 'auth/operation-not-allowed') { await u.verifyBeforeUpdateEmail(email); throw fail('cz/verify-sent'); }   // project has email enumeration protection on: the email changes once the link is opened
   throw e;
  }
  try { await u.getIdToken(true); } catch (e) {}
  try { await prof(u.uid, { email, phone }); } catch (e) { console.warn('email not saved to profile', e); }
  return u;
 }
 // Log in with email + password; if that account does not exist yet: upgrade an old phone account (phone + old PIN as password), else create a new one.
 async function ensureAccount({ email, phone, pw, name }) {
  try { return await signIn(email, pw); }
  catch (e) { if (!credErr(e)) throw e; }
  let old = null;
  try { old = await signIn(emailOf(phone), pw); }
  catch (e) { if (!credErr(e)) throw e; }
  if (old) return toNewEmail(old, email, phone);
  let taken = false;
  try { taken = ((await auth.fetchSignInMethodsForEmail(emailOf(phone))) || []).length > 0; } catch (e) {}
  if (taken) throw fail('cz/phone-taken');
  const u = (await auth.createUserWithEmailAndPassword(email, pw)).user;
  if (name) { try { await u.updateProfile({ displayName: name.slice(0, 60) }); } catch (e) { console.warn('name not saved', e); } }
  myPhone = phone;
  try { await prof(u.uid, { email, phone, ...(name ? { name: name.slice(0, 300) } : {}) }); } catch (e) { console.warn('profile not saved', e); }
  return u;
 }
 async function runAuth(fn) {
  const before = auth.currentUser && auth.currentUser.uid;
  holdAuth = true;
  try { const u = await fn(); adopt(u); return u; }
  catch (e) {
   const now = auth.currentUser;
   if (now && now.uid !== before) { try { await auth.signOut(); } catch (_) {} }
   throw e;
  }
  finally { holdAuth = false; }
 }
 function adopt(u) {
  custUser = u; lastUid = u.uid;
  startOrders(u); loadProfile(u);
  renderAll(true);
 }
 async function logout() {
  B.classList.remove('menu-open');
  try { await auth.signOut(); } catch (e) { console.warn(e); }
 }

 async function saveProfile(d) {
  const u = me();
  if (!u || !db) return;
  try {
   const p = { updatedAt: TS() }, ph = phoneOf(u);
   if (ph) p.phone = ph;
   if (!isLegacy(u.email)) p.email = u.email;
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
  if (p.phone) myPhone = String(p.phone);
  let changed = false;
  const put = (k, v) => { if (v && !cust[k]) { cust[k] = v; changed = true; } };
  const ph = phoneOf(now);
  put('name', p.name || u.displayName); if (ph) put('phone', fmt(ph)); put('address', p.address); put('city', p.city); put('pincode', p.pincode);
  if (changed) { try { localStorage.setItem('cozelle-customer', JSON.stringify(cust)); } catch (e) {} renderFields(); }
  renderPanel(true);
 }
 function wipe() {
  Object.keys(cust).forEach(k => delete cust[k]);
  myPhone = ''; skipEmail = false;
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
 function pwField(auto, id) {
  const t = A();
  return `<div class="pin-wrap"><input ${id ? `id="${id}" ` : ''}name="password" class="pin" type="password" minlength="6" maxlength="128" required autocomplete="${auto}" placeholder=" " title="${esc(t.err.pin)}"><button type="button" class="pin-eye" data-eye>${esc(t.show)}</button></div>`;
 }
 function renderGate(force) {
  const k = keyOf();
  if (!force && k === gateKey) return;
  gateKey = k;
  const t = A(), u = me();
  const emailBox = hint => `<label><span>${esc(t.gateEmail)}</span><input id="gateEmail" type="email" inputmode="email" autocomplete="email" required placeholder=" " title="${esc(t.err.email)}"></label>${hint ? `<p class="gate-hint">${esc(hint)}</p>` : ''}`;
  if (u) {
   const legacy = isLegacy(u.email), who = legacy ? fmt(phoneOf(u)) : u.email;
   gate.innerHTML = `<p class="gate-as">${esc(t.orderingAs)} <b>${esc(who)}</b></p>${legacy ? emailBox(t.gateHintPhone) + '<p class="acct-err" id="gateErr" role="alert"></p>' : ''}<button type="button" class="cof-back" data-acct="logout">${esc(t.notYou)}</button>`;
   return;
  }
  gate.innerHTML = `${emailBox('')}<label><span>${esc(t.gatePw)}</span>${pwField('new-password', 'gatePw')}</label><p class="gate-hint">${esc(t.gateHint)}</p><p class="acct-err" id="gateErr" role="alert"></p>`;
 }
 function renderPanel(force) {
  const t = A(), u = me(), legacy = !!u && isLegacy(u.email), ask = legacy && !skipEmail, body = $('acctBody');
  const k = (u ? u.uid : 'out') + '|' + tab + '|' + needLogin + '|' + (ask ? 'ask' : '');
  if (!force && k === panelKey) { renderOrders(); return; }
  panelKey = k;
  const mode = tab === 'signup' ? 'signup' : 'login';
  $('acctTitle').textContent = ask ? t.addEmailTitle : u ? t.title : mode === 'signup' ? t.signupTitle : t.loginTitle;
  if (ask) {
   body.innerHTML = `<p class="acct-note">${esc(t.addEmailText)}</p>
   <form class="acct-form" id="aForm" data-mode="addemail">
    <label class="af"><span>${esc(t.email)}</span><input name="email" type="email" inputmode="email" autocomplete="email" required placeholder=" " title="${esc(t.err.email)}"></label>
    <p class="acct-err" role="alert"></p>
    <button class="co" type="submit">${esc(t.addEmailBtn)}</button>
    <button type="button" class="acct-link" data-acct="skipemail">${esc(t.later)}</button>
   </form>`;
   return;
  }
  if (u) {
   const em = legacy ? '' : u.email, ph = phoneOf(u);
   body.innerHTML = `<div class="acct-me"><div class="acct-av">${esc(initial(u))}</div><div class="acct-who"><b>${esc(u.displayName || '')}</b>${em ? `<span>${esc(em)}</span>` : ''}${ph ? `<span>${esc(fmt(ph))}</span>` : ''}</div><button type="button" class="acct-out" data-acct="logout">${esc(t.logout)}</button></div>${legacy ? `<div class="acct-note">${esc(t.addEmailNudge)} <button type="button" class="acct-inline" data-acct="addemail">${esc(t.addEmailNudgeBtn)}</button></div>` : ''}<h3 class="acct-h">${esc(t.ordersTitle)}</h3><div id="ordList"></div>`;
   renderOrders();
   return;
  }
  const idIn = `<input name="id" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required placeholder=" " title="${esc(t.err.id)}">`;
  const emailIn = `<input name="email" type="email" inputmode="email" autocomplete="email" required placeholder=" " title="${esc(t.err.email)}">`;
  const phoneIn = `<input name="phone" type="tel" inputmode="tel" autocomplete="tel" pattern="[0-9+ ]{10,15}" required placeholder=" " value="${esc(cust.phone || '')}" title="${esc(t.err.phone)}">`;
  const hint = mode === 'signup' ? t.signupHint + ' ' + t.pinHint : '';
  body.innerHTML = `${needLogin ? `<p class="acct-note">${esc(t.needLogin)}</p>` : ''}
   <div class="acct-tabs"><button type="button" data-tab="login" class="${mode === 'login' ? 'on' : ''}">${esc(t.login)}</button><button type="button" data-tab="signup" class="${mode === 'signup' ? 'on' : ''}">${esc(t.signup)}</button></div>
   <form class="acct-form" id="aForm" data-mode="${mode}">
    ${mode === 'signup' ? `<label class="af"><span>${esc(t.name)}</span><input name="name" type="text" autocomplete="name" required placeholder=" " value="${esc(cust.name || '')}"></label>` : ''}
    <label class="af"><span>${esc(mode === 'login' ? t.id : t.email)}</span>${mode === 'login' ? idIn : emailIn}</label>
    ${mode === 'login' ? '' : `<label class="af"><span>${esc(t.phone)}</span>${phoneIn}</label>`}
    <label class="af"><span>${esc(mode === 'signup' ? t.pinNew : t.pin)}</span>${pwField(mode === 'signup' ? 'new-password' : 'current-password')}</label>
    ${hint ? `<p class="acct-hint">${esc(hint)}</p>` : ''}
    <p class="acct-err" role="alert"></p>
    <button class="co" type="submit">${esc(mode === 'signup' ? t.signupBtn : t.loginBtn)}</button>
    ${mode === 'login' ? `<button type="button" class="acct-link" data-forgot>${esc(t.forgot)}</button>` : ''}
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
  const u0 = me();
  if (u0 && !isLegacy(u0.email)) return true;
  const t = A(), say = m => { const e = $('gateErr'); if (e) e.textContent = m || ''; };
  say('');
  if (!auth) { say(t.err.unavailable); return false; }
  const emEl = $('gateEmail'), email = ((emEl && emEl.value) || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || isLegacy(email)) { say(t.err.email); if (emEl) emEl.focus(); return false; }
  if (ensuring) return false;
  const go = q('button[type=submit]', form), label = go.textContent;
  // Signed in with just a phone number: the email they give for this order is added to their account.
  if (u0) {
   ensuring = true; go.disabled = true; go.textContent = t.creating;
   try { await toNewEmail(u0, email, phoneOf(u0)); renderAll(true); }
   catch (e) { if (!(e && e.code === 'cz/verify-sent')) { say(errMsg(e, 'upgrade')); return false; } }
   finally { ensuring = false; go.disabled = false; go.textContent = label; }
   return true;
  }
  const ph = q('[name="phone"]', form), nm = q('[name="name"]', form), pwEl = $('gatePw');
  const phone = normPhone(ph && ph.value), pw = (pwEl && pwEl.value) || '';
  if (!phone) { say(t.err.phone); if (ph) ph.focus(); return false; }
  if (!PW_RE.test(pw)) { say(t.err.pin); if (pwEl) pwEl.focus(); return false; }
  ensuring = true;
  go.disabled = true; go.textContent = t.creating;
  try {
   await runAuth(() => ensureAccount({ email, phone, pw, name: ((nm && nm.value) || '').trim() }));
   return !!me();
  } catch (e) {
   say(errMsg(e, 'checkout'));
   return false;
  } finally {
   ensuring = false; go.disabled = false; go.textContent = label;
  }
 }

 // Forgot password: an email gets Firebase's own reset email; a phone number cannot, so a WhatsApp pop-up opens instead.
 function waPopup(digits) {
  const t = A(), old = $('waPop');
  if (old) old.remove();
  const pop = document.createElement('div');
  pop.className = 'acct-pop'; pop.id = 'waPop';
  pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-modal', 'true');
  const msg = t.forgotMsg + (digits ? fmt(digits) : '');
  pop.innerHTML = `<div class="acct-pop-card"><h3>${esc(t.popTitle)}</h3><p>${esc(t.popText)}</p><a class="co" target="_blank" rel="noopener" href="https://wa.me/${esc(D.site.whatsapp)}?text=${encodeURIComponent(msg)}">${esc(t.popWa)}</a><button type="button" class="acct-link" data-pop-close>${esc(t.popClose)}</button></div>`;
  B.appendChild(pop);
 }
 async function forgot(btn) {
  const f = btn.closest('#aForm'), t = A(), say = f.querySelector('.acct-err');
  say.textContent = ''; say.classList.remove('ok');
  const el = f.elements.namedItem('id'), id = ((el && el.value) || '').trim();
  if (!id) { say.textContent = t.resetNeedId; if (el) el.focus(); return; }
  const mail = id.indexOf('@') >= 0, email = id.toLowerCase();
  if (!mail || isLegacy(email)) {
   const ph = mail ? email.split('@')[0] : normPhone(id);
   if (!ph) { say.textContent = t.err.id; if (el) el.focus(); return; }
   waPopup(ph);
   return;
  }
  if (!EMAIL_RE.test(email)) { say.textContent = t.err.email; if (el) el.focus(); return; }
  if (!auth) { say.textContent = t.err.unavailable; return; }
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = t.resetSending;
  try { await auth.sendPasswordResetEmail(email); say.classList.add('ok'); say.textContent = t.resetSent; }
  catch (err) {
   const c = (err && err.code) || '';
   if (c === 'auth/user-not-found') { say.classList.add('ok'); say.textContent = t.resetSent; }   // do not reveal whether an email has an account
   else say.textContent = errMsg(err, 'reset');
  }
  btn.disabled = false; btn.textContent = label;
 }

 let busy = false;
 document.addEventListener('click', e => {
  const fg = e.target.closest('#acct [data-forgot]');
  if (fg) { forgot(fg); return; }
  if (e.target.closest('[data-pop-close]') || e.target.id === 'waPop') { const p = $('waPop'); if (p) p.remove(); return; }
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
   else if (v === 'skipemail') { skipEmail = true; renderPanel(true); }
   else if (v === 'addemail') { skipEmail = false; renderPanel(true); }
   else if (v === 'shop') { closePanel(); const s = $('shop'); if (s) s.scrollIntoView(); else location.href = 'collection'; }
   else open(v);
   return;
  }
  const tb = e.target.closest('#acct [data-tab]');
  if (tb) { tab = tb.dataset.tab; needLogin = false; renderPanel(true); return; }
  if (e.target.closest('#acct [data-close]') || e.target.id === 'scrim') closePanel();
 });
 document.addEventListener('keydown', e => { if (e.key === 'Escape') { const p = $('waPop'); if (p) p.remove(); else closePanel(); } });
 panel.addEventListener('submit', async e => {
  const f = e.target.closest('#aForm');
  if (!f) return;
  e.preventDefault();
  if (busy) return;
  const t = A(), mode = f.dataset.mode, say = f.querySelector('.acct-err'), go = f.querySelector('button[type=submit]');
  const val = n => { const el = f.elements.namedItem(n); return el ? el.value : ''; };
  say.textContent = ''; say.classList.remove('ok');
  if (!auth) { say.textContent = t.err.unavailable; return; }

  // Signed in with a phone number: add the email to the same account (same uid, orders and details stay).
  if (mode === 'addemail') {
   const u = me(), email = val('email').trim().toLowerCase();
   if (!u) return;
   if (!EMAIL_RE.test(email) || isLegacy(email)) { say.textContent = t.err.email; return; }
   busy = true;
   const label = go.textContent;
   go.disabled = true; go.textContent = t.adding;
   try { await toNewEmail(u, email, phoneOf(u)); renderAll(true); }
   catch (err) {
    if (err && err.code === 'cz/verify-sent') { say.classList.add('ok'); say.textContent = t.err.verifyAdd; }
    else say.textContent = errMsg(err, 'upgrade');
    go.disabled = false; go.textContent = label;
   }
   busy = false;
   return;
  }

  const pw = val('password');
  let email, phone = '', name = '';
  if (mode === 'login') {
   // One field takes an email or a phone number. A phone number logs into the old phone + PIN account.
   const id = val('id').trim(), isMail = id.indexOf('@') >= 0, ph = isMail ? '' : normPhone(id);
   if (isMail ? !EMAIL_RE.test(id) : !ph) { say.textContent = t.err.id; return; }
   if (!pw) { say.textContent = t.err.pin; return; }
   email = isMail ? id.toLowerCase() : emailOf(ph);
  } else {
   email = val('email').trim().toLowerCase(); name = val('name').trim(); phone = normPhone(val('phone'));
   if (!name) { say.textContent = t.err.name; return; }
   if (!EMAIL_RE.test(email) || isLegacy(email)) { say.textContent = t.err.email; return; }
   if (!phone) { say.textContent = t.err.phone; return; }
   if (!PW_RE.test(pw)) { say.textContent = t.err.pin; return; }
  }
  busy = true;
  const label = go.textContent;
  go.disabled = true; go.textContent = mode === 'login' ? t.loggingIn : t.creating;
  try { await runAuth(() => mode === 'login' ? signIn(email, pw) : ensureAccount({ email, phone, pw, name })); }
  catch (err) { say.textContent = errMsg(err, mode); go.disabled = false; go.textContent = label; }
  busy = false;
 });

 // A signed-in user is a customer unless they are the shop admin (the admin check is the same one admin.html uses).
 if (auth) auth.onAuthStateChanged(async u => {
  if (holdAuth) return;
  if (!u) { const was = lastUid; custUser = null; lastUid = null; stopOrders(); if (was) wipe(); renderAll(); return; }
  if (custUser && custUser.uid === u.uid) { custUser = u; renderAll(); return; }
  let admin = false;
  try { if (db) { await db.doc('admin/check').get(); admin = true; } } catch (e) {}
  if (auth.currentUser !== u || holdAuth) return;
  if (admin) { if (custUser) { custUser = null; lastUid = null; stopOrders(); wipe(); } renderAll(); return; }
  adopt(u);
 });
 renderAll(true);

 window.Account = {
  user: me,
  open,
  ensure,
  afterOrder: d => saveProfile(d)
 };
})();
