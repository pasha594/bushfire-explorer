#!/usr/bin/env node
// Fire snapshot for the per-fire pages (SEO audit items A2 and P3). The scheduled GitHub Actions build runs it every
// 15 minutes, before tools/build.mjs:
//   node tools/snapshot.mjs                  # writes snapshot/fires.json, which build.mjs turns into pages
//   node tools/snapshot.mjs --log FILE|URL   # read the previous log from somewhere else (local testing)
//   node tools/snapshot.mjs --fresh          # start with an empty log
//
// 1. The previous run's log is read back from the live site (/data/fires.json). The deployed site is the only store,
//    so nothing is committed. A 404 (the first run) starts an empty log; any other failure stops the build, so a bad
//    fetch can never publish a site that has forgotten its ended fires.
// 2. Only feeds the audit rates "Full" (republishable with credit) are fetched: NSW RFS, through the browser app's own
//    adapter so fire ids match the app, and Queensland Fire Department's open-data incident feed (CC BY 4.0), not the
//    ArcGIS layers the app reads in the browser. Other states keep their fires in the browser app only.
// 3. Each fire's record keeps its latest facts, when it was first and last listed, its highest warning and largest
//    size, its nearest town (ABS), and its lifecycle (audit section 7):
//    - major (indexed for good): Watch and Act or Emergency Warning at any time, or 1,000 ha or more within 50 km of a
//      town of 200 or more people (audit decision 12, option a);
//    - ended: missing from two successful fetches in a row and for at least 30 minutes;
//    - removed: ended, never major, and last listed more than 30 days ago (its page then returns 404).
//    A feed that fails leaves its fires untouched; build.mjs marks the data as unavailable after 60 minutes.
// Fires without a stable agency id, and planned burns, get no page.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { DOMParser } from '@xmldom/xmldom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://bushfiremap.com';
const OUT = join(ROOT, 'snapshot', 'fires.json');
const QLD_FEED = 'https://publiccontent-gis-psba-qld-gov-au.s3.amazonaws.com/content/Feeds/BushfireCurrentIncidents/bushfireAlert.json';
const QLD_HOME = 'https://www.fire.qld.gov.au/Current-Incidents';
const QLD_DATASET = 'https://www.data.qld.gov.au/dataset/queensland-fire-and-rescue-current-bushfire-incidents';
const ABS_UCL = 'https://geo.abs.gov.au/arcgis/rest/services/Hosted/ASGS_2021_UCL_Pop/FeatureServer/0';
const MIN = 60e3, DAY = 864e5;
const ENDED_AFTER_MS = 30 * MIN, REMOVE_MINOR_AFTER_MS = 30 * DAY;
const MAJOR_HA = 1000, TOWN_KM = 50, TOWN_POP = 200;
const RANK = { advice: 1, watch_act: 2, emergency: 3 };
const LABEL = { advice: 'Advice', watch_act: 'Watch and Act', emergency: 'Emergency Warning' };

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

// ---- the browser app's adapters and helpers, run unchanged in Node (everything before the app core) ----
function loadAUF() {
  const src = readFileSync(join(ROOT, 'src', 'app.js'), 'utf8');
  const cut = src.indexOf('// ===== app.js =====');
  if (cut < 0) throw new Error('src/app.js: app core marker not found');
  const ctx = { fetch, AbortController, setTimeout, clearTimeout, URL, URLSearchParams, Intl, console, TextDecoder, DOMParser, performance };
  ctx.globalThis = ctx; ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(src.slice(0, cut), ctx, { filename: 'src/app.js' });
  return ctx.AUF;
}

async function previousLog() {
  if (args.includes('--fresh')) return null;
  const src = opt('--log') || `${ORIGIN}/data/fires.json?t=${Date.now()}`; // the query string skips the CDN cache
  if (!/^https?:/.test(src)) return JSON.parse(readFileSync(src, 'utf8'));
  const r = await fetch(src, { headers: { 'Cache-Control': 'no-cache' } });
  if (r.status === 404) { console.error('snapshot: no previous log on the live site; starting empty'); return null; }
  if (!r.ok) throw new Error(`previous log: HTTP ${r.status} for ${src}`);
  const log = await r.json();
  if (!log || log.v !== 1 || typeof log.fires !== 'object') throw new Error('previous log: unexpected format');
  return log;
}

