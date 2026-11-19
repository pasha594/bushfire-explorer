// Per-fire pages (SEO audit P3) from the snapshot log that tools/snapshot.mjs writes. Used by tools/build.mjs.
//
// Each fire gets /{state}/fire/{name}-{id}/: real HTML with the facts, the agency's warning text unaltered, credits and
// times, so search engines and link previews see the fire without running JavaScript. The app takes over in the browser
// as on every other page. Major fires (see snapshot.mjs) are indexed and listed in the sitemap; others carry
// noindex, follow. A renamed fire keeps a redirect stub at each old path. Times that change on every run sit between
// <!--v--> and <!--/v--> so tools/indexnow.mjs ignores them; only real changes (status, size, warning, name, ended)
// move a page's "last changed" time, its dateModified and its sitemap lastmod.

const STATE_NAME = { NSW: 'New South Wales', QLD: 'Queensland', VIC: 'Victoria', SA: 'South Australia', WA: 'Western Australia', TAS: 'Tasmania', NT: 'Northern Territory', ACT: 'Australian Capital Territory' };
const TZ = { NSW: 'Australia/Sydney', ACT: 'Australia/Sydney', VIC: 'Australia/Melbourne', TAS: 'Australia/Hobart', QLD: 'Australia/Brisbane', SA: 'Australia/Adelaide', NT: 'Australia/Darwin', WA: 'Australia/Perth' };
const ALERT_TXT = { advice: 'Advice', watch_act: 'Watch and Act', emergency: 'Emergency Warning' };
const WARN_PHRASE = { advice: 'an Advice warning', watch_act: 'a Watch and Act warning', emergency: 'an Emergency Warning' };
const KIND_TXT = { bushfire: 'bush fire', grassfire: 'grass fire', other_veg: 'vegetation fire' };
const STALE_MS = 60 * 60e3; // audit A2: a feed older than an hour is shown as unavailable

