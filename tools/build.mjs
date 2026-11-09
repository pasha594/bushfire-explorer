#!/usr/bin/env node
// Builds the static pages from templates/page.html: the home page, one page per state (/nsw/ … /act/) and
// sitemap.xml. Each page gets its own title, description, canonical URL, link-preview tags, structured data and
// a short static introduction inside <main>, so crawlers that don't run JavaScript still see real text. The app
// (app.js) replaces <main> when it starts.
//
// Run after editing the template, app.js or app.css (the asset version in every page is a hash of both):
//   node tools/build.mjs
// No dependencies. Writes files in place; commit the output.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://bushfiremap.com';
const SITE = 'Bushfire Explorer';
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const write = (p, s) => { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), s); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STATES = [
  { id: 'NSW', name: 'New South Wales', agency: 'NSW Rural Fire Service', official: 'https://www.rfs.nsw.gov.au/fire-information/fires-near-me', officialName: 'NSW RFS Fires Near Me' },
  { id: 'VIC', name: 'Victoria', agency: 'VicEmergency (CFA, DEECA and FRV)', official: 'https://emergency.vic.gov.au/respond/', officialName: 'VicEmergency' },
  { id: 'QLD', name: 'Queensland', agency: 'Queensland Fire Department', official: 'https://www.fire.qld.gov.au/Current-Incidents', officialName: 'Queensland Fire Department current incidents' },
  { id: 'SA', name: 'South Australia', agency: 'SA Country Fire Service and MFS', official: 'https://www.cfs.sa.gov.au/warnings-restrictions/warnings/incidents-warnings/', officialName: 'SA CFS incidents and warnings' },
  { id: 'WA', name: 'Western Australia', agency: 'Emergency WA (DFES) and DBCA', official: 'https://emergency.wa.gov.au/', officialName: 'Emergency WA' },
  { id: 'TAS', name: 'Tasmania', agency: 'Tasmania Fire Service', official: 'https://alert.tas.gov.au/', officialName: 'TasALERT' },
  { id: 'NT', name: 'Northern Territory', agency: null, official: 'https://www.pfes.nt.gov.au/incidentmap', officialName: 'PFES Fire Incident Map' },
  { id: 'ACT', name: 'Australian Capital Territory', agency: 'ACT Emergency Services Agency', official: 'https://esa.act.gov.au/', officialName: 'ACT Emergency Services Agency' },
];
const slug = (st) => '/' + st.id.toLowerCase() + '/';

// The app's own copy of these strings lives in app.js (pageMeta); keep the two in step.
const HOME = {
  path: '/',
  title: 'Bushfire map Australia: live fires and warnings - Bushfire Explorer',
  description: 'Live map of Australian bushfires from every state fire agency, with warnings, fire danger ratings and total fire bans. Unofficial.',
};
const stateMeta = (st) => ({
  path: slug(st),
  title: `${st.id} fire map: live ${st.name} bushfires and warnings today`,
  description: st.id === 'NT'
    ? 'Live Northern Territory bushfire map: satellite hotspots and NAFI burnt areas, fire danger ratings and total fire bans.'
    : `Live ${st.name} bushfire map: incidents and warnings from ${st.agency}, fire danger ratings and total fire bans.`,
});

const ldScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
function head(meta, ld) {
  const url = ORIGIN + meta.path;
  return [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:locale" content="en_AU">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${ORIGIN}/assets/og-image.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Bushfire Explorer: live bushfire map of Australia">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    ldScript(ld),
  ].join('\n');
}

const WEBSITE = { '@type': 'WebSite', '@id': ORIGIN + '/#website', name: SITE, alternateName: 'bushfiremap.com', url: ORIGIN + '/', inLanguage: 'en-AU' };
const webPage = (meta) => ({ '@type': 'WebPage', '@id': ORIGIN + meta.path + '#webpage', url: ORIGIN + meta.path, name: meta.title, description: meta.description, inLanguage: 'en-AU', isPartOf: { '@id': WEBSITE['@id'] } });

const stateLinks = (except) => `<ul class="shell-links">${STATES.filter(s => s !== except).map(s => `<li><a href="${slug(s)}">${esc(s.name)} fire map</a></li>`).join('')}</ul>`;
// The map placeholder keeps the page's layout close to the app's, so the swap when the app starts doesn't jump.
const MAP_PLACEHOLDER = '<div class="mapcard shell-map" aria-hidden="true"><div class="mapbar"></div><div class="mapslot"></div></div>';
const NOSCRIPT = '<noscript><p class="shell-note">The live map and fire list need JavaScript. Turn it on, or use the official links on this page.</p></noscript>';
const EMERGENCY = '<p class="shell-note"><strong>Unofficial.</strong> Bushfire Explorer is not a replacement for official sources. Always follow advice and warnings from your state fire agency and emergency broadcaster. In an emergency call <strong>000</strong>.</p>';

