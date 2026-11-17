:root{--cream:#f4e8d3;--sand:#ecd8bd;--copper:#b5693f;--copper-d:#8e4a2a;--rose:#d49a78;--cocoa:#4a2b1b;
--serif:'Cormorant Garamond',Georgia,serif;--sans:'Jost',system-ui,sans-serif;--glass:rgba(250,245,235,.87);--line:rgba(181,105,63,.45);--bg-image:none;--model-radius:76px;--cols:minmax(0,1.04fr) minmax(0,1fr)}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:var(--sans);font-weight:300;color:var(--cocoa);background:#d8c2a3;overflow-x:hidden;-webkit-font-smoothing:antialiased}
body::before{content:"";position:fixed;inset:-16px;z-index:-1;background:var(--bg-image) center/cover;filter:blur(2.5px)}
body.lock{overflow:hidden}
img{display:block;width:100%;height:100%;object-fit:cover}
button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}
a{color:inherit;text-decoration:none}
.ph{background:linear-gradient(145deg,var(--rose),var(--copper))}
[hidden]{display:none!important}
.dc{display:contents}
.eyebrow:empty,.lead:empty{display:none}

/* loader */
.loader{position:fixed;inset:0;z-index:200;display:grid;place-items:center;text-align:center;
 background:rgba(236,216,189,.12);backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);transition:opacity 1s,visibility 1s}
.loader.done{opacity:0;visibility:hidden}
.loader img{width:clamp(110px,22vw,170px);height:auto;margin:0 auto 6px;animation:breathe 2.4s ease-in-out infinite}
.lw{font-family:var(--serif);font-weight:500;font-size:clamp(34px,8vw,54px);letter-spacing:.22em;color:var(--copper-d);padding-left:.22em}
.lt{font-size:12px;letter-spacing:.4em;text-transform:uppercase;color:var(--copper-d);margin-top:6px}
.lh{color:var(--copper);margin-top:14px;animation:breathe 1.6s ease-in-out infinite}
@keyframes breathe{50%{transform:scale(1.07);opacity:.8}}

/* one connected sheet */
.page{position:relative;width:100%;margin:0;overflow:hidden;
 background:var(--glass);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}
header{position:absolute;z-index:20;top:0;left:0;right:0;display:grid;grid-template-columns:var(--cols);align-items:center}
.hline{grid-column:1;grid-row:1;align-self:end;height:1px;background:var(--line);pointer-events:none}
.hctl{grid-column:2;grid-row:1;display:flex;align-items:center;gap:12px;padding-left:clamp(16px,2.6vw,44px)}
.brand{grid-column:1;grid-row:1;display:flex;align-items:center;gap:14px;padding:22px 0 22px clamp(18px,4vw,60px)}
.brand img{width:50px;height:50px;object-fit:contain;flex:none}
.brand b{display:block;font-family:var(--serif);font-weight:600;font-size:26px;letter-spacing:.26em;color:var(--copper-d);line-height:1}
.brand small{display:block;font-size:9px;letter-spacing:.34em;text-transform:uppercase;margin-top:5px;color:var(--copper)}
.bag{position:relative;display:grid;place-items:center;width:50px;height:50px;border-radius:50%;background:var(--copper);box-shadow:0 10px 24px -10px rgba(74,43,27,.6);transition:.3s}
.bag:hover,.burger:hover{background:var(--copper-d)}
.bi{position:relative;display:block;width:18px;height:15px;margin-top:7px;border-radius:3px 3px 5px 5px;background:var(--cream)}
.bi::before{content:"";position:absolute;left:50%;top:-8px;width:10px;height:9px;transform:translateX(-50%);border:2px solid var(--cream);border-bottom:0;border-radius:8px 8px 0 0}
.bag b{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;background:var(--cream);color:var(--copper-d);font-size:11px;font-weight:500;display:grid;place-items:center;padding:0 5px;box-shadow:0 2px 8px -2px rgba(74,43,27,.5)}
.bag.bump{animation:bump .5s}
@keyframes bump{40%{transform:scale(1.18)}}
.burger{width:50px;height:50px;border-radius:50%;display:grid;place-content:center;gap:5px;background:var(--copper);box-shadow:0 10px 24px -10px rgba(74,43,27,.6);transition:.3s}
.burger i{display:block;width:20px;height:2px;border-radius:2px;background:var(--cream);transition:.4s}
.burger i:nth-child(2){width:14px;margin-left:auto}
.burger:hover i:nth-child(2){width:20px}

