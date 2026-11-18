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
    { name: ap.gpay, href: (ios ? 'gpay://upi/pay' : 'tez://upi/pay') + q, logos: ["data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20512%20204%22%3E%3Cpath%20fill%3D%22%235f6368%22%20d%3D%22M362.927%2055.057c14.075%200%2024.952%203.839%2033.27%2011.517c8.317%207.677%2012.155%2017.914%2012.155%2030.71v61.42h-17.914V144.63h-.64c-7.677%2011.517-18.554%2017.275-31.35%2017.275c-10.877%200-20.474-3.2-28.151-9.597c-7.038-6.398-11.517-15.355-11.517-24.952q0-15.356%2011.517-24.953c7.677-6.398%2018.554-8.957%2031.35-8.957c11.516%200%2020.474%201.92%2027.511%206.398v-4.478c0-5.972-2.229-11.943-6.688-15.834l-.99-.801c-5.118-4.479-11.516-7.038-18.553-7.038q-16.315%200-24.953%2013.436L321.34%2074.89c10.236-13.436%2023.672-19.834%2041.587-19.834M272.715%2011.55c11.48%200%2022.39%203.995%2031.113%2011.445l1.517%201.35c8.957%207.678%2013.435%2019.195%2013.435%2031.351s-4.478%2023.033-13.435%2031.35s-19.834%2012.796-32.63%2012.796l-30.71-.64v59.502H222.81V11.55zm92.77%2097.25q-11.516%200-19.193%205.758q-7.678%204.798-7.678%2013.435c0%205.119%202.56%209.597%206.398%2012.157c4.479%203.199%209.597%205.118%2014.716%205.118c7.165%200%2014.331-2.787%2019.936-7.84l1.177-1.117c6.398-5.758%209.597-12.796%209.597-20.474c-5.758-4.478-14.076-7.038-24.952-7.038m-91.49-79.336h-31.99V80.65h31.99c7.037%200%2014.075-2.559%2018.554-7.677c10.236-9.597%2010.236-25.592.64-35.19l-.64-.64c-5.119-5.118-11.517-8.317-18.555-7.677M512%2058.256l-63.34%20145.235h-19.194l23.672-50.544l-41.587-94.051h20.474l30.07%2072.297h.64l29.431-72.297H512z%22%2F%3E%3Cpath%20fill%3D%22%234285f4%22%20d%3D%22M165.868%2086.407c0-5.758-.64-11.516-1.28-17.274H84.615v32.63h45.425c-1.919%2010.236-7.677%2019.833-16.634%2025.592v21.113h27.511c15.995-14.715%2024.952-36.469%2024.952-62.06%22%2F%3E%3Cpath%20fill%3D%22%2334a853%22%20d%3D%22M84.614%20168.942c23.032%200%2042.226-7.678%2056.302-20.474l-27.511-21.113c-7.678%205.118-17.275%208.317-28.791%208.317c-21.754%200-40.948-14.715-47.346-35.189H9.118v21.753c14.715%2028.791%2043.506%2046.706%2075.496%2046.706%22%2F%3E%3Cpath%20fill%3D%22%23fbbc04%22%20d%3D%22M37.268%20100.483c-3.838-10.237-3.838-21.753%200-32.63V46.1H9.118c-12.157%2023.673-12.157%2051.824%200%2076.136z%22%2F%3E%3Cpath%20fill%3D%22%23ea4335%22%20d%3D%22M84.614%2033.304c12.156%200%2023.672%204.479%2032.63%2012.796l24.312-24.312C126.2%207.712%20105.727-.605%2085.253.034c-31.99%200-61.42%2017.915-75.496%2046.706l28.151%2021.753c5.758-20.474%2024.952-35.189%2046.706-35.189%22%2F%3E%3C%2Fsvg%3E", 'assets/img/upi/gpay.svg', 'https://api.iconify.design/logos:google-pay.svg?height=36'] },
    { name: ap.phonepe, href: 'phonepe://pay' + q, logos: ["data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%235F259F%22%3E%3Cpath%20fill%3D%22%235F259F%22%20d%3D%22M10.206%209.941h2.949v4.692c-.402.201-.938.268-1.34.268c-1.072%200-1.609-.536-1.609-1.743zm13.47%204.816c-1.523%206.449-7.985%2010.442-14.433%208.919C2.794%2022.154-1.199%2015.691.324%209.243C1.847%202.794%208.309-1.199%2014.757.324c6.449%201.523%2010.442%207.985%208.919%2014.433m-6.231-5.888a.887.887%200%200%200-.871-.871h-1.609l-3.686-4.222c-.335-.402-.871-.536-1.407-.402l-1.274.401c-.201.067-.268.335-.134.469l4.021%203.82H6.386c-.201%200-.335.134-.335.335v.67c0%20.469.402.871.871.871h.938v3.217c0%202.413%201.273%203.82%203.418%203.82c.67%200%201.206-.067%201.877-.335v2.145c0%20.603.469%201.072%201.072%201.072h.938a.43.43%200%200%200%20.402-.402V9.874h1.542c.201%200%20.335-.134.335-.335z%22%2F%3E%3C%2Fsvg%3E", 'assets/img/upi/phonepe.svg', 'https://api.iconify.design/simple-icons:phonepe.svg?color=%235F259F'] },
    { name: ap.paytm, href: 'paytmmp://pay' + q, logos: ["data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%2300BAF2%22%3E%3Cpath%20fill%3D%22%2300BAF2%22%20d%3D%22m15.85%208.167l-.04.004c-.68.19-.543%201.148-1.781%201.23h-.12a.2.2%200%200%200-.052.005h-.001a.24.24%200%200%200-.184.235v1.09c0%20.134.106.241.237.241h.645v4.623c0%20.132.104.238.233.238h1.058a.236.236%200%200%200%20.233-.238v-4.623h.6c.13%200%20.236-.107.236-.241v-1.09a.24.24%200%200%200-.236-.24h-.612V8.386a.22.22%200%200%200-.216-.22zm4.225%201.17c-.398%200-.762.15-1.042.395v-.124a.24.24%200%200%200-.234-.224h-1.07a.24.24%200%200%200-.236.242v5.92a.24.24%200%200%200%20.236.242h1.07c.12%200%20.217-.091.233-.209v-4.25a.393.393%200%200%201%20.371-.408h.196a.4.4%200%200%201%20.226.09a.4.4%200%200%201%20.145.319v4.074l.004.155a.24.24%200%200%200%20.237.241h1.07a.24.24%200%200%200%20.235-.23l-.001-4.246c0-.14.062-.266.174-.34a.4.4%200%200%201%20.196-.068h.198c.23.02.37.2.37.408c.005%201.396.004%202.8.004%204.224a.24.24%200%200%200%20.237.241h1.07c.13%200%20.236-.108.236-.241v-4.543c0-.31-.034-.442-.08-.577a1.6%201.6%200%200%200-1.51-1.09h-.015a1.58%201.58%200%200%200-1.152.5c-.291-.308-.7-.5-1.153-.5zM.232%209.4A.234.234%200%200%200%200%209.636v5.924c0%20.132.096.238.216.241h1.09c.13%200%20.237-.107.237-.24l.004-1.658H2.57c.857%200%201.453-.605%201.453-1.481v-1.538c0-.877-.596-1.484-1.453-1.484zm9.032%200a.24.24%200%200%200-.237.241v2.47c0%20.94.657%201.608%201.579%201.608h.675s.016%200%20.037.004a.253.253%200%200%201%20.222.253c0%20.13-.096.235-.219.251l-.018.004l-.303.006H9.739a.24.24%200%200%200-.236.24v1.09a.24.24%200%200%200%20.236.242h1.75c.92%200%201.577-.669%201.577-1.608v-4.56a.24.24%200%200%200-.236-.24h-1.07a.24.24%200%200%200-.236.24c-.005.787%200%201.525%200%202.255a.253.253%200%200%201-.25.25h-.449a.253.253%200%200%201-.25-.255c.005-.754-.005-1.5-.005-2.25a.24.24%200%200%200-.236-.24zm-4.004.006a.23.23%200%200%200-.238.226v1.023c0%20.132.113.24.252.24h1.413c.112.017.2.1.213.23v.14c-.013.124-.1.214-.207.224h-.7c-.93%200-1.594.63-1.594%201.515v1.269c0%20.88.57%201.506%201.495%201.506h1.94c.348%200%20.63-.27.63-.6v-4.136c0-1.004-.508-1.637-1.72-1.637zm-3.713%201.572h.678c.139%200%20.25.115.25.256v.836a.253.253%200%200%201-.25.256h-.1q-.289.002-.578%200zm4.67%201.977h.445c.139%200%20.252.108.252.24v.932a.2.2%200%200%201-.014.076a.25.25%200%200%201-.238.164h-.445a.247.247%200%200%201-.252-.24v-.933c0-.132.113-.239.252-.239%22%2F%3E%3C%2Fsvg%3E", 'assets/img/upi/paytm.svg', 'https://api.iconify.design/simple-icons:paytm.svg?color=%2300BAF2'] },
    { name: ap.any, href: url, logos: ["data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2072%2032%22%3E%3Ctext%20x%3D%2236%22%20y%3D%2224%22%20text-anchor%3D%22middle%22%20font-family%3D%22Arial%2CHelvetica%2Csans-serif%22%20font-weight%3D%22800%22%20font-size%3D%2224%22%20font-style%3D%22italic%22%20fill%3D%22%234a2b1b%22%3EUPI%3C%2Ftext%3E%3C%2Fsvg%3E", 'assets/img/upi/upi.svg', 'assets/img/upi-mark.svg'], any: true }
   ];
   g('payApps').innerHTML = '<p class="lbl">' + esc(t.pickApp) + '</p>' + links.map(a => '<a href="' + esc(a.href) + '" aria-label="' + esc(a.name) + '" title="' + esc(a.name) + '"' + (a.any ? ' class="any"' : '') + '><img src="' + esc(a.logos[0]) + '" data-next="' + esc(a.logos.slice(1).join('|')) + '" alt="" loading="eager"></a>').join('') + '<p>' + esc(t.appHint) + '</p>';
   /* if a logo fails to load, try the next source, and finally show the app name so a button is never blank */
   const pe = g('payApps');
   if (!pe._lg) { pe._lg = 1; pe.addEventListener('error', ev => { const im = ev.target; if (im.tagName !== 'IMG') return; const rest = (im.dataset.next || '').split('|').filter(Boolean); if (rest.length) { im.dataset.next = rest.slice(1).join('|'); im.src = rest[0]; } else { const a = im.parentNode; a.textContent = a.getAttribute('title') || ''; } }, true); }
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
