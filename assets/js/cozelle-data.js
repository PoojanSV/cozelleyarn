/* Shared by every page and admin.html. Firebase (sign-in + Firestore data) web keys are safe to be public; the RULES protect your data.
   Images are NOT stored in Firebase: they live on Cloudinary, see assets/js/cloudinary.js. */
const FIREBASE_CONFIG={
  apiKey:"AIzaSyA54Vz_46paWinrnIk4Pxjv8OD5Hi9MXFI",
  authDomain:"ems-45c2c.firebaseapp.com",
  projectId:"ems-45c2c",
  storageBucket:"ems-45c2c.firebasestorage.app",
  messagingSenderId:"432371886956",
  appId:"1:432371886956:web:14f3628ea215a940972149",
  measurementId:"G-PDJN7GNNPS"
};
/* Customer accounts: the phone number is the username. Firebase Auth needs an email-shaped id, so the phone number is turned into
   <digits>@CUSTOMER_DOMAIN. No email is ever sent to it. If you change this value, change it in firebase/firestore.rules too. */
const CUSTOMER_DOMAIN='cozelle-phone.com';
const isObj=v=>v&&typeof v==='object'&&!Array.isArray(v);
/* remote values win, anything missing falls back to the defaults below (arrays are replaced whole) */
function deepMerge(base,over){if(!isObj(base)||!isObj(over))return over===undefined?base:over;const o={...base};for(const k in over)o[k]=deepMerge(base[k],over[k]);
 if(base===DEFAULT_DATA){o.menu=DEFAULT_DATA.menu;o.pay=DEFAULT_DATA.pay;o.acct=DEFAULT_DATA.acct;o.footer={...o.footer,columns:DEFAULT_DATA.footer.columns}} /* menu, footer links, checkout and account wording always come from this file */
 return o}

/* Images that used to sit next to the HTML files now live in assets/img/.
   Content already saved in Firestore may still say "cozelle-logo.png", so old bare names are mapped on load
   (and the admin re-saves them with the new path the next time you press Save). */
const LEGACY_IMG=/^(cozelle-logo\.png|plaited-wool-rug\.jpg|cozelle-bg\.jpg)$/;
const fixImg=v=>typeof v==='string'&&LEGACY_IMG.test(v)?'assets/img/'+v:v;
function fixAssets(d){
 if(d.site){d.site.logo=fixImg(d.site.logo);d.site.background=fixImg(d.site.background)}
 if(d.hero)d.hero.modelImage=fixImg(d.hero.modelImage);
 if(d.about)d.about.image=fixImg(d.about.image);
 (d.products||[]).forEach(p=>{p.image=fixImg(p.image);(p.gallery||[]).forEach(g=>{if(g)g.image=fixImg(g.image)})});
 return d}

/* Starting content. Used until you press Save in the admin panel for the first time. */
const U=(id,w=900)=>`https://unsplash.com/photos/${id}/download?force=true&w=${w}`;

/* ================= ALL CONTENT LIVES HERE =================
   Plain JSON. Every text, image URL, price, link and colour on the page comes from this object.
   Firebase later: return the same shape from loadData() (below) and the page builds itself. */