.hero{display:grid;grid-template-columns:var(--cols);min-height:100vh}
.left{padding:clamp(110px,16vh,150px) clamp(18px,4vw,60px) 44px;display:flex;flex-direction:column;justify-content:center;gap:clamp(28px,5vh,52px);min-width:0}
.eyebrow{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:var(--copper);margin-bottom:16px}
h1{font-family:var(--serif);font-weight:500;font-size:clamp(44px,6.2vw,96px);line-height:1;color:var(--cocoa)}
h1 em{display:block;color:var(--copper)}
.lead{max-width:430px;line-height:1.75;margin-top:20px;font-size:15px;color:rgba(74,43,27,.78)}
.heroprods{display:grid;grid-template-columns:1fr 1fr;gap:clamp(14px,2vw,26px);max-width:760px}
.right{position:relative;min-height:560px}
.model{position:absolute;inset:0;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 30%);mask-image:linear-gradient(90deg,transparent 0,#000 30%)}
.model img{object-position:50% 20%;animation:drift 20s ease-in-out infinite alternate}
@keyframes drift{from{transform:scale(1.02)}to{transform:scale(1.1) translateY(-1%)}}
.reviews{position:absolute;left:12%;right:clamp(18px,3vw,40px);bottom:clamp(20px,4vh,40px);height:116px;border-radius:32px;overflow:hidden;
 background:rgba(244,232,211,.8);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);box-shadow:0 20px 50px -24px rgba(74,43,27,.6)}
.rv{position:absolute;inset:0;display:grid;grid-template-columns:44px 1fr;column-gap:14px;align-content:center;padding:0 24px;opacity:0;transform:translateX(36px);transition:opacity .8s,transform .8s}
.rv.on{opacity:1;transform:none}
.av{grid-row:span 2;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;align-self:center;background:var(--copper);color:var(--cream);font-family:var(--serif);font-size:20px}
.rv .top{display:flex;gap:10px;align-items:center;font-size:13px;font-weight:400}
.stars{color:var(--copper);letter-spacing:3px;font-size:12px}
.rv p{font-size:13px;line-height:1.5;margin-top:3px;color:rgba(74,43,27,.8)}

