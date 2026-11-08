/* Sources comparées : base nationale IRVE (data.gouv.fr), OpenStreetMap (Overpass) et, avec une clé, Open Charge Map.
   Itinéraire : Valhalla, profil deux-roues motorisé limité à 45 km/h (Twizy 45, sans autoroutes ni voies express), secours OSRM.
   Adresses : Géoplateforme IGN. Fond de carte : OpenStreetMap. */
const DATASET_API = "https://www.data.gouv.fr/api/1/datasets/5448d3e0c751df01f85d0572/";
const TABULAR = id => "https://tabular-api.data.gouv.fr/api/resources/" + id + "/data/";
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const VALHALLA = ["https://valhalla1.openstreetmap.de/route", "https://valhalla.openstreetmap.de/route"];
const OSRM = "https://router.project-osrm.org/route/v1/driving/";
const GEOCODE = "https://data.geopf.fr/geocodage/";
const OCM = "https://api.openchargemap.io/v3/";
const SRC = {irve:"Base nationale", osm:"OpenStreetMap", ocm:"Open Charge Map"};
const MIN_ZOOM = 11, CELL = 0.12, CELL_TTL = 3 * 864e5, PARALLEL = 4, OCELL = 0.36, OSM_TTL = 7 * 864e5;

const $ = id => document.getElementById(id);
const root = document.documentElement;
const store = { get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v); return true}catch(e){return false}} };
const jget = (k, d) => { try { const v = store.get(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } };
const jset = (k, v) => store.set(k, JSON.stringify(v));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const truthy = v => v === true || v === 1 || /^(true|1|oui|yes)$/i.test(String(v));
function hav(a, b){const R=6371,r=Math.PI/180,dl=(b.lat-a.lat)*r,dg=(b.lng-a.lng)*r;
  const h=Math.sin(dl/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dg/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
const fmtKm = d => d < 1 ? Math.round(d*1000) + " m" : d.toFixed(d < 10 ? 1 : 0).replace(".", ",") + " km";
const fmtH = min => { min = Math.round(min); const h = Math.floor(min/60), m = min % 60; return h ? h + " h " + String(m).padStart(2,"0") : m + " min"; };
const fmtClock = (t, ref) => { const d = new Date(t), days = Math.floor((new Date(t).setHours(0,0,0,0) - new Date(ref).setHours(0,0,0,0)) / 864e5);
  return String(d.getHours()).padStart(2,"0") + ":" + String(d.getMinutes()).padStart(2,"0") + (days === 1 ? " demain" : days > 1 ? " (+" + days + " j)" : ""); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const plural = (n, w) => n + " " + w + (n > 1 ? "s" : "");
const dark = matchMedia("(prefers-color-scheme: dark)").matches;
const COL = {ef: dark ? "#f5b82e" : "#e89a0c", t2: dark ? "#5aa2f0" : "#2f7fd6", route: dark ? "#5aa2f0" : "#12305a", fav: dark ? "#fb7185" : "#e11d48"};
const DAYS = {Mo:"lun", Tu:"mar", We:"mer", Th:"jeu", Fr:"ven", Sa:"sam", Su:"dim"};
function prettyHours(h){
  if (!h) return "";
  if (is24({hours:h})) return "24 h/24, 7 j/7";
  const m = h.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*,\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s+(.+)$/);
  if (m){ const set = new Set(m[1].split(/\s*,\s*/));
    return (set.size === 7 ? "Tous les jours" : Object.keys(DAYS).filter(d => set.has(d)).map(d => DAYS[d]).join(", ")) + ", " + m[2].replace(/\s*-\s*/g, " – "); }
  return h.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su)\b/g, d => DAYS[d]);
}
const is24 = s => /24\s*\/\s*7|24\s*h?\s*\/\s*24|00:00\s*-\s*24:00|24h24|tous les jours.*24/i.test(s.hours || "");

/* ---------- Mes notes sur les bornes (gardées sur le téléphone) ---------- */
let notes = jget("notes", {});
const noteOf = s => notes[s.k] || {};
function setNote(s, patch){
  const n = Object.assign({}, notes[s.k], patch, {t:Date.now()});
  if (!n.status && !n.text) delete notes[s.k]; else notes[s.k] = n;
  jset("notes", notes);
}

/* ---------- Coût : batterie Twizy 6,1 kWh, pertes du chargeur environ 15 % ---------- */
const BATT = 6.1, EFF = 0.85;
function pricePerKwh(s){
  if (s.free) return 0;
  const p = String(s.price || "").replace(/\s+/g, " ");
  let m = p.match(/(\d+(?:[.,]\d+)?)\s*(?:€|eur(?:os?)?)\s*(?:ttc\s*)?(?:\/|par)\s*kwh/i);
  if (m) return +m[1].replace(",", ".");
  m = p.match(/(\d+(?:[.,]\d+)?)\s*(?:cts?|centimes?|c€)\s*(?:\/|par)?\s*kwh/i);
  if (m) return +m[1].replace(",", ".") / 100;
  return null;
}
const kwhFor = pct => Math.max(0, pct) / 100 * BATT / EFF;
function costOf(s, pct){ const p = pricePerKwh(s); return {eur:kwhFor(pct) * (p == null ? cfg.priceDef : p), est:p == null}; }
const fmtEur = c => (c.est ? "≈ " : "") + c.eur.toFixed(2).replace(".", ",") + " €";

/* ---------- Météo : le froid réduit l'autonomie (Open-Meteo, sans clé) ---------- */
async function tempAt(lat, lng, when){
  const r = await fetch("https://api.open-meteo.com/v1/forecast?latitude=" + lat.toFixed(3) + "&longitude=" + lng.toFixed(3) + "&hourly=temperature_2m&forecast_days=3&timezone=Europe%2FParis");
  if (!r.ok) throw new Error("météo");
  const j = await r.json(), times = j.hourly.time.map(t => new Date(t).getTime());
  let best = 0; times.forEach((t, i) => { if (Math.abs(t - when) < Math.abs(times[best] - when)) best = i; });
  return j.hourly.temperature_2m[best];
}
const wxFactor = T => Math.max(0.62, Math.min(1, 0.75 + 0.0125 * T));
let rangeNow = 0;

/* ---------- État ---------- */
const F = Object.assign({t2:false, free:false, h24:false, fav:false, conf:false}, jget("filters", {}));
let favs = jget("favs", {});
let navApp = store.get("navApp") || "apple";
let mode = "map", pane = "map", me = null, meMarker = null, detail = null, tripHead = null, lastMarkerTap = 0;

/* ---------- Carte ---------- */
const firstVisit = !store.get("view");
const start = jget("view", null) || {lat:46.6705, lng:-1.4260, z:13};
if (start.z < MIN_ZOOM) start.z = 12;
const map = L.map("map", {zoomControl:false, attributionControl:false, preferCanvas:true, bounceAtZoomLimits:false,
  rotate:true, touchRotate:false, rotateControl:false, bearing:0}).setView([start.lat, start.lng], start.z);
const canRotate = typeof map.setBearing === "function"; // extension leaflet-rotate chargée ?
L.control.attribution({position:"topright", prefix:false}).addTo(map);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {maxZoom:19, keepBuffer:6, updateWhenZooming:false,
  attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
const renderer = L.canvas({padding:0.4, tolerance:10});
const nearLayer = L.layerGroup().addTo(map);
const tripLayer = L.layerGroup();
const selLayer = L.layerGroup().addTo(map);

/* ---------- Bornes : IRVE puis OpenStreetMap ---------- */
let irveId = store.get("irveId") || null, irvePromise = null;
async function findIRVE(){
  if (irveId) return irveId;
  if (!irvePromise) irvePromise = (async () => {
    const r = await fetch(DATASET_API); if (!r.ok) throw new Error("jeu IRVE " + r.status);
    const res = ((await r.json()).resources || []).filter(x => /csv/i.test(x.format || "") && !/doc/i.test(x.title || ""));
    for (const x of res){
      try { const t = await fetch(TABULAR(x.id) + "?page_size=1"); if (!t.ok) continue;
        const row = ((await t.json()).data || [])[0];
        if (row && "prise_type_ef" in row && "consolidated_latitude" in row){ irveId = x.id; store.set("irveId", x.id); return x.id; } } catch(e) {}
    }
    throw new Error("IRVE introuvable");
  })().finally(() => { irvePromise = null; });
  return irvePromise;
}
async function irveRows(bb, col, maxPages){
  const id = await findIRVE();
  for (const v of ["true", "True"]){
    const p = new URLSearchParams({page_size:"50"});
    p.set(col + "__exact", v);
    p.set("consolidated_latitude__greater", bb.s.toFixed(5)); p.set("consolidated_latitude__less", bb.n.toFixed(5));
    p.set("consolidated_longitude__greater", bb.w.toFixed(5)); p.set("consolidated_longitude__less", bb.e.toFixed(5));
    let url = TABULAR(id) + "?" + p, rows = [], pages = 0, ok = true;
    while (url && pages < maxPages){
      const r = await fetch(url);
      if ((r.status === 404 || r.status === 410) && pages === 0){ irveId = null; store.set("irveId", ""); throw new Error("IRVE déplacé"); }
      if (!r.ok){ ok = false; break; }
      const j = await r.json(); rows = rows.concat(j.data || []); url = j.links && j.links.next; pages++;
    }
    if (ok) return rows;
  }
  throw new Error("IRVE filtre");
}
function groupIRVE(rows){
  const by = new Map();
  for (const r of rows){
    const lat = +r.consolidated_latitude, lng = +r.consolidated_longitude; if (!lat || !lng) continue;
    const k = lat.toFixed(5) + "," + lng.toFixed(5);
    let s = by.get(k);
    if (!s){ s = {k, lat, lng, name:r.nom_station || r.nom_enseigne || "Borne", addr:r.adresse_station || "", op:r.nom_operateur || r.nom_enseigne || "",
      hours:r.horaires || "", free:truthy(r.gratuit) || /gratuit/i.test(r.tarification || ""), price:r.tarification || "", access:r.condition_acces || "", ef:0, t2:0, seen:new Set()}; by.set(k, s); }
    const pid = r.id_pdc_itinerance || r.id_pdc_local || r.__id || s.seen.size;
    if (s.seen.has(pid)) continue; s.seen.add(pid);
    if (truthy(r.prise_type_ef)) s.ef++; if (truthy(r.prise_type_2)) s.t2++;
  }
  return [...by.values()].map(s => tagSrc(s, "irve"));
}
async function osmStations(bb, t2){
  const b = [bb.s, bb.w, bb.n, bb.e].map(x => x.toFixed(5)).join(",");
  const q = `[out:json][timeout:25];(nwr["amenity"="charging_station"]["socket:schuko"](${b});nwr["amenity"="charging_station"]["socket:typee"](${b});${t2 ? `nwr["amenity"="charging_station"]["socket:type2"](${b});nwr["amenity"="charging_station"]["socket:type2_cable"](${b});` : ""});out center tags;`;
  for (const u of OVERPASS){
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 25000);
      const r = await fetch(u + "?data=" + encodeURIComponent(q), {signal:ctl.signal}).finally(() => clearTimeout(to));
      if (!r.ok) continue;
      return (await r.json()).elements.map(e => { const t = e.tags || {}, c = e.center || e;
        const efv = t["socket:schuko"] || t["socket:typee"], t2v = t["socket:type2"] || t["socket:type2_cable"];
        return {k:c.lat.toFixed(5)+","+c.lon.toFixed(5), lat:c.lat, lng:c.lon, name:t.name || t.operator || "Borne",
          addr:[t["addr:housenumber"], t["addr:street"], t["addr:city"]].filter(Boolean).join(" "), op:t.operator || t.network || "",
          hours:t.opening_hours || "", free:t.fee === "no" || /gratuit|free/i.test(t.charge || ""), price:t.charge || "", access:t.access || "",
          ef: efv ? (+efv || 1) : 0, t2: t2v ? (+t2v || 1) : 0}; }).map(s => tagSrc(s, "osm"));
    } catch(e) {}
  }
  throw new Error("OSM");
}
function tagSrc(s, id){ s.src = [id]; s.by = {[id]:{ef:s.ef, t2:s.t2, free:s.free}}; return s; }
/* Open Charge Map : la liste des types de prises est lue chez eux, puis classée en E/F ou Type 2. */
let ocmKey = store.get("ocmKey") || "", ocmRef = null, ocmErr = "";
async function ocmRefData(){
  if (ocmRef) return ocmRef;
  const r = await fetch(OCM + "referencedata/?key=" + encodeURIComponent(ocmKey));
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? "clé refusée" : "erreur " + r.status);
  const j = await r.json(), ct = {}, ops = {}, ut = {};
  (j.ConnectionTypes || []).forEach(c => { const t = (c.Title || "") + " " + (c.FormalName || "");
    ct[c.ID] = /schuko|type ?e\b|cee ?7|french|domestic/i.test(t) ? "ef" : /type ?2|mennekes|62196-2/i.test(t) ? "t2" : ""; });
  (j.Operators || []).forEach(o => ops[o.ID] = o.Title);
  (j.UsageTypes || []).forEach(u => ut[u.ID] = u.Title);
  return ocmRef = {ct, ops, ut};
}
async function ocmStations(bb){
  const ref = await ocmRefData();
  const lat = (bb.s + bb.n) / 2, lng = (bb.w + bb.e) / 2;
  const r = await fetch(OCM + "poi/?output=json&compact=true&verbose=false&maxresults=1000&distanceunit=KM&distance=30&latitude=" + lat.toFixed(4) + "&longitude=" + lng.toFixed(4) + "&key=" + encodeURIComponent(ocmKey));
  if (!r.ok) throw new Error("OCM " + r.status);
  return (await r.json()).map(p => {
    const a = p.AddressInfo || {}; let ef = 0, t2 = 0;
    (p.Connections || []).forEach(c => { const k = ref.ct[c.ConnectionTypeID], q = c.Quantity || 1; if (k === "ef") ef += q; else if (k === "t2") t2 += q; });
    return tagSrc({k:(+a.Latitude).toFixed(5) + "," + (+a.Longitude).toFixed(5), lat:+a.Latitude, lng:+a.Longitude, name:a.Title || "Borne",
      addr:[a.AddressLine1, a.Postcode, a.Town].filter(Boolean).join(" "), op:ref.ops[p.OperatorID] || "", hours:"",
      free:/free|gratuit/i.test(p.UsageCost || ""), price:p.UsageCost || "", access:ref.ut[p.UsageTypeID] || "", ef, t2}, "ocm");
  }).filter(s => s.lat && s.lng && (s.ef || s.t2) && !/private|privé/i.test(s.access)
    && s.lat >= bb.s && s.lat < bb.n && s.lng >= bb.w && s.lng < bb.e);
}
let sourceName = "", lastErr = "";
async function stationsIn(bb, t2, maxPages){
  try {
    let rows = await irveRows(bb, "prise_type_ef", maxPages);
    if (t2) rows = rows.concat(await irveRows(bb, "prise_type_2", maxPages));
    sourceName = "Base nationale IRVE";
    return groupIRVE(rows);
  } catch(e) {
    lastErr = e.message;
    const list = await osmStations(bb, t2);
    sourceName = "OpenStreetMap";
    return list;
  }
}
const slim = s => ({k:s.k, lat:+s.lat.toFixed(6), lng:+s.lng.toFixed(6), name:s.name, addr:s.addr, op:s.op, hours:s.hours, free:s.free, price:s.price, access:s.access, ef:s.ef, t2:s.t2, src:s.src || [], by:s.by || {}});

