# Bushfire Explorer

A live map of bushfires across Australia, modelled on [fires.cornea.is](https://fires.cornea.is/). It has a national map with a ranked list of fires, a page for each state, and a page for each fire. Fire pages show the official warning, perimeter, nearby satellite hotspots, weather, air quality, fire danger rating and vegetation.

**Live site:** https://bushfiremap.com

The app is static files on GitHub Pages, with no server or API keys. Each visitor's browser fetches the agencies' public feeds directly and refreshes them every 1–5 minutes. A scheduled GitHub Actions build also writes a real page for each NSW and Queensland fire every 15 minutes, so search engines and link previews can see them.

## Pages and URLs

| URL | Page |
| --- | --- |
| `/` | National map |
| `/fires-near-me/` | Fires near a location or town |
| `/nsw/`, `/vic/`, `/qld/`, `/sa/`, `/wa/`, `/tas/`, `/nt/`, `/act/` | State and territory maps |
| `/nsw/fire/{name}-{id}/`, `/qld/fire/{name}-{id}/` | A NSW or Queensland fire's own page, e.g. `/nsw/fire/beecroft-weapons-range-beecroft-peninsula-685889/` |
| `/#/fire/{id}`, `/#/warning/{id}` | Fires in other states, and warnings (in-page routes on the home page) |

Old `#/state/xx` links redirect to `/xx/` in the browser, and `#/fire/{id}` links to the fire's own page when it has one.

### Fire pages

Fire pages follow the SEO audit's P3 lifecycle (items A2 and P3, decision 12 option a):

- **Which fires:** NSW and Queensland only, the two states whose feeds the audit rates as republishable. NSW comes from the RFS feeds the app uses; Queensland from Queensland Fire Department's open-data feed (CC BY 4.0), not the ArcGIS layers the app reads. Planned burns and incidents without a stable agency id get no page.
- **Indexed:** a fire becomes "major", and stays indexed for good, once it reaches Watch and Act or Emergency Warning, or 1,000 ha within 50 km of a town of 200 or more people (ABS). Major fires go in the sitemap with the time their facts last changed. Other fire pages carry `noindex, follow`.
- **Ended:** a fire the agency stops listing (two fetches in a row, at least 30 minutes) keeps a summary page: first and last listed, highest warning and largest size. Minor ended fires are removed after 30 days, and their address then returns 404; `404.html` sends visitors to the live map's view of that fire.
- **Renamed:** the old address keeps a redirect stub to the new one.
- **Stale feed:** if a feed hasn't been received for an hour, its fire pages say the data is unavailable and point to the agency.

The build's log lives on the live site (`/data/fires.json`), and each run reads it back, so nothing is committed. `/data/pages.json` tells the app which fires have a page.

## Files

| File | Purpose |
| --- | --- |
| `src/app.js`, `src/app.css` | The app: data adapters, map, views and router |
| `templates/page.html` | Page shell shared by every page |
| `tools/build.mjs` | Builds the site into `dist/`: copies `public/` and `src/`, and generates the home page, `/fires-near-me/`, the state pages, the fire pages and `sitemap.xml` from the template |
| `tools/snapshot.mjs` | Fetches the NSW and Queensland fire feeds, merges them into the previous log read from the live site, and writes `snapshot/fires.json` for the build. Runs the app's own NSW adapter in Node, so fire ids match the app |
| `tools/fire-pages.mjs` | Turns the snapshot into fire pages, the fire lists on the state and home pages, and the sitemap entries |
| `package.json` | One build dependency, `@xmldom/xmldom` (an XML parser, for the NSW warning feeds in Node). The site itself has no dependencies |
| `public/` | Files published as they are: `404.html`, `robots.txt`, `CNAME`, icons and link-preview image (`assets/`), `manifest.webmanifest`, Leaflet 1.9.4, MapLibre GL and its Leaflet bridge (`lib/`), and the IndexNow key file (lets the site notify Bing and other engines of changed URLs) |
| `.github/workflows/pages.yml` | Builds on every push and pull request, and every 15 minutes on `main`; deploys `dist/` to GitHub Pages from `main`, then submits pages whose text changed to IndexNow |
| `.github/workflows/keepalive.yml` | Once a month, an empty commit on the `keepalive` branch, because GitHub turns off schedules after 60 days without activity |
| `tools/indexnow.mjs` | IndexNow diff and submit (tells Bing and other engines, not Google, which pages changed) |

### Build and deploy

GitHub Actions builds and deploys the site on every push to `main`, and every 15 minutes to refresh the fire pages (GitHub runs schedules on a best-effort basis, so some runs start late or are skipped). Only `dist/` is published, and it isn't committed. The build needs Node.js and `npm ci`, and gives `app.js` and `app.css` a new version in every page when they change, so browsers fetch the new copies.

GitHub Pages must be set to deploy from GitHub Actions: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

> **Not for safety-of-life decisions.** This site compiles official feeds automatically. Data may be delayed or incomplete. Always follow advice from your state fire agency and emergency broadcaster. In an emergency call **000**.

## Data sources

| Data | Source |
| --- | --- |
| Incidents and warnings | NSW Rural Fire Service · VicEmergency (CFA, DEECA, FRV) · Queensland Fire Department and Queensland Parks and Wildlife Service · SA Country Fire Service · Emergency WA (DFES) and WA Department of Biodiversity, Conservation and Attractions · Tasmania Fire Service and theLIST · ACT Emergency Services Agency |
| Fire perimeters | State agencies and Geoscience Australia, Near Real-Time Bushfire Extents (Digital Atlas of Australia) |
| Satellite hotspots | Geoscience Australia, DEA Hotspots (fallback: NASA FIRMS) · burnt areas in northern Australia: NAFI, Charles Darwin University |
| Fire danger ratings | Australian Fire Danger Rating System, Bureau of Meteorology data via Esri Australia · state Total Fire Ban feeds |
| Weather and air quality | [Open-Meteo](https://open-meteo.com) (CC BY 4.0), including CAMS air quality |
| Location context and map search | Australian Bureau of Statistics (ASGS, including suburbs and localities and postcode areas for the map search box, and urban centres for fire pages' nearest town), NVIS vegetation and CAPAD protected areas (DCCEEW) |
| Fire pages | NSW RFS feeds; [Queensland Fire Department current bushfire incidents](https://www.data.qld.gov.au/dataset/queensland-fire-and-rescue-current-bushfire-incidents) (open data, CC BY 4.0) |
| Base map | [OpenFreeMap](https://openfreemap.org) (© OpenMapTiles, data © OpenStreetMap contributors), shaded relief from AWS Terrain Tiles (Mapzen); satellite view: [EOxCloudless](https://cloudless.eox.at) 2025 by EOX IT Services GmbH (contains modified Copernicus Sentinel data; CC BY-NC-SA 4.0) |

Most data is licensed CC BY 4.0. Some sources (SA CFS, Emergency WA, DBCA, EOxCloudless satellite imagery) carry non-commercial or no-derivatives terms. The site is non-commercial and shows agency warning text unaltered. The NT doesn't publish a reusable incident feed, so NT fires appear as satellite hotspots and NAFI burnt areas only.

## Run locally

Install the build dependency once, take a fire snapshot (optional: without one the build leaves out the fire pages), build the site, then serve `dist/` over HTTP rather than opening the files directly:

```bash
npm ci
```

```bash
node tools/snapshot.mjs
```

```bash
node tools/build.mjs
```

```bash
python3 -m http.server 8765 -d dist
```

Then open http://localhost:8765 (or http://localhost:8765/nsw/ for a state page).
