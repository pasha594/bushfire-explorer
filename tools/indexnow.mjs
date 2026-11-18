#!/usr/bin/env node
// IndexNow: tells Bing and other participating engines (not Google) which pages changed, so they recrawl sooner.
//
//   node tools/indexnow.mjs diff  > changed.txt   # before deploy: sitemap URLs whose built HTML differs from the live page
//   node tools/indexnow.mjs ping  < changed.txt   # after deploy: submit those URLs (does nothing for an empty list)
//
// A page counts as changed only if its text changed: the ?v= asset version is ignored, so a script-only release
// pings nothing. New pages (404 on the live site) count as changed. No dependencies; Node 18+ (global fetch).
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const HOST = 'bushfiremap.com', ORIGIN = 'https://' + HOST;
const keyFile = readdirSync(join(ROOT, 'public')).find(f => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('IndexNow key file (public/<32 hex>.txt) not found');
const KEY = keyFile.slice(0, -4);

const normalise = (html) => html.replace(/\?v=[0-9a-f]+/g, '?v=').replace(/\s+/g, ' ').trim();

async function diff() {
  const sitemap = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  const changed = [];
  for (const url of urls) {
    const path = new URL(url).pathname, file = join(DIST, path, 'index.html');
    if (!existsSync(file)) continue;
    let live = null;
    try {
      const r = await fetch(url + '?indexnow=' + Date.now(), { redirect: 'follow' }); // bypass the CDN cache
      if (r.ok) live = await r.text();
    } catch (e) { /* unreachable: treat as changed */ }
    if (live == null || normalise(live) !== normalise(readFileSync(file, 'utf8'))) changed.push(url);
  }
  process.stdout.write(changed.join('\n') + (changed.length ? '\n' : ''));
  console.error(`IndexNow: ${changed.length} of ${urls.length} pages changed`);
}

async function ping() {
  const urlList = readFileSync(0, 'utf8').split('\n').map(s => s.trim()).filter(u => u.startsWith(ORIGIN + '/'));
  if (!urlList.length) { console.error('IndexNow: nothing changed, no ping sent'); return; }
  const r = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList }),
  });
  console.error(`IndexNow: submitted ${urlList.length} URLs, HTTP ${r.status}`);
  // 200/202 = accepted. Anything else is reported but doesn't fail the deploy.
  if (r.status !== 200 && r.status !== 202) console.error(await r.text().catch(() => ''));
}

const cmd = process.argv[2];
if (cmd === 'diff') await diff();
else if (cmd === 'ping') await ping();
else { console.error('usage: node tools/indexnow.mjs diff|ping'); process.exit(2); }
