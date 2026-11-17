/* Cozelle checkout: pay by UPI QR, attach a screenshot, send the order to the admin panel.
   Every order belongs to a customer account (phone number + 6-digit PIN, see assets/js/account.js): the details form asks for the PIN
   when the shopper is not logged in, and the order is saved with their uid so it shows under "My orders".
   The screenshot is uploaded to Cloudinary (assets/js/cloudinary.js, preset CLOUDINARY.paymentPreset);
   only its URL is saved in the Firestore order.
   Shared by every page that has the bag drawer. It relies on the globals each page already defines
   (D, cart, cust, db, live, money, sub, drawer, esc, toast, renderCart, $), on assets/js/vendor/qrcode.js and on assets/js/account.js (load it first).
   Order flow: bag -> details form -> this payment step -> Cloudinary (screenshot) + Firestore "orders". */
(() => {
 const VPA = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/;
 const MAX_BYTES = 5 * 1024 * 1024;
 const T = () => D.pay;
 let cur = null, busy = false, starting = false, previewUrl = '', appLaunchPending = false, appWasBackgrounded = false;

 /* ---------- build the extra markup once ---------- */
 const head = drawer.querySelector('.ph-head');
 const h2 = document.createElement('h2');
 h2.className = 't-pay';
 head.insertBefore(h2, head.querySelector('.x'));

 const pane = document.createElement('div');
 pane.className = 'pay';
 pane.id = 'payPane';
 pane.innerHTML = `
  <div class="pay-amt live"><span id="payAmtL"></span><strong id="payAmt"></strong></div>
  <div class="brk pay-brk live" id="payBrk"></div>
  <div class="pay-apps live" id="payApps" hidden></div>
  <div class="pay-qr live" id="payQr"></div>
  <p class="pay-scan live" id="payScan"></p>
  <div class="pay-id live"><span id="payToL"></span><b id="payVpa"></b><button type="button" id="payCopy"></button></div>
  <p class="pay-ref live"><span id="payRefL"></span> <b id="payRef"></b></p>
  <p class="pay-step live" id="payStep"></p>
  <label class="pay-file live" tabindex="-1"><input type="file" accept="image/*" id="payFile"><span id="payFileL"></span></label>
  <img class="pay-prev live" id="payPrev" alt="" hidden>
  <label class="pay-utr live"><span id="payUtrL"></span><input id="payUtr" inputmode="numeric" maxlength="30" autocomplete="off"></label>
  <p class="pay-err" id="payErr" role="alert"></p>
  <button type="button" class="co live" id="payPlace" disabled></button>
  <button type="button" class="cof-back" id="payBack"></button>`;
 drawer.appendChild(pane);

 const done = document.createElement('div');
 done.className = 'pdone';
 done.id = 'payDone';
 done.innerHTML = `<div class="tick" aria-hidden="true">✓</div><h3 id="doneT"></h3><p id="doneP"></p><p class="ref" id="doneRef"></p><button type="button" class="co" id="doneBtn"></button><button type="button" class="cof-back" id="doneOrders"></button>`;
 drawer.appendChild(done);

 const g = id => document.getElementById(id);
 const setErr = m => { g('payErr').textContent = m || ''; };
 const setBtn = (label, disabled) => { const b = g('payPlace'); b.textContent = label; b.disabled = !!disabled; };

 /* ---------- helpers ---------- */
 const sig = rows => rows.map(p => p.id + ':' + cart[p.id] + ':' + Price.unit(p)).sort().join('|');
 const newRef = () => {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let s = 'CZ-';
  for (let i = 0; i < bytes.length; i++) s += a[bytes[i] % a.length];
  return s;
 };
 async function reserveRef(preferred, user) {
  const refs = db.collection('orderRefs');
  for (let attempt = 0; attempt < 12; attempt++) {
   const ref = attempt === 0 && preferred ? preferred : newRef();
   try {
    const reserved = await db.runTransaction(async tx => {
     const doc = refs.doc(ref), snap = await tx.get(doc);
     if (snap.exists) return snap.data().uid === user.uid && snap.data().status === 'reserved';
     tx.set(doc, { uid: user.uid, status: 'reserved', createdAt: firebase.firestore.FieldValue.serverTimestamp() });
     return true;
    });
    if (reserved) return ref;
   } catch (err) {
    /* A reference owned by another customer is intentionally unreadable; try a fresh one. */
    if (err.code !== 'permission-denied') throw err;
   }
  }
  throw new Error('Could not reserve a unique order ID. Publish the updated Firestore rules and try again.');
 }
 const upiUrl = (vpa, name, amount, note) =>
  'upi://pay?pa=' + vpa + '&pn=' + encodeURIComponent(name) + '&am=' + amount.toFixed(2) + '&cu=INR&tn=' + encodeURIComponent(note);

 function qrSvg(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), m = 4;
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
  const w = n + 2 * m;
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + w + '" shape-rendering="crispEdges" role="img" aria-label="' + esc(T().qrLabel) + '"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
 }

 /* shrink big phone screenshots before upload; fall back to the original file if the browser can't decode it */
 function shrink(file) {
  return new Promise(res => {
   const url = URL.createObjectURL(file), im = new Image();
   im.onload = () => {
    URL.revokeObjectURL(url);
    try {
     const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight));
     const c = document.createElement('canvas');
     c.width = Math.max(1, Math.round(im.naturalWidth * k));
     c.height = Math.max(1, Math.round(im.naturalHeight * k));
     const x = c.getContext('2d');
     x.fillStyle = '#fff';
     x.fillRect(0, 0, c.width, c.height);
     x.drawImage(im, 0, 0, c.width, c.height);
     c.toBlob(b => res(b || file), 'image/jpeg', 0.82);
    } catch (e) { res(file); }
   };
   im.onerror = () => { URL.revokeObjectURL(url); res(file); };
   im.src = url;
  });
 }

 function fillText() {
  const t = T();
  h2.textContent = t.title;
  g('payAmtL').textContent = t.amount;
  g('payScan').textContent = t.scan;
  g('payToL').textContent = t.payee;
  g('payCopy').textContent = t.copy;
  g('payRefL').textContent = t.ref;
  g('payStep').textContent = t.step;
  g('payFileL').textContent = (cur && cur.file) ? t.change : t.attach;
  g('payUtrL').textContent = t.utr;
  g('payUtr').placeholder = t.utrPh;
  g('payBack').textContent = t.back;
  g('doneBtn').textContent = t.doneBtn;
  g('doneOrders').textContent = D.acct.viewOrders;
 }

 function clearPreview() {
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = ''; }
  g('payPrev').hidden = true;
  g('payPrev').removeAttribute('src');
 }

 function focusScreenshot() {
  if (!cur || !drawer.classList.contains('paying')) return;
  const section = g('payFile').closest('.pay-file');
  if (!section) return;
  section.scrollIntoView({ behavior: 'smooth', block: 'center' });
  section.classList.add('return-focus');
  setTimeout(() => section.classList.remove('return-focus'), 2600);
  requestAnimationFrame(() => section.focus({ preventScroll: true }));
 }
 function handlePaymentAppReturn() {
  if (!appWasBackgrounded) return;
  appWasBackgrounded = false;
  appLaunchPending = false;
  setTimeout(focusScreenshot, 300);
 }

 /* ---------- step 1: details form -> payment pane ---------- */
 async function startPay() {
  const rows = live().filter(p => cart[p.id]);
  if (!rows.length) return;
  const t = T(), s = D.site || {}, vpa = String(s.upiId || '').trim();
  const calc = Price.calc(rows, cart), total = calc.total;
  const ready = VPA.test(vpa) && total > 0;
  appLaunchPending = false;
  appWasBackgrounded = false;

  /* keep the same order id while the bag is unchanged (e.g. the shopper left to pay in their UPI app and came back) */
  let preferred = '';
  try {
   const p = JSON.parse(localStorage.getItem('cozelle-pending'));
   if (p && p.sig === sig(rows) && /^CZ-[A-Z0-9]{10}$/.test(p.ref)) preferred = p.ref;
  } catch (e) {}
  const user = Account.user();
  if (!user) throw new Error('Please sign in again before continuing.');
  const ref = await reserveRef(preferred, user);
  try { localStorage.setItem('cozelle-pending', JSON.stringify({ sig: sig(rows), ref })); } catch (e) {}

  clearPreview();
  cur = { ref, total, calc, vpa, rows, file: null, uploaded: '' };
  g('payFile').value = '';
  g('payUtr').value = '';
  setErr('');
  fillText();
  pane.classList.toggle('off', !ready);

  if (ready) {
   const name = String(s.upiName || s.name || '').trim() || 'Shop';
   const url = upiUrl(vpa, name, total, (s.name || 'Order') + ' ' + ref);
   g('payAmt').textContent = money(total);
   g('payQr').innerHTML = qrSvg(url);
   g('payVpa').textContent = vpa;
   g('payRef').textContent = ref;
   g('payBrk').innerHTML = Price.brk(calc);
   /* One tap per UPI app, with the QR kept alongside as a fallback. */
   const q = url.slice(url.indexOf('?')), ios = /iphone|ipad|ipod/i.test(navigator.userAgent), ap = t.apps;
   const links = [
    { name: ap.gpay, href: (ios ? 'gpay://upi/pay' : 'tez://upi/pay') + q, logo: 'https://api.iconify.design/logos:google-pay.svg?height=36' },
    { name: ap.phonepe, href: 'phonepe://pay' + q, logo: 'https://api.iconify.design/simple-icons:phonepe.svg?color=%235F259F' },
    { name: ap.paytm, href: 'paytmmp://pay' + q, logo: 'https://api.iconify.design/simple-icons:paytm.svg?color=%2300BAF2' },
    { name: ap.any, href: url, logo: 'assets/img/upi-mark.svg', any: true }
   ];
   g('payApps').innerHTML = '<p class="lbl">' + esc(t.pickApp) + '</p>' + links.map(a => '<a href="' + esc(a.href) + '" aria-label="' + esc(a.name) + '" title="' + esc(a.name) + '"' + (a.any ? ' class="any"' : '') + '><img src="' + esc(a.logo) + '" alt="" loading="eager"><span class="pay-app-name">' + esc(a.name) + '</span></a>').join('') + '<p>' + esc(t.appHint) + '</p>';
   g('payApps').querySelectorAll('img').forEach(img => img.addEventListener('error', () => { img.hidden = true; img.parentElement.classList.add('logo-fallback'); }));
   g('payApps').hidden = false;
   setBtn(t.place, true);
  } else {
   setErr(t.notReady);
  }
  drawer.classList.remove('details', 'done');
  drawer.classList.add('paying');
  drawer.scrollTop = 0;
 }

 /* ---------- step 2: screenshot chosen ---------- */
 function onFile(e) {
  const f = e.target.files && e.target.files[0];
  if (!cur || !f) return;
  const t = T();
  if (!/^image\//.test(f.type)) { setErr(t.imgOnly); e.target.value = ''; return; }
  setErr('');
  cur.file = f;
  cur.uploaded = '';
  clearPreview();
  previewUrl = URL.createObjectURL(f);
  const im = g('payPrev');
  im.src = previewUrl;
  im.hidden = false;
  g('payFileL').textContent = t.change;
  setBtn(t.place, false);
 }

 /* ---------- step 3: upload screenshot, save order ---------- */
 async function place() {
  if (busy || !cur) return;
  const t = T(), s = D.site || {};
  if (!cur.file) { setErr(t.needShot); return; }
  const user = Account.user();
  if (!user) { setErr(D.acct.err.sessionLost); return; }
  busy = true;
  setErr('');
  try {
   if (typeof db === 'undefined' || !db) throw new Error('Firebase is not available');
   if (!cur.uploaded) {
    setBtn(t.uploading, true);
    const blob = await shrink(cur.file);
    if (blob.size >= MAX_BYTES) { setErr(t.tooBig); busy = false; setBtn(t.place, false); return; }
    const up = await cldUpload(blob, { preset: CLOUDINARY.paymentPreset, tags: ['payment', cur.ref], filename: cur.ref + '.jpg' });
    cur.uploaded = up.secure_url;
   }
   setBtn(t.placing, true);
   const orderRef = db.collection('orders').doc(), reservationRef = db.collection('orderRefs').doc(cur.ref);let existingOrderId='';
   await db.runTransaction(async tx => {
    const reservation = await tx.get(reservationRef);
    if (!reservation.exists || reservation.data().uid !== user.uid) throw new Error('This order reference is no longer available.');
    if (reservation.data().status === 'used' && reservation.data().orderId) { existingOrderId = reservation.data().orderId; return; }
    if (reservation.data().status !== 'reserved') throw new Error('This order reference is no longer available.');
    tx.set(orderRef, {
    uid: user.uid,
    customer: { ...cust },
    items: cur.rows.map(p => ({ id: p.id, name: p.name, qty: cart[p.id], price: Price.unit(p), mrp: Number(p.price) || 0, discount: Price.pct(p), gstRate: Price.rate(p) })),
    total: cur.total,
    pricing: { mrp: cur.calc.mrp, discount: cur.calc.discount, net: cur.calc.net, gst: cur.calc.gst, gstMode: cur.calc.incl ? 'inclusive' : 'exclusive', gstin: String(s.gstin || '').trim().slice(0, 20) },
    status: 'new',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    payment: {
     method: 'upi',
     ref: cur.ref,
     upiId: cur.vpa,
     amount: cur.total,
     utr: g('payUtr').value.trim().slice(0, 30),
     screenshotUrl: cur.uploaded
    }
    });
    tx.update(reservationRef, { status: 'used', orderId: orderRef.id });
   });
   if (existingOrderId) {
    const prior = await db.collection('orders').doc(existingOrderId).get();
    if (!prior.exists || prior.data().uid !== user.uid || (prior.data().payment || {}).ref !== cur.ref)
     throw new Error('Could not confirm the previous order. Please contact the shop before retrying payment.');
   }
   /* success */
   const ref = cur.ref;
   Account.afterOrder(cust);
   Object.keys(cart).forEach(k => delete cart[k]);
   try { localStorage.removeItem('cozelle-pending'); } catch (e) {}
   renderCart();
   clearPreview();
   g('doneT').textContent = t.doneTitle;
   g('doneP').textContent = t.doneText;
   g('doneRef').textContent = t.ref + ' ' + ref;
   drawer.classList.remove('paying', 'details');
   drawer.classList.add('done');
   cur = null;
  } catch (err) {
   console.error('order failed', err);
   setErr(t.failed + (err && err.code ? ' (' + err.code + ')' : ''));
   setBtn(t.place, false);
  }
  busy = false;
 }

 /* ---------- events ---------- */
 g('coForm').addEventListener('submit', async e => {
  e.preventDefault();
  if (starting || busy) return;
  starting = true;
  const submit = e.submitter || g('coForm').querySelector('[type="submit"]');
  if (submit) submit.disabled = true;
  try { if (await Account.ensure()) await startPay(); }
  catch (err) { console.error('could not reserve order reference', err); toast('We could not prepare a unique order ID. Please try again.'); }
  finally { starting = false; if (submit) submit.disabled = false; }
 });
 g('payFile').addEventListener('change', onFile);
 g('payApps').addEventListener('click', e => { if (e.target.closest('a')) appLaunchPending = true; });
 document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (appLaunchPending) appWasBackgrounded = true; return; }
  handlePaymentAppReturn();
 });
 window.addEventListener('focus', handlePaymentAppReturn);
 window.addEventListener('pageshow', handlePaymentAppReturn);
 g('payPlace').addEventListener('click', place);
 g('payBack').addEventListener('click', () => {
  if (busy) return;
  drawer.classList.remove('paying');
  drawer.classList.add('details');
 });
 g('doneBtn').addEventListener('click', () => { close(); });
 g('doneOrders').addEventListener('click', () => { close(); Account.open('orders'); });
 g('payCopy').addEventListener('click', async () => {
  const b = g('payCopy'), v = g('payVpa').textContent;
  try { await navigator.clipboard.writeText(v); }
  catch (e) {
   const r = document.createRange();
   r.selectNodeContents(g('payVpa'));
   const sel = getSelection();
   sel.removeAllRanges();
   sel.addRange(r);
   try { document.execCommand('copy'); } catch (_) {}
  }
  const old = T().copy;
  b.textContent = T().copied;
  setTimeout(() => { b.textContent = old; }, 1600);
 });
 /* opening the bag again always starts from the bag view (unless an upload is in progress) */
 g('bag').addEventListener('click', () => {
  if (busy) return;
  drawer.classList.remove('paying', 'done');
 }, true);
})();
