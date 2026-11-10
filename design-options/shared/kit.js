// Shared helpers for the design options. Each option page loads geo.js, data.js (and optionally danger.js), then this file.
// Everything here is presentation-neutral: data shaping, formatting and a bare Leaflet map that each page styles itself.
(function () {
  const S = window.SNAP, G = window.GEO;
  const AT = new Date(S.at).getTime();

  const STATES = ['NSW', 'VIC', 'QLD', 'SA', 'WA', 'TAS', 'NT', 'ACT'];
  const STATE_NAME = { NSW: 'New South Wales', VIC: 'Victoria', QLD: 'Queensland', SA: 'South Australia', WA: 'Western Australia',
    TAS: 'Tasmania', NT: 'Northern Territory', ACT: 'Australian Capital Territory' };
  const STATE_SHORT = { NSW: 'NSW', VIC: 'Vic.', QLD: 'Qld', SA: 'SA', WA: 'WA', TAS: 'Tas.', NT: 'NT', ACT: 'ACT' };
  const LABEL_AT = { WA: [-25.6, 121.6], NT: [-19.6, 133.4], SA: [-30.1, 135.4], QLD: [-22.6, 144.6], NSW: [-32.3, 146.6],
    VIC: [-36.95, 144.1], TAS: [-42.1, 146.6], ACT: [-35.5, 149.0] };
  const ALERT_RANK = { emergency: 3, watch_act: 2, advice: 1 };
  const ALERT_LABEL = { emergency: 'Emergency Warning', watch_act: 'Watch and Act', advice: 'Advice' };
  const STATUS_LABEL = { out_of_control: 'Out of control', being_controlled: 'Being controlled', under_control: 'Under control', unknown: 'Status unknown' };
  const KIND_LABEL = { bushfire: 'Bushfire', grassfire: 'Grass fire', planned: 'Planned burn', other_veg: 'Vegetation fire' };
  // Australian Fire Danger Rating System colours, as published by AFAC.
  const RATING_COLOR = { 'No Rating': '#ffffff', Moderate: '#64bf30', High: '#ffe000', Extreme: '#ff6d00', Catastrophic: '#ad0909' };
  const RATING_ORDER = ['No Rating', 'Moderate', 'High', 'Extreme', 'Catastrophic'];

  const caps = (v) => { v = String(v || ''); return v && v === v.toUpperCase() ? v.toLowerCase().replace(/(^|[\s(\-–\/])([a-z])/g, (m, a, b) => a + b.toUpperCase()) : v; };
  const fires = S.fires.map((f) => Object.assign({}, f, {
    name: caps(f.name),
    alertRank: ALERT_RANK[f.alert] || 0,
    stateName: STATE_NAME[f.state],
    kindLabel: KIND_LABEL[f.kind] || 'Fire',
    statusText: STATUS_LABEL[f.status] || 'Status unknown',
    agencyStatus: f.statusLabel || STATUS_LABEL[f.status] || '',
    place: caps(f.location || f.lga || ''),
  }));
  const isVeg = (f) => f.kind !== 'planned';
  const active = fires.filter((f) => isVeg(f) && f.status !== 'under_control');
  const controlled = fires.filter((f) => isVeg(f) && f.status === 'under_control');
  const planned = fires.filter((f) => f.kind === 'planned');

  const bySize = (a, b) => (b.sizeHa || -1) - (a.sizeHa || -1) || b.alertRank - a.alertRank || (b.updated || '').localeCompare(a.updated || '');
  const ranked = active.slice().sort(bySize);
  ranked.forEach((f, i) => { f.rank = i + 1; });

  // Warnings: alerts attached to incidents plus stand-alone agency warnings, highest level first, newest first.
  const warnings = fires.filter((f) => f.alert).map((f) => ({ uid: f.uid, state: f.state, alert: f.alert, title: f.name, place: f.place,
    headline: f.headline || '', updated: f.updated, fire: f }))
    .concat(S.warnings.map((w) => ({ uid: w.uid, state: w.state, alert: w.alert, title: caps(w.title), place: 'Warning not tied to a listed fire', headline: '', updated: w.updated, fire: null })))
    .sort((a, b) => (ALERT_RANK[b.alert] || 0) - (ALERT_RANK[a.alert] || 0) || (b.updated || '').localeCompare(a.updated || ''));

  const counts = {
    active: active.length, controlled: controlled.length, planned: planned.length,
    emergency: warnings.filter((w) => w.alert === 'emergency').length,
    watch: warnings.filter((w) => w.alert === 'watch_act').length,
    advice: warnings.filter((w) => w.alert === 'advice').length,
    hotspots: S.hotTotal, hotspotsLive: S.hotLive, warnings: warnings.length,
  };

  // Fire danger: highest rating per state today (from danger.js when loaded).
  const danger = {};
  if (window.DANGER) {
    STATES.forEach((s) => { danger[s] = { max: 'No Rating', districts: [] }; });
    window.DANGER.features.forEach((f) => {
      const p = f.properties, d = danger[p.state]; if (!d) return;
      d.districts.push(p);
      if (RATING_ORDER.indexOf(p.rating) > RATING_ORDER.indexOf(d.max)) d.max = p.rating;
    });
  }

  const byState = STATES.map((s) => {
    const a = ranked.filter((f) => f.state === s);
    return { code: s, name: STATE_NAME[s], active: a.length, warnings: warnings.filter((w) => w.state === s).length,
      planned: planned.filter((f) => f.state === s).length, controlled: controlled.filter((f) => f.state === s).length,
      hotspots: S.hotByState[s] || 0, largest: a.find((f) => f.sizeHa) || null, top: a[0] || null, fires: a,
      danger: danger[s] ? danger[s].max : null, noFeed: s === 'NT' };
  });

  // ---------- formatting ----------
  const nf = new Intl.NumberFormat('en-AU');
  function ha(n) {
    if (n == null) return '—';
    if (n < 1) return n.toFixed(2);
    if (n < 10) return n.toFixed(1);
    return nf.format(Math.round(n));
  }
  function num(n) { return nf.format(n); }
  function ago(iso) {
    if (!iso) return '';
    const m = Math.max(0, Math.round((AT - new Date(iso).getTime()) / 60000));
    if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60);
    if (h < 48) return h + ' h ago';
    return Math.round(h / 24) + ' days ago';
  }
  function agoShort(iso) { return ago(iso).replace(' min ago', 'm').replace(' h ago', 'h').replace(' days ago', 'd'); }
  const tz = 'Australia/Sydney';
  const TZ_OF = { NSW: 'Australia/Sydney', ACT: 'Australia/Sydney', VIC: 'Australia/Melbourne', TAS: 'Australia/Hobart', QLD: 'Australia/Brisbane', SA: 'Australia/Adelaide', NT: 'Australia/Darwin', WA: 'Australia/Perth' };
  const snapDate = new Intl.DateTimeFormat('en-AU', { timeZone: tz, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(AT);
  const snapTime = new Intl.DateTimeFormat('en-AU', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true }).format(AT).replace(' ', ' ');
  const snapISODate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(AT);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  // Trim the agency prefix off names like "Bushfire – Waterbank" for compact layouts.
  function shortName(f) { return String(f.name || '').replace(/^(Bushfire|Grass Fire|Grassfire|Hazard Reduction Burn|Permitted Burn|Prescribed Burn|Planned Burn)\s*[–-]\s*/i, ''); }
  function title(s) { return String(s || '').toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()); }
  function sentence(s) { s = String(s || ''); return s === s.toUpperCase() ? title(s) : s; }

  // ---------- geometry ----------
  function rings(geom) { return geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates; }
  function inRing(x, y, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function inGeom(lon, lat, geom) { return rings(geom).some((poly) => inRing(lon, lat, poly[0]) && !poly.slice(1).some((h) => inRing(lon, lat, h))); }
  function stateAt(lon, lat) { const f = G.states.features.find((ft) => inGeom(lon, lat, ft.geometry)); return f ? f.properties.code : null; }
  function stateFeature(code) { return G.states.features.find((f) => f.properties.code === code); }
  function bbox(geom) {
    let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
    rings(geom).forEach((poly) => poly[0].forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
    return [x0, y0, x1, y1];
  }

  // Equirectangular projection into a w×h box, corrected for latitude. Returns { path(geom), xy(lon,lat), w, h }.
  function projector(box, w, pad) {
    const [x0, y0, x1, y1] = box, k = Math.cos(((y0 + y1) / 2) * Math.PI / 180);
    const sx = (w - 2 * pad) / ((x1 - x0) * k);
    const h = Math.round((y1 - y0) * sx + 2 * pad);
    const xy = (lon, lat) => [pad + (lon - x0) * k * sx, pad + (y1 - lat) * sx];
    const path = (geom) => rings(geom).map((poly) => poly.map((ring) => 'M' + ring.map(([x, y]) => xy(x, y).map((v) => v.toFixed(1)).join(',')).join('L') + 'Z').join('')).join('');
    return { xy, path, w, h };
  }

  // Rasterise Australia into a cols×rows grid (true where land), for mosaic and dot maps.
  function landGrid(cols, rows, box) {
    const [x0, y0, x1, y1] = box || [112, -44.5, 154.5, -9.5];
    const out = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const lon = x0 + (c + 0.5) * (x1 - x0) / cols, lat = y1 - (r + 0.5) * (y1 - y0) / rows;
        row.push(stateAt(lon, lat));
      }
      out.push(row);
    }
    return out;
  }

  // ---------- Leaflet map with an embedded vector basemap ----------
  // opts: sea, neighbour (style), state (style or fn), hot (fn(h) -> circle style | null), fireIcon (fn(f) -> L.divIcon | null),
  //       fires (array), labels (fn(code) -> html | null), graticule ({ step, style }), danger (fn(props) -> style | null), onFire (fn),
  //       attribution (string), zoomControl (bool), bounds.
  function map(el, opts) {
    opts = opts || {};
    const m = L.map(el, { zoomControl: opts.zoomControl !== false, attributionControl: true, zoomSnap: 0.25, minZoom: 3, maxZoom: 9,
      scrollWheelZoom: false, preferCanvas: false });
    el.style.background = opts.sea || '#dfe7ea';
    const fit = () => m.fitBounds(opts.bounds || [[-43.8, 112.8], [-10.2, 153.8]], { padding: opts.fitPadding || [8, 8], animate: false });
    fit();
    m.attributionControl.setPrefix(false);
    m.attributionControl.addAttribution(opts.attribution || 'Outlines: Natural Earth · Hotspots: Geoscience Australia DEA · Incidents: state fire agencies');
    if (opts.graticule) {
      const g = opts.graticule, lines = [];
      for (let lon = 100; lon <= 180; lon += g.step) lines.push([[-60, lon], [5, lon]]);
      for (let lat = -60; lat <= 5; lat += g.step) lines.push([[lat, 95], [lat, 185]]);
      L.polyline(lines, Object.assign({ interactive: false }, g.style)).addTo(m);
    }
    if (opts.neighbour !== null) L.geoJSON(G.neighbours, { interactive: false, style: opts.neighbour || { color: '#c9cfd2', weight: 0.6, fillColor: '#eef0f0', fillOpacity: 1 } }).addTo(m);
    m.layers = {};
    if (opts.danger && window.DANGER) { m.layers.danger = L.geoJSON(window.DANGER, { interactive: false, style: (f) => opts.danger(f.properties) }); if (opts.dangerOn) m.layers.danger.addTo(m); }
    if (opts.state !== null) L.geoJSON(G.states, { interactive: false, style: typeof opts.state === 'function' ? (f) => opts.state(f.properties.code) : (opts.state || { color: '#9aa3a6', weight: 0.8, fillColor: '#fbfbf9', fillOpacity: 1 }) }).addTo(m);
    if (opts.hot) {
      m.createPane('hot').style.zIndex = 450;
      const r = L.canvas({ padding: 0.3, pane: 'hot' }), g = m.layers.hot = L.layerGroup();
      S.hot.slice().sort((a, b) => b[2] - a[2]).forEach((h) => { const st = opts.hot({ lon: h[0], lat: h[1], ageH: h[2], frp: h[3], state: h[4] }); if (st) L.circleMarker([h[1], h[0]], Object.assign({ renderer: r, interactive: false }, st)).addTo(g); });
      if (opts.hotOn !== false) g.addTo(m);
    }
    if (opts.labels) STATES.forEach((s) => { const html = opts.labels(s); if (html) L.marker(LABEL_AT[s], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'st-label', html, iconSize: null }) }).addTo(m); });
    if (opts.fireIcon) {
      const g = m.layers.fires = L.layerGroup().addTo(m);
      (opts.fires || ranked).slice().reverse().forEach((f) => {
        const icon = opts.fireIcon(f); if (!icon) return;
        const mk = L.marker([f.lat, f.lon], { icon, title: f.name, riseOnHover: true, zIndexOffset: (f.alertRank || 0) * 1000 }).addTo(g);
        if (opts.onFire) mk.on('click', () => opts.onFire(f));
      });
    }
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { m.invalidateSize(); fit(); }, 150); });
    m.refit = fit;
    (window.__maps = window.__maps || []).push(m);
    return m;
  }

  // ---------- fire detail page (loaded with fire.js) ----------
  const FIRE_UID = 'qld:QF1-26-152531';
  const pageBase = () => location.pathname.split('/').pop().replace(/(-fire)?\.html$/, '');
  function fireHref(f) { return f && f.uid === FIRE_UID ? pageBase() + '-fire.html' : '#'; }
  let F = null;
  if (window.FIRE) {
    const X = window.FIRE, zone = TZ_OF[X.fire.state] || 'Australia/Sydney';
    const fmt = (iso, o) => new Intl.DateTimeFormat('en-AU', Object.assign({ timeZone: zone }, o)).format(new Date(iso));
    const blocks = [];
    String(X.fire.body || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).forEach((l) => {
      if (/^- /.test(l)) { const last = blocks[blocks.length - 1]; const item = l.slice(2); if (last && last.type === 'ul') last.items.push(item); else blocks.push({ type: 'ul', items: [item] }); }
      else if (/:$/.test(l) && l.length < 40) blocks.push({ type: 'h', text: l.replace(/:$/, '') });
      else blocks.push({ type: 'p', text: l });
    });
    F = Object.assign({}, X, {
      zone, zoneLabel: zone === 'Australia/Brisbane' ? 'AEST' : 'local time',
      time: (iso) => fmt(iso, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s/g, '').toLowerCase(),
      dateTime: (iso) => fmt(iso, { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', hour12: true }).replace(/\s(am|pm)$/i, (m) => m.trim().toLowerCase()),
      shortDate: (iso) => fmt(iso, { weekday: 'short', day: 'numeric', month: 'short' }),
      day: (d) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d + 'T00:00:00Z')),
      dayName: (d) => new Intl.DateTimeFormat('en-AU', { timeZone: 'UTC', weekday: 'long' }).format(new Date(d + 'T00:00:00Z')),
      blocks,
      fireRec: fires.find((f) => f.uid === X.fire.uid),
    });
  }
  // opts: bases (['light','relief','labels','topo','imagery'] in draw order), warn (style), hot (fn -> style|null), fireIcon (fn -> L.divIcon), zoomControl, scale
  function fireMap(el, opts) {
    opts = opts || {};
    const X = window.FIRE, B = [[X.base.south, X.base.west], [X.base.north, X.base.east]];
    const m = L.map(el, { zoomControl: opts.zoomControl !== false, scrollWheelZoom: false, zoomSnap: 0.25, minZoom: 9.5, maxZoom: 13, maxBounds: B, maxBoundsViscosity: 1 });
    m.attributionControl.setPrefix(false);
    m.attributionControl.addAttribution('Basemap © Esri, HERE, Garmin, USGS · Warning area: QFD · Hotspots: Geoscience Australia DEA');
    const FILE = { light: 'light.jpg', relief: 'relief.jpg', labels: 'labels.png', topo: 'topo.jpg', imagery: 'imagery.jpg' };
    m.layers = {};
    (opts.bases || ['light', 'relief', 'labels']).forEach((b) => { m.layers[b] = L.imageOverlay('shared/fire/' + FILE[b], B, { className: 'base-' + b, interactive: false }).addTo(m); });
    m.layers.warn = L.geoJSON(X.warningGeometry, { interactive: false, style: opts.warn || { color: '#c8401c', weight: 2, fillColor: '#c8401c', fillOpacity: .08, dashArray: '6 4' } }).addTo(m);
    if (opts.hot) {
      m.createPane('hot').style.zIndex = 450;
      const r = L.canvas({ padding: 0.3, pane: 'hot' }), g = m.layers.hot = L.layerGroup().addTo(m);
      X.nearPts.slice().sort((a, b) => b[2] - a[2]).forEach((h) => { const st = opts.hot({ lon: h[0], lat: h[1], ageH: h[2], frp: h[3], sat: h[4] }); if (st) L.circleMarker([h[1], h[0]], Object.assign({ renderer: r, interactive: false }, st)).addTo(g); });
    }
    if (opts.fireIcon) m.layers.fire = L.marker([X.fire.lat, X.fire.lon], { icon: opts.fireIcon(X.fire), title: X.fire.name, zIndexOffset: 1000 }).addTo(m);
    if (opts.scale !== false) L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(m);
    const wb = m.layers.warn.getBounds();
    const fit = () => {
      m.fitBounds(wb, { padding: opts.fitPadding || [16, 16], animate: false });
      const minZ = m.getBoundsZoom(B, true); m.setMinZoom(minZ); if (m.getZoom() < minZ) m.setView(wb.getCenter(), minZ, { animate: false });
    };
    fit();
    let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => { m.invalidateSize(); fit(); }, 150); });
    m.refit = fit;
    return m;
  }

  window.K = { S, G, AT, STATES, STATE_NAME, STATE_SHORT, LABEL_AT, ALERT_RANK, ALERT_LABEL, STATUS_LABEL, KIND_LABEL, RATING_COLOR, RATING_ORDER,
    fires, active, controlled, planned, ranked, warnings, counts, byState, danger,
    ha, num, ago, agoShort, esc, shortName, title, sentence, snapDate, snapTime, snapISODate,
    inGeom, stateAt, stateFeature, bbox, projector, landGrid, map, FIRE_UID, fireHref, fireMap, F };
})();
