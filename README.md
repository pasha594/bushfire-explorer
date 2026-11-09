# Bushfire Explorer

A live map of bushfires across Australia, modelled on [fires.cornea.is](https://fires.cornea.is/). It has a national map with a ranked list of fires, a page for each state, and a page for each fire. Fire pages show the official warning, perimeter, nearby satellite hotspots, weather, air quality, fire danger rating and vegetation.

**Live site:** https://bushfiremap.com

The app is static files on GitHub Pages, with no server or API keys. Each visitor's browser fetches the agencies' public feeds directly and refreshes them every 1–5 minutes.

## Pages and URLs

| URL | Page |
| --- | --- |
| `/` | National map |
| `/fires-near-me/` | Fires near a location or town |
| `/nsw/`, `/vic/`, `/qld/`, `/sa/`, `/wa/`, `/tas/`, `/nt/`, `/act/` | State and territory maps |
| `/#/fire/{id}`, `/#/warning/{id}` | A fire or warning (in-page routes on the home page) |

Old `#/state/xx` links redirect to `/xx/` in the browser.

## Files

| File | Purpose |
| --- | --- |
| `src/app.js`, `src/app.css` | The app: data adapters, map, views and router |
| `templates/page.html` | Page shell shared by every page |
| `tools/build.mjs` | Builds the site into `dist/`: copies `public/` and `src/`, and generates the home page, `/fires-near-me/`, the state pages and `sitemap.xml` from the template |
| `public/` | Files published as they are: `404.html`, `robots.txt`, `CNAME`, icons and link-preview image (`assets/`), `manifest.webmanifest`, Leaflet 1.9.4 and Leaflet.markercluster 1.5.3 (`lib/`), and the IndexNow key file (lets the site notify Bing and other engines of changed URLs) |
| `.github/workflows/pages.yml` | Builds on every push and pull request; deploys `dist/` to GitHub Pages on pushes to `main` |

### Build and deploy

GitHub Actions builds and deploys the site on every push to `main`. Only `dist/` is published, and it isn't committed. The build needs only Node.js, and gives `app.js` and `app.css` a new version in every page when they change, so browsers fetch the new copies.

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
| Location context | Australian Bureau of Statistics (ASGS), NVIS vegetation and CAPAD protected areas (DCCEEW) |
| Base map | Esri (World Light/Dark Gray Canvas, World Hillshade, World Imagery) |

Most data is licensed CC BY 4.0. Some sources (SA CFS, Emergency WA, DBCA) carry non-commercial or no-derivatives terms. The site is non-commercial and shows agency warning text unaltered. The NT doesn't publish a reusable incident feed, so NT fires appear as satellite hotspots and NAFI burnt areas only.

## Run locally

Build the site, then serve `dist/` over HTTP rather than opening the files directly:

```bash
node tools/build.mjs
```

```bash
python3 -m http.server 8765 -d dist
```

Then open http://localhost:8765 (or http://localhost:8765/nsw/ for a state page).