const DEFAULT_DATA={
 theme:{cream:'#f4e8d3',sand:'#ecd8bd',copper:'#b5693f','copper-d':'#8e4a2a',rose:'#d49a78',cocoa:'#4a2b1b','model-radius':'76px'},
 site:{title:'Cozelle · Wrapped in comfort',name:'Cozelle',brand:'COZELLE',tagline:'Wrapped in comfort',loaderMark:'♥',
  logo:'assets/img/cozelle-logo.png',background:'',whatsapp:'917046975673',upiId:'',upiName:'Cozelle',gstin:'',gstPct:5,gstMode:'inclusive',currency:'₹',locale:'en-IN',copyright:'© 2026 Cozelle. All rights reserved.'},
 hero:{eyebrow:'',title:'Wrapped in comfort,',accent:'one stitch at a time.',lead:'',
  modelImage:U('VjE0Lt9Ix_8',1200),modelAlt:'Woman in a cream wool sweater'},
 collection:{title:'The cosy',accent:'collection'},
 /* about.html: text paragraphs are separated by a blank line. The 'story' points below also show on this page. */
 about:{title:'The story behind',accent:'Cozelle',image:U('53BjYSxca5g',1200),
  text:'At Cozelle we believe the things we wrap ourselves in should feel good, last long and be made with care.\n\nWe bring together soft merino and wool yarns for your own knitting, along with throws, rugs and knitwear that are finished by hand and checked before they leave us.\n\nEvery piece is chosen for natural fibres that breathe, soften with every wash and stay with you for years. Whether you are casting on a first scarf or settling under a new throw, we want it to feel like home.'},
 /* contact.html: the WhatsApp number comes from site.whatsapp. Email, address and hours only show when filled in. */
 contact:{title:'Get in',accent:'touch',text:'Questions about an order, a yarn or a piece you have in mind? Message us and we will get back to you soon.',
  email:'',address:'',hours:'',
  whatsapp:'WhatsApp',emailLabel:'Email',addressLabel:'Find us',hoursLabel:'Hours',
  formName:'Your name',formPhone:'Phone number (optional)',formMessage:'Your message',send:'Send on WhatsApp',msgTitle:'New message',thanks:'Opening WhatsApp…'},
 /* wording of collection.html (search, filters, sorting) */
 listing:{searchPh:'Search yarn, throws, knits',sortLabel:'Sort by',filters:'Filters',category:'Category',price:'Price',min:'Min',max:'Max',apply:'Show results',clear:'Clear all',
  none:'Nothing matches those filters. Try removing one.',results:'{n} pieces',oneResult:'1 piece',
  sorts:{featured:'Featured',priceAsc:'Price: low to high',priceDesc:'Price: high to low',nameAsc:'Name: A to Z',nameDesc:'Name: Z to A'}},
 /* featured:true -> shows in the hero. active:false hides a product. order sorts. */
 products:[
  {id:'cable-knit-throw',name:'Cable Knit Throw',category:'Throw',price:3800,image:U('53BjYSxca5g'),featured:true,description:'A chunky cable-knit throw for the sofa or the foot of the bed. Soft, heavy and made to be wrapped in.',order:1},
  {id:'cloud-merino-yarn',name:'Cloud Merino Yarn',category:'Yarn',price:1450,image:U('nfy_wp26fqs'),featured:true,description:'Soft merino yarn for scarves, hats and everyday knitting. Gentle on the hands and easy to work with.',order:2},
  {id:'cream-wool-skeins',name:'Cream Wool Skeins',category:'Yarn',price:1250,image:U('Mv2q2fpsFk0'),description:'Cream wool skeins for everyday knitting projects. Wind them into balls and cast on.',order:3},
  {id:'hand-spun-wool',name:'Hand-spun Wool',category:'Yarn',price:1650,image:U('zXXyER7lH60'),description:'Hand-spun wool with a lovely uneven texture, for knits that look handmade because they are.',order:4},
  {id:'plaited-wool-rug',name:'Plaited Wool Rug',category:'Rug',price:9800,image:'assets/img/plaited-wool-rug.jpg',description:'A plaited wool rug that warms up a floor. Soft underfoot and made to last.',order:5},
  {id:'ivory-knit-pullover',name:'Ivory Knit Pullover',category:'Knitwear',price:3200,image:U('oFOex6VySOM'),description:'A relaxed ivory pullover knitted for everyday wear. Warm without being heavy.',order:6},
  {id:'cloud-knit-sweater',name:'Cloud Knit Sweater',category:'Knitwear',price:3600,image:U('9lX56_DWfME'),description:'A soft sweater with a cosy drape. Easy to layer through the cooler months.',order:7},
  {id:'sunday-lounge-knit',name:'Sunday Lounge Knit',category:'Knitwear',price:2900,image:U('oOnJWBMlb5A'),description:'A slouchy knit made for slow Sundays at home. Roomy, soft and easy to wear.',order:8}],
 reviews:[
  {name:'Priya S.',rating:5,text:'The throw is so soft and heavy in the best way. It lives on my sofa now.'},
  {name:'Meera K.',rating:5,text:'Knitted a scarf with the merino yarn and it hasn’t pilled once.'},
  {name:'Nisha P.',rating:5,text:'Beautiful packaging and the rug feels even better than the photos.'},
  {name:'Anjali R.',rating:5,text:'My third order. The knits keep their shape wash after wash.'}],
 story:[
  {title:'Natural fibres',text:'Wool that breathes, softens with every wash and lasts for years.'},
  {title:'Made with care',text:'Each piece is finished by hand and checked before it ships.'},
  {title:'Easy returns',text:'Not the one? Send it back within 30 days.'}],
 menu:{links:[{label:'Home',href:'index.html'},{label:'Collection',href:'collection.html'},{label:'About us',href:'about.html'},{label:'Contact us',href:'contact.html'}]},
 /* product.html: wording, plus the lines shown under every product. Each product can also have description, gallery [{image,alt}] and details [{label,value}] (edit them in admin.html) */
 product:{back:'Back to collection',about:'About this piece',details:'Details',category:'Category',qty:'Quantity',related:'You may also like',notFound:'We could not find that piece.',zoom:'View larger',close:'Close',prev:'Previous photo',next:'Next photo',
  assurances:[{text:'Free delivery across India'},{text:'30-day easy returns'},{text:'Finished by hand and checked before it ships'}]},
 /* checkout: pay by UPI QR + payment screenshot. The UPI ID itself is set in admin.html > Site. */
 pay:{proceed:'Pay with UPI',continue:'Continue to payment',title:'Pay with UPI',scan:'Scan with any UPI app',qrLabel:'UPI payment QR code',amount:'Amount to pay',payee:'Paying to',
  copy:'Copy',copied:'Copied',ref:'Order ID',openApp:'Open UPI app',pickApp:'Pay with your UPI app',appHint:'Tap your app, pay, then come back here and attach the screenshot.',apps:{gpay:'Google Pay',phonepe:'PhonePe',paytm:'Paytm',any:'Other UPI app'},step:'After paying, attach a screenshot of the payment',attach:'Attach payment screenshot',change:'Change screenshot',
  utr:'UPI transaction ID (optional)',utrPh:'12-digit UTR from your payment app',place:'I have paid, place my order',uploading:'Uploading screenshot…',placing:'Sending your order…',back:'Back to details',
  notReady:'Online payment is not set up yet. Please try again later.',needShot:'Please attach the payment screenshot first.',imgOnly:'Please choose an image file.',tooBig:'That image is too large. Please choose a smaller screenshot.',
  failed:'We could not send your order. Please check your connection and try again.',doneTitle:'Order received',doneText:'Thank you! We will check your payment and confirm your order shortly.',doneBtn:'Continue shopping'},
 /* prices, discount and GST wording (bag, checkout, My orders) */
 tax:{total:'Total',items:'Items',discount:'Discount',gst:'GST',gstIncl:'Includes GST',off:'off',gstin:'GSTIN'},
 /* customer accounts + orders (assets/js/account.js). Phone number = username, 6-digit PIN = password. */
 acct:{account:'Account',login:'Log in',signup:'Create account',logout:'Log out',orders:'My orders',menuLogin:'Log in / Sign up',
  loginTitle:'Welcome back',signupTitle:'Create your account',title:'My account',
  phone:'Phone number',name:'Your name',pin:'6-digit PIN',pinNew:'Create a 6-digit PIN',show:'Show',hide:'Hide',
  pinHint:'Six digits you will remember. You log in with your phone number and this PIN.',
  gateHint:'Your phone number is your username. Use this PIN to log in later and see your orders. Ordered before? Enter your PIN to log in.',
  signupHint:'No email needed. Your phone number is your username.',
  orderingAs:'Ordering as',notYou:'Not you? Log out',
  loginBtn:'Log in',signupBtn:'Create account',loggingIn:'Logging in…',creating:'Please wait…',
  needLogin:'Log in to see your orders.',ordersTitle:'Your orders',noOrders:'You have not placed an order yet.',browse:'Browse the collection',
  loadingOrders:'Loading your orders…',ordersErr:'We could not load your orders right now. Please try again later.',
  orderId:'Order ID',total:'Total',utr:'UPI transaction ID',viewOrders:'View my orders',
  forgot:'Forgot your PIN? Message us on WhatsApp',forgotMsg:'Hi, I forgot my Cozelle PIN. My phone number is ',
  status:{new:'Payment being checked',confirmed:'Confirmed',shipped:'Shipped',delivered:'Delivered',cancelled:'Cancelled'},
  steps:['Placed','Confirmed','Shipped','Delivered'],
  err:{phone:'Please enter a valid phone number (10 digits).',pin:'Your PIN must be exactly 6 digits.',name:'Please enter your name.',
   wrong:'That phone number and PIN do not match.',
   exists:'This phone number already has an account. Please log in instead.',
   existsWrong:'This phone number already has an account, and that PIN does not match. Enter your PIN, or message us on WhatsApp if you forgot it.',
   tooMany:'Too many attempts. Please wait a few minutes and try again.',network:'Please check your connection and try again.',
   unavailable:'Accounts are not available right now. Please try again later.',policy:'That PIN was not accepted. Please try a different 6-digit PIN.',
   generic:'Something went wrong. Please try again.',sessionLost:'You are no longer logged in. Please go back and continue again.'}},
 /* an item with no href is plain text; href:'wa' becomes the WhatsApp link */
 footer:{blurb:'Get new yarn drops and knitting notes in your inbox.',columns:[
  {title:'Explore',items:[{label:'Collection',href:'collection.html'},{label:'About us',href:'about.html'},{label:'Contact us',href:'contact.html'}]},
  {title:'Help',items:[{label:'Free delivery across India'},{label:'30-day easy returns'},{label:'Chat on WhatsApp',href:'wa'}]}]},
 /* fields are fully editable: key, label, type (text/tel/email/textarea), required, half, pattern, hint, placeholder */
 checkout:{title:'Your details',customer:'Customer details',submit:'Send order on WhatsApp',back:'Back to bag',fields:[
  {key:'name',label:'Full name',type:'text',required:true,autocomplete:'name'},
  {key:'phone',label:'Phone number',type:'tel',required:true,autocomplete:'tel',pattern:'[0-9+ ]{10,15}',hint:'Enter a valid phone number'},
  {key:'address',label:'Delivery address',type:'textarea',required:true,autocomplete:'street-address'},
  {key:'city',label:'City',type:'text',required:true,half:true,autocomplete:'address-level2'},
  {key:'pincode',label:'Pincode',type:'text',required:true,half:true,autocomplete:'postal-code',pattern:'[0-9]{6}',hint:'6-digit pincode'},
  {key:'notes',label:'Order notes (optional)',type:'textarea',required:false}]},
 ui:{addToBag:'Add to bag',added:'added to your bag',openBag:'Open bag',closeBag:'Close bag',openMenu:'Open menu',closeMenu:'Close menu',
  menuTitle:'Menu',bagTitle:'Your bag',empty:'Your bag is empty',browse:'Browse the collection',subtotal:'Subtotal',
  delivery:'Delivery is free across India.',checkout:'Order on WhatsApp',orderTitle:'New order',total:'Total',
  decrease:'Decrease',increase:'Increase',remove:'Remove',emailPh:'Your email',join:'Join',thanks:'Thank you, you’re on the list'}
};

