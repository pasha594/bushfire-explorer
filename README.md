# Bushfire Explorer

A live map of bushfires across Australia, modelled on [fires.cornea.is](https://fires.cornea.is/). It has a national map with a ranked list of fires, a page for each state, and a page for each fire. Fire pages show the official warning, perimeter, nearby satellite hotspots, weather, air quality, fire danger rating and vegetation.

**Live site:** https://pasha594.github.io/bushfire-explorer/

The whole app is one static `index.html`. It has no server, build step or API keys. Each visitor's browser fetches the agencies' public feeds directly and refreshes them every 1–5 minutes.

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

Serve the folder over HTTP rather than opening the file directly:

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.