// ---- Queensland: QFD's open-data feed carries the same ESCAD fields as the ArcGIS layer the app reads ----
async function loadQld(U, P) {
  const j = await U.fetchJSON(QLD_FEED, { timeout: 30000 });
  if (!j || !Array.isArray(j.features)) throw new Error('QLD feed: no features');
  const warns = [], fires = [];
  for (const ft of j.features) {
    const p = (ft && ft.properties) || {}, id = U.clean(p.UniqueID) || '';
    if (/^WARN-/i.test(id)) {
      const lvl = P.mapAlert(p.WarningLevel, p.CallToAction);
      if (lvl && ft.geometry) warns.push({ lvl, title: U.clean(p.WarningTitle), body: U.clean(p.WarningText), time: U.toISO(p.PublishDateLocal_ISO || p.ItemDateTimeLocal_ISO), geom: ft.geometry });
      continue;
    }
    if (!/^QF\d+-\d+-\d+$/i.test(id)) continue; // incident numbers only: anything else has no stable id
    // Kind and type label as the app derives them: from GroupedType, refined to bush or grass fire by Incident_Type.
    let kind = P.mapKind(p.GroupedType), type = P.typeLabel(p.GroupedType);
    const fine = U.clean(p.Incident_Type) && P.mapKind(p.Incident_Type);
    if ((fine === 'bushfire' || fine === 'grassfire') && kind === 'other_veg') { kind = fine; type = fine === 'bushfire' ? 'Bushfire' : 'Grass fire'; }
    const lat = +p.Latitude, lon = +p.Longitude;
    if (!kind || !(lat < -9 && lat > -30 && lon > 137 && lon < 154)) continue;
    const locality = P.pretty(p.Locality), road = P.pretty(p.Location);
    const lga = U.clean(p.LGA);
    fires.push({
      uid: 'qld:' + id.toUpperCase(), state: 'QLD', sourceId: id.toUpperCase(), source: 'QFD',
      name: type + ' – ' + (locality || road || 'Queensland'), slugName: locality || road || type, kind, typeLabel: type,
      status: P.mapStatus(p.CurrentStatus), statusLabel: U.clean(p.CurrentStatus), alert: null, alertLabel: null, sizeHa: null,
      lat: Math.round(lat * 1e5) / 1e5, lon: Math.round(lon * 1e5) / 1e5, lga: lga && !/^none$/i.test(lga) ? U.titleCase(lga) : null,
      location: [road, locality].filter(Boolean).join(', ') || null, agency: 'Queensland Fire Department',
      started: U.toISO(p.ItemDateTimeLocal_ISO), updated: null, url: null, headline: null, body: null,
    });
  }
  // A warning area that contains the incident gives it its level and the warning text, unaltered.
  for (const f of fires) {
    for (const w of warns) {
      if ((RANK[w.lvl] || 0) <= (RANK[f.alert] || 0) || !U.pointInGeom([f.lon, f.lat], w.geom)) continue;
      Object.assign(f, { alert: w.lvl, alertLabel: LABEL[w.lvl], headline: w.title, body: w.body, warnedAt: w.time });
    }
  }
  return fires;
}

// ---- nearest ABS urban centre or locality (200+ people) within 50 km, for titles and the major-fire test ----
const COMPASS = ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east',
  'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'];