/* ================= Prices: discount + GST (shared by every page and admin.html) =================
   product.price = the full price. product.discount = percent off (0 = none). product.gst = GST % for that product (empty = shop default site.gstPct).
   site.gstMode 'inclusive' = prices already contain GST (it is only shown); 'exclusive' = GST is added on top at the bag. */
const Price={
 cfg(){return (typeof D!=='undefined'&&D&&D.site)||(typeof state!=='undefined'&&state&&state.site)||DEFAULT_DATA.site},
 tx(){return (typeof D!=='undefined'&&D&&D.tax)||DEFAULT_DATA.tax},
 money(n){const s=this.cfg(),v=Math.round(Number(n||0)*100)/100;return (s.currency||'')+v.toLocaleString(s.locale||'en-IN',{minimumFractionDigits:Number.isInteger(v)?0:2,maximumFractionDigits:2})},
 pct(p){const d=Number(p&&p.discount);return d>0&&d<100?d:0},
 unit(p){const d=this.pct(p),m=Number(p.price)||0;return d?Math.round(m*(100-d)/100):m},
 rate(p){const g=p&&p.gst,r=(g===undefined||g===null||g==='')?Number(this.cfg().gstPct):Number(g);return r>0?r:0},
 incl(){return this.cfg().gstMode!=='exclusive'},
 calc(rows,cart){let mrp=0,net=0,gst=0,rates=new Set();const inc=this.incl();
  rows.forEach(p=>{const q=Number(cart[p.id])||0,line=this.unit(p)*q,r=this.rate(p);mrp+=(Number(p.price)||0)*q;net+=line;if(r>0)rates.add(r);gst+=inc?line-line/(1+r/100):line*r/100});
  gst=Math.round(gst*100)/100;net=Math.round(net*100)/100;
  return {mrp,net,discount:Math.round((mrp-net)*100)/100,gst,incl:inc,rate:rates.size===1?[...rates][0]:0,total:Math.round((inc?net:net+gst)*100)/100}},
 /* price markup: current price, old price struck through, "x% off" */
 html(p){const d=this.pct(p);return d?`<span class="pnow">${this.money(this.unit(p))}</span> <s class="pmrp">${this.money(p.price)}</s> <span class="poff">${d}% ${this.tx().off}</span>`:this.money(p.price)},
 badge(p){const d=this.pct(p);return d?`<span class="dbadge">−${d}%</span>`:''},
 /* lines shown above the total in the bag / payment step */
 brk(c){const t=this.tx(),r=(a,b,k)=>`<div class="br${k?' '+k:''}"><span>${a}</span><span>${b}</span></div>`;let h='';
  if(c.discount>0)h+=r(t.items,this.money(c.mrp))+r(t.discount,'−'+this.money(c.discount),'off');
  if(c.gst>0)h+=c.incl?r(t.gstIncl+(c.rate?' ('+c.rate+'%)':''),this.money(c.gst),'mut'):r(t.gst+(c.rate?' ('+c.rate+'%)':''),'+'+this.money(c.gst));
  return h}
};