/* ---------- Chargement par zones, en parallèle, gardé en mémoire 3 jours ---------- */
const cellsFor = (bb, size = CELL) => { const out = [];
  for (let i = Math.floor(bb.s / size); i <= Math.floor(bb.n / size); i++)
    for (let j = Math.floor(bb.w / size); j <= Math.floor(bb.e / size); j++) out.push([i, j]);
  return out; };
const cellBB = (i, j) => ({s:i*CELL, n:(i+1)*CELL, w:j*CELL, e:(j+1)*CELL});
const cellKey = (i, j, t2) => "c4:" + (t2 ? "t2:" : "") + i + "_" + j;
const memCache = new Map(), inflight = new Map();
let active = 0; const waiting = [];
function slot(fn, wanted){
  return new Promise((res, rej) => {
    const run = () => { if (!wanted()){ res(null); next(); return; } active++; fn().then(res, rej).finally(() => { active--; next(); }); };
    active < PARALLEL ? run() : waiting.push(run);
  });
}
function next(){ while (active < PARALLEL && waiting.length) waiting.shift()(); }
function cached(i, j, t2){
  const key = cellKey(i, j, t2);
  if (memCache.has(key)) return memCache.get(key);
  const o = jget(key, null);
  if (o && Date.now() - o.t < CELL_TTL){ memCache.set(key, o.l); return o.l; }
  return null;
}
function pruneCache(){
  try { const ks = []; for (let n = 0; n < localStorage.length; n++){ const k = localStorage.key(n); if (k && /^(c4|o4|m4):/.test(k)) ks.push(k); }
    ks.forEach((k, n) => { if (n % 2 === 0) localStorage.removeItem(k); }); } catch(e) {}
}
function getCell(i, j, wanted = () => true){
  const t2 = F.t2, key = cellKey(i, j, t2), hit = cached(i, j, t2);
  if (hit) return Promise.resolve(hit);
  if (inflight.has(key)) return inflight.get(key);
  const p = slot(async () => {
    let list;
    for (let n = 0; ; n++){ try { list = await stationsIn(cellBB(i, j), t2, 10); break; } catch(e){ if (n) throw e; await sleep(500); } }
    list = list.map(slim);
    memCache.set(key, list);
    if (!jset(key, {t:Date.now(), l:list})){ pruneCache(); jset(key, {t:Date.now(), l:list}); }
    return list;
  }, wanted).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/* Sources complémentaires (OpenStreetMap, Open Charge Map), par grandes zones, en arrière-plan. */
const EXTRA = [
  {id:"osm", prefix:"o4:", on:() => true, fetch:bb => osmStations(bb, true)},
  {id:"ocm", prefix:"m4:", on:() => !!ocmKey, fetch:bb => ocmStations(bb)}
];
const xMem = new Map(), xInflight = new Map(), xWaiting = [], used = new Set();
let xActive = 0, osmPending = 0;
function xslot(fn){
  return new Promise((res, rej) => {
    const run = () => { xActive++; fn().then(res, rej).finally(() => { xActive--; if (xWaiting.length) xWaiting.shift()(); }); };
    xActive < 3 ? run() : xWaiting.push(run);
  });
}
function xCached(src, i, j){
  const k = src.prefix + i + "_" + j;
  if (xMem.has(k)) return xMem.get(k);
  const o = jget(k, null);
  if (o && Date.now() - o.t < OSM_TTL){ xMem.set(k, o.l); return o.l; }
  return null;
}
function getExtraCell(src, i, j){
  const k = src.prefix + i + "_" + j, hit = xCached(src, i, j);
  if (hit) return Promise.resolve(hit);
  if (xInflight.has(k)) return xInflight.get(k);
  const p = xslot(async () => {
    const list = (await src.fetch({s:i*OCELL, n:(i+1)*OCELL, w:j*OCELL, e:(j+1)*OCELL})).filter(s => s.ef || s.t2).map(slim);
    xMem.set(k, list);
    if (!jset(k, {t:Date.now(), l:list})){ pruneCache(); jset(k, {t:Date.now(), l:list}); }
    return list;
  }).finally(() => xInflight.delete(k));
  xInflight.set(k, p);
  return p;
}
function loadExtra(i, j, onDone){
  for (const src of EXTRA){
    if (!src.on()) continue;
    const hit = xCached(src, i, j);
    if (hit){ addExtra(hit); continue; }
    osmPending++; setLoading(true);
    getExtraCell(src, i, j).then(addExtra).catch(e => { if (src.id === "ocm"){ ocmErr = e.message; paintOcm(); } })
      .finally(() => { osmPending--; setLoading(busy()); onDone && onDone(); });
  }
}
function addExtra(list){ if (list && list.length){ list.forEach(s => (s.src || []).forEach(x => used.add(x))); addStations(list); } }
const busy = () => pending + osmPending > 0;
const sourcesLabel = () => [...used].map(x => SRC[x]).join(" + ");
try { for (let n = localStorage.length - 1; n >= 0; n--){ const k = localStorage.key(n); if (k && /^(c3|o3):/.test(k)) localStorage.removeItem(k); } } catch(e) {}

/* ---------- Bornes connues et marqueurs ---------- */
const all = new Map(), markers = new Map();
function addStations(list){
  for (const s of list){
    (s.src || []).forEach(x => used.add(x));
    let o = all.get(s.k);
    // Même borne connue des deux sources : on garde une seule fiche, complétée.
    if (!o) for (const x of all.values()) if (Math.abs(x.lat - s.lat) < 0.0008 && Math.abs(x.lng - s.lng) < 0.0012 && hav(x, s) < 0.08){ o = x; break; }
    if (!o){ all.set(s.k, s); continue; }
    if (o === s) continue;
    o.src = [...new Set([...(o.src || []), ...(s.src || [])])]; o.by = Object.assign({}, s.by, o.by);
    o.ef = Math.max(o.ef, s.ef); o.t2 = Math.max(o.t2, s.t2); o.free = o.free || s.free;
    for (const f of ["hours", "addr", "op", "price", "access"]) if (!o[f] && s[f]) o[f] = s[f];
    if ((!o.name || o.name === "Borne") && s.name) o.name = s.name;
  }
}
Object.values(favs).forEach(s => all.set(s.k, s));
const compatible = s => s.ef > 0 || (F.t2 && s.t2 > 0);
const nsrc = s => (s.src || []).length;
const shown = s => compatible(s) && (!F.free || s.free) && (!F.h24 || is24(s)) && (!F.fav || favs[s.k]) && (!F.conf || nsrc(s) >= 2);
function markerFor(s){
  const fav = !!favs[s.k], ko = noteOf(s).status === "ko";
  return L.circleMarker([s.lat, s.lng], {renderer, radius: fav ? 10 : 8.5, weight: fav || ko ? 3.5 : 2.5, color: ko ? "#e11d48" : fav ? COL.fav : "#fff", fillColor: ko ? "#8a94a6" : s.ef ? COL.ef : COL.t2, fillOpacity:1})
    .on("click", () => { lastMarkerTap = Date.now(); showDetail(s, mode); });
}
function syncMarkers(rebuild){
  if (rebuild){ nearLayer.clearLayers(); markers.clear(); }
  for (const s of all.values()){
    const ok = shown(s), m = markers.get(s.k);
    if (ok && !m) markers.set(s.k, markerFor(s).addTo(nearLayer));
    else if (!ok && m){ nearLayer.removeLayer(m); markers.delete(s.k); }
  }
}
let rafPending = false;
function scheduleRender(){ if (rafPending) return; rafPending = true;
  requestAnimationFrame(() => { rafPending = false; syncMarkers(false); if (mode === "map" && pane === "map") renderList(); }); }

let wanted = new Set(), pending = 0, failed = 0, loadTimer = null;
const setLoading = on => { $("spin").hidden = !on; };
function loadNear(){
  if (mode !== "map") return;
  jset("view", {lat:+map.getCenter().lat.toFixed(5), lng:+map.getCenter().lng.toFixed(5), z:map.getZoom()});
  if (map.getZoom() < MIN_ZOOM){ wanted = new Set(); renderList("Zoomez un peu pour afficher les bornes."); return; }
  const b = map.getBounds().pad(0.3), c = map.getCenter();
  const cells = cellsFor({s:b.getSouth(), n:b.getNorth(), w:b.getWest(), e:b.getEast()});
  if (cells.length > 60){ renderList("Zoomez un peu pour afficher les bornes."); return; }
  cells.sort((a, b2) => Math.hypot((a[0]+.5)*CELL - c.lat, (a[1]+.5)*CELL - c.lng) - Math.hypot((b2[0]+.5)*CELL - c.lat, (b2[1]+.5)*CELL - c.lng));
  const t2 = F.t2;
  wanted = new Set(cells.map(([i, j]) => cellKey(i, j, t2)));
  const myWanted = wanted;
  failed = 0;
  for (const [i, j] of cells){
    const hit = cached(i, j, t2);
    if (hit){ addStations(hit); continue; }
    const key = cellKey(i, j, t2);
    pending++; setLoading(true);
    getCell(i, j, () => myWanted === wanted && wanted.has(key))
      .then(list => { if (list) addStations(list); })
      .catch(() => { failed++; })
      .finally(() => { pending--; setLoading(busy()); scheduleRender(); });
  }
  for (const [i, j] of cellsFor({s:b.getSouth(), n:b.getNorth(), w:b.getWest(), e:b.getEast()}, OCELL).slice(0, 9)) loadExtra(i, j, scheduleRender);
  scheduleRender();
}
map.on("moveend", () => { clearTimeout(loadTimer); loadTimer = setTimeout(loadNear, 120); });
map.on("click", () => {
  if (Date.now() - lastMarkerTap < 400) return;
  if (detail) closeDetail(); else if (snapName !== "peek") setSnap("peek");
});

/* ---------- Liste ---------- */
function tagsHTML(s){
  return (s.ef ? `<span class="tag ef">E/F ×${s.ef}</span>` : "") + (s.t2 ? `<span class="tag t2">Type 2 ×${s.t2}</span>` : "")
    + (s.free ? `<span class="tag free">Gratuit</span>` : "") + (is24(s) ? `<span class="tag h24">24 h/24</span>` : "")
    + (nsrc(s) >= 2 ? `<span class="tag src">✓ ${nsrc(s)} sources</span>` : "")
    + (noteOf(s).status === "ok" ? `<span class="tag ok">✓ testée</span>` : noteOf(s).status === "ko" ? `<span class="tag ko">✗ en panne</span>` : ""); }
function compareHTML(s){
  const src = s.src || []; if (!src.length) return "";
  const yes = v => v ? (v === true ? "oui" : v) : "–";
  const rows = src.map(id => { const b = (s.by || {})[id] || {}; return `<tr><td>${SRC[id] || id}</td><td>${yes(b.ef)}</td><td>${yes(b.t2)}</td><td>${yes(b.free)}</td></tr>`; }).join("");
  const missing = Object.keys(SRC).filter(id => !src.includes(id) && (id !== "ocm" || ocmKey)).map(id => SRC[id]);
  const head = src.length >= 2 ? `<div class="cmp-h">✓ Confirmée par ${src.length} sources</div>` : `<div class="cmp-h one">Une seule source : à vérifier sur place</div>`;
  return `<div class="cmp">${head}<table><thead><tr><th>Source</th><th>Prises E/F</th><th>Type 2</th><th>Gratuit</th></tr></thead><tbody>${rows}</tbody></table>${missing.length ? `<div class="note">Absente de : ${missing.join(", ")}.</div>` : ""}</div>`;
}
function renderList(msg){
  if (mode !== "map" || pane !== "map") return;
  const ref = me || map.getCenter(), view = map.getBounds();
  const vis = [...all.values()].filter(s => shown(s) && (F.fav || view.contains([s.lat, s.lng])));
  vis.forEach(s => s.d = hav(ref, s)); vis.sort((a, b) => a.d - b.d);
  const n = vis.length;
  $("hTitle").textContent = F.fav ? (n ? plural(n, "favori") : "Aucun favori") : map.getZoom() < MIN_ZOOM ? "Rapprochez la carte" : (n ? n + (n > 1 ? " bornes compatibles" : " borne compatible") : (pending ? "Recherche des bornes…" : "Aucune borne compatible ici"));
  $("hSub").textContent = msg || (failed && !n ? "Données indisponibles (" + (lastErr || "réseau") + "). Bougez la carte pour réessayer."
    : (me ? "Triées par distance de vous" : "Triées par distance du centre de la carte") + (sourcesLabel() ? " · " + sourcesLabel() : "") + (osmPending ? " · recherche d'autres bornes…" : ""));
  const frag = document.createDocumentFragment();
  if (!n && !pending){ const li = document.createElement("li"); li.className = "empty";
    li.textContent = F.fav ? "Ouvrez une borne puis touchez « Favori » pour la retrouver ici." : F.free ? "Peu de bornes sont déclarées gratuites dans les données publiques. Dézoomez ou activez « Type 2 » pour en voir plus." : F.h24 || F.conf ? "Essayez d'enlever un filtre ou de dézoomer." : "Déplacez la carte ou activez « Type 2 »."; frag.appendChild(li); }
  vis.slice(0, 50).forEach(s => {
    const li = document.createElement("li");
    li.innerHTML = `<i class="dot" style="width:14px;height:14px;background:${s.ef ? "var(--ef)" : "var(--t2)"}"></i>
      <div class="n">${favs[s.k] ? '<span class="star">★</span> ' : ""}${esc(s.name)}<div class="s">${esc(s.addr || s.op)}</div><div class="tags">${tagsHTML(s)}</div></div>
      <span class="d">${fmtKm(s.d)}</span><span class="chev">›</span>`;
    li.onclick = () => showDetail(s, "map");
    frag.appendChild(li);
  });
  $("list").replaceChildren(frag);
}

/* ---------- Panneau glissable ---------- */
const sheet = $("sheet"), handle = $("handle"), fab = $("fab");
let snapName = "peek", curVis = 96, hdrH = 150;
const snaps = () => { const padB = parseFloat(getComputedStyle(sheet).paddingBottom) || 0, full = innerHeight - hdrH - 8;
  return {peek: handle.offsetHeight + padB, half: Math.min(full, Math.round(innerHeight * 0.48)), full}; };
function setVis(v, settle){
  curVis = v; root.style.setProperty("--vis", v + "px");
  fab.classList.toggle("off", v > innerHeight - hdrH - 90);
  if (settle){ const padB = parseFloat(getComputedStyle(sheet).paddingBottom) || 0;
    root.style.setProperty("--pmax", Math.max(0, v - handle.offsetHeight - padB) + "px"); }
}
function setSnap(name){ snapName = name; const s = snaps(); root.style.setProperty("--full", s.full + "px"); setVis(s[name], true); }
let drag = null;
handle.addEventListener("pointerdown", e => {
  if (e.target.closest("button")) return;
  drag = {y:e.clientY, vis:curVis, t:performance.now(), py:e.clientY, pt:performance.now(), moved:false};
  handle.setPointerCapture(e.pointerId);
});
handle.addEventListener("pointermove", e => {
  if (!drag) return;
  const dy = e.clientY - drag.y;
  if (!drag.moved && Math.abs(dy) > 6){ drag.moved = true; document.body.classList.add("dragging"); }
  if (!drag.moved) return;
  const s = snaps(); setVis(Math.max(s.peek, Math.min(s.full, drag.vis - dy)), false);
  drag.vy = (e.clientY - drag.py) / Math.max(1, performance.now() - drag.pt); drag.py = e.clientY; drag.pt = performance.now();
});
function endDrag(){
  if (!drag) return;
  document.body.classList.remove("dragging");
  const order = ["peek", "half", "full"];
  if (!drag.moved){ setSnap(snapName === "peek" ? "half" : snapName === "half" ? "full" : "half"); }
  else {
    const s = snaps(), v = drag.vy || 0; let pick;
    if (v < -0.45) pick = order.find(n => s[n] > curVis + 10) || "full";
    else if (v > 0.45) pick = [...order].reverse().find(n => s[n] < curVis - 10) || "peek";
    else pick = order.reduce((a, b) => Math.abs(s[b] - curVis) < Math.abs(s[a] - curVis) ? b : a);
    setSnap(pick);
  }
  drag = null;
}
handle.addEventListener("pointerup", endDrag);
handle.addEventListener("pointercancel", endDrag);
new ResizeObserver(() => { hdrH = $("top").offsetHeight; root.style.setProperty("--hdr", hdrH + "px"); setSnap(snapName); }).observe($("top"));
addEventListener("resize", () => { setSnap(snapName); map.invalidateSize(); });

function showPane(name){
  pane = name;
  $("paneMap").hidden = name !== "map"; $("paneTrip").hidden = name !== "trip"; $("paneDetail").hidden = name !== "detail"; $("paneCharge").hidden = name !== "charge";
  $("back").hidden = name !== "detail" && name !== "charge";
  if (name === "detail") $("paneDetail").scrollTop = 0;
}

/* ---------- Fiche d'une borne ---------- */
function navURL(app, lat, lng){
  return app === "google" ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`
    : app === "waze" ? `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`
    : `https://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
}
document.addEventListener("click", e => { const a = e.target.closest("a[data-app]"); if (a){ navApp = a.dataset.app; store.set("navApp", navApp); } });
function panAbove(lat, lng, minZoom){
  const z = Math.max(map.getZoom(), minZoom), size = map.getSize();
  const targetY = (hdrH + (innerHeight - curVis)) / 2;
  const p = map.project([lat, lng], z);
  map.setView(map.unproject(p.add([0, size.y / 2 - targetY]), z), z, {animate:true});
}
function showDetail(s, from, extra){
  detail = {s, from};
  selLayer.clearLayers();
  L.circleMarker([s.lat, s.lng], {renderer, radius:16, weight:3.5, color:COL.route, fill:false, interactive:false}).addTo(selLayer);
  const d = me ? hav(me, s) : null, fav = !!favs[s.k];
  $("hTitle").textContent = s.name;
  $("hSub").textContent = [d != null ? fmtKm(d) + " de vous" : "", s.ef ? "Prise domestique E/F" : "Type 2 seulement", s.op].filter(Boolean).join(" · ");
  const row = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : "";
  const nb = (app, label) => `<a class="navb${navApp === app ? " pref" : ""}" data-app="${app}" target="_blank" rel="noopener" href="${navURL(app, s.lat, s.lng)}">${label}</a>`;
  $("paneDetail").innerHTML = `${extra || ""}
    <div class="d-addr">${esc(s.addr || "Adresse non renseignée")}</div>
    <div class="tags">${tagsHTML(s)}</div>
    <div class="nav">${nb("apple", "Plans")}${nb("google", "Google Maps")}${nb("waze", "Waze")}</div>
    <div class="acts">
      ${from === "map" ? `<button type="button" class="act wide" id="dTrip">Trajet en Twizy jusqu'ici</button>` : ""}
      <button type="button" class="act wide plug" id="dPlug">⚡ Je me branche ici</button>
      <button type="button" class="act" id="dFav" aria-pressed="${fav}">${fav ? "★ En favori" : "☆ Ajouter aux favoris"}</button>
      <button type="button" class="act" id="dCopy">Copier l'adresse</button>
    </div>
    <div class="mine">
      <div class="mine-h">Mon avis sur cette borne</div>
      <div class="seg">
        <button type="button" id="nOk" aria-pressed="${noteOf(s).status === "ok"}">✓ Ça marche</button>
        <button type="button" id="nKo" aria-pressed="${noteOf(s).status === "ko"}">✗ En panne</button>
      </div>
      <textarea id="nText" rows="2" placeholder="Note perso : emplacement de la prise, code, horaires réels…">${esc(noteOf(s).text || "")}</textarea>
      <div class="note" id="nSaved">${noteOf(s).t ? "Mis à jour le " + new Date(noteOf(s).t).toLocaleDateString("fr-FR") : "Gardé uniquement sur ce téléphone."}</div>
    </div>
    <dl class="info">${row("Opérateur", s.op)}${row("Horaires", prettyHours(s.hours))}${row("Tarif", s.free ? "Gratuit" : s.price)}${row("Recharge 0 → 100 %", fmtEur(costOf(s, 100)) + (pricePerKwh(s) == null ? " (tarif inconnu, estimé à " + cfg.priceDef.toFixed(2).replace(".", ",") + " €/kWh)" : ""))}${row("Accès", s.access)}
      ${row("Prises", [s.ef ? s.ef + " prise" + (s.ef > 1 ? "s" : "") + " E/F" : "", s.t2 ? s.t2 + " Type 2" : ""].filter(Boolean).join(" · "))}</dl>
    ${!s.ef ? `<div class="alert">Pas de prise domestique ici : il faut le câble adaptateur Type 2.</div>` : ""}
    ${compareHTML(s)}
    <div class="note">Vérifiez que la borne est accessible avant de partir.</div>`;
  if ($("dTrip")) $("dTrip").onclick = () => tripTo(s);
  $("dPlug").onclick = () => openCharge(s);
  const paintNote = () => { $("nOk").setAttribute("aria-pressed", noteOf(s).status === "ok"); $("nKo").setAttribute("aria-pressed", noteOf(s).status === "ko");
    $("nSaved").textContent = noteOf(s).t ? "Enregistré ✓ · gardé uniquement sur ce téléphone" : "Gardé uniquement sur ce téléphone."; };
  const toggleSt = st => { setNote(s, {status: noteOf(s).status === st ? "" : st}); paintNote(); syncMarkers(true); };
  $("nOk").onclick = () => toggleSt("ok"); $("nKo").onclick = () => toggleSt("ko");
  let nt; $("nText").oninput = () => { clearTimeout(nt); nt = setTimeout(() => { setNote(s, {text:$("nText").value.trim()}); paintNote(); }, 500); };
  $("dFav").onclick = () => {
    if (favs[s.k]) delete favs[s.k]; else favs[s.k] = slim(s);
    jset("favs", favs);
    const f = !!favs[s.k]; $("dFav").setAttribute("aria-pressed", f); $("dFav").textContent = f ? "★ En favori" : "☆ Ajouter aux favoris";
    syncMarkers(true);
  };
  $("dCopy").onclick = () => {
    const txt = [s.name, s.addr].filter(Boolean).join(", ");
    const done = ok => { $("dCopy").textContent = ok ? "Adresse copiée ✓" : "Copie impossible"; setTimeout(() => { if ($("dCopy")) $("dCopy").textContent = "Copier l'adresse"; }, 1800); };
    try { navigator.clipboard.writeText(txt).then(() => done(true), () => done(false)); } catch(e){ done(false); }
  };
  showPane("detail");
  if (snapName === "peek") setSnap("half");
  panAbove(s.lat, s.lng, from === "map" ? 15 : 13);
}
function closeDetail(){
  if (!detail) return;
  const from = detail.from; detail = null; selLayer.clearLayers();
  if (from === "map" && mode === "map"){ showPane("map"); renderList(); }
  else if (mode === "trip"){ showPane("trip"); restoreTripHead(); }
}
$("back").onclick = () => pane === "charge" ? closeCharge() : closeDetail();

/* ---------- Localisation ---------- */
function getPos(){
  return new Promise((ok, ko) => {
    if (!navigator.geolocation) return ko(new Error("Localisation indisponible"));
    navigator.geolocation.getCurrentPosition(p => {
      me = {lat:p.coords.latitude, lng:p.coords.longitude};
      if (meMarker) meMarker.setLatLng([me.lat, me.lng]);
      else meMarker = L.circleMarker([me.lat, me.lng], {renderer, radius:8, color:"#fff", weight:3, fillColor:"#1a73e8", fillOpacity:1, interactive:false}).addTo(map);
      ok(me);
    }, () => ko(new Error("Localisation refusée")), {enableHighAccuracy:true, timeout:10000, maximumAge:30000});
  });
}
async function locateMe(){
  setLoading(true);
  try { const p = await getPos(); if (detail) closeDetail(); map.setView([p.lat, p.lng], Math.max(map.getZoom(), 14)); }
  catch(e){ $("hSub").textContent = e.message + ". Cherchez une ville à la place."; }
  finally { setLoading(busy()); }
}

/* ---------- Adresses avec suggestions ---------- */
/* Trois recherches en parallèle : adresses et lieux IGN, lieux OpenStreetMap (Photon : écoles, magasins, mairies…). */
const PHOTON = "https://photon.komoot.io/api/";
const STOP = new Set(["de","du","des","la","le","les","l","d","a","au","aux","sur","en","et","rue","avenue","av","bd","boulevard","place","chemin","route","allee","impasse"]);
const norm = s => String(s || "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const first = v => Array.isArray(v) ? v[0] : v;
async function getFeatures(url, fn){
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
    const r = await fetch(url, {signal:ctl.signal}).finally(() => clearTimeout(to));
    if (!r.ok) return [];
    return ((await r.json()).features || []).map(fn).filter(Boolean);
  } catch(e){ return []; }
}
const PHOTON_SKIP = /^(highway|place|boundary|landuse|natural|waterway)$/;
async function geocode(q, limit = 5){
  const c = me || map.getCenter(), enc = encodeURIComponent(q);
  const ll = "&lat=" + c.lat.toFixed(4) + "&lon=" + c.lng.toFixed(4);
  const pt = f => ({lat:f.geometry.coordinates[1], lng:f.geometry.coordinates[0]});
  const [adr, poi, osm] = await Promise.all([
    getFeatures(GEOCODE + "search?index=address&limit=10" + ll + "&q=" + enc, f => Object.assign(pt(f), {label:f.properties.label, ctx:f.properties.context || "",
      type:f.properties.type, score:f.properties.score || 0})),
    getFeatures(GEOCODE + "search?index=poi&limit=6" + ll + "&q=" + enc, f => { const p = f.properties, name = p.toponym || first(p.name);
      if (!name || [].concat(p.category || []).some(k => norm(k) === norm(name))) return null; // noms vagues (« Équipement de transport »)
      const city = first(p.city) || "", cat = first(p.category) || "";
      return Object.assign(pt(f), {label:name + (city && !norm(name).includes(norm(city)) ? ", " + city : ""), ctx:[cat, [first(p.postcode), city].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
        type:"poi", score:p.score || 0}); }),
    getFeatures(PHOTON + "?limit=8&lang=fr" + ll + "&q=" + enc, (f, i) => { const p = f.properties;
      if (!p.name || (p.countrycode && p.countrycode !== "FR") || PHOTON_SKIP.test(p.osm_key || "")) return null;
      return Object.assign(pt(f), {label:p.name + (p.city && p.city !== p.name ? ", " + p.city : ""),
        ctx:[p.street ? (p.housenumber ? p.housenumber + " " : "") + p.street : "", [p.postcode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(" · "),
        type:"poi", score:0.62 - i * 0.02}); })
  ]);
  // Chaque mot tapé doit se retrouver dans le résultat : un lycée passe avant une rue qui porte seulement le même nom.
  const qw = norm(q).split(" ").filter(w => w && !STOP.has(w));
  const match = p => { if (!qw.length) return 1; const hw = norm(p.label + " " + p.ctx).split(" ");
    return qw.filter(w => hw.some(h => h.startsWith(w))).length / qw.length; };
  const top = Math.max(0, ...adr.map(p => p.score));
  // Un numéro ou « rue, avenue… » : on cherche une adresse. Sinon, les lieux (lycée, mairie, magasin) passent devant.
  const isAddr = /^\s*\d/.test(q) || /\b(rue|avenue|av|bd|boulevard|chemin|route|all[ée]e|impasse|place|quai|cours|lotissement)\b/i.test(q);
  const kind = p => isAddr ? (p.type === "housenumber" ? 0.25 : p.type === "street" ? 0.1 : 0) : (p.type === "poi" ? 0.12 : 0);
  const rank = p => match(p) * 1.2 + p.score * 0.5 + (p.type === "municipality" && p.score >= top - 0.06 ? 0.15 : 0) + kind(p) - hav(c, p) / 3000;
  const out = [];
  for (const p of [...adr, ...poi, ...osm].sort((a, b) => rank(b) - rank(a))){
    // Même lieu trouvé par deux services : on ne le garde qu'une fois.
    if (out.some(o => norm(o.label) === norm(p.label) || (o.type === "poi" && p.type === "poi" && hav(o, p) < 0.3))) continue;
    out.push(p); if (out.length >= limit) break;
  }
  return out;
}
function setPlace(input, p){ input.value = p.label; input.dataset.lat = p.lat; input.dataset.lng = p.lng; }
function suggest(input, ul, onPick){
  let t, seq = 0;
  input.addEventListener("input", () => {
    clearTimeout(t); input.dataset.lat = ""; const q = input.value.trim();
    if (q.length < 3){ ul.hidden = true; return; }
    t = setTimeout(async () => {
      const my = ++seq; let res = [];
      try { res = await geocode(q); } catch(e) {}
      if (my !== seq) return;
      ul.replaceChildren(...res.map(p => { const li = document.createElement("li");
        li.innerHTML = esc(p.label) + "<small>" + esc(p.ctx) + "</small>";
        li.onpointerdown = e => { e.preventDefault(); setPlace(input, p); ul.hidden = true; input.blur(); onPick && onPick(p); };
        return li; }));
      ul.hidden = !res.length;
    }, 250);
  });
  input.addEventListener("blur", () => setTimeout(() => ul.hidden = true, 150));
}
const goTo = p => { if (detail) closeDetail(); map.setView([p.lat, p.lng], p.type === "municipality" ? 13 : p.type === "poi" ? 16 : 15); };
suggest($("q"), $("qSugg"), goTo);
$("search").onsubmit = async e => { e.preventDefault(); const q = $("q").value.trim(); if (!q) return; $("q").blur();
  try { const [p] = await geocode(q, 1); if (p) goTo(p); else $("hSub").textContent = "Lieu introuvable."; } catch(err){ $("hSub").textContent = err.message; } };

/* ---------- Filtres ---------- */
const chipFor = {t2:"fT2", free:"fFree", h24:"f24", conf:"fConf", fav:"fFav"};
function paintFilters(){ for (const k in chipFor) $(chipFor[k]).setAttribute("aria-pressed", !!F[k]); $("useT2").checked = F.t2; }
function toggleFilter(k, val){
  F[k] = val === undefined ? !F[k] : val; jset("filters", F); paintFilters();
  syncMarkers(true);
  if (k === "t2") loadNear(); else renderList();
  if (k === "fav" && F.fav && mode === "map" && snapName === "peek") setSnap("half");
}
for (const k in chipFor) $(chipFor[k]).onclick = () => toggleFilter(k);
$("useT2").onchange = () => toggleFilter("t2", $("useT2").checked);
function paintOcm(){
  $("ocmNote").textContent = !ocmKey ? "Ajoute une 3ᵉ source de bornes. Clé gratuite sur openchargemap.org. Elle reste sur votre téléphone."
    : ocmErr ? "Open Charge Map : " + ocmErr + ". Vérifiez la clé." : "Open Charge Map activé ✓";
}
$("ocmKey").value = ocmKey; paintOcm();
$("ocmKey").onchange = () => {
  ocmKey = $("ocmKey").value.trim(); store.set("ocmKey", ocmKey); ocmRef = null; ocmErr = "";
  for (const k of [...xMem.keys()]) if (k.startsWith("m4:")) xMem.delete(k);
  paintOcm(); loadNear();
};

/* ---------- Réglages Twizy ---------- */
const DEF = {soc:100, range:75, reserve:15, target:100, full:210, detour:3, wx:true, priceDef:0.35};
const cfg = Object.assign({}, DEF, jget("cfg", {}));
const saveCfg = () => jset("cfg", cfg);
const outFmt = {soc:v => v + " %", range:v => v + " km", reserve:v => v + " %", target:v => v + " %", full:v => fmtH(v), detour:v => v + " km", priceDef:v => v.toFixed(2).replace(".", ",") + " €/kWh"};
function paintQuick(){ document.querySelectorAll("[data-set]").forEach(b => b.setAttribute("aria-pressed", +cfg[b.dataset.set] === +b.dataset.v)); }
for (const k of Object.keys(outFmt)){
  const el = $(k); el.value = cfg[k]; $(k + "Out").textContent = outFmt[k](+cfg[k]);
  el.oninput = () => { cfg[k] = +el.value; $(k + "Out").textContent = outFmt[k](cfg[k]); saveCfg(); paintQuick(); };
}
document.querySelectorAll("[data-set]").forEach(b => b.onclick = () => {
  const k = b.dataset.set, v = +b.dataset.v; cfg[k] = v; $(k).value = v; $(k + "Out").textContent = outFmt[k](v); saveCfg(); paintQuick(); });
delete cfg.model; saveCfg(); paintQuick();
$("wx").checked = cfg.wx; $("wx").onchange = () => { cfg.wx = $("wx").checked; saveCfg(); };

/* ---------- Suivi de recharge ---------- */
let charge = jget("charge", null), chargeFrom = "map";
function chargeState(c){
  const rate = 100 / cfg.full / 6e4;
  const pct = Math.min(c.to, c.from + (Date.now() - c.start) * rate);
  const end = c.start + (c.to - c.from) / rate;
  return {pct, end, done: Date.now() >= end};
}
function paintChargePill(){
  const pill = $("cpill");
  if (!charge){ pill.hidden = true; return; }
  const st = chargeState(charge);
  pill.hidden = false;
  pill.textContent = st.done ? "⚡ Chargée à " + charge.to + " % ✓" : "⚡ " + Math.floor(st.pct) + " % · fin " + fmtClock(st.end, Date.now());
  if (pane === "charge") paintCharge();
}
function paintCharge(){
  const from = +$("cFrom").value, to = +$("cTo").value;
  $("cFromOut").textContent = from + " %"; $("cToOut").textContent = to + " %";
  const s = charge ? charge.s : chargeTarget, c = s ? costOf(s, to - from) : null;
  if (charge){
    const st = chargeState(charge), left = Math.max(0, st.end - Date.now()) / 6e4;
    $("cInfo").innerHTML = `<div class="cbig">${Math.floor(st.pct)} %</div>${socBar(charge.from, st.pct)}
      <div class="m">${st.done ? "Recharge terminée ✓" : "Fin prévue à <b>" + fmtClock(st.end, Date.now()) + "</b>, dans " + fmtH(left)}</div>
      <div class="m">Branchée à ${charge.from} % à ${fmtClock(charge.start, charge.start)} · objectif ${charge.to} %${charge.s ? " · " + fmtEur(costOf(charge.s, charge.to - charge.from)) : ""}</div>`;
    $("cSetup").hidden = true; $("cGo").hidden = true; $("cStop").hidden = false;
  } else {
    const min = Math.max(0, to - from) / 100 * cfg.full;
    $("cInfo").innerHTML = `<div class="m">Durée estimée : <b>${fmtH(min)}</b> · fin vers <b>${fmtClock(Date.now() + min * 6e4, Date.now())}</b>${c ? " · " + fmtEur(c) : ""}</div>`;
    $("cSetup").hidden = false; $("cGo").hidden = false; $("cStop").hidden = true;
  }
}
let chargeTarget = null;
function openCharge(s){
  chargeFrom = mode; if (s) chargeTarget = s;
  if (detail){ detail = null; selLayer.clearLayers(); }
  if (!charge){ $("cTo").value = cfg.target; }
  $("hTitle").textContent = "⚡ Recharge" + ((charge ? charge.s : chargeTarget) ? " · " + (charge ? charge.s : chargeTarget).name : "");
  $("hSub").textContent = charge ? "Suivi en cours · gardé même si vous fermez l'appli" : "Indiquez la batterie actuelle puis démarrez";
  showPane("charge"); if (snapName === "peek") setSnap("half"); paintCharge();
}
function closeCharge(){ if (mode === "map"){ showPane("map"); renderList(); } else { showPane("trip"); restoreTripHead(); } }
$("cFrom").oninput = paintCharge; $("cTo").oninput = paintCharge;
document.querySelectorAll("[data-cfrom]").forEach(b => b.onclick = () => { $("cFrom").value = b.dataset.cfrom; paintCharge(); });
$("cGo").onclick = () => {
  const from = +$("cFrom").value, to = +$("cTo").value;
  if (to <= from){ $("cInfo").innerHTML = `<div class="alert">L'objectif doit être plus haut que la batterie actuelle.</div>`; return; }
  charge = {start:Date.now(), from, to, s: chargeTarget ? slim(chargeTarget) : null};
  jset("charge", charge); paintChargePill(); openCharge();
};
$("cStop").onclick = () => { charge = null; store.set("charge", ""); paintChargePill(); openCharge(); };
$("cpill").onclick = () => openCharge();
setInterval(paintChargePill, 20000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) paintChargePill(); });
suggest($("from"), $("fromSugg")); suggest($("to"), $("toSugg"));
$("swap").onclick = () => {
  const a = $("from"), b = $("to"), av = [a.value, a.dataset.lat, a.dataset.lng], bv = [b.value, b.dataset.lat, b.dataset.lng];
  [a.value, a.dataset.lat, a.dataset.lng] = [bv[0], bv[1] || "", bv[2] || ""]; [b.value, b.dataset.lat, b.dataset.lng] = [av[0], av[1] || "", av[2] || ""];
};
let recents = jget("recents", []);
function renderRecents(){
  $("recents").replaceChildren(...recents.map(p => { const b = document.createElement("button"); b.type = "button";
    b.textContent = "↻ " + p.label.split(/\s\d{5}\s?/)[0]; b.onclick = () => setPlace($("to"), p); return b; }));
  $("recents").hidden = !recents.length;
}
renderRecents();
function nowHHMM(){ const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); }
/* Heure du trajet : « Maintenant » par défaut (toujours l'heure du moment), ou « Partir à » / « Arriver à ». */
let when = "now";
function setWhen(w){
  if (w !== "now" && when === "now") $("dep").value = nowHHMM();
  when = w;
  document.querySelectorAll("[data-when]").forEach(b => b.setAttribute("aria-pressed", b.dataset.when === w));
  $("timeField").hidden = w === "now";
  $("depLbl").textContent = w === "arr" ? "Arrivée souhaitée à" : "Départ à";
}
document.querySelectorAll("[data-when]").forEach(b => b.onclick = () => setWhen(b.dataset.when));
setWhen("now");

