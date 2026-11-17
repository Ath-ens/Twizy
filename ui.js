/* Version 23 : nouvelle interface « façon Plans ».
   Carte plein écran, un seul panneau en verre dépoli (onglets, recherche, filtres), police et couleurs de l'iPhone,
   raccourcis en haut du formulaire de trajet, saisie plus fluide. Chargé après app.js et extras.js. */
(() => {
const UV = 23;
const css = document.createElement("style");
css.textContent = `
:root{--accent:#0a84ff;--night:#0a84ff;--bg:#f2f2f7;--card:rgba(255,255,255,.93);--solid:#ffffff;--fg:#111114;--muted:#6c6c74;
  --line:rgba(60,60,67,.13);--field:rgba(118,118,128,.12);--ok:#2f9e4f;--warn:#c25400;--ef:#e89a0c;
  --f-display:-apple-system,"SF Pro Display",system-ui,"Segoe UI",Roboto,sans-serif;--f-body:-apple-system,"SF Pro Text",system-ui,"Segoe UI",Roboto,sans-serif}
@media (prefers-color-scheme: dark){:root{--bg:#000;--card:rgba(30,30,32,.92);--solid:#636366;--fg:#f5f5f7;--muted:#9c9ca4;
  --line:rgba(255,255,255,.11);--field:rgba(118,118,128,.26);--ok:#3fbf6a;--warn:#ff9f45;--ef:#f5b82e}}
body{font:16px/1.4 var(--f-body);letter-spacing:-.01em}
button{font-family:var(--f-body)}
/* En-tête : il disparaît, la carte prend tout l'écran */
.top{background:transparent!important;box-shadow:none!important;padding:0!important;height:calc(env(safe-area-inset-top,0px) + 4px);pointer-events:none}
.top .brand{display:none!important}
.leaflet-control-attribution{border-radius:8px 0 0 8px;font-size:9px!important;opacity:.6!important;background:rgba(255,255,255,.7)!important}
/* Panneau unique */
.sheet{background:var(--card);-webkit-backdrop-filter:saturate(1.8) blur(26px);backdrop-filter:saturate(1.8) blur(26px);border-radius:24px 24px 0 0;box-shadow:0 -1px 0 var(--line),0 -8px 30px rgba(0,0,0,.14)}
.handle{flex-direction:column;align-items:stretch;gap:10px;padding:18px max(16px,env(safe-area-inset-right,0px)) 8px max(16px,env(safe-area-inset-left,0px));min-height:0}
.handle::before{top:7px;width:38px;height:5px;background:rgba(127,127,135,.38)}
.hrow{display:flex;align-items:center;gap:10px;min-height:44px}
.tabs{background:var(--field);border-radius:11px;padding:2px;display:flex;gap:0}
.tabs button{flex:1;color:var(--fg);height:34px;font-size:14px;font-weight:600;border-radius:9px;padding:0}
.tabs button[aria-selected="true"]{background:var(--solid);color:var(--fg);box-shadow:0 2px 6px rgba(0,0,0,.12)}
#mapBar{gap:10px}
#mapBar input[type=search]{background:var(--field) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%238e8e93' stroke-width='2.4' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M20 20l-3.5-3.5'/%3E%3C/svg%3E") no-repeat 12px 50%;padding-left:38px;color:var(--fg);height:42px;border-radius:12px}
input[type=search]::placeholder,input[type=text]::placeholder,input[type=number]::placeholder{color:var(--muted)}
.chips{margin:0 -16px;padding:0 16px 2px}
.chip{background:var(--field);color:var(--fg);height:34px;font-size:14px;font-weight:500;padding:0 13px}
.chip[aria-pressed="true"]{background:var(--accent);color:#fff}
.h-title{font:700 22px/1.2 var(--f-display);letter-spacing:-.02em}
.h-sub{font-size:14px}
.back{background:var(--field);color:var(--accent)}
.spin{border-color:var(--line);border-top-color:var(--accent)}
.sugg{background:var(--solid);border-radius:14px;box-shadow:0 12px 32px rgba(0,0,0,.22)}
@media (prefers-color-scheme: dark){.sugg{background:#2c2c2e}}
.sugg li{border-top:1px solid var(--line)}
/* Boutons */
.primary{background:var(--accent);color:#fff;font:600 17px var(--f-body);text-transform:none;letter-spacing:-.01em;border-radius:14px;height:52px}
.act{background:var(--field);color:var(--fg);border-radius:12px;font-weight:600}
.act.wide{background:var(--accent);color:#fff;font:600 17px var(--f-body);text-transform:none;letter-spacing:-.01em}
.act.plug{background:var(--ok);color:#fff}
.act[aria-pressed="true"]{color:#e0245e}
.ghost{background:var(--field);color:var(--accent);font-weight:600;border-radius:12px}
.navb{background:var(--field);color:var(--fg);border:0;font-weight:600}
.navb.pref{background:var(--accent);color:#fff}
.go{background:var(--accent);border-radius:10px}
.quick button,.seg button{background:var(--field);border:0;color:var(--fg);border-radius:10px;font-weight:500}
.quick button[aria-pressed="true"],.seg button[aria-pressed="true"]{background:var(--accent);color:#fff}
.swap{background:var(--field);color:var(--accent)}
/* Formulaires */
.field label,.set label,.xh{text-transform:none!important;letter-spacing:0!important;font-size:13px!important;font-weight:600!important;color:var(--muted)!important}
.field input,.logadd input{background:var(--field);border:0;color:var(--fg)}
.set output{font:600 17px var(--f-body)}
input[type=range]::-webkit-slider-runnable-track{height:4px;background:var(--line)}
input[type=range]::-webkit-slider-thumb{width:28px;height:28px;background:#fff;border:0;box-shadow:0 2px 8px rgba(0,0,0,.25),0 0 0 .5px rgba(0,0,0,.06);margin-top:-12px}
.check input{accent-color:var(--accent)}
details{border-top:0;background:var(--field);border-radius:14px;padding:4px 14px}
details[open]{padding-bottom:14px}
summary{min-height:44px}
.form{gap:16px}
/* Raccourcis du trajet : Maison, Travail, récents sur une seule ligne */
.shortcuts{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 -16px;padding:2px 16px}
.shortcuts::-webkit-scrollbar{display:none}
.shortcuts .places,.shortcuts .quick{display:contents}
.shortcuts button{flex:none!important;height:38px!important;padding:0 14px!important;border-radius:999px!important;border:0!important;background:var(--field)!important;color:var(--fg)!important;font-size:14px!important;font-weight:500!important;white-space:nowrap}
.shortcuts .places button.set{background:var(--accent)!important;color:#fff!important}
.addvia{border:0!important;background:transparent!important;color:var(--accent)!important;font-weight:600;padding:0!important;height:30px!important}
.via-row .vdel{background:var(--field)!important;border:0!important}
/* Listes et étiquettes */
.list li{border-top:1px solid var(--line);min-height:64px}
.list .d{font:600 15px var(--f-body);color:var(--muted)}
.empty{border-top:0}
.tag{font-size:11px;font-weight:600;letter-spacing:0;text-transform:none;padding:3px 8px;border-radius:999px}
.tag.ef{background:rgba(232,154,12,.16);color:#a86400}.tag.t2{background:rgba(10,132,255,.13);color:#0a6cd6}.tag.free{background:rgba(47,158,79,.14);color:#23803e}
.tag.h24{background:rgba(118,118,128,.16);color:var(--fg)}.tag.src{background:rgba(118,118,128,.12);border:0}.tag.ok{background:rgba(47,158,79,.14);color:#23803e}.tag.ko{background:rgba(224,36,94,.13);color:#c41c4f}
@media (prefers-color-scheme: dark){.tag.ef{color:#f5b82e}.tag.t2{color:#5aa2f0}.tag.free,.tag.ok{color:#5fd683}.tag.ko{color:#ff6b8f}}
.summary div{background:var(--field);border-radius:14px}
.summary b{font:700 19px var(--f-body);letter-spacing:-.02em}
.summary span{text-transform:none;letter-spacing:0;font-size:12px}
.pin{background:var(--accent);font:700 14px var(--f-body)}
.pin.stop{background:#f5b82e}
.steps .clock{font:600 15px var(--f-body)}
.alert{border-radius:14px}
.cmp,.mine,.rt{border:0!important;background:var(--field);border-radius:16px}
.offbox{border:0;border-radius:16px}
.stopinfo{border-radius:16px}
.stopinfo b{font:700 17px var(--f-body)}
.cbig{font:700 54px/1 var(--f-display);letter-spacing:-.03em}
.end-icon{background:var(--accent)}
.num-icon,.end-icon{font:700 14px var(--f-body)}
/* Boutons flottants */
.fab button{background:var(--card);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);color:var(--accent);width:50px;height:50px;box-shadow:0 4px 16px rgba(0,0,0,.18)}
.fab button[aria-pressed="true"]{background:var(--accent);color:#fff}
.cpill{background:var(--ok);font:600 15px var(--f-body)}
/* Guidage : bandeau vert façon Plans */
.g-top{background:#1d7a45;padding-bottom:16px}
.g-arrow{background:rgba(255,255,255,.16);color:#fff;border-radius:18px}
.g-dist{font:700 34px/1 var(--f-display);letter-spacing:-.02em}
.g-ins{font-size:17px;font-weight:500}
.g-bot{background:var(--card);-webkit-backdrop-filter:saturate(1.8) blur(26px);backdrop-filter:saturate(1.8) blur(26px);border-radius:24px 24px 0 0}
.g-info b{font:700 26px/1 var(--f-display)}
.g-btn{background:var(--field);color:var(--fg)}
.g-btn.stop{background:#ff3b30;color:#fff}
.g-rec{background:var(--accent)}
.news-card{border-radius:22px}.news-h{font:700 22px/1.2 var(--f-display)}
.g-row{flex-wrap:wrap;gap:8px}
.g-info{flex:1 1 100%;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.g-info span{font-size:14px}
.g-row .g-btn{flex:1;padding:0 6px}
.g-row .g-btn.stop{flex:1.6}
button:focus-visible,a:focus-visible{outline:2px solid var(--accent)!important;outline-offset:2px}
input:focus,input:focus-visible,textarea:focus{outline:none!important;box-shadow:0 0 0 2px var(--accent)}
.verlink{display:block;margin-top:4px;background:none;color:var(--accent);font-size:14px;font-weight:600;text-decoration:none;opacity:1}
`;
document.head.appendChild(css);

/* Couleur du trajet : bleu Plans */
COL.route = dark ? "#4aa3ff" : "#0a84ff";

/* Onglets, recherche et filtres passent dans le panneau du bas (comme Plans). */
const handle = $("handle"), hrow = document.createElement("div"); hrow.className = "hrow";
[$("back"), handle.querySelector(".htxt"), $("spin")].forEach(n => n && hrow.appendChild(n));
handle.prepend(document.querySelector(".tabs"));
handle.insertBefore($("mapBar"), handle.querySelector(".tabs").nextSibling);
handle.appendChild(hrow);
// Toucher un champ ou un onglet du panneau ne doit pas lancer le glissement du panneau.
["pointerdown", "touchstart"].forEach(ev => [document.querySelector(".tabs"), $("mapBar")].forEach(el => el.addEventListener(ev, e => e.stopPropagation(), {passive:true})));

/* Formulaire de trajet : Maison, Travail et récents en raccourcis tout en haut */
const sc = document.createElement("div"); sc.className = "shortcuts";
const form = $("tripForm"), places = form.querySelector(".places");
form.insertBefore(sc, form.querySelector(".route-fields"));
if (places) sc.appendChild(places);
sc.appendChild($("recents"));
// L'offre de trajet enregistré reste au-dessus de tout.
if ($("offBox")) form.prepend($("offBox"));

/* Numéro de version et nouveautés : dans les réglages */
const ver = document.querySelector(".ver");
if (ver){ ver.className = "verlink"; ver.textContent = "Version " + UV + " · Nouveautés"; document.querySelector("#carSet .dgrid").appendChild(ver); ver.onclick = () => showNews(0); }

/* Saisie fluide : le panneau s'ouvre en grand quand on écrit, et l'écran ne saute plus sous le clavier. */
document.addEventListener("focusin", e => {
  const el = e.target; if (!el.matches || !el.matches("#sheet input[type=search], #sheet input[type=text], #sheet input[type=number], #sheet textarea")) return;
  if (snapName !== "full") setSnap("full");
  setTimeout(() => window.scrollTo(0, 0), 60);
});
if (window.visualViewport) visualViewport.addEventListener("resize", () => { if (window.scrollY) window.scrollTo(0, 0); });

/* Suggestions d'adresses plus rapides : un service lent n'attend plus 6 secondes, et les mêmes recherches sont gardées. */
const gfCache = new Map();
getFeatures = async (url, fn) => {
  if (gfCache.has(url)) return gfCache.get(url).map(fn).filter(Boolean);
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), /photon/.test(url) ? 2500 : 3500);
    const r = await fetch(url, {signal:ctl.signal}).finally(() => clearTimeout(to));
    if (!r.ok) return [];
    const feats = (await r.json()).features || [];
    gfCache.set(url, feats); if (gfCache.size > 80) gfCache.delete(gfCache.keys().next().value);
    return feats.map(fn).filter(Boolean);
  } catch(e){ return []; }
};

/* Redessine tout de suite avec la nouvelle disposition */
setSnap(snapName);
if (mode === "map") renderList();

/* Nouveautés */
CHANGELOG.unshift([UV, "17 nov.", ["Nouvelle interface façon Plans : carte plein écran, un seul panneau avec onglets, recherche et filtres", "Police et couleurs de l'iPhone, boutons plus simples",
  "Maison, Travail et trajets récents en raccourcis en haut de Trajet", "Écriture plus fluide et suggestions d'adresses plus rapides", "Numéro de version et nouveautés : dans « Réglages de ma Twizy »"]]);
CHANGELOG.sort((a, b) => b[0] - a[0]);
const seen = +store.get("seenX") || 0;
if (seen < UV){ store.set("seenX", UV); if (store.get("seenVersion")) setTimeout(() => { if (!document.querySelector(".news")) showNews(Math.min(seen, 22)); }, 900); }
})();
