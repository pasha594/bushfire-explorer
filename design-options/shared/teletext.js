// Teletext page engine for option 10 (homepage and fire page share it).
(function () {
  const { num } = K;
  const N = 40;
  const scr = document.getElementById('screen');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const up = (s) => String(s).normalize('NFKD').replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '');
  const pad = (s, n, right) => { s = up(s); s = s.length > n ? s.slice(0, n) : s; return right ? s.padStart(n) : s.padEnd(n); };
  // a segment: [text, fg, bg, go]
  const seg = (t, fg = 'w', bg, go) => ({ t: up(t), fg, bg, go });
  function row(segs, dh) {
    let used = 0, html = '';
    segs.forEach((s) => {
      let t = s.t; if (used + t.length > N) t = t.slice(0, N - used); used += t.length; if (!t) return;
      const cls = `s f-${s.fg}${s.bg ? ' b-' + s.bg : ''}`, inner = dh ? `<i>${esc(t)}</i>` : esc(t);
      html += s.go ? `<button type="button" class="${cls}" data-go="${s.go}">${inner}</button>` : `<span class="${cls}">${inner}</span>`;
    });
    if (used < N) html += `<span class="s">${' '.repeat(N - used)}</span>`;
    return `<div class="row${dh ? ' dh' : ''}">${html}</div>`;
  }
  const blank = () => row([]);
  const time = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', weekday: 'short', day: '2-digit', month: 'short' }).format(K.AT).replace(',', '');
  const clock = new Intl.DateTimeFormat('en-AU', { timeZone: 'Australia/Sydney', hour: '2-digit', minute: '2-digit', hour12: false }).format(K.AT);
  const header = (p) => row([seg(`P${p} `, 'w'), seg('BUSHFIRE ', 'y'), seg(`${p} `, 'w'), seg(pad(time, 10), 'c'), seg(' ' + clock + ' AEDT', 'y')]);
  const fastext = () => row([seg(' Top fires', 'k', 'r', 303), seg(' Warnings ', 'k', 'g', 304), seg(' States   ', 'k', 'y', 305), seg(' Map      ', 'k', 'c', 302)]);
  const fastextFire = () => row([seg(' Warning  ', 'k', 'r', 311), seg(' Weather  ', 'k', 'g', 312), seg(' Place    ', 'k', 'y', 313), seg(' All fires ', 'k', 'c', 303)]);
  function wrap(text, width) { const out = []; let line = ''; up(text).split(/\s+/).forEach((word) => { if ((line + ' ' + word).trim().length > width) { out.push(line); line = word; } else line = (line + ' ' + word).trim(); }); if (line) out.push(line); return out; }
  const banner = (t, bg, fg, right, rfg) => row([seg(' ', fg, bg), seg(pad(t, 22), fg, bg), seg(pad(right || '', 17, true), rfg || fg, bg)], true);
  const c = K.counts;

  const STC = { out_of_control: 'r', being_controlled: 'y', under_control: 'g' };
  let sub = 1;
  const pages = {
    302() {
      const r = [header(302), banner('BUSHFIRES', 'b', 'y', 'AUSTRALIA ', 'c'),
        row([seg(` Live from state agencies at ${clock} AEDT`, 'c')])];
      for (let i = 0; i < 14; i++) r.push(blank());
      r.push(row([seg(' ', 'w'), seg(' ', 'r', 'r'), seg(' Fire   ', 'w'), seg(' ', 'y', 'y'), seg(' Hotspot 24h   ', 'w'), seg(' ', 'w', 'w'), seg(' Advice', 'w')]));
      r.push(row([seg(' ACTIVE FIRES ', 'c'), seg(pad(c.active, 4, true), 'y'), seg('    ADVICE      ', 'c'), seg(pad(c.advice, 3, true), 'y')]));
      r.push(row([seg(' WATCH+ACT    ', 'c'), seg(pad(c.watch, 4, true), 'w'), seg('    EMERGENCY   ', 'c'), seg(pad(c.emergency, 3, true), 'w')]));
      r.push(row([seg(' HOTSPOTS 24H ', 'c'), seg(pad(c.hotspots, 6, true), 'y'), seg('  NO TOTAL FIRE BAN', 'g')]));
      r.push(row([seg(' Top fires ', 'w'), seg('303', 'y', null, 303), seg('  Warnings ', 'w'), seg('304', 'y', null, 304), seg('  States ', 'w'), seg('305', 'y', null, 305)]));
      r.push(row([seg(' Not for safety-of-life use. Call 000.', 'm')]));
      r.push(fastext());
      return r;
    },
    303() {
      const PER = 15, list = K.ranked, n = Math.ceil(list.length / PER); sub = Math.min(Math.max(1, sub), n);
      const r = [header(303), banner('TOP FIRES', 'r', 'w', `${sub}/${n} `, 'y'), row([seg(' # FIRE                   ST     HA    ', 'c')])];
      list.slice((sub - 1) * PER, sub * PER).forEach((f) => {
        r.push(row([seg(pad(f.rank, 2, true) + ' ', 'w'), seg(pad(K.shortName(f), 22) + ' ', STC[f.status] || 'w', null, f.uid === K.FIRE_UID ? 310 : null), seg(pad(f.state, 3) + ' ', 'c'), seg(pad(f.sizeHa != null ? K.ha(f.sizeHa) : '-', 6, true) + ' ', 'w'), f.alert ? seg('ADV', 'k', 'y') : seg('   ')]));
      });
      while (r.length < 19) r.push(blank());
      r.push(row([seg(' RED ', 'r'), seg('out of control ', 'w'), seg('YEL ', 'y'), seg('being controlled', 'w')]));
      r.push(row([seg(' GREEN ', 'g'), seg('under control  ', 'w'), seg('ADV', 'k', 'y'), seg(' Advice warning', 'w')]));
      r.push(row([seg(' Sizes in hectares. - = not reported', 'c')]));
      r.push(row([seg(' ', 'w'), seg('< Prev', sub > 1 ? 'y' : 'w', null, sub > 1 ? 'prev' : null), seg(pad(`page ${sub} of ${n}`, 26, false).replace(/^/, '        ').slice(0, 26), 'w'), seg('Next >', sub < n ? 'y' : 'w', null, sub < n ? 'next' : null)]));
      r.push(fastext());
      return r;
    },
    304() {
      const r = [header(304), banner('WARNINGS', 'g', 'k', `${c.advice} ADVICE `, 'k'), row([seg(' Australian Warning System, highest first', 'c')]), blank()];
      K.warnings.slice(0, 15).forEach((w) => r.push(row([seg(' ADVICE ', 'k', 'y'), seg(' ' + pad(w.state, 3) + ' ', 'c'), seg(pad(K.shortName({ name: w.title }), 21) + ' ', 'w'), seg(pad(K.agoShort(w.updated), 4, true), 'y')])));
      while (r.length < 20) r.push(blank());
      r.push(row([seg(' No Watch and Act or Emergency Warnings', 'g')]));
      r.push(row([seg(' are in force.', 'g')]));
      r.push(blank());
      r.push(fastext());
      return r;
    },
    305() {
      const r = [header(305), banner('BY STATE', 'y', 'k', 'TODAY ', 'k'), row([seg(' STATE              FIRES WARN  HOT DGR', 'c')])];
      const DC = { High: 'y', Moderate: 'g', Extreme: 'r', Catastrophic: 'r' };
      K.byState.forEach((s) => {
        r.push(row([seg(' ' + pad(s.name.replace('Australian Capital Territory', 'Aust Capital Terr'), 18) + ' ', 'w'), seg(pad(s.noFeed ? '-' : s.active, 4, true) + ' ', s.active ? 'y' : 'w'), seg(pad(s.warnings, 4, true) + ' ', s.warnings ? 'y' : 'w'), seg(pad(s.hotspots, 5, true) + ' ', 'c'), seg(pad((s.danger || '').slice(0, 3).toUpperCase(), 3), DC[s.danger] || 'w')]));
        r.push(blank());
      });
      r.push(row([seg(' DGR = highest fire danger rating today', 'c')]));
      r.push(row([seg(' MOD', 'g'), seg(' moderate  ', 'w'), seg('HIG', 'y'), seg(' high  ', 'w'), seg('EXT', 'r'), seg(' extreme', 'w')]));
      r.push(row([seg(' NT publishes no incident feed.', 'm')]));
      while (r.length < 23) r.push(blank());
      r.push(fastext());
      return r;
    },

    310() {
      const F = K.F, f = F.fire, n = F.near, hm = (iso) => new Intl.DateTimeFormat('en-AU', { timeZone: F.zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
      const r = [header(310), banner('CLONCURRY FIRE', 'r', 'w', 'QLD ', 'y'),
        row([seg(' Bushfire, Cloncurry Duchess Rd', 'c')]),
        row([seg(' STATUS   ', 'c'), seg(up(f.statusLabel).toUpperCase() + ' - NOT UNDER CONTROL', 'r')]),
        row([seg(' WARNING  ', 'c'), seg(' ADVICE ', 'k', 'y'), seg(' Avoid smoke  ', 'w'), seg('311', 'y', null, 311)]),
        row([seg(' VEHICLES ', 'c'), seg('7 ', 'y'), seg('(1 on scene, 6 en route)', 'w')]),
        row([seg(' HOTSPOTS ', 'c'), seg('within 10km  ', 'w'), seg('24h ', 'c'), seg(String(n.count24), 'y'), seg('  72h ', 'c'), seg(String(n.count72), 'y')]),
        row([seg(' STARTED  ', 'c'), seg(F.shortDate(f.started).replace(',', '') + ' ' + hm(f.started), 'w'), seg('  UPD ', 'c'), seg(hm(f.updated), 'y')]),
        blank()];
      for (let i = 0; i < 10; i++) r.push(blank());
      r.push(row([seg(' ', 'w'), seg(' ', 'r', 'r'), seg(' <24h ', 'w'), seg(' ', 'y', 'y'), seg(' 24-48h ', 'w'), seg(' ', 'b', 'b'), seg(' warning area ', 'w'), seg(' ', 'w', 'w'), seg(' fire', 'w')]));
      r.push(row([seg(` Cloncurry (${Math.round(F.context.nearestTown.distKm)}km ${F.context.nearestTown.bearing}) is in warning area`, 'c')]));
      r.push(row([seg(' Warning ', 'w'), seg('311', 'y', null, 311), seg('  Weather ', 'w'), seg('312', 'y', null, 312), seg('  Place ', 'w'), seg('313', 'y', null, 313)]));
      r.push(row([seg(' Not for safety-of-life use. Call 000.', 'm')]));
      r.push(fastextFire());
      return r;
    },
    311() {
      const F = K.F, f = F.fire, ex = f.extra || {}, lines = [];
      wrap(f.headline, 38).forEach((l) => lines.push([seg(' ' + l, 'y')]));
      F.blocks.forEach((b) => {
        if (b.type === 'h') { lines.push([]); lines.push([seg(' ' + b.text.toUpperCase(), 'c')]); }
        else if (b.type === 'ul') b.items.forEach((it) => wrap(it, 36).forEach((l, i) => lines.push([seg(i ? '   ' + l : ' * ' + l, 'w')])));
        else { lines.push([]); wrap(b.text, 38).forEach((l) => lines.push([seg(' ' + l, 'w')])); }
      });
      const PER = 19, total = Math.ceil(lines.length / PER); sub = Math.min(Math.max(1, sub), total);
      const r = [header(311), banner('AVOID SMOKE', 'y', 'k', `ADVICE ${sub}/${total} `, 'k')];
      lines.slice((sub - 1) * PER, sub * PER).forEach((l) => r.push(row(l)));
      while (r.length < 21) r.push(blank());
      r.push(row([seg(' ', 'w'), seg('< Prev', sub > 1 ? 'y' : 'w', null, sub > 1 ? 'prev' : null), seg(`      page ${sub} of ${total}      `, 'w'), seg('Next >', sub < total ? 'y' : 'w', null, sub < total ? 'next' : null)]));
      r.push(row([seg(' QFD warning text, unaltered. ' + up(ex['Warning ID'] || ''), 'c')]));
      r.push(fastextFire());
      return r;
    },
    312() {
      const F = K.F, w = F.weather, d = F.danger, DC = { High: 'y', Moderate: 'g', Extreme: 'r', Catastrophic: 'r' };
      const r = [header(312), banner('CONDITIONS', 'g', 'k', 'AT THE FIRE ', 'k'),
        row([seg(' NOW ', 'c'), seg(w.now.tempC.toFixed(1) + 'C ', 'y'), seg(w.now.text + '  ', 'w'), seg('RH ', 'c'), seg(w.now.rh + '%', 'y')]),
        row([seg(' WIND ', 'c'), seg(`${w.now.windDir} ${Math.round(w.now.windKmh)}km/h gusts ${Math.round(w.now.gustKmh)}`, 'w')]),
        row([seg(' SMOKE ', 'c'), seg('now ' + w.aq.category.toUpperCase() + '  ', 'g'), seg('peak today ', 'w'), seg(w.aq.forecast[0].category.toUpperCase(), 'r')]),
        blank(), row([seg(' DAY        MAX MIN RAIN WIND   DANGER', 'c')])];
      w.daily.forEach((x, i) => { const dr = d.days[i]; r.push(row([seg(' ' + pad(i === 0 ? 'Today' : F.day(x.date).replace(',', ''), 10) + ' ', 'w'), seg(pad(Math.round(x.tMaxC), 3, true) + ' ', 'y'), seg(pad(Math.round(x.tMinC), 3, true) + ' ', 'w'), seg(pad(x.precipProb + '%', 4, true) + ' ', 'c'), seg(pad(x.windDirDominant + Math.round(x.windMaxKmh), 6) + ' ', 'w'), seg(pad(dr ? dr.rating.toUpperCase().slice(0, 8) : '', 8), dr ? DC[dr.rating] : 'w')])); r.push(blank()); });
      r.push(row([seg(' Fire danger: ' + d.district.toUpperCase() + ' district', 'c')]));
      wrap(d.tfb.text, 38).forEach((l) => r.push(row([seg(' ' + l, 'g')])));
      while (r.length < 23) r.push(blank());
      r.push(row([seg(' Open-Meteo, CAMS, BoM via Esri', 'm')]));
      r.push(fastextFire());
      return r;
    },
    313() {
      const F = K.F, f = F.fire, cx = F.context, n = F.near, ex = f.extra || {};
      const item = (k, v, c) => row([seg(' ' + pad(k, 13), 'c'), seg(pad(v, 26), c || 'w')]);
      const r = [header(313), banner('LOCATION', 'c', 'k', 'CLONCURRY ', 'k'), blank(),
        item('Nearest town', `${cx.nearestTown.name} ${cx.nearestTown.distKm}km ${cx.nearestTown.bearing}`), item('Population', K.num(cx.nearestTown.population), 'y'), item('Council', cx.lga + ' Shire'),
        item('Remoteness', cx.remoteness), item('Vegetation', cx.vegetation.group, 'g'), row([seg('              ' + pad(cx.vegetation.subgroup.split(' with ')[1] ? 'with ' + cx.vegetation.subgroup.split(' with ')[1] : '', 26), 'g')]),
        item('Protected', 'None'), blank(), item('Latitude', f.lat.toFixed(4), 'y'), item('Longitude', f.lon.toFixed(4), 'y'), item('Incident', ex['Incident number']), item('Region', ex.Region), blank(),
        item('Last hotspot', new Intl.DateTimeFormat('en-AU', { timeZone: F.zone, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(n.latest)) + ' AEST', 'y'), item('Peak power', Math.round(n.maxFrp) + ' MW', 'y'),
        item('Satellites', Object.keys(n.bySat).join(' '))];
      while (r.length < 23) r.push(blank());
      r.push(row([seg(' ABS, NVIS, Geoscience Australia DEA', 'm')]));
      r.push(fastextFire());
      return r;
    },
  };

  let current = /-fire\.html$/.test(location.pathname) ? 310 : 302;
  function show(p) {
    if (!pages[p]) { document.getElementById('hint').textContent = `Page ${p} not found. Try 302 to 305, or 310 to 313.`; return; }
    current = p; scr.innerHTML = pages[p]().join('');
    scr.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { const g = b.dataset.go; if (g === 'next') { sub++; show(current); } else if (g === 'prev') { sub--; show(current); } else { if (+g !== current) sub = 1; show(+g); } });
    if (p === 302) mosaic();
    if (p === 310) fireMosaic();
  }

  // local mosaic for the fire page: warning area in blue, hotspots by age, fire position in white
  function fireMosaic() {
    const F = K.F, probe = document.createElement('span'); probe.textContent = '0'.repeat(40); probe.style.visibility = 'hidden'; scr.appendChild(probe);
    const chW = probe.getBoundingClientRect().width / 40; probe.remove();
    const lh = scr.querySelector('.row').getBoundingClientRect().height, ROWS = 10, sx = 80, sy = ROWS * 3, wpx = 40 * chW, hpx = ROWS * lh;
    const ys = F.nearPts.map((p) => p[1]), latC = (Math.min(...ys) + Math.max(...ys)) / 2, latSpan = (Math.max(...ys) - Math.min(...ys)) + 0.1;
    const lonC = (Math.min(...F.nearPts.map((p) => p[0])) + Math.max(...F.nearPts.map((p) => p[0]))) / 2, lonSpan = (wpx / hpx) * latSpan / Math.cos(latC * Math.PI / 180);
    const box = [lonC - lonSpan / 2, latC - latSpan / 2, lonC + lonSpan / 2, latC + latSpan / 2];
    const cv = document.createElement('canvas'); cv.className = 'mosaic'; cv.width = sx; cv.height = sy;
    cv.style.top = scr.children[9].offsetTop + 'px'; cv.style.width = wpx + 'px'; cv.style.height = hpx + 'px';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', `Mosaic map: ${F.nearPts.length} hotspots near the fire, inside the warning area.`);
    const x = cv.getContext('2d'), cell = (lon, lat) => [Math.floor((lon - box[0]) / (box[2] - box[0]) * sx), Math.floor((box[3] - lat) / (box[3] - box[1]) * sy)];
    x.fillStyle = '#1a1aff';
    for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) { const lon = box[0] + (i + .5) / sx * (box[2] - box[0]), lat = box[3] - (j + .5) / sy * (box[3] - box[1]); if (K.inGeom(lon, lat, F.warningGeometry)) x.fillRect(i, j, 1, 1); }
    F.nearPts.slice().sort((a, b) => b[2] - a[2]).forEach((p) => { const [i, j] = cell(p[0], p[1]); x.fillStyle = p[2] < 24 ? '#ff2b1c' : '#ffff00'; x.fillRect(i, j, 1, 1); });
    const [fi, fj] = cell(F.fire.lon, F.fire.lat); x.fillStyle = '#ffffff'; x.fillRect(fi, fj, 2, 2);
    scr.appendChild(cv);
  }

  // mosaic map: 40 columns × 14 rows of 2 × 3 block cells, geography kept true to the cell aspect
  function mosaic() {
    const cs = getComputedStyle(scr), fs = parseFloat(cs.fontSize);
    const probe = document.createElement('span'); probe.textContent = '0'.repeat(40); probe.style.visibility = 'hidden'; scr.appendChild(probe);
    const chW = probe.getBoundingClientRect().width / 40; probe.remove();
    const lh = scr.querySelector('.row').getBoundingClientRect().height;
    const ROWS = 14, COLS = 40, sx = COLS * 2, sy = ROWS * 3;
    const wpx = COLS * chW, hpx = ROWS * lh, latSpan = 37, lat0 = -27.2, lon0 = 133.6;
    const lonSpan = (wpx / hpx) * latSpan / Math.cos(lat0 * Math.PI / 180);
    const box = [lon0 - lonSpan / 2, lat0 - latSpan / 2, lon0 + lonSpan / 2, lat0 + latSpan / 2];
    const grid = K.landGrid(sx, sy, box);
    const cv = document.createElement('canvas'); cv.className = 'mosaic'; cv.width = sx; cv.height = sy;
    cv.style.top = (lh * 3 + lh * 2 - lh) + 'px'; // after header + double-height banner + one text row
    cv.style.top = scr.children[3].offsetTop + 'px';
    cv.style.width = wpx + 'px'; cv.style.height = hpx + 'px';
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', `Mosaic map of Australia: ${c.active} active fires and ${num(c.hotspots)} hotspots, mostly in the north.`);
    const x = cv.getContext('2d');
    const cell = (lon, lat) => [Math.floor((lon - box[0]) / (box[2] - box[0]) * sx), Math.floor((box[3] - lat) / (box[3] - box[1]) * sy)];
    x.fillStyle = '#19e619';
    grid.forEach((r, j) => r.forEach((st, i) => { if (st) x.fillRect(i, j, 1, 1); }));
    const hotCount = {};
    K.S.hot.forEach((h) => { const [i, j] = cell(h[0], h[1]); const k = i + ',' + j; hotCount[k] = (hotCount[k] || 0) + 1; });
    x.fillStyle = '#ffff00';
    Object.entries(hotCount).forEach(([k, n]) => { if (n >= 2) { const [i, j] = k.split(',').map(Number); x.fillRect(i, j, 1, 1); } });
    x.fillStyle = '#ff2b1c';
    K.ranked.forEach((f) => { const [i, j] = cell(f.lon, f.lat); x.fillRect(i, j, 1, 1); });
    x.fillStyle = '#ffffff';
    K.ranked.filter((f) => f.alert).forEach((f) => { const [i, j] = cell(f.lon, f.lat); x.fillRect(i, j, 1, 1); });
    scr.appendChild(cv);
  }

  // size the screen so 40 columns fit the viewport
  function fit() {
    const avail = Math.min(window.innerWidth - 24 - 2 * Math.max(12, 0), 1100);
    const probe = document.createElement('span'); probe.style.cssText = 'font: 100px VT323, monospace; position:absolute; visibility:hidden; white-space:pre'; probe.textContent = '0'.repeat(40); document.body.appendChild(probe);
    const ratio = probe.getBoundingClientRect().width / 4000; probe.remove();
    const fs = Math.max(12, Math.min(30, (avail - 0.0) / (40 * ratio + 2.4)));
    document.documentElement.style.setProperty('--fs', fs.toFixed(2) + 'px');
    show(current);
  }
  document.getElementById('entry').addEventListener('submit', (e) => { e.preventDefault(); const v = +document.getElementById('pg').value; sub = 1; show(v); document.getElementById('pg').value = ''; });
  (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fit);
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(fit, 150); });
})();
