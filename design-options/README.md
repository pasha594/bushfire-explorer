# Design options

Ten alternative designs for bushfiremap.com, for review. Each option has a homepage (`NN-name.html`) and a fire detail page (`NN-name-fire.html`, showing the Cloncurry fire in Queensland). Open `index.html` for the overview.

Each option is a working page built from a snapshot of the live agency feeds (10:44 am AEDT, Tuesday 10 November 2026), collected by running the site's own feed code. National maps are drawn from embedded outlines (Natural Earth); fire maps use a stitched Esri basemap image (`shared/fire/`), because the review page can't load live tiles.

| File | Option | Tone | Layout | Mode |
| --- | --- | --- | --- | --- |
| `01-public-notice.html` | Public Notice | Safe | Reskin | Light |
| `02-survey-sheet.html` | Survey Sheet | Safe | Reskin | Light |
| `03-synoptic.html` | Synoptic | Safe | Reskin | Light |
| `04-ranger.html` | Ranger | Bold | Reskin | Light |
| `05-hi-vis.html` | Hi-Vis | Bold | Reskin | Light |
| `06-riso.html` | Riso | Bold | Reskin | Light |
| `07-atlas.html` | Atlas | Safe | New layout | Light |
| `08-state-by-state.html` | State by State | Safe | New layout | Light |
| `09-departures.html` | Departures | Bold | New layout | Dark |
| `10-teletext.html` | Teletext | Bold | New layout | Dark |

`styles/` holds one stylesheet per option, shared by its two pages. `shared/` holds the data snapshot (`data.js`, `danger.js`, `fire.js`), outlines (`geo.js`), fire basemaps (`fire/`), the map and formatting helpers (`kit.js`), the Teletext page engine (`teletext.js`) and the review bar (`nav.js`). `shots/` holds the screenshots used on the overview page.

## View locally

```bash
cd design-options && python3 -m http.server 8765
```

Then open http://localhost:8765.