/* ---------- Itinéraire ---------- */
async function resolvePlace(input, useMe){
  if (input.dataset.lat) return {lat:+input.dataset.lat, lng:+input.dataset.lng, label:input.value};
  const q = input.value.trim();
  if (!q){ if (useMe){ const p = await getPos(); return {lat:p.lat, lng:p.lng, label:"Ma position"}; } throw new Error("Indiquez une arrivée."); }
  const [p] = await geocode(q, 1); if (!p) throw new Error("Adresse introuvable : " + q);
  return p;
}
function decode6(str){
  const out = []; let i = 0, lat = 0, lng = 0;
  while (i < str.length){
    for (const k of [0, 1]){ let b, shift = 0, res = 0;
      do { b = str.charCodeAt(i++) - 63; res |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = (res & 1) ? ~(res >> 1) : (res >> 1); if (k === 0) lat += d; else lng += d; }
    out.push({lat:lat / 1e6, lng:lng / 1e6});
  }
  return out;
}
async function route(a, b){
  const body = {locations:[{lat:a.lat, lon:a.lng}, {lat:b.lat, lon:b.lng}], costing:"motor_scooter",
    costing_options:{motor_scooter:{top_speed:45, use_highways:0, use_primary:0.2, use_hills:0.3}},
    units:"kilometers", directions_type:"none"};
  for (const u of VALHALLA){
    try {
      const r = await fetch(u + "?json=" + encodeURIComponent(JSON.stringify(body)));
      if (!r.ok) continue;
      const t = (await r.json()).trip; if (!t || !t.legs || !t.legs.length) continue;
      return {pts:t.legs.flatMap(l => decode6(l.shape)), km:t.summary.length, min:t.summary.time / 60, twizy:true};
    } catch(e) {}
  }
  const coords = a.lng + "," + a.lat + ";" + b.lng + "," + b.lat;
  for (const ex of ["&exclude=motorway", ""]){
    try {
      const r = await fetch(OSRM + coords + "?overview=full&geometries=geojson" + ex);
      if (!r.ok) continue;
      const j = await r.json(); if (j.code !== "Ok" || !j.routes.length) continue;
      const g = j.routes[0];
      return {pts:g.geometry.coordinates.map(c => ({lat:c[1], lng:c[0]})), km:g.distance/1000, min:g.duration/60, twizy:false};
    } catch(e) {}
  }
  throw new Error("Itinéraire impossible à calculer pour le moment.");
}
function sampleRoute(pts){
  const out = [{lat:pts[0].lat, lng:pts[0].lng, km:0}]; let km = 0, acc = 0;
  for (let i = 1; i < pts.length; i++){ const d = hav(pts[i-1], pts[i]); km += d; acc += d;
    if (acc >= 0.25 || i === pts.length - 1){ out.push({lat:pts[i].lat, lng:pts[i].lng, km}); acc = 0; } }
  return out;
}
function corridorCells(sp, padKm){
  const cells = new Map(), padLat = padKm / 111;
  let cur = null, startKm = 0;
  const flush = () => { if (!cur) return; const padLng = padKm / (111 * Math.cos(((cur.s + cur.n) / 2) * Math.PI / 180));
    for (const c of cellsFor({s:cur.s - padLat, n:cur.n + padLat, w:cur.w - padLng, e:cur.e + padLng})) cells.set(c.join("_"), c); };
  for (const p of sp){
    if (!cur || p.km - startKm > 8){ flush(); cur = {s:p.lat, n:p.lat, w:p.lng, e:p.lng}; startKm = p.km; }
    cur.s = Math.min(cur.s, p.lat); cur.n = Math.max(cur.n, p.lat); cur.w = Math.min(cur.w, p.lng); cur.e = Math.max(cur.e, p.lng);
  }
  flush();
  return [...cells.values()];
}
async function stationsAlong(sp, padKm, onProgress){
  const cells = corridorCells(sp, padKm); let done = 0, bad = 0;
  const ocells = new Map(); cells.forEach(([i, j]) => ocells.set(Math.floor(i / 3) + "_" + Math.floor(j / 3), [Math.floor(i / 3), Math.floor(j / 3)]));
  const osmDone = Promise.allSettled([...ocells.values()].flatMap(([i, j]) => EXTRA.filter(x => x.on()).map(x => getExtraCell(x, i, j).then(addExtra))));
  await Promise.all(cells.map(async ([i, j]) => {
    try { let list = await getCell(i, j); if (!list) list = await getCell(i, j);
      if (list) addStations(list); }
    catch(e){ bad++; }
    onProgress(++done, cells.length);
  }));
  onProgress(-1, 0);
  await Promise.race([osmDone, sleep(15000)]);
  if (bad === cells.length && cells.length && !used.size) throw new Error("Impossible de charger les bornes pour le moment. Réessayez dans un instant.");
  let s0 = Infinity, n0 = -Infinity, w0 = Infinity, e0 = -Infinity;
  sp.forEach(p => { s0 = Math.min(s0, p.lat); n0 = Math.max(n0, p.lat); w0 = Math.min(w0, p.lng); e0 = Math.max(e0, p.lng); });
  const padLat = padKm / 111 + 0.01, padLng = padKm / 70 + 0.01;
  const res = [];
  for (const s of all.values()){
    if (s.lat < s0 - padLat || s.lat > n0 + padLat || s.lng < w0 - padLng || s.lng > e0 + padLng) continue;
    if (!compatible(s) || noteOf(s).status === "ko") continue;
    let best = Infinity, km = 0;
    for (const p of sp){ if (Math.abs(p.lat - s.lat) > 0.1) continue; const d = hav(p, s); if (d < best){ best = d; km = p.km; } }
    const detour = best * 1.3;
    if (detour <= padKm) res.push(Object.assign({}, s, {km, detour}));
  }
  return {list:res.sort((a, b) => a.km - b.km), bad};
}
function plan(totalKm, cand){
  const pctPerKm = 100 / (rangeNow || cfg.range), reserve = cfg.reserve, target = cfg.target;
  let pos = 0, soc = cfg.soc, back = 0; const stops = [];
  for (let guard = 0; guard < 40; guard++){
    const usable = (soc - reserve) / pctPerKm;
    if (totalKm - pos + back <= usable) return {ok:true, stops, arrival: soc - (totalKm - pos + back) * pctPerKm};
    const reach = cand.filter(s => s.km > pos + 0.5 && (s.km - pos) + back + s.detour <= usable);
    if (!reach.length){ const nx = cand.find(s => s.km > pos + 0.5); return {ok:false, stops, failAt:pos + usable - back, gapTo: nx ? nx.km : null}; }
    const far = reach[reach.length - 1].km;
    const pick = reach.filter(s => s.km >= far - 3).sort((a, b) => (b.ef > 0) - (a.ef > 0) || a.detour - b.detour)[0];
    const arrive = soc - ((pick.km - pos) + back + pick.detour) * pctPerKm;
    const need = (totalKm - pick.km + pick.detour) * pctPerKm + reserve;
    const chargeTo = Math.max(Math.ceil(arrive), Math.min(target, Math.ceil((need + 5) / 5) * 5));
    stops.push({s:pick, arrive, chargeTo, minutes: Math.max(0, chargeTo - arrive) / 100 * cfg.full});
    if (chargeTo <= arrive + 1) return {ok:false, stops, failAt:pick.km, gapTo:null};
    pos = pick.km; back = pick.detour; soc = chargeTo;
  }
  return {ok:false, stops, failAt:pos, gapTo:null};
}
function socBar(a, b){
  const lo = Math.max(0, Math.min(a, b)), hi = Math.min(100, Math.max(a, b));
  return `<div class="bar"><i style="left:0;width:${lo}%;background:var(--muted);opacity:.45"></i><i style="left:${lo}%;width:${hi - lo}%;background:var(--ef)"></i></div>`;
}
const pinIcon = (txt, cls) => L.divIcon({className:"", html:`<div class="${cls}">${txt}</div>`, iconSize:[30,30], iconAnchor:[15,15]});
function setTripHead(title, sub){ tripHead = {title, sub}; restoreTripHead(); }
function restoreTripHead(){ if (!tripHead) return; $("hTitle").textContent = tripHead.title; $("hSub").textContent = tripHead.sub; }
function tripTo(s){
  setMode("trip");
  setPlace($("to"), {label:s.name + (s.addr ? ", " + s.addr : ""), lat:s.lat, lng:s.lng});
  showForm(); setSnap("full");
}
function showForm(){ $("tripForm").hidden = false; $("tripResult").hidden = true; setTripHead("Planifier un trajet", "Départ, arrivée et batterie"); }

let tripBusy = false;
$("tripForm").onsubmit = async e => {
  e.preventDefault(); if (tripBusy) return; tripBusy = true;
  const btn = $("calc"), out = $("tripResult");
  btn.disabled = true; out.hidden = true; $("carSet").open = false;
  if (document.activeElement) document.activeElement.blur();
  const status = t => { btn.textContent = t; $("hSub").textContent = t; };
  setLoading(true);
  try {
    status("Recherche des adresses…");
    const [a, b] = await Promise.all([resolvePlace($("from"), true), resolvePlace($("to"), false)]);
    status("Calcul de l'itinéraire…");
    const r = await route(a, b);
    const sp = sampleRoute(r.pts);
    tripLayer.clearLayers(); selLayer.clearLayers();
    const line = L.polyline(r.pts.map(p => [p.lat, p.lng]), {color:COL.route, weight:6, opacity:.85, interactive:false}).addTo(tripLayer);
    // Heure : maintenant, partir à, ou arriver à (une heure déjà passée = demain).
    const now = Date.now(), ref = now;
    const atTime = () => { const [hh, mm] = ($("dep").value || nowHHMM()).split(":").map(Number); const d = new Date(); d.setHours(hh, mm, 0, 0);
      if (d.getTime() < now - (when === "arr" ? 0 : 15 * 6e4)) d.setDate(d.getDate() + 1); return d; };
    const goal = when === "arr" ? atTime() : null;
    let dep = when === "dep" ? atTime() : new Date(now);
    rangeNow = cfg.range; let wxNote = "";
    if (cfg.wx){
      status("Météo du trajet…");
      try { const mid = sp[Math.floor(sp.length / 2)], T = await tempAt(mid.lat, mid.lng, goal ? goal.getTime() - r.min * 9e4 : dep.getTime() + r.min * 3e4);
        rangeNow = Math.round(cfg.range * wxFactor(T));
        wxNote = `Météo prévue sur le trajet : ${Math.round(T)} °C → autonomie estimée ${rangeNow} km` + (rangeNow < cfg.range ? ` (au lieu de ${cfg.range} km)` : "") + "."; }
      catch(e){ wxNote = "Météo indisponible : autonomie réglée utilisée."; }
    }
    const directOk = r.km <= ((cfg.soc - cfg.reserve) / 100) * rangeNow;
    let cand = [], bad = 0;
    if (!directOk){ status("Recherche des bornes sur le trajet…");
      ({list:cand, bad} = await stationsAlong(sp, cfg.detour, (d, n) => status(d < 0 ? "Comparaison avec les autres sources…" : "Bornes sur le trajet… " + Math.round(d / n * 100) + " %"))); }
    const res = plan(r.km, cand);
    const speed = 36; // moyenne réaliste d'une Twizy 45 (villages, ronds-points, côtes)
    const driveMin = Math.max(r.min * 1.1, r.km / speed * 60);
    const minPerKm = driveMin / Math.max(r.km, 0.1);
    let t = dep.getTime(), prevKm = 0, back = 0;
    res.stops.forEach(x => { x.arrT = t + ((x.s.km - prevKm) + back + x.s.detour) * minPerKm * 6e4; x.leaveT = x.arrT + x.minutes * 6e4; t = x.leaveT; prevKm = x.s.km; back = x.s.detour; });
    let arrT = t + (r.km - prevKm + back) * minPerKm * 6e4, late = false;
    // « Arriver à » : on recule tout le trajet pour finir pile à l'heure voulue.
    if (goal){ const shift = goal.getTime() - arrT; dep = new Date(dep.getTime() + shift); arrT += shift;
      res.stops.forEach(x => { x.arrT += shift; x.leaveT += shift; }); late = dep.getTime() < now - 2 * 6e4; }
    const keyTime = goal ? "départ " + fmtClock(dep, ref) : "arrivée " + fmtClock(arrT, ref);
    const chargeMin = res.stops.reduce((s, x) => s + x.minutes, 0);
    res.stops.forEach(x => x.cost = costOf(x.s, x.chargeTo - x.arrive));
    const cost = {eur:res.stops.reduce((a, x) => a + x.cost.eur, 0), est:res.stops.some(x => x.cost.est)};

    cand.forEach(s => { if (!res.stops.some(x => x.s === s))
      L.circleMarker([s.lat, s.lng], {renderer, radius:6, weight:1.5, color:"#fff", fillOpacity:.9, fillColor:s.ef ? COL.ef : COL.t2})
        .on("click", () => { lastMarkerTap = Date.now(); showDetail(s, "trip"); }).addTo(tripLayer); });
    L.marker([a.lat, a.lng], {icon:pinIcon("A", "end-icon"), interactive:false}).addTo(tripLayer);
    L.marker([b.lat, b.lng], {icon:pinIcon("B", "end-icon"), interactive:false}).addTo(tripLayer);
    const stopInfo = (x, i) => `<div class="stopinfo"><b>Arrêt ${i + 1}</b> · km ${Math.round(x.s.km)}<br>
      Arrivée vers <b>${fmtClock(x.arrT, ref)}</b> avec ${Math.round(x.arrive)} % · recharger jusqu'à <b>${x.chargeTo} %</b> (${fmtH(x.minutes)}, ${fmtEur(x.cost)}) · départ vers ${fmtClock(x.leaveT, ref)}
      ${socBar(x.arrive, x.chargeTo)}</div>`;
    res.stops.forEach((x, i) => { L.marker([x.s.lat, x.s.lng], {icon:pinIcon(i + 1, "num-icon"), zIndexOffset:500})
      .on("click", () => { lastMarkerTap = Date.now(); showDetail(x.s, "trip", stopInfo(x, i)); }).addTo(tripLayer); });

    let html = `<div class="summary">
      <div><b>${Math.round(r.km)}</b><span>km</span></div>
      <div><b>${fmtH(chargeMin)}</b><span>recharge</span></div>
      <div><b>${res.stops.length ? fmtEur(cost).replace("≈ ", "") : "0 €"}</b><span>${cost.est ? "coût estimé" : "coût"}</span></div>
      <div><b>${fmtClock(goal ? dep : arrT, ref)}</b><span>${goal ? "départ" : "arrivée"}</span></div></div>
      <div class="note" style="margin-top:0">${plural(res.stops.length, "arrêt")} · conduite ${fmtH(driveMin)} + recharge ${fmtH(chargeMin)} = ${fmtH((arrT - dep) / 6e4)} au total.</div>
      ${wxNote ? `<div class="note wx">${esc(wxNote)}</div>` : ""}
      ${goal && !late ? `<div class="note wx">Pour arriver à <b>${fmtClock(goal, ref)}</b>, partez à <b>${fmtClock(dep, ref)}</b>.</div>` : ""}`;
    if (late) html += `<div class="alert">Trop tard pour arriver à ${fmtClock(goal, ref)} : il aurait fallu partir à ${fmtClock(dep, ref)}. En partant maintenant, arrivée vers ${fmtClock(now + (arrT - dep), ref)}.</div>`;
    if (!r.twizy) html += `<div class="alert">Calcul de secours : l'itinéraire peut emprunter une voie express interdite à la Twizy. Réessayez dans un moment.</div>`;
    if (bad) html += `<div class="alert">Une partie des bornes n'a pas pu être chargée : le plan peut en manquer.</div>`;
    if (!res.ok) html += `<div class="alert">Aucune borne compatible atteignable : la batterie atteint la réserve vers le km ${Math.max(0, Math.round(res.failAt))}${res.gapTo ? ` et la borne suivante est au km ${Math.round(res.gapTo)}` : ""}. Augmentez le détour maximum, baissez la réserve ou partez plus chargé.</div>`;
    html += `<ol class="steps"><li><span class="pin">A</span><div><div class="t">${esc(a.label)}</div><div class="m"><span class="clock">${fmtClock(dep, ref)}</span> · départ avec ${cfg.soc} %</div></div></li>`;
    res.stops.forEach((x, i) => {
      html += `<li data-i="${i}"><span class="pin stop">${i + 1}</span><div>
        <div class="t">${esc(x.s.name)}</div>
        <div class="m">Km ${Math.round(x.s.km)}${x.s.detour > 0.3 ? " · détour " + fmtKm(x.s.detour) : ""}${x.s.addr ? " · " + esc(x.s.addr) : ""}</div>
        <div class="m"><span class="clock">${fmtClock(x.arrT, ref)}</span> arrivée avec ${Math.round(x.arrive)} % → recharger jusqu'à <b>${x.chargeTo} %</b> (${fmtH(x.minutes)}, ${fmtEur(x.cost)}) · repart <span class="clock">${fmtClock(x.leaveT, ref)}</span></div>
        ${socBar(x.arrive, x.chargeTo)}<div class="tags">${tagsHTML(x.s)}</div>
        <a class="go" data-app="${navApp}" target="_blank" rel="noopener" href="${navURL(navApp, x.s.lat, x.s.lng)}">Y aller</a></div></li>`;
    });
    if (res.ok) html += `<li><span class="pin">B</span><div><div class="t">${esc(b.label)}</div><div class="m"><span class="clock">${fmtClock(arrT, ref)}</span> · arrivée avec environ ${Math.round(res.arrival)} %</div>
      <a class="go" data-app="${navApp}" target="_blank" rel="noopener" href="${navURL(navApp, b.lat, b.lng)}">Y aller</a></div></li>`;
    html += `</ol><div class="note">Estimation avec ${rangeNow} km d'autonomie${cand.length ? " et " + plural(cand.length, "borne") + " compatible" + (cand.length > 1 ? "s" : "") + " trouvée" + (cand.length > 1 ? "s" : "") + " sur le trajet" : ""}. Touchez un arrêt pour voir la fiche de la borne.</div>
      ${res.ok ? `<button type="button" class="primary" id="gGo" style="width:100%;margin-top:14px">▶ Démarrer le guidage</button>
      <a class="ghost glink" target="_blank" rel="noopener" id="gGoogle">Ouvrir dans Google Maps (secours)</a>` : ""}
      <button type="button" class="ghost" id="edit">Modifier le trajet ou les réglages</button>`;
    out.innerHTML = html; out.hidden = false; $("tripForm").hidden = true;
    $("paneTrip").scrollTop = 0;
    setTripHead("Vers " + b.label.split(/\s\d{5}\s?/)[0], res.ok ? (res.stops.length ? plural(res.stops.length, "recharge") + " prévue" + (res.stops.length > 1 ? "s" : "") + " · " + keyTime : "Pas besoin de recharger · " + keyTime) : "Trajet impossible avec ces réglages");
    out.querySelectorAll("li[data-i]").forEach(li => li.onclick = ev => { if (ev.target.closest("a")) return;
      const i = +li.dataset.i, x = res.stops[i]; showDetail(x.s, "trip", stopInfo(x, i)); });
    $("edit").onclick = () => { showForm(); setSnap("full"); };
    lastTrip = {a, b, stops:res.stops, pts:sp};
    if ($("gGo")){ $("gGo").onclick = startGuide; $("gGoogle").href = googleURL(lastTrip); }
    if (b.label !== "Ma position"){ recents = [{label:b.label, lat:b.lat, lng:b.lng}, ...recents.filter(p => p.label !== b.label)].slice(0, 5); jset("recents", recents); renderRecents(); }
    setSnap("half");
    map.fitBounds(line.getBounds(), {paddingTopLeft:[24, hdrH + 16], paddingBottomRight:[24, curVis + 16]});
  } catch(err) {
    $("hSub").textContent = err.message;
    out.innerHTML = `<div class="alert">${esc(err.message)}</div>`; out.hidden = false;
  } finally { btn.disabled = false; btn.textContent = "Calculer mon trajet"; tripBusy = false; setLoading(busy()); }
};

/* ---------- Boussole du téléphone (la carte tourne quand on tourne le téléphone) ---------- */
let compass = null, compassOn = false, headMode = false;
/* Rotation animée image par image : on fixe une cible, l'affichage la rejoint en douceur (pas de crans). */
const ROT = {target:0, shown:null, headUp:true, raf:0, t:0};
function rotTo(deg, headUp){
  ROT.target = (deg + 360) % 360; ROT.headUp = headUp;
  if (ROT.shown == null) ROT.shown = ROT.target;
  if (!ROT.raf){ ROT.t = performance.now(); ROT.raf = requestAnimationFrame(rotStep); }
}
function rotStep(now){
  const dt = Math.min(100, Math.max(0, now - ROT.t)); ROT.t = now;
  const d = ((ROT.target - ROT.shown + 540) % 360) - 180, done = Math.abs(d) < 0.05;
  ROT.shown = (ROT.shown + (done ? d : d * (1 - Math.exp(-dt / 160))) + 360) % 360;
  applyRot();
  ROT.raf = done ? 0 : requestAnimationFrame(rotStep);
}
function applyRot(){
  const b = ROT.shown;
  if (canRotate) map.setBearing(ROT.headUp ? 360 - b : 0);
  const el = gMe && gMe.getElement && gMe.getElement();
  if (el && el.firstChild){ el.firstChild.style.transition = "none"; el.firstChild.style.transform = "rotate(" + (ROT.headUp ? 0 : b) + "deg)"; }
}
function onOrient(e){
  let h = e.webkitCompassHeading != null ? e.webkitCompassHeading : (e.absolute && e.alpha != null ? 360 - e.alpha : null);
  if (h == null || isNaN(h)) return;
  const scr = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
  const c = (h + scr + 360) % 360;
  // Petit lissage de la boussole pour effacer ses tremblements.
  compass = compass == null ? c : (compass + (((c - compass + 540) % 360) - 180) * 0.35 + 360) % 360;
  onCompass();
}
function enableCompass(){
  // Sur iPhone, l'autorisation doit être demandée pendant le toucher : cette fonction est appelée tout de suite au clic.
  if (compassOn) return Promise.resolve(true);
  const go = () => { addEventListener("ondeviceorientationabsolute" in window ? "deviceorientationabsolute" : "deviceorientation", onOrient); compassOn = true; return true; };
  try {
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function")
      return DeviceOrientationEvent.requestPermission().then(r => r === "granted" ? go() : false, () => false);
  } catch(e){ return Promise.resolve(false); }
  return Promise.resolve(go());
}
function onCompass(){
  if (compass == null) return;
  if (G){ if (G.lastP && !G.moving) updateView(G.lastP, compass, true); }
  else if (headMode && canRotate) rotTo(compass, true);
}
function paintLoc(){ $("loc").setAttribute("aria-pressed", headMode); $("loc").setAttribute("aria-label", headMode ? "Carte orientée comme le téléphone (toucher pour remettre le nord en haut)" : "Me localiser"); }
// Bouton de position : 1er toucher = me localiser ; 2e toucher = la carte suit l'orientation du téléphone ; 3e = nord en haut.
$("loc").onclick = () => {
  if (headMode){ headMode = false; rotTo(0, true); paintLoc(); return; }
  if (me && canRotate && map.distance(map.getCenter(), [me.lat, me.lng]) < 60){
    enableCompass().then(ok => { if (ok){ headMode = true; paintLoc(); onCompass(); } else $("hSub").textContent = "Boussole non autorisée : réglages de Safari > Mouvement et orientation."; });
    return;
  }
  locateMe();
};

/* ---------- Guidage dans l'appli : suit l'itinéraire Twizy 45, voix, arrêts recharge ---------- */
let lastTrip = null, G = null;
const ARW = {8:"↑",9:"↗",10:"→",11:"↘",12:"↷",13:"↶",14:"↙",15:"←",16:"↖",17:"↑",18:"↗",19:"↖",20:"↗",21:"↖",22:"↑",23:"↗",24:"↖",25:"↑",26:"⟳",27:"⟳",4:"⚑",5:"⚑",6:"⚑"};
const fmtDist = km => km < 1 ? Math.max(10, Math.round(km * 100) * 10) + " m" : km.toFixed(1).replace(".", ",") + " km";
let gMuted = store.get("gMuted") === "1";
function say(t){
  if (gMuted || !t || !("speechSynthesis" in window)) return;
  try { const u = new SpeechSynthesisUtterance(t); u.lang = "fr-FR"; u.rate = 1.02;
    const v = speechSynthesis.getVoices().find(v => /^fr/i.test(v.lang)); if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u); } catch(e) {}
}
function googleURL(t){
  // Secours : Google Maps avec les bornes et quelques points de notre trajet pour le forcer à suivre les mêmes routes.
  const via = t.stops.map(x => x.s.lat.toFixed(5) + "," + x.s.lng.toFixed(5));
  const n = Math.max(0, 8 - via.length), pts = t.pts;
  const extra = []; for (let i = 1; i <= n; i++){ const p = pts[Math.floor(i * pts.length / (n + 1))]; if (p) extra.push(p); }
  const wp = [...via.map((v, i) => ({v, k:t.stops[i].s.km})), ...extra.map(p => ({v:p.lat.toFixed(5) + "," + p.lng.toFixed(5), k:p.km || 0}))];
  return "https://www.google.com/maps/dir/?api=1&origin=" + t.a.lat.toFixed(5) + "," + t.a.lng.toFixed(5) + "&destination=" + t.b.lat.toFixed(5) + "," + t.b.lng.toFixed(5)
    + (wp.length ? "&waypoints=" + encodeURIComponent(wp.sort((x, y) => x.k - y.k).map(x => x.v).join("|")) : "") + "&travelmode=driving";
}
async function guideRoute(from, targets){
  const body = {locations:[{lat:from.lat, lon:from.lng}, ...targets.map(t => ({lat:t.lat, lon:t.lng}))], costing:"motor_scooter",
    costing_options:{motor_scooter:{top_speed:45, use_highways:0, use_primary:0.2, use_hills:0.3}}, units:"kilometers", language:"fr-FR"};
  for (const u of VALHALLA){
    try {
      const r = await fetch(u + "?json=" + encodeURIComponent(JSON.stringify(body))); if (!r.ok) continue;
      const t = (await r.json()).trip; if (!t || !t.legs) continue;
      return t.legs.map(l => { const pts = decode6(l.shape), cum = [0];
        for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hav(pts[i - 1], pts[i]));
        return {pts, cum, man:l.maneuvers}; });
    } catch(e) {}
  }
  throw new Error("Guidage impossible pour le moment (service d'itinéraire indisponible).");
}
function snap(leg, p, from){
  // Point le plus proche sur le tracé, en cherchant autour de la dernière position connue.
  const k = Math.cos(p.lat * Math.PI / 180) * 111.32, X = q => q.lng * k, Y = q => q.lat * 110.57;
  let best = {d:Infinity, i:0, along:0};
  const lo = Math.max(0, from - 10), hi = Math.min(leg.pts.length - 1, from + 150);
  for (let i = lo; i < hi; i++){
    const a = leg.pts[i], b = leg.pts[i + 1], dx = X(b) - X(a), dy = Y(b) - Y(a), L2 = dx * dx + dy * dy;
    let t = L2 ? ((X(p) - X(a)) * dx + (Y(p) - Y(a)) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    const d = Math.hypot(X(a) + t * dx - X(p), Y(a) + t * dy - Y(p));
    if (d < best.d) best = {d, i, along:leg.cum[i] + t * (leg.cum[i + 1] - leg.cum[i])};
  }
  return best;
}
const gLayer = L.layerGroup();
let gMe = null;
function drawGuide(){
  gLayer.clearLayers();
  G.legs.forEach(l => L.polyline(l.pts.map(p => [p.lat, p.lng]), {color:COL.route, weight:8, opacity:.85, interactive:false}).addTo(gLayer));
  G.targets.forEach((t, i) => L.marker([t.lat, t.lng], {icon:pinIcon(t.stop ? "⚡" : "B", t.stop ? "num-icon" : "end-icon"), interactive:false}).addTo(gLayer));
}
async function startGuide(){
  if (!lastTrip) return;
  say("Guidage démarré."); // à faire pendant le toucher pour qu'iPhone autorise la voix
  enableCompass(); // idem pour la boussole (iPhone demande l'autorisation une fois)
  headMode = false; paintLoc();
  $("gGo").disabled = true; $("gGo").textContent = "Calcul du guidage…";
  try {
    const p = await getPos();
    const targets = [...lastTrip.stops.map(x => ({lat:x.s.lat, lng:x.s.lng, label:x.s.name, stop:x})), {lat:lastTrip.b.lat, lng:lastTrip.b.lng, label:lastTrip.b.label}];
    G = {targets, legs:await guideRoute(p, targets), idx:0, off:0, spoken:new Set(), busy:false, paused:false, follow:true};
    document.body.classList.add("guiding"); $("guide").hidden = false; $("gCard").hidden = true;
    tripLayer.remove(); nearLayer.remove(); gLayer.addTo(map); drawGuide();
    if (gMe) gMe.remove();
    gMe = L.marker([p.lat, p.lng], {interactive:false, zIndexOffset:1000, icon:L.divIcon({className:"", iconSize:[44, 44], iconAnchor:[22, 24],
      html:'<div class="g-me"><svg viewBox="0 0 44 44" width="44" height="44"><path d="M22 4 L37 38 L22 29 L7 38 Z" fill="#1a73e8" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg></div>'})}).addTo(map);
    map.setView([p.lat, p.lng], 17); paintNorth();
    try { G.wake = await navigator.wakeLock.request("screen"); } catch(e) {}
    G.watch = navigator.geolocation.watchPosition(onGuidePos, () => { $("gIns").textContent = "Position GPS perdue…"; }, {enableHighAccuracy:true, maximumAge:1000, timeout:15000});
    onGuidePos({coords:{latitude:p.lat, longitude:p.lng}});
  } catch(e){ $("hSub").textContent = e.message; $("gGoogle").insertAdjacentHTML("beforebegin", `<div class="alert">${esc(e.message)}</div>`); }
  finally { if ($("gGo")){ $("gGo").disabled = false; $("gGo").textContent = "▶ Démarrer le guidage"; } }
}
function stopGuide(){
  if (!G) return;
  if (G.watch != null) navigator.geolocation.clearWatch(G.watch);
  try { G.wake && G.wake.release(); } catch(e) {}
  try { speechSynthesis.cancel(); } catch(e) {}
  G = null; gLayer.remove(); if (gMe){ gMe.remove(); gMe = null; }
  rotTo(0, true);
  document.body.classList.remove("guiding"); $("guide").hidden = true;
  tripLayer.addTo(map); setMode("trip");
}
document.addEventListener("visibilitychange", async () => { if (G && !document.hidden){ try { G.wake = await navigator.wakeLock.request("screen"); } catch(e) {} } });
async function reroute(p){
  if (G.busy) return; G.busy = true; $("gIns").textContent = "Nouveau calcul…"; say("Nouvel itinéraire.");
  try { G.legs = await guideRoute(p, G.targets); G.idx = 0; G.off = 0; G.spoken = new Set(); drawGuide(); }
  catch(e){ $("gIns").textContent = "Hors trajet, nouveau calcul impossible pour le moment."; }
  finally { G.busy = false; }
}
function arrived(){
  const t = G.targets[0];
  G.paused = true; $("gCard").hidden = false;
  if (t.stop){
    const x = t.stop;
    say("Vous êtes arrivé à la borne. Rechargez jusqu'à " + x.chargeTo + " pour cent, environ " + fmtH(x.minutes).replace(" h ", " heure ") + ".");
    $("gCard").innerHTML = `<b>⚡ Arrêt recharge : ${esc(t.label)}</b><div class="m">Recharger jusqu'à <b>${x.chargeTo} %</b> (${fmtH(x.minutes)})</div>
      <div class="acts"><button type="button" class="act plug" id="gPlug">⚡ Suivre la recharge</button><button type="button" class="act" id="gNext">▶ Reprendre</button></div>`;
    $("gPlug").onclick = () => { chargeTarget = x.s; $("cFrom").value = Math.max(0, Math.min(95, Math.round(x.arrive / 5) * 5)); $("cTo").value = x.chargeTo;
      charge = {start:Date.now(), from:+$("cFrom").value, to:x.chargeTo, s:slim(x.s)}; jset("charge", charge); paintChargePill(); $("gPlug").textContent = "Suivi lancé ✓"; };
    $("gNext").onclick = () => { G.targets.shift(); G.legs.shift(); G.idx = 0; G.off = 0; G.spoken = new Set(); G.paused = false; $("gCard").hidden = true; drawGuide(); say("C'est reparti."); };
  } else {
    say("Vous êtes arrivé à destination.");
    $("gCard").innerHTML = `<b>⚑ Arrivé : ${esc(t.label)}</b><div class="acts"><button type="button" class="act wide" id="gEnd">Terminer</button></div>`;
    $("gEnd").onclick = stopGuide;
  }
}
function onGuidePos(pos){
  if (!G || G.busy) return;
  const p = {lat:pos.coords.latitude, lng:pos.coords.longitude};
  const leg = G.legs[0], s = snap(leg, p, G.idx), total = leg.cum[leg.cum.length - 1];
  // Direction : celle de la route devant nous (stable), sinon celle donnée par le GPS quand on roule.
  // À l'arrêt ou au pas, c'est la boussole du téléphone qui oriente la carte.
  G.lastP = p; G.moving = (pos.coords.speed || 0) > 2;
  let hd = null;
  if (!G.paused && s.d <= 0.05 && (G.moving || compass == null)) hd = bearingDeg(pointAt(leg, s.along), pointAt(leg, Math.min(total, s.along + 0.04)));
  if (hd == null && !G.moving) hd = compass;
  if (hd == null && pos.coords.heading != null && !isNaN(pos.coords.heading) && (pos.coords.speed || 0) > 1.5) hd = pos.coords.heading;
  updateView(p, hd);
  if (G.paused) return;
  if (s.d > 0.05){ if (++G.off >= 3) { reroute(p); return; } } else { G.off = 0; G.idx = s.i; }
  if (hav(p, G.targets[0]) < 0.04 || total - s.along < 0.03){ arrived(); return; }
  const m = leg.man.find(m => m.type > 3 && leg.cum[m.begin_shape_index] > s.along + 0.005) || leg.man[leg.man.length - 1];
  const dNext = Math.max(0, leg.cum[m.begin_shape_index] - s.along), key = G.targets.length + ":" + m.begin_shape_index;
  $("gArrow").textContent = ARW[m.type] || "↑";
  $("gDist").textContent = fmtDist(dNext);
  // À une borne, on parle de la borne et non de « destination » (l'annonce d'arrivée vient de arrived()).
  const tgt = G.targets[0], end = m.type >= 4 && m.type <= 6, side = m.type === 5 ? "sur la droite" : m.type === 6 ? "sur la gauche" : "devant vous";
  $("gIns").textContent = end && tgt.stop ? "Borne " + side + " : " + tgt.label : m.instruction;
  if (end && tgt.stop){
    if (dNext < 0.3 && dNext > 0.08 && !G.spoken.has(key + "f")){ G.spoken.add(key + "f"); say("Dans " + Math.round(dNext * 20) * 50 + " mètres, la borne de recharge est " + side + "."); }
  }
  // Voix : une annonce vers 250 m, puis juste avant la manœuvre (pas pour la sortie d'un rond-point déjà annoncée).
  else if (m.type !== 27 && !(end && dNext < 0.06)){
    if (dNext < 0.06 && !G.spoken.has(key + "n")){ G.spoken.add(key + "n"); G.spoken.add(key + "f"); say(m.verbal_pre_transition_instruction || m.instruction); }
    else if (dNext < 0.3 && dNext > 0.12 && !G.spoken.has(key + "f")){ G.spoken.add(key + "f");
      const t = m.verbal_transition_alert_instruction || m.instruction; say("Dans " + Math.round(dNext * 20) * 50 + " mètres, " + t.charAt(0).toLowerCase() + t.slice(1)); }
  }
  const rem = (total - s.along) + G.legs.slice(1).reduce((a, l) => a + l.cum[l.cum.length - 1], 0);
  const chargeLeft = G.targets.filter(t => t.stop).reduce((a, t) => a + t.stop.minutes, 0);
  $("gEta").textContent = fmtClock(Date.now() + (rem / 36 * 60 + chargeLeft) * 6e4, Date.now());
  $("gRem").textContent = fmtDist(rem) + (G.targets[0].stop ? " · borne dans " + fmtDist(total - s.along) : "");
}
/* Carte orientée dans le sens de la route (comme Plans ou Waze), ou nord en haut au choix. */
let gNorthUp = store.get("gNorthUp") === "1";
function bearingDeg(a, b){ const r = Math.PI / 180, dl = (b.lng - a.lng) * r;
  const y = Math.sin(dl) * Math.cos(b.lat * r), x = Math.cos(a.lat * r) * Math.sin(b.lat * r) - Math.sin(a.lat * r) * Math.cos(b.lat * r) * Math.cos(dl);
  return (Math.atan2(y, x) / r + 360) % 360; }
function pointAt(leg, along){
  let i = 0; while (i < leg.cum.length - 2 && leg.cum[i + 1] < along) i++;
  const a = leg.pts[i], b = leg.pts[i + 1] || a, seg = (leg.cum[i + 1] || 0) - leg.cum[i], t = seg ? Math.max(0, Math.min(1, (along - leg.cum[i]) / seg)) : 0;
  return {lat:a.lat + (b.lat - a.lat) * t, lng:a.lng + (b.lng - a.lng) * t};
}
function destPoint(p, brg, km){ const R = 6371, r = Math.PI / 180, d = km / R, la = p.lat * r, t = brg * r;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(t));
  return {lat:la2 / r, lng:p.lng + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2)) / r}; }
