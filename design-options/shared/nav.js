// Review bar: a small, deliberately neutral strip for flipping between options. Not part of any design.
(function () {
  const OPTIONS = [
    ['01-public-notice.html', 'Public Notice'], ['02-survey-sheet.html', 'Survey Sheet'], ['03-synoptic.html', 'Synoptic'],
    ['04-ranger.html', 'Ranger'], ['05-hi-vis.html', 'Hi-Vis'], ['06-riso.html', 'Riso'], ['07-atlas.html', 'Atlas'],
    ['08-state-by-state.html', 'State by State'], ['09-departures.html', 'Departures'], ['10-teletext.html', 'Teletext'],
  ];
  const here = location.pathname.split('/').pop();
  const i = OPTIONS.findIndex((o) => o[0] === here);
  if (i < 0) return;
  const prev = OPTIONS[(i + OPTIONS.length - 1) % OPTIONS.length], next = OPTIONS[(i + 1) % OPTIONS.length];
  const bar = document.createElement('nav');
  bar.setAttribute('aria-label', 'Design options');
  bar.innerHTML = '<a href="index.html" title="All options">All options</a><span>' + String(i + 1).padStart(2, '0') + ' / 10 · ' + OPTIONS[i][1] +
    '</span><a href="' + prev[0] + '" title="Previous: ' + prev[1] + '" aria-label="Previous option">‹</a><a href="' + next[0] + '" title="Next: ' + next[1] + '" aria-label="Next option">›</a>';
  const st = document.createElement('style');
  st.textContent = '.rv-bar{position:fixed;z-index:99999;left:calc(12px + env(safe-area-inset-left,0px));bottom:calc(12px + env(safe-area-inset-bottom,0px));display:flex;align-items:center;gap:2px;padding:3px;border-radius:7px;background:rgba(28,28,30,.88);color:#f2f2f2;font:500 12px/1 system-ui,-apple-system,"Segoe UI",sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.25);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}' +
    '.rv-bar a,.rv-bar span{display:block;padding:7px 9px;border-radius:5px;color:inherit;text-decoration:none;white-space:nowrap}.rv-bar a:hover{background:rgba(255,255,255,.14)}.rv-bar a:focus-visible{outline:2px solid #8ab4ff;outline-offset:0}.rv-bar span{opacity:.7}' +
    '@media (max-width:480px){.rv-bar span{display:none}}';
  bar.className = 'rv-bar';
  document.head.appendChild(st);
  document.body.appendChild(bar);
})();