/* cards */
.card,.hp{position:relative}
.pic{position:relative;overflow:hidden;border-radius:26px;display:flex;flex-direction:column;justify-content:flex-end;box-shadow:0 24px 50px -28px rgba(74,43,27,.7)}
.hp .pic{height:clamp(250px,36vh,340px)}.card .pic{aspect-ratio:4/5}
.pic .im{position:absolute;inset:0;transition:transform 1.2s cubic-bezier(.2,.7,.2,1)}
.pic:hover .im{transform:scale(1.07)}
.pic::before{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(to top,rgba(58,32,20,.88) 6%,rgba(58,32,20,.1) 55%,transparent)}
.info{position:relative;z-index:2;padding:0 20px 14px;color:var(--cream)}
.im .bl{position:absolute;left:-14px;top:-14px;width:calc(100% + 28px);height:calc(100% + 28px);filter:blur(7px);pointer-events:none;
 -webkit-mask-image:linear-gradient(to top,#000 0,#000 22%,transparent 58%);mask-image:linear-gradient(to top,#000 0,#000 22%,transparent 58%)}
.info h3{font-family:var(--serif);font-weight:500;font-size:24px;line-height:1.1}
.info p{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.75;margin-top:4px}
.price{color:#f3cba8;font-size:14px;letter-spacing:.05em;margin-top:4px}
.arch{position:relative;z-index:2;display:block;width:100%;padding:11px 0 13px;text-align:center;font-size:11px;letter-spacing:.28em;text-transform:uppercase;font-weight:500;color:var(--cream);
 background:linear-gradient(120deg,var(--copper-d),var(--copper),var(--rose));background-size:200% 100%;border-radius:50% 50% 0 0/100% 100% 0 0;transition:background-position .6s,letter-spacing .4s}
.arch:hover{background-position:100% 0;letter-spacing:.36em}

section{padding:clamp(60px,10vh,110px) clamp(18px,4vw,60px) 10px}
.sec-head{display:flex;justify-content:space-between;align-items:end;gap:20px;flex-wrap:wrap;margin-bottom:44px}
.sec-head h2{font-family:var(--serif);font-weight:500;font-size:clamp(36px,5vw,66px);line-height:1}
.sec-head h2 em{color:var(--copper)}
.sec-head p{max-width:340px;line-height:1.7;font-size:14px;color:rgba(74,43,27,.7)}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:clamp(16px,2.4vw,34px)}
.card:nth-child(3n+2){margin-top:44px}
.story{display:grid;grid-template-columns:repeat(var(--scols,3),1fr);gap:30px;text-align:center;padding-top:clamp(50px,9vh,100px)}
.story h4{font-family:var(--serif);font-weight:500;font-size:26px;color:var(--copper-d);margin-bottom:8px}
.story p{font-size:14px;line-height:1.7;max-width:300px;margin:auto;color:rgba(74,43,27,.7)}

footer{margin-top:clamp(60px,9vh,100px);padding:60px clamp(18px,4vw,60px) 34px;color:var(--cream);
 background:linear-gradient(to bottom,rgba(181,105,63,0),rgba(142,74,42,.92) 38%)}
.fgrid{display:grid;grid-template-columns:1.4fr repeat(var(--fcols,2),1fr);gap:36px;max-width:1200px;margin:auto}
footer .fb{font-family:var(--serif);font-weight:600;font-size:30px;letter-spacing:.24em}
footer .ft{font-size:10px;letter-spacing:.34em;text-transform:uppercase;opacity:.8;margin:6px 0 18px}
footer p,footer li{font-size:14px;line-height:1.8;opacity:.85}
footer ul{list-style:none}footer li a:hover{opacity:.6}
footer h5{font-family:var(--serif);font-weight:500;font-size:20px;margin-bottom:10px}
footer form{display:flex;max-width:360px;border-radius:40px;background:rgba(244,232,211,.16);padding:5px;margin-top:6px}
footer input{flex:1;min-width:0;background:none;border:0;outline:0;color:var(--cream);padding:0 18px;font:inherit;font-size:14px}
footer input::placeholder{color:rgba(244,232,211,.6)}
footer form button{padding:11px 22px;border-radius:30px;background:var(--cream);color:var(--copper-d);font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:500}
.copy{text-align:center;font-size:12px;letter-spacing:.1em;opacity:.65;margin-top:44px}

/* menu + bag drawers */
.scrim{position:fixed;inset:0;z-index:60;background:rgba(74,43,27,.35);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px);opacity:0;visibility:hidden;transition:.4s}
.panel{position:fixed;top:0;right:0;bottom:0;z-index:70;width:min(420px,100%);display:flex;flex-direction:column;background:rgba(244,232,211,.9);
 backdrop-filter:blur(26px);-webkit-backdrop-filter:blur(26px);transform:translateX(105%);visibility:hidden;transition:transform .55s cubic-bezier(.2,.8,.2,1),visibility .55s}
body.menu-open #menu,body.cart-open #drawer{transform:none;visibility:visible}
body.menu-open .scrim,body.cart-open .scrim{opacity:1;visibility:visible}
body.menu-open,body.cart-open{overflow:hidden}
.ph-head{display:flex;justify-content:space-between;align-items:center;padding:22px 26px}
.ph-head h2{font-family:var(--serif);font-weight:500;font-size:30px;color:var(--copper-d)}
.x{font-size:32px;line-height:1;width:44px;height:44px}
#menu nav{display:flex;flex-direction:column;padding:10px 26px;gap:4px}
#menu nav a{font-family:var(--serif);font-size:38px;padding:8px 0;color:var(--cocoa);transition:.3s}
#menu nav a:hover{color:var(--copper);padding-left:10px}
#menu p{margin-top:auto;padding:26px;font-size:13px;letter-spacing:.1em;color:var(--copper-d)}
#cartList{list-style:none;flex:1;overflow-y:auto;padding:4px 26px}
.ci{display:grid;grid-template-columns:70px 1fr auto;gap:14px;align-items:center;padding:16px 0}
.ci .th{width:70px;height:86px;border-radius:16px;overflow:hidden}
.ci h5{font-family:var(--serif);font-weight:500;font-size:20px;line-height:1.15}
.ci .price{color:var(--copper-d);margin:3px 0 8px}
.qty{display:inline-flex;align-items:center;border-radius:20px;background:rgba(181,105,63,.14)}
.qty button{width:30px;height:28px;font-size:16px;color:var(--copper-d)}
.qty span{min-width:22px;text-align:center;font-size:13px}
.rm{font-size:22px;width:32px;height:32px;opacity:.5}
.df{padding:20px 26px 28px;background:rgba(181,105,63,.1)}
.sum{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px}
.sum strong{font-family:var(--serif);font-size:28px;font-weight:500;color:var(--copper-d)}
.df small{display:block;font-size:12px;opacity:.65;margin-bottom:16px}
.co{width:100%;padding:15px 24px;border-radius:30px;background:var(--copper);color:var(--cream);font-size:11px;letter-spacing:.26em;text-transform:uppercase;font-weight:500;transition:.3s}
.co:hover{background:var(--copper-d)}
.emp{display:none;flex:1;flex-direction:column;align-items:center;justify-content:center;gap:20px;font-family:var(--serif);font-size:26px;opacity:.8}
.emp .co{width:auto}
#drawer.empty #cartList,#drawer.empty .df{display:none}#drawer.empty .emp{display:flex}
.t-det{display:none}#drawer.details .t-det{display:block}#drawer.details .t-bag{display:none}
.cof{display:none;flex:1;flex-direction:column;gap:16px;overflow-y:auto;padding:4px 26px 28px}
#drawer.details .cof{display:flex}#drawer.details #cartList,#drawer.details .df,#drawer.details .emp{display:none!important}
.cof-sum{display:flex;justify-content:space-between;align-items:baseline}
.cof-sum strong{font-family:var(--serif);font-size:26px;font-weight:500;color:var(--copper-d)}
.cof-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px 12px}
.cof label{grid-column:1/-1}.cof label.half{grid-column:auto}
.cof label span{display:block;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--copper-d);margin-bottom:6px}
.cof input,.cof textarea{display:block;width:100%;font:inherit;font-size:15px;color:var(--cocoa);background:rgba(255,255,255,.55);border:1px solid rgba(181,105,63,.3);border-radius:16px;padding:12px 14px;outline:0;transition:.25s;resize:vertical}
.cof textarea{min-height:84px}
.cof input:focus,.cof textarea:focus{border-color:var(--copper);background:#fff}
.cof input:invalid:not(:placeholder-shown){border-color:#b3472f}
.cof-back{align-self:center;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--copper-d);padding:6px}
.toast{position:fixed;left:50%;bottom:26px;transform:translate(-50%,130px);background:var(--copper-d);color:var(--cream);padding:13px 24px;border-radius:40px;font-size:13px;z-index:90;transition:transform .5s cubic-bezier(.2,.8,.2,1);max-width:90vw;text-align:center}
.toast.show{transform:translate(-50%,0)}
button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--copper);outline-offset:3px}