// Same rules as prettyName() in src/app.js: agencies publish ALL-CAPS names ("TERREEL RD, WARDS RIVER").
const KEEP_CAPS = /^(NP|SF|NR|CP|SCA|RFS|QPWS|DBCA|ACT|NSW|QLD|WA|SA|NT|VIC|TAS|RX|HR|II|III|IV|STH|NTH|LGA|DFES)$/;
export function prettyName(n) {
  if (!n) return n;
  const letters = n.replace(/[^A-Za-z]/g, '');
  if (!letters || letters !== letters.toUpperCase()) return n;
  return n.toLowerCase().replace(/\b([a-z][a-z']*)/g, (w) => KEEP_CAPS.test(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)).replace(/\bMc([a-z])/g, (m, c) => 'Mc' + c.toUpperCase());
}
const slug = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
function nameSlug(s) {
  let out = slug(s);
  if (out.length > 60) out = out.slice(0, 60).replace(/-[^-]*$/, '');
  return out;
}
// /nsw/fire/beecroft-weapons-range-beecroft-peninsula-685889/ and /qld/fire/cape-melville-qf7-26-148662/. The id
// comes last so the app (and 404.html) can read it back from any path, whatever the name part says.
export function firePath(e) {
  const name = nameSlug(prettyName(e.slugName || e.name)), id = slug(e.sourceId);
  return `/${e.state.toLowerCase()}/fire/${name ? name + '-' : ''}${id}/`;
}

const fmtHa = (ha) => ha == null ? null : ha >= 100 ? Math.round(ha).toLocaleString('en-AU') : ha >= 10 ? ha.toFixed(0) : ha >= 1 ? ha.toFixed(1) : ha > 0 ? ha.toFixed(2) : '0';
function when(iso, st) {
  if (!iso) return null;
  const d = new Date(iso); if (isNaN(d)) return null;
  const tz = TZ[st] || TZ.NSW;
  const t = d.toLocaleTimeString('en-AU', { timeZone: tz, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).replace(/\s?([ap])m/i, (m, a) => ' ' + a.toLowerCase() + 'm');
  return `${t} on ${d.toLocaleDateString('en-AU', { timeZone: tz, day: 'numeric', month: 'long', year: 'numeric' })}`;
}
const agencyStatus = (e) => { const t = String(e.statusLabel || '').trim(); if (!t) return null; return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t; };
const kmTxt = (km) => km < 1 ? 'under 1 km' : (km < 10 ? km.toFixed(1) : Math.round(km)) + ' km';
const hasFireWord = (s) => /\bfire\b|bushfire|grassfire/i.test(s);

export function buildFirePages(log, h) {
  const { esc, page, head, ORIGIN, WEBSITE, webPage, MAP_PLACEHOLDER, NOSCRIPT, EMERGENCY } = h;
  const now = Date.parse(log.builtAt) || Date.now();
  const entries = Object.values(log.fires || {}).filter(e => e && e.sourceId && STATE_NAME[e.state]);
  const feedOf = (st) => (log.feeds && log.feeds[st]) || {};
  const stale = (st) => { const f = feedOf(st); return !f.okAt || now - Date.parse(f.okAt) > STALE_MS; };
  const rank = (e) => (e.major ? 1e7 : 0) + ({ emergency: 3, watch_act: 2, advice: 1 }[e.alert] || 0) * 1e6 + Math.min(999999, Math.round(e.sizeHa || 0));
  const display = (e) => prettyName(e.name);

  const out = { pages: [], sitemap: [], index: {}, stateList: {}, homeList: '' };
  for (const e of entries) {
    e.path = firePath(e);
    e.paths = [...new Set([...(e.paths || []), e.path])].slice(-6);
  }

  for (const e of entries) {
    const st = e.state, f = feedOf(st), name = display(e), stName = STATE_NAME[st], isStale = !e.ended && stale(st);
    const agency = f.label || 'the state fire agency', agencyLink = f.home ? `<a href="${esc(f.home)}" rel="noopener">${esc(agency)}</a>` : esc(agency);
    const town = e.town && e.town.name ? e.town : null;
    const near = town ? ` near ${town.name}` : '';
    const title = `${name}${hasFireWord(name) ? '' : ' fire'}${near}, ${st}: map, size and status`;
    const description = `Map, size, warning level and official updates for the ${name}${hasFireWord(name) ? '' : ' fire'}${near}, ${st}. Unofficial.`;
    const kind = KIND_TXT[e.kind] || 'fire', status = agencyStatus(e), size = e.sizeHa > 0 ? fmtHa(e.sizeHa) + ' ha' : null;
    const where = town ? (town.km < 1 ? ` It is at ${esc(town.name)}.` : ` It is about ${kmTxt(town.km)} ${town.dir} of ${esc(town.name)}.`) : '';

    let answer;
    if (e.ended) answer = `No longer listed as active by ${agencyLink} since ${esc(when(e.ended, st))}.${where}`;
    else if (isStale) answer = `<strong>Data unavailable.</strong> Bushfire Explorer last received ${esc(agency)}'s feed at ${esc(when(f.okAt, st) || 'an unknown time')}. Check ${agencyLink} for current information.`;
    else answer = `As at <!--v-->${esc(when(f.okAt, st))}<!--/v-->, ${esc(agency)} lists this ${kind} ${status ? `as “${esc(status)}”` : 'with no status'}${size ? ` at ${esc(size)}` : ''}${e.alert ? `, with ${WARN_PHRASE[e.alert]} in place` : ''}.${where}`;

    const row = (k, v) => v ? `<dt>${esc(k)}</dt><dd>${v}</dd>` : '';
    const E = (v) => (v == null || v === '' ? null : esc(v)); // empty facts get no row
    const facts = e.ended
      ? row('Last status', esc(status || 'Not given')) + row('Largest size reported', e.maxSizeHa > 0 ? esc(fmtHa(e.maxSizeHa) + ' ha') : 'Not reported')
        + row('Highest warning level', esc(ALERT_TXT[e.maxAlert] || 'No warning issued')) + row('First listed', E(when(e.firstSeen, st))) + row('Last listed', E(when(e.lastSeen, st)))
      : row(isStale ? 'Status when last received' : 'Status (agency’s words)', esc(status || 'Not given')) + row('Size', esc(size || (e.sizeHa === 0 ? 'Not yet sized' : 'Not reported')))
        + row('Warning level', esc(e.alert ? (e.alertLabel || ALERT_TXT[e.alert]) : 'No warning in place')) + row('First listed', E(when(e.firstSeen, st)))
        + row('Reported', E(when(e.started, st))) + row('Agency update', E(when(e.updated, st)));
    const details = row('Type', esc(e.typeLabel || kind)) + row('Council area', E(e.lga)) + row('Location', E(prettyName(e.location)))
      + row('Nearest town', town ? esc(`${kmTxt(town.km)} ${town.dir} of ${town.name}`) : null) + row('Responsible agency', E(e.agency))
      + row('Incident number', esc(e.sourceId)) + row('Coordinates', `${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}`);
    // The agency's warning text, unaltered, in its own credited block (AIDR guidance for warning republishers).
    const warning = !e.ended && !isStale && (e.headline || e.body) ? `<h2>Current warning</h2><div class="shell-warn">${e.headline ? `<p><strong>${esc(e.headline)}</strong></p>` : ''}${e.body ? esc(e.body).split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('') : ''}<p class="shell-note">As published by ${esc(agency)}${e.warnedAt || e.updated ? ' · ' + esc(when(e.warnedAt || e.updated, st)) : ''}. Check ${agencyLink} for the current warning.</p></div>` : '';
    const others = entries.filter(o => o !== e && o.state === st && !o.ended).sort((a, b) => rank(b) - rank(a)).slice(0, 12);
    const crumbs = { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Australia', item: ORIGIN + '/' },
      { '@type': 'ListItem', position: 2, name: `${stName} fire map`, item: `${ORIGIN}/${st.toLowerCase()}/` },
      { '@type': 'ListItem', position: 3, name, item: ORIGIN + e.path },
    ] };
    const meta = { path: e.path, title, description };
    const ld = { '@context': 'https://schema.org', '@graph': [WEBSITE, Object.assign(webPage(meta), {
      datePublished: e.firstSeen, dateModified: e.changedAt || e.firstSeen, breadcrumb: crumbs,
      about: { '@type': 'Place', name: `${name}, ${stName}`, geo: { '@type': 'GeoCoordinates', latitude: e.lat, longitude: e.lon } },
    })] };
    const main = `<div class="shell" data-shell="fire" data-fire-uid="${esc(e.uid)}">
<a class="back" href="/${st.toLowerCase()}/">← ${esc(stName)} fires</a>
<header class="statehead"><h1>${esc(name)}</h1><hr><p class="lede">${answer}</p></header>
<p class="shell-note"><strong>Unofficial.</strong> In an emergency call <strong>000</strong>, and follow ${agencyLink}.</p>
${e.ended ? '' : MAP_PLACEHOLDER}
${NOSCRIPT}
<section class="section shell-text">
<h2>${e.ended ? 'Fire summary' : 'Fire details'}</h2>
<dl class="shell-facts">${facts}${details}</dl>
${warning}
<p>Official information: ${agencyLink}${e.url ? ` · <a href="${esc(e.url)}" rel="noopener">Major fire update</a>` : ''}.</p>
${others.length ? `<h2>Other fires in ${esc(stName)}</h2><ul class="shell-links">${others.map(o => `<li><a href="${o.path}">${esc(display(o))}</a></li>`).join('')}</ul>` : ''}
<p><a href="/${st.toLowerCase()}/">${esc(stName)} fire map</a> · <a href="/">Australia bushfire map</a> · <a href="/fires-near-me/">Fires near me</a></p>
<p class="shell-note">Last changed ${esc(when(e.changedAt || e.firstSeen, st))}. Last received from ${esc(agency)}: <!--v-->${esc(when(f.okAt, st) || 'not yet')}<!--/v-->. ${esc(f.attribution || '')}${f.dataset ? ` (<a href="${esc(f.dataset)}" rel="noopener">dataset</a>)` : ''}. Bushfire Explorer is not affiliated with ${esc(agency)}.</p>
${EMERGENCY}
</section>
</div>`;
    out.pages.push({ path: e.path, html: page(head(meta, ld, e.major ? null : 'noindex, follow'), main) });
    for (const old of e.paths.filter(p => p !== e.path)) out.pages.push({ path: old, html: stub(e.path, title, esc, ORIGIN) });
    out.index[e.uid] = [e.path, e.major ? 1 : 0];
    if (e.major) out.sitemap.push({ path: e.path, lastmod: e.changedAt || e.firstSeen });
  }

  // State pages name their current fires, and the home page its major ones (crawlable links to every fire page).
  for (const st of new Set(entries.map(e => e.state).concat(Object.keys(log.feeds || {})))) {
    const f = feedOf(st), agency = f.label || st, list = entries.filter(e => e.state === st && !e.ended).sort((a, b) => rank(b) - rank(a));
    const intro = stale(st)
      ? `<strong>Data unavailable.</strong> Bushfire Explorer last received ${esc(agency)}'s feed at ${esc(when(f.okAt, st) || 'an unknown time')}. Check <a href="${esc(f.home || '#')}" rel="noopener">${esc(agency)}</a> for current information.`
      : `As at <!--v-->${esc(when(f.okAt, st))}<!--/v-->, ${esc(agency)} lists ${list.length ? `${list.length} ${list.length === 1 ? 'fire' : 'fires'}` : 'no fires'} in ${esc(STATE_NAME[st])}${list.filter(e => e.alert).length ? `, ${list.filter(e => e.alert).length} with a warning` : ''} (planned burns are not included).`;
    out.stateList[st] = `<h2>Fires listed by ${esc(agency)}</h2><p>${intro}</p>${list.length && !stale(st) ? `<ul class="shell-links shell-fires">${list.map(e => `<li><a href="${e.path}">${esc(display(e))}</a> <span>${esc([agencyStatus(e), e.sizeHa > 0 ? fmtHa(e.sizeHa) + ' ha' : null, e.alert ? (e.alertLabel || ALERT_TXT[e.alert]) : null].filter(Boolean).join(' · '))}</span></li>`).join('')}</ul>` : ''}`;
  }
  const major = entries.filter(e => e.major && !e.ended && !stale(e.state)).sort((a, b) => rank(b) - rank(a));
  if (major.length) out.homeList = `<h2>Major fires</h2><ul class="shell-links shell-fires">${major.map(e => `<li><a href="${e.path}">${esc(display(e))}</a> <span>${esc(STATE_NAME[e.state])}</span></li>`).join('')}</ul>`;
  return out;
}

// A renamed fire's old address: points to the new one (a canonical stub, since GitHub Pages can't send a 301).
function stub(to, title, esc, ORIGIN) {
  return `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><title>${esc(title)}</title>
<link rel="canonical" href="${ORIGIN}${to}"><meta name="robots" content="noindex, follow">
<meta http-equiv="refresh" content="0; url=${to}"><script>location.replace(${JSON.stringify(to)} + location.hash);</script></head>
<body><p>This fire's page has moved: <a href="${to}">${esc(title)}</a>.</p></body></html>
`;
}