function homeMain() {
  return `<div class="shell" data-shell="home">
<div class="home-top"><h1>Australia bushfire map</h1><span>Active fires, warnings and satellite hotspots</span></div>
${MAP_PLACEHOLDER}
${NOSCRIPT}
<section class="section shell-text">
<p>Bushfire Explorer is a free, unofficial live map of bushfires across Australia. It puts incidents and warnings from every state and territory fire agency on one map: the NSW Rural Fire Service, VicEmergency, the Queensland Fire Department, the SA Country Fire Service, Emergency WA, the Tasmania Fire Service and the ACT Emergency Services Agency.</p>
<p>The map adds satellite hotspots from Geoscience Australia's DEA Hotspots, burnt areas in northern Australia from NAFI, Australian Fire Danger Rating System forecasts for every fire weather district, and each state's total fire ban status. Every fire has its own page with the agency's status and warning, size, mapped perimeter, nearby hotspots, weather and air quality.</p>
<p>Your browser fetches the data directly from each agency's public feed and refreshes it every one to five minutes. The Northern Territory doesn't publish a reusable incident feed, so NT fires appear as satellite hotspots and burnt areas only.</p>
<h2>Fire maps by state and territory</h2>
${stateLinks(null)}
${EMERGENCY}
</section>
</div>`;
}

function stateMain(st) {
  const lede = st.id === 'NT'
    ? 'Track fires in the Northern Territory with satellite hotspots from Geoscience Australia and NAFI burnt-area mapping. NT Fire and Rescue doesn\'t publish a reusable incident feed, so official NT incidents and warnings are linked below.'
    : `Track active ${st.name} bushfires on a live ${st.id} fire map. See fires in ${st.name} today (location, size and status) with official warnings from ${st.agency}, fire danger ratings by district and satellite hotspots.`;
  return `<div class="shell" data-shell="state">
<a class="back" href="/#/states">← All states</a>
<header class="statehead"><h1>${esc(st.name)} fire map</h1><hr><p class="lede">${esc(lede)}</p></header>
${MAP_PLACEHOLDER}
${NOSCRIPT}
<section class="section shell-text">
<p>${st.agency ? `Incidents and warnings on this page come from ${esc(st.agency)}. ` : ''}Fire danger ratings come from the Australian Fire Danger Rating System, and satellite hotspots from Geoscience Australia's DEA Hotspots. Your browser fetches each feed directly and refreshes it every few minutes.</p>
<p>Official information: <a href="${st.official}" rel="noopener">${esc(st.officialName)}</a>.</p>
<h2>Other states and territories</h2>
${stateLinks(st)}
${EMERGENCY}
</section>
</div>`;
}

const ASSET_V = createHash('sha1').update(read('app.js')).update(read('app.css')).digest('hex').slice(0, 10);
const TEMPLATE = read('templates/page.html');
const page = (headHtml, mainHtml) => TEMPLATE.replace('{{HEAD}}', headHtml).replace('{{MAIN}}', mainHtml).replace(/\{\{V\}\}/g, ASSET_V);

const breadcrumbs = (st) => ({ '@type': 'BreadcrumbList', itemListElement: [
  { '@type': 'ListItem', position: 1, name: 'Australia', item: ORIGIN + '/' },
  { '@type': 'ListItem', position: 2, name: `${st.name} fire map`, item: ORIGIN + slug(st) },
] });

write('index.html', page(head(HOME, { '@context': 'https://schema.org', '@graph': [WEBSITE, webPage(HOME)] }), homeMain()));
for (const st of STATES) {
  const meta = stateMeta(st);
  write(slug(st).slice(1) + 'index.html', page(head(meta, { '@context': 'https://schema.org', '@graph': [Object.assign(webPage(meta), { breadcrumb: breadcrumbs(st) })] }), stateMain(st)));
}
// No <lastmod>: Google uses it only when it is consistently accurate, and these pages' text doesn't change with fire activity yet.
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[HOME.path, ...STATES.map(slug)].map(p => `  <url><loc>${ORIGIN}${p}</loc></url>`).join('\n')}
</urlset>
`);
console.log(`Built index.html, ${STATES.length} state pages and sitemap.xml (assets v=${ASSET_V}).`);