.rise{opacity:0;transform:translateY(30px);transition:opacity 1s,transform 1s cubic-bezier(.2,.7,.2,1)}
.rise.in{opacity:1;transform:none}
.intro>*{opacity:0}
body.ready .intro>*{animation:up 1.1s both}
body.ready .intro>*:nth-child(2){animation-delay:.15s}body.ready .intro>*:nth-child(3){animation-delay:.3s}
@keyframes up{from{opacity:0;transform:translateY(26px)}to{opacity:1;transform:none}}

@media(max-width:900px){
 header{display:flex;padding:16px;gap:10px}.hline{position:absolute;left:0;right:0;bottom:0}.brand{padding:0}.hctl{margin-left:auto;padding-left:0;gap:10px}.bag,.burger{width:44px;height:44px}
 .brand img{width:40px;height:40px}.brand b{font-size:20px;letter-spacing:.2em}.brand small{font-size:8px;letter-spacing:.28em}
 .hero{display:flex;flex-direction:column;min-height:0}
 .left,.right{display:contents}
 .intro{order:1;padding:96px 20px 0}.model{order:2;position:relative;inset:auto;height:430px;margin-top:10px;
  -webkit-mask-image:linear-gradient(180deg,transparent 0,#000 18%,#000 80%,transparent);mask-image:linear-gradient(180deg,transparent 0,#000 18%,#000 80%,transparent)}
 .heroprods{order:3;padding:0 16px;max-width:none;gap:12px}
 .reviews{order:4;position:relative;left:auto;right:auto;bottom:auto;margin:22px 16px 6px;height:132px}
 .hp .pic{height:240px}.info{padding:0 14px 10px}.info h3{font-size:19px}
 section{padding:56px 14px 6px}
 .grid{grid-template-columns:1fr 1fr;gap:12px}.card:nth-child(3n+2){margin-top:0}.card:nth-child(even){margin-top:30px}
 .story{grid-template-columns:1fr}.fgrid{grid-template-columns:1fr}
 #menu nav a{font-size:34px}
}
@media(min-width:901px){
 h1{font-size:clamp(42px,5.3vw,84px)}
 .model{-webkit-mask-image:none;mask-image:none;border-radius:0 0 0 var(--model-radius);border:1px solid var(--line);border-top:0;border-right:0;box-shadow:-34px 0 60px -42px rgba(74,43,27,.55)}
 .hctl{justify-self:start;transform:translateX(-100%);padding:0 38px 0 0}
 .reviews{left:7%}
}
@media(prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}.intro>*,.rise{opacity:1;transform:none}}

/* "view all" button */
.viewall{text-align:center;margin-top:clamp(28px,5vh,50px)}
.btn{display:inline-block;padding:15px 34px;border-radius:30px;background:var(--copper);color:var(--cream);font-size:11px;letter-spacing:.26em;text-transform:uppercase;font-weight:500;transition:.3s}
.btn:hover{background:var(--copper-d)}
