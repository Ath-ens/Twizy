/* Carte « façon Plans » : la carte vectorielle Liberty (OpenFreeMap) recolorée, en version jour et nuit.
   Chargé avant app.js : toute carte OpenFreeMap demandée par l'appli reçoit ce style (nuit si l'appli demande le style sombre). */
(() => {
  if (!window.maplibregl) return;
  const LIB = "https://tiles.openfreemap.org/styles/liberty";
  const ours = s => typeof s === "string" && /openfreemap\.org\/styles\//.test(s);
  const nightURL = s => typeof s === "string" && /\/styles\/(fiord|dark)/.test(s);
  const DAY = {bg:"#f8f4ec", res:"#f4f0e8", build:"#ebe7e0", buildL:"#e2ded6", water:"#8fcbf2", park:"#c2e7b0", wood:"#b8dfa4", minor:"#ffffff", major:"#fdd876",
    second:"#fff3c4", path:"#e6e1d8", casing:"#e2ddd3", text:"#4a4f57", waterText:"#3c7fb8", halo:"#ffffff", rail:"#d2cec6", border:"#c9c3b8"};
  const NIGHT = {bg:"#1f2329", res:"#23272e", build:"#2c3139", buildL:"#353b44", water:"#1d3b57", park:"#203a2c", wood:"#1e3628", minor:"#3a4049", major:"#8c6d2e",
    second:"#5a606a", path:"#353b44", casing:"#1f2329", text:"#c9ced6", waterText:"#6fa3cf", halo:"#1f2329", rail:"#3a4049", border:"#4a4f57"};
  function paint(m, night){
    const C = night ? NIGHT : DAY, st = m.getStyle(); if (!st || !st.layers) return false;
    const set = (id, p, v) => { try { m.setPaintProperty(id, p, v); } catch(e) {} };
    const hide = id => { try { m.setLayoutProperty(id, "visibility", "none"); } catch(e) {} };
    st.layers.forEach(l => { const id = l.id, t = l.type;
      if (t === "background") return set(id, "background-color", C.bg);
      if (t === "symbol"){
        if (/poi|shield|oneway|aerodrome|transit|station|bus/.test(id)) return hide(id);
        set(id, "text-color", /water/.test(id) ? C.waterText : C.text); set(id, "text-halo-color", C.halo); set(id, "text-halo-width", 1.4); return; }
      if (t === "fill" && l.paint && l.paint["fill-pattern"]) return hide(id);
      if (t === "fill" || t === "fill-extrusion"){
        if (/water/.test(id)) return set(id, "fill-color", C.water);
        if (/wood|forest/.test(id)) return set(id, "fill-color", C.wood);
        if (/park|grass|landcover|cemetery|pitch|golf|garden/.test(id)) { set(id, "fill-color", C.park); set(id, "fill-opacity", 1); return; }
        if (/building/.test(id)) { if (t === "fill") { set(id, "fill-color", C.build); set(id, "fill-outline-color", C.buildL); } else set(id, "fill-extrusion-color", C.build); return; }
        if (/residential|landuse|industrial|commercial|school|hospital|university/.test(id)) set(id, "fill-color", C.res);
        return; }
      if (t === "line"){
        if (/water|river|stream|canal/.test(id)) return set(id, "line-color", C.water);
        if (/rail|transit/.test(id)) return set(id, "line-color", C.rail);
        if (/boundary|admin/.test(id)) return set(id, "line-color", C.border);
        if (/casing/.test(id)) return set(id, "line-color", C.casing);
        if (/motorway|trunk|primary/.test(id)) return set(id, "line-color", C.major);
        if (/secondary/.test(id)) return set(id, "line-color", C.second);
        if (/road|street|minor|service|tertiary|path|track|tunnel|bridge/.test(id)) set(id, "line-color", /path|track/.test(id) ? C.path : C.minor);
      }
    });
    return true;
  }
  const Base = maplibregl.Map;
  class PlansMap extends Base {
    constructor(o){
      const night = nightURL(o && o.style);
      if (o && ours(o.style)) o = Object.assign({}, o, {style:LIB});
      super(o); this._night = night; this._built = true;
      this.on("style.load", () => paint(this, this._night));
    }
    setStyle(s, opt){
      // Pendant la création, MapLibre charge le style lui-même : on le laisse faire.
      if (!this._built || !ours(s)) return super.setStyle(ours(s) ? LIB : s, opt);
      this._night = nightURL(s);   // même carte, on change seulement les couleurs (jour / nuit)
      try { paint(this, this._night); } catch(e) {}
      return this;
    }
  }
  maplibregl.Map = PlansMap;
})();