function bearing(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180, y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return COMPASS[Math.round(((Math.atan2(y, x) / r + 360) % 360) / 22.5) % 16];
}
async function nearestTown(U, lat, lon) {
  const j = await U.fetchJSON(U.arcgisQueryURL(ABS_UCL, {
    geometry: `${lon},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    distance: String(TOWN_KM * 1000), units: 'esriSRUnit_Meter', where: `persons_ur_2021 >= ${TOWN_POP} AND ucl_name_2021 NOT LIKE 'Remainder%'`,
    outFields: 'ucl_name_2021,persons_ur_2021', returnGeometry: 'false', returnCentroid: 'true', f: 'json',
  }), { timeout: 20000 });
  if (!j || j.error || !Array.isArray(j.features)) throw new Error('ABS towns: ' + ((j && j.error && j.error.message) || 'bad response'));
  let best = null;
  for (const x of j.features) {
    if (!x.centroid || !x.attributes) continue;
    const km = U.haversineKm(lat, lon, x.centroid.y, x.centroid.x);
    if (km <= TOWN_KM && (!best || km < best.km)) best = { name: String(x.attributes.ucl_name_2021).replace(/\s*\([^)]*\)\s*$/, ''), pop: x.attributes.persons_ur_2021, km: Math.round(km * 10) / 10, dir: bearing(x.centroid.y, x.centroid.x, lat, lon) };
  }
  return best;
}

// ---- merge this run into the log ----
const FACTS = ['name', 'kind', 'typeLabel', 'status', 'statusLabel', 'alert', 'alertLabel', 'sizeHa', 'lat', 'lon', 'lga', 'location', 'agency', 'started', 'updated', 'url', 'headline', 'body', 'extra', 'slugName', 'sourceId'];
const fingerprint = (e) => JSON.stringify([e.name, e.status, e.statusLabel, e.alert, e.sizeHa == null ? null : Math.round(e.sizeHa), e.headline, e.body, e.ended]);

async function main() {
  const now = new Date(), nowIso = now.toISOString(), t = now.getTime();
  const prev = await previousLog();
  const log = { v: 1, builtAt: nowIso, feeds: (prev && prev.feeds) || {}, fires: (prev && prev.fires) || {} };
  const AUF = loadAUF(), U = AUF.util;
  const nsw = AUF.adapters.find(a => a.id === 'nsw'), qld = AUF.adapters.find(a => a.id === 'qld');
  const FEEDS = {
    NSW: { label: nsw.label, home: nsw.homepage, attribution: nsw.attribution, load: async () => (await nsw.load()).fires },
    QLD: { label: qld.label, home: QLD_HOME, dataset: QLD_DATASET, attribution: '© State of Queensland (Queensland Fire Department), CC BY 4.0. Source: Queensland Fire Department current bushfire incidents (data.qld.gov.au)', load: () => loadQld(U, qld.parse) },
  };

  for (const [st, feed] of Object.entries(FEEDS)) {
    const fs = log.feeds[st] = Object.assign({}, log.feeds[st], { label: feed.label, home: feed.home, dataset: feed.dataset || null, attribution: feed.attribution, checkedAt: nowIso });
    let fires;
    try { fires = await feed.load(); }
    catch (e) { fs.error = String(e && e.message || e).slice(0, 300); console.error(`snapshot: ${st} feed failed: ${fs.error}`); continue; }
    fs.okAt = nowIso; fs.error = null;
    const listed = new Set();
    let kept = 0;
    for (const f of fires) {
      if (!f.sourceId || f.kind === 'planned') continue; // no stable id, or a planned burn: no page
      listed.add(f.uid); kept++;
      const e = log.fires[f.uid] || (log.fires[f.uid] = { uid: f.uid, state: st, firstSeen: nowIso, maxAlert: null, maxSizeHa: null, major: null, town: null });
      const before = fingerprint(e);
      for (const k of FACTS) e[k] = f[k] == null ? null : f[k];
      e.lastSeen = nowIso; e.missed = 0; e.ended = null;
      if ((RANK[f.alert] || 0) > (RANK[e.maxAlert] || 0)) e.maxAlert = f.alert;
      if (f.sizeHa != null && (e.maxSizeHa == null || f.sizeHa > e.maxSizeHa)) e.maxSizeHa = f.sizeHa;
      if (fingerprint(e) !== before || !e.changedAt) e.changedAt = nowIso;
    }
    fs.count = kept;
    // Fires this feed no longer lists.
    for (const e of Object.values(log.fires)) {
      if (e.state !== st || listed.has(e.uid) || e.ended) continue;
      e.missed = (e.missed || 0) + 1;
      if (e.missed >= 2 && t - Date.parse(e.lastSeen) >= ENDED_AFTER_MS) { e.ended = e.lastSeen; e.changedAt = nowIso; }
    }
  }

  // Nearest towns for fires that don't have one yet (or have moved more than about 5 km): at most 60 per run, 4 at a time.
  const todo = Object.values(log.fires).filter(e => !e.ended && (!e.townAt || Math.abs(e.townAt[0] - e.lat) > 0.05 || Math.abs(e.townAt[1] - e.lon) > 0.05)).slice(0, 60);
  const lookups = todo.length;
  await Promise.all([0, 1, 2, 3].map(async (w) => {
    for (let i = w; i < todo.length; i += 4) {
      const e = todo[i];
      try { e.town = await nearestTown(U, e.lat, e.lon); e.townAt = [e.lat, e.lon]; }
      catch (err) { console.error(`snapshot: town lookup for ${e.uid} failed: ${err.message}`); }
    }
  }));

  // Lifecycle: major for good once over the threshold; minor ended fires drop out after 30 days.
  for (const [uid, e] of Object.entries(log.fires)) {
    if (!e.major && ((RANK[e.maxAlert] || 0) >= RANK.watch_act || (e.maxSizeHa >= MAJOR_HA && e.town && e.town.km <= TOWN_KM))) { e.major = nowIso; e.changedAt = nowIso; }
    if (e.ended && !e.major && t - Date.parse(e.lastSeen) > REMOVE_MINOR_AFTER_MS) delete log.fires[uid];
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(log));
  const all = Object.values(log.fires), active = all.filter(e => !e.ended);
  console.log(`snapshot: ${active.length} active and ${all.length - active.length} ended fires (${all.filter(e => e.major).length} major); `
    + Object.entries(log.feeds).map(([st, f]) => `${st} ${f.error ? 'failed' : (f.count ?? 0) + ' listed'}`).join(', ') + `; ${lookups} town lookups`);
}

main().catch((e) => { console.error('snapshot failed:', e); process.exit(1); });