function updateView(p, hd, quick){
  if (hd != null) G.bear = hd;
  const b = G.bear || 0, headUp = canRotate && !gNorthUp;
  if (gMe) gMe.setLatLng([p.lat, p.lng]);
  rotTo(b, headUp); // la rotation se fait en douceur, image par image
  // La boussole (quick) ne fait que tourner la carte : pas de recentrage à chaque mouvement du téléphone.
  if (G.follow && !quick){
    // En roulant, position affichée plus bas que le centre pour voir loin devant ; à l'arrêt, au centre (la carte tourne autour de vous).
    const z = map.getZoom(), ahead = G.moving ? innerHeight * 0.2 * 156543.03 * Math.cos(p.lat * Math.PI / 180) / Math.pow(2, z) / 1000 : 0;
    const c = headUp && ahead ? destPoint(p, G.moving ? b : 0, ahead) : p;
    map.setView([c.lat, c.lng], z, {animate:true});
  }
}
function paintNorth(){ $("gNorth").hidden = !canRotate; $("gNorth").textContent = gNorthUp ? "N↑" : "🧭"; $("gNorth").setAttribute("aria-label", gNorthUp ? "Carte nord en haut" : "Carte dans le sens de la route"); }
$("gNorth").onclick = () => { gNorthUp = !gNorthUp; store.set("gNorthUp", gNorthUp ? "1" : "0"); paintNorth(); if (G && gMe){ const ll = gMe.getLatLng(); updateView({lat:ll.lat, lng:ll.lng}, null); } };
$("gStop").onclick = stopGuide;
$("gMute").onclick = () => { gMuted = !gMuted; store.set("gMuted", gMuted ? "1" : "0"); $("gMute").textContent = gMuted ? "🔇" : "🔊"; if (gMuted) try { speechSynthesis.cancel(); } catch(e) {} };
$("gMute").textContent = gMuted ? "🔇" : "🔊";
map.on("dragstart", () => { if (G){ G.follow = false; $("gRecenter").hidden = false; } });
$("gRecenter").onclick = () => { if (!G) return; G.follow = true; $("gRecenter").hidden = true; if (gMe){ map.setZoom(17, {animate:false}); const ll = gMe.getLatLng(); updateView({lat:ll.lat, lng:ll.lng}, null); } };

