/* Version 21 : ajouts chargés après app.js (ils utilisent ses fonctions).
   Maison / Travail · Aller-retour · Éviter les routes rapides · Sauvegarde des données · Raccourcis Siri · Mode support voiture. */
(() => {
const XV = 22;
const css = document.createElement("style");
css.textContent = `
.places{display:flex;gap:8px}
.places button{flex:1;height:46px;border-radius:12px;background:var(--field);border:1px solid var(--line);font-size:15px}
.places button.set{background:var(--night);color:#fff;border-color:var(--night)}
#rtOpts{display:flex;flex-direction:column;gap:8px;margin-top:4px}
.rt{margin-top:16px;border:1px solid var(--line);border-radius:14px;padding:12px 14px}
.rt-h{font:700 18px var(--f-display);letter-spacing:.02em;margin-bottom:4px}
.rt .m{font-size:13px;color:var(--muted)}
.xbtns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.xbtns .act{height:46px}
.siri{display:flex!important;flex-direction:column;align-items:stretch;gap:6px;text-align:left}
.siri .row2{display:flex;gap:8px;align-items:center}
.siri code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;background:var(--field);border-radius:8px;padding:8px}
.siri .act{height:40px;padding:0 12px;flex:none}
.via-row .vrow{display:flex;gap:6px}
.via-row .vdel{flex:none;width:46px;height:46px;border-radius:12px;background:var(--field);border:1px solid var(--line);font-size:20px;color:var(--muted)}
.addvia{align-self:flex-start;height:40px;padding:0 14px;border-radius:999px;background:var(--field);border:1px dashed var(--line);font-size:14px}
.via-icon{background:#7c3aed!important;color:#fff!important;font-size:12px!important}
.pin.via{background:#7c3aed}
.xh{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
/* Mode support voiture : tout en grand pendant le guidage */
body.bigui .g-top{padding-top:calc(env(safe-area-inset-top,0px) + 16px);padding-bottom:18px}
body.bigui .g-arrow{width:104px;height:104px;font-size:72px;border-radius:22px}
body.bigui .g-dist{font-size:58px}
body.bigui .g-ins{font-size:22px;font-weight:600}
body.bigui .g-info b{font-size:40px}
body.bigui .g-info span{font-size:16px}
body.bigui #gNorth,body.bigui #gShare{display:none}
body.bigui .g-btn{height:60px;font-size:20px}
body.bigui .g-me{transform:scale(1.35)}
@media (orientation:landscape){body.bigui .g-top{right:auto;width:46%;bottom:0;flex-direction:column;align-items:flex-start;justify-content:center}
  body.bigui .g-bot{left:auto;width:54%;border-radius:20px 0 0 0}}
`;
document.head.appendChild(css);
const toast = t => { $("hSub").textContent = t; };
const short = l => String(l || "").split(/\s\d{5}\s?/)[0];

/* ---------- 2. Maison / Travail ---------- */
let places = jget("places", {});
const PL = {home:"🏠 Maison", work:"💼 Travail"};
const box = document.createElement("div"); box.className = "places";
$("recents").before(box);
function paintPlaces(){
  box.replaceChildren(...Object.keys(PL).map(k => { const b = document.createElement("button"); b.type = "button";
    b.className = places[k] ? "set" : ""; b.textContent = places[k] ? PL[k] : "+ " + PL[k].split(" ")[1];
    let t = 0, long = false;
    b.onpointerdown = () => { long = false; t = setTimeout(() => { long = true; if (places[k] && confirm("Effacer l'adresse « " + PL[k] + " » ?")){ delete places[k]; jset("places", places); paintPlaces(); } }, 650); };
    b.onpointerup = b.onpointerleave = () => clearTimeout(t);
    b.onclick = async () => { if (long) return;
      if (places[k]){ setPlace($("to"), places[k]); $("tripForm").requestSubmit(); return; }
      const to = $("to");
      let p = to.dataset.lat ? {label:to.value, lat:+to.dataset.lat, lng:+to.dataset.lng} : null;
      if (!p){ try { const me2 = await getPos(); p = {label:PL[k].split(" ")[1], lat:me2.lat, lng:me2.lng}; } catch(e){ toast("Écrivez l'adresse dans « Arrivée », puis retouchez le bouton."); return; } }
      places[k] = p; jset("places", places); paintPlaces();
      toast(PL[k] + " enregistrée : " + short(p.label) + ". Appui long pour l'effacer.");
    };
    return b; }));
}
paintPlaces();

/* ---------- 3. Aller-retour ---------- */
const rt = Object.assign({on:false, stay:120, charge:false}, jget("rt", {}));
const rtBox = document.createElement("div"); rtBox.className = "set";
rtBox.innerHTML = `<label class="check" style="grid-column:1/-1;text-transform:none;letter-spacing:0;font-size:15px;color:var(--fg);font-weight:500"><input type="checkbox" id="rtOn"> ↩ Prévoir aussi le retour</label>
  <div id="rtOpts" style="grid-column:1/-1"><span class="xh">Temps sur place</span><div class="quick" id="rtStay"></div>
  <label class="check" style="text-transform:none;letter-spacing:0;font-size:15px;color:var(--fg);font-weight:500"><input type="checkbox" id="rtCharge"> Je recharge sur place</label></div>`;
$("carSet").before(rtBox);
const STAYS = [[30, "30 min"], [60, "1 h"], [120, "2 h"], [240, "4 h"], [480, "8 h"]];
function paintRt(){
  $("rtOn").checked = rt.on; $("rtOpts").hidden = !rt.on; $("rtCharge").checked = rt.charge;
  $("rtStay").replaceChildren(...STAYS.map(([v, l]) => { const b = document.createElement("button"); b.type = "button"; b.textContent = l;
    b.setAttribute("aria-pressed", rt.stay === v); b.onclick = () => { rt.stay = v; jset("rt", rt); paintRt(); }; return b; }));
}
$("rtOn").onchange = () => { rt.on = $("rtOn").checked; jset("rt", rt); paintRt(); };
$("rtCharge").onchange = () => { rt.charge = $("rtCharge").checked; jset("rt", rt); };
paintRt();
function arrivalSoc(t){
  const pct = 100 / (t.range || cfg.range) * (t.climbF || 1);
  const ch = t.stops.filter(x => !x.via);
  if (!ch.length) return cfg.soc - t.km * pct;
  const x = ch[ch.length - 1];
  return x.chargeTo - (t.km - x.s.km + (x.s.detour || 0)) * pct;
}
/* Zoom sur un trajet minuscule (départ = arrivée) : Leaflet calculait un zoom infini et la carte plantait. */
const fitB = map.fitBounds.bind(map);
map.fitBounds = (bb, o) => {
  try { const B = L.latLngBounds(bb);
    if (!B.isValid()) return map;
    if (B.getNorthEast().distanceTo(B.getSouthWest()) < 80) return map.setView(B.getCenter(), Math.max(map.getZoom() || 15, 16));
  } catch(e) { return map; }
  return fitB(bb, o);
};
const goForward = $("tripForm").onsubmit;
$("tripForm").onsubmit = async e => {
  // Déjà sur place (ex. bouton Maison alors qu'on est à la maison) : pas de trajet à calculer.
  const to = $("to");
  if (to.dataset.lat && !$("from").value.trim()){
    let here = me; try { if (!here) here = await getPos(); } catch(err) {}
    if (here && hav(here, {lat:+to.dataset.lat, lng:+to.dataset.lng}) < 0.15){
      e.preventDefault(); toast("Vous êtes déjà à " + short(to.value) + " 🙂"); return;
    }
  }
  e.preventDefault();
  try { viaPts = await resolveVias(); } catch(err){ toast(err.message); return; }
  const before = lastTrip;
  await goForward(e);
  if (lastTrip && lastTrip !== before && lastVia.length) addVias(lastTrip);
  if (rt.on && lastTrip && lastTrip !== before && $("gGo")) await addReturn(lastTrip);
};
async function addReturn(t){
  const out = $("tripResult"), block = document.createElement("div"); block.className = "rt";
  block.innerHTML = `<div class="rt-h">↩ Retour</div><div class="m">Calcul du retour…</div>`;
  out.querySelector("#edit").before(block);
  const savedSoc = cfg.soc, savedClimb = climbF, savedRange = rangeNow;
  try {
    const arr = Math.max(0, arrivalSoc(t));
    const startSoc = rt.charge ? Math.min(cfg.target, Math.max(arr, arr + rt.stay / cfg.full * 100)) : arr;
    const dep = t.arrT + rt.stay * 6e4;
    skipVia = true; let r; try { r = await route(t.b, t.a); } finally { skipVia = false; }
    const sp = sampleRoute(r.pts);
    rangeNow = t.range || cfg.range;
    const f = (r.km + climbKm(r.up || 0, r.down || 0, rangeNow, r.km)) / Math.max(r.km, 0.1);
    climbF = f; cfg.soc = Math.round(startSoc);
    let cand = [];
    if (r.km * f > (cfg.soc - cfg.reserve) / 100 * rangeNow) ({list:cand} = await stationsAlong(sp, cfg.detour, () => {}));
    const res = plan(r.km, cand);
    cfg.soc = savedSoc; climbF = savedClimb; rangeNow = savedRange;
    const minPerKm = Math.max(r.min * 1.1, r.km / 36 * 60) / Math.max(r.km, 0.1);
    let tt = dep, prev = 0, back = 0;
    res.stops.forEach(x => { x.arrT = tt + ((x.s.km - prev) + back + x.s.detour) * minPerKm * 6e4; x.leaveT = x.arrT + x.minutes * 6e4; tt = x.leaveT; prev = x.s.km; back = x.s.detour; });
    const arrT = tt + (r.km - prev + back) * minPerKm * 6e4;
    L.polyline(r.pts.map(p => [p.lat, p.lng]), {color:"#1e8a52", weight:5, opacity:.8, dashArray:"8 8", interactive:false}).addTo(tripLayer);
    res.stops.forEach((x, i) => L.marker([x.s.lat, x.s.lng], {icon:pinIcon("R" + (i + 1), "num-icon"), zIndexOffset:400}).on("click", () => showDetail(x.s, "trip")).addTo(tripLayer));
    const ref = Date.now();
    let h = `<div class="m">Départ vers <b>${fmtClock(dep, ref)}</b> avec ${Math.round(startSoc)} %${rt.charge ? " (après recharge sur place)" : ""} · ${Math.round(r.km)} km</div>`;
    if (!res.ok){
      h += `<div class="alert">Retour impossible avec ${Math.round(startSoc)} % sans borne compatible sur le chemin.${rt.charge ? "" : " Cochez « Je recharge sur place » ou allongez le temps sur place."}</div>`;
    } else {
      res.stops.forEach((x, i) => { h += `<div class="m">⚡ Arrêt R${i + 1} : <b>${esc(x.s.name)}</b> · arrivée ${fmtClock(x.arrT, ref)} avec ${Math.round(x.arrive)} % → ${x.chargeTo} % (${fmtH(x.minutes)})</div>`; });
      h += `<div class="m">Arrivée au point de départ vers <b>${fmtClock(arrT, ref)}</b> avec environ ${Math.round(res.arrival)} %</div>
        <button type="button" class="ghost" id="rtGo">▶ Guider le retour</button>`;
    }
    block.innerHTML = `<div class="rt-h">↩ Retour</div>` + h;
    if ($("rtGo")) $("rtGo").onclick = async () => {
      lastTrip = {a:t.b, b:t.a, stops:res.stops, pts:sp, range:rangeNow || t.range, climbF:f, km:r.km, arrT, legs:null};
      await startGuide(); if (G) G.socBase = Math.round(startSoc);
    };
    setTripHead(tripHead.title + " et retour", tripHead.sub);
  } catch(e){
    cfg.soc = savedSoc; climbF = savedClimb; rangeNow = savedRange;
    block.innerHTML = `<div class="rt-h">↩ Retour</div><div class="alert">Retour non calculé : ${esc(e.message)}</div>`;
  }
}

/* ---------- 5. Éviter les routes rapides ---------- */
const slowBox = document.createElement("label"); slowBox.className = "check";
slowBox.innerHTML = `<input type="checkbox" id="slowRoads"> Éviter au maximum les routes rapides (80–90 km/h)`;
$("wx").closest("label").before(slowBox);
$("slowRoads").checked = store.get("slowRoads") === "1";
$("slowRoads").onchange = () => store.set("slowRoads", $("slowRoads").checked ? "1" : "0");
const realFetch = window.fetch.bind(window);
window.fetch = (u, o) => {
  try {
    if (typeof u === "string" && /valhalla[^/]*\/(route|isochrone)\?json=/.test(u) && store.get("slowRoads") === "1"){
      const [base, q] = u.split("?json="), body = JSON.parse(decodeURIComponent(q)), ms = body.costing_options && body.costing_options.motor_scooter;
      if (ms){ ms.use_primary = 0; ms.use_highways = 0; ms.use_living_streets = 0.6; u = base + "?json=" + encodeURIComponent(JSON.stringify(body)); }
    }
  } catch(e) {}
  return realFetch(u, o);
};

/* ---------- 7. Sauvegarde de mes données (changement de téléphone) ---------- */
const KEYS = ["cfg", "favs", "notes", "log", "recents", "filters", "places", "rt", "navApp", "gMuted", "gNorthUp", "ocmKey", "slowRoads", "bigui", "charge"];
const bk = document.createElement("div"); bk.className = "set";
bk.innerHTML = `<span class="xh" style="grid-column:1/-1">Sauvegarde de mes données</span>
  <div class="xbtns" style="grid-column:1/-1"><button type="button" class="act" id="bkOut">⬇ Exporter</button><button type="button" class="act" id="bkIn">⬆ Importer</button></div>
  <small style="grid-column:1/-1">Favoris, notes, carnet, Maison / Travail et réglages, dans un fichier à garder (Fichiers, iCloud…).</small>
  <input type="file" id="bkFile" accept="application/json,.json" hidden>`;
$("ocmKey").closest(".field").after(bk);
$("bkOut").onclick = async () => {
  const data = {app:"bornes-twizy", v:XV, date:new Date().toISOString(), data:{}};
  KEYS.forEach(k => { const v = store.get(k); if (v != null && v !== "") data.data[k] = v; });
  const name = "bornes-twizy-" + new Date().toISOString().slice(0, 10) + ".json";
  const file = new File([JSON.stringify(data, null, 1)], name, {type:"application/json"});
  try { if (navigator.canShare && navigator.canShare({files:[file]})){ await navigator.share({files:[file], title:"Sauvegarde Bornes Twizy"}); return; } } catch(e){ if (e && e.name === "AbortError") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(file); a.download = name; document.body.appendChild(a); a.click(); a.remove();
};
$("bkIn").onclick = () => $("bkFile").click();
$("bkFile").onchange = async () => {
  const f = $("bkFile").files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== "bornes-twizy" || !j.data) throw new Error("ce fichier n'est pas une sauvegarde de l'appli");
    if (!confirm("Remplacer vos données actuelles par celles du " + new Date(j.date).toLocaleDateString("fr-FR") + " ?")) return;
    Object.entries(j.data).forEach(([k, v]) => { if (KEYS.includes(k)) store.set(k, v); });
    location.reload();
  } catch(e){ alert("Import impossible : " + e.message); }
  $("bkFile").value = "";
};

/* ---------- 8. Raccourcis Siri : liens qui ouvrent l'appli directement ---------- */
const BASE = location.origin + location.pathname;
function siriLinks(){
  const L2 = [["Borne la plus proche", BASE + "?go=borne"]];
  Object.keys(PL).forEach(k => { const p = places[k]; if (p) L2.push(["Trajet " + PL[k].split(" ")[1], BASE + "?go=trajet&lat=" + p.lat.toFixed(5) + "&lng=" + p.lng.toFixed(5) + "&nom=" + encodeURIComponent(PL[k].split(" ")[1])]); });
  return L2;
}
const sb = document.createElement("div"); sb.className = "set siri";
$("bkOut").closest(".set").after(sb);
function paintSiri(){
  sb.innerHTML = `<span class="xh">Raccourcis Siri</span><small>Dans l'app Raccourcis : nouveau raccourci → « Ouvrir les URL » → collez le lien, puis nommez-le (ex. « Borne la plus proche ») pour le dire à Siri.</small>` +
    siriLinks().map(([n, u], i) => `<div class="row2"><code>${esc(n)}</code><button type="button" class="act" data-cp="${i}">Copier le lien</button></div>`).join("");
  sb.querySelectorAll("[data-cp]").forEach(b => b.onclick = () => { const u = siriLinks()[+b.dataset.cp][1];
    try { navigator.clipboard.writeText(u).then(() => { b.textContent = "Copié ✓"; setTimeout(() => b.textContent = "Copier le lien", 1600); }); } catch(e){ prompt("Copiez ce lien :", u); } });
}
paintSiri();
const _pp = paintPlaces; paintPlaces = function(){ _pp(); paintSiri(); };
const qs = new URLSearchParams(location.search), go = qs.get("go");
if (go) history.replaceState(null, "", location.pathname);
if (go === "borne"){
  (async () => {
    toast("Recherche de la borne la plus proche…");
    let p; try { p = await getPos(); } catch(e){ toast("Position indisponible."); return; }
    map.setView([p.lat, p.lng], 14);
    const t0 = Date.now();
    while (Date.now() - t0 < 20000){
      await sleep(800);
      const near = [...all.values()].filter(s => compatible(s) && noteOf(s).status !== "ko").map(s => ({s, d:hav(p, s)})).sort((a, b) => a.d - b.d)[0];
      if (near && (near.d < 3 || Date.now() - t0 > 8000)){ showDetail(near.s, "map"); return; }
    }
    toast("Aucune borne compatible trouvée autour de vous.");
  })();
} else if (go === "trajet" && qs.get("lat")){
  setTimeout(() => { setMode("trip"); setPlace($("to"), {label:qs.get("nom") || "Destination", lat:+qs.get("lat"), lng:+qs.get("lng")}); $("tripForm").requestSubmit(); }, 300);
}

/* ---------- 10. Mode support voiture ---------- */
let big = store.get("bigui") === "1";
const bigBtn = document.createElement("button"); bigBtn.type = "button"; bigBtn.className = "g-btn"; bigBtn.id = "gBig";
bigBtn.setAttribute("aria-label", "Mode support voiture (tout en grand)");
$("gStop").before(bigBtn);
function paintBig(){ document.body.classList.toggle("bigui", big); bigBtn.textContent = big ? "▭" : "⛶"; }
bigBtn.onclick = () => { big = !big; store.set("bigui", big ? "1" : "0"); paintBig(); };
paintBig();

/* ---------- Étapes : passer par d'autres endroits pendant le trajet ---------- */
let viaPts = [], lastVia = [], skipVia = false;
const viaBox = document.createElement("div"); viaBox.style.cssText = "display:flex;flex-direction:column;gap:10px";
$("to").closest(".field").before(viaBox);
const addBtn = document.createElement("button"); addBtn.type = "button"; addBtn.className = "addvia"; addBtn.textContent = "+ Ajouter une étape";
document.querySelector(".route-fields").after(addBtn);
function renumber(){ [...viaBox.children].forEach((f, i) => f.querySelector("label").textContent = "Étape " + (i + 1)); addBtn.hidden = viaBox.children.length >= 5; }
function addViaField(p){
  const f = document.createElement("div"); f.className = "field via-row";
  f.innerHTML = `<label></label><div class="vrow"><input type="search" placeholder="Ville, lieu ou rue" autocomplete="off"><button type="button" class="vdel" aria-label="Retirer l'étape">×</button></div><ul class="sugg" hidden></ul>`;
  viaBox.appendChild(f);
  const inp = f.querySelector("input"); suggest(inp, f.querySelector("ul"));
  if (p) setPlace(inp, p);
  f.querySelector(".vdel").onclick = () => { f.remove(); renumber(); };
  renumber(); if (!p) inp.focus();
}
addBtn.onclick = () => addViaField();
renumber();
async function resolveVias(){
  const out = [];
  for (const inp of viaBox.querySelectorAll("input")){
    if (!inp.value.trim()) continue;
    const p = await resolvePlace(inp, false);
    out.push({lat:+p.lat, lng:+p.lng, label:p.label || inp.value});
  }
  return out;
}
// Itinéraire Twizy passant par les étapes (même réglages que le trajet normal).
const route0 = route;
route = async (a, b) => {
  const via = skipVia ? [] : viaPts;
  lastVia = [];
  if (!via.length) return route0(a, b);
  const body = {locations:[a, ...via, b].map(p => ({lat:p.lat, lon:p.lng})), costing:"motor_scooter",
    costing_options:{motor_scooter:{top_speed:45, use_highways:0, use_primary:0.2, use_hills:0.3}}, units:"kilometers", directions_type:"none", elevation_interval:30};
  for (const u of VALHALLA){
    try {
      const r = await fetch(u + "?json=" + encodeURIComponent(JSON.stringify(body))); if (!r.ok) continue;
      const t = (await r.json()).trip; if (!t || !t.legs || t.legs.length !== via.length + 1) continue;
      let km = 0; lastVia = via.map((v, i) => { km += t.legs[i].summary.length; return Object.assign({}, v, {km}); });
      return Object.assign({pts:t.legs.flatMap(l => decode6(l.shape)), km:t.summary.length, min:t.summary.time / 60, twizy:true}, climb(t.legs.flatMap(l => l.elevation || [])));
    } catch(e) {}
  }
  throw new Error("Itinéraire avec étapes impossible pour le moment. Réessayez dans un instant.");
};
// Ajoute les étapes au trajet calculé : liste, carte, guidage.
function addVias(t){
  const anchors = t.stops.map(x => ({km:x.s.km, t:x.arrT})).concat([{km:t.km, t:t.arrT}]);
  const ol = document.querySelector("#tripResult .steps"), lis = ol ? [...ol.children] : [];
  lastVia.forEach((v, i) => {
    const nxt = anchors.find(a => a.km >= v.km) || anchors[anchors.length - 1];
    const when = nxt.t - (nxt.km - v.km) * 60 / 36 * 6e4;
    const li = document.createElement("li"); li.dataset.via = v.km;
    li.innerHTML = `<span class="pin via">É${i + 1}</span><div><div class="t">${esc(v.label)}</div><div class="m"><span class="clock">${fmtClock(when, Date.now())}</span> · étape au km ${Math.round(v.km)}</div></div>`;
    if (ol){ const kmOf = el => el.dataset.i != null ? t.stops[+el.dataset.i].s.km : el.dataset.via != null ? +el.dataset.via : Infinity;
      const before = lis.find((el, k) => k > 0 && kmOf(el) > v.km); ol.insertBefore(li, before || null);
      if (before) lis.splice(lis.indexOf(before), 0, li); else lis.push(li); }
    L.marker([v.lat, v.lng], {icon:pinIcon("É" + (i + 1), "num-icon via-icon"), zIndexOffset:450, interactive:false}).addTo(tripLayer);
  });
  const vs = lastVia.map(v => ({s:{lat:v.lat, lng:v.lng, name:short(v.label), km:v.km, detour:0}, via:true, chargeTo:0, minutes:0, arrive:0}));
  t.stops = t.stops.concat(vs).sort((a, b) => a.s.km - b.s.km);
  if ($("gGoogle")) $("gGoogle").href = googleURL(t);
  setTripHead(tripHead.title + " · " + plural(lastVia.length, "étape"), tripHead.sub);
}
// Guidage : une étape n'est pas une borne (pas de recharge, on continue après).
const guideRoute0 = guideRoute;
guideRoute = (from, targets) => { targets.forEach(t => { if (t.stop && t.stop.via){ t.via = true; delete t.stop; } }); return guideRoute0(from, targets); };
drawGuide = function(){
  gLayer.clearLayers();
  G.legs.forEach(l => L.polyline(l.pts.map(p => [p.lat, p.lng]), {color:routeCol(), weight:8, opacity:.85, interactive:false}).addTo(gLayer));
  G.targets.forEach(t => L.marker([t.lat, t.lng], {icon:pinIcon(t.stop ? "⚡" : t.via ? "É" : "B", t.stop ? "num-icon" : t.via ? "num-icon via-icon" : "end-icon"), interactive:false}).addTo(gLayer));
};
const arrived0 = arrived;
arrived = function(){
  const t = G.targets[0]; if (!t.via) return arrived0();
  G.paused = true; $("gCard").hidden = false;
  say("Vous êtes arrivé à l'étape : " + short(t.label) + ".");
  $("gCard").innerHTML = `<b>📍 Étape : ${esc(t.label)}</b><div class="acts"><button type="button" class="act wide" id="gViaNext">▶ Continuer</button></div>`;
  $("gViaNext").onclick = () => { G.targets.shift(); G.legs.shift(); G.idx = 0; G.off = 0; G.spoken = new Set(); G.paused = false; $("gCard").hidden = true; drawGuide(); say("C'est reparti."); };
};

/* ---------- Nouveautés ---------- */
CHANGELOG.unshift([22, "17 nov.", ["Étapes : « + Ajouter une étape » dans Trajet (jusqu'à 5), prises en compte pour la batterie, les recharges et le guidage"]]);
CHANGELOG.unshift([21, "12 nov.", ["Boutons 🏠 Maison et 💼 Travail dans Trajet (appui long pour effacer)", "↩ Aller-retour : le retour est calculé avec le temps sur place et la recharge éventuelle",
  "Réglage pour éviter au maximum les routes rapides", "Sauvegarde et import de vos données (réglages de ma Twizy)", "Raccourcis Siri : « borne la plus proche » et trajets Maison / Travail",
  "Mode support voiture ⛶ pendant le guidage : tout en grand, aussi à l'horizontale"]]);
CHANGELOG.sort((a, b) => b[0] - a[0]);
const ver = document.querySelector(".ver"); if (ver) ver.textContent = "Version " + XV + " · 17 nov. 19 h";
const seen = +store.get("seenX") || 0;
if (seen < XV){ store.set("seenX", XV); if (store.get("seenVersion")) setTimeout(() => showNews(seen >= 21 ? 21 : 20), 700); }
})();
