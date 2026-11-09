/* Bornes Twizy : garde le fond de carte, les bibliothèques et l'appli sur le téléphone
   pour un affichage plus rapide et un démarrage même sans réseau. */
const V = "twizy-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (!k.startsWith(V)) await caches.delete(k);
  await self.clients.claim();
})()));

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  // Carte vectorielle : style et index toujours redemandés (copie gardée pour rouler sans réseau), morceaux, icônes et polices gardés.
  if (u.hostname === "tiles.openfreemap.org" && (u.pathname.startsWith("/styles/") || u.pathname === "/planet")) { e.respondWith(styleFirst(req)); return; }
  if (u.hostname === "tiles.openfreemap.org" || u.hostname === "tile.openstreetmap.org" || (u.hostname === "data.geopf.fr" && u.pathname === "/wmts")) { e.respondWith(tile(req)); return; }
  if (u.hostname === "cdnjs.cloudflare.com" || u.hostname === "cdn.jsdelivr.net" || u.hostname === "fonts.googleapis.com" || u.hostname === "fonts.gstatic.com") { e.respondWith(cacheFirst(req)); return; }
  if (u.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
});

async function cacheFirst(req) {
  const c = await caches.open(V + "-lib");
  const hit = await c.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) c.put(req, res.clone());
  return res;
}

let added = 0;
async function tile(req) {
  const c = await caches.open(V + "-tiles");
  const hit = await c.match(req.url);
  if (hit) return hit;
  // Morceaux de carte enregistrés pour rouler sans réseau (bouton « Enregistrer pour rouler sans réseau »).
  const off = await (await caches.open(V + "-off")).match(req.url);
  if (off) return off;
  try {
    const res = await fetch(req.url, { mode: "cors", credentials: "omit" });
    if (res.ok) {
      c.put(req.url, res.clone());
      if (++added % 150 === 0) trim(c);
    }
    return res;
  } catch (err) {
    return fetch(req);
  }
}
async function trim(c) {
  const keys = await c.keys();
  if (keys.length > 3000) for (const k of keys.slice(0, keys.length - 2400)) await c.delete(k);
}

async function styleFirst(req) {
  const c = await caches.open(V + "-lib");
  try {
    const res = await fetch(req.url, { mode: "cors", credentials: "omit", cache: "no-cache" });
    if (res.ok) c.put(req.url, res.clone());
    return res;
  } catch (err) {
    const hit = (await c.match(req.url)) || (await (await caches.open(V + "-off")).match(req.url));
    if (hit) return hit;
    throw err;
  }
}

async function networkFirst(req) {
  const c = await caches.open(V + "-app");
  try {
    // no-cache : redemande toujours au serveur si la page a changé, pour voir les mises à jour tout de suite.
    const res = await fetch(req, { cache: "no-cache" });
    if (res.ok) c.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