/* ---------- Onglets ---------- */
function setMode(m){
  if (detail){ detail = null; selLayer.clearLayers(); }
  mode = m;
  $("tabMap").setAttribute("aria-selected", m === "map"); $("tabTrip").setAttribute("aria-selected", m === "trip");
  $("mapBar").hidden = m !== "map";
  if (m === "map"){ tripLayer.remove(); nearLayer.addTo(map); showPane("map"); loadNear(); setSnap(snapName === "full" ? "half" : snapName); }
  else {
    nearLayer.remove(); tripLayer.addTo(map); showPane("trip");
    if ($("tripResult").hidden){ showForm(); setSnap("full"); } else { restoreTripHead(); setSnap("half"); }
  }
}
$("tabMap").onclick = () => mode !== "map" && setMode("map");
$("tabTrip").onclick = () => mode !== "trip" && setMode("trip");

/* ---------- Icône d'écran d'accueil ---------- */
try { const c = document.createElement("canvas"); c.width = c.height = 180; const g = c.getContext("2d");
  g.fillStyle = "#12305a"; g.fillRect(0, 0, 180, 180); g.fillStyle = "#f5b82e"; g.beginPath(); g.arc(90, 90, 60, 0, 7); g.fill();
  g.fillStyle = "#12305a"; g.beginPath(); [[100,42],[62,100],[88,100],[78,140],[120,80],[94,80]].forEach(([x,y],i) => i ? g.lineTo(x,y) : g.moveTo(x,y)); g.fill();
  $("touchIcon").href = c.toDataURL("image/png"); } catch(e) {}

/* ---------- Démarrage ---------- */
paintFilters();
paintChargePill();
showPane("map");
setSnap("peek");
syncMarkers(true);
loadNear();
if (firstVisit) locateMe();
else try { navigator.permissions && navigator.permissions.query({name:"geolocation"}).then(p => { if (p.state === "granted") getPos().then(() => renderList()).catch(() => {}); }).catch(() => {}); } catch(e) {}
if ("serviceWorker" in navigator && location.protocol === "https:" && /github\.io$/.test(location.hostname)) navigator.serviceWorker.register("sw.js").catch(() => {});
