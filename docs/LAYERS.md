# Secondary layers: traffic, transit, bikes

Three optional layers next to Aircraft. They are discovered from `src/layers/<name>/index.js`
(see `src/layers/registry.js`), so each shows up as a button in the layers pill and can be driven
by voice through `actions.setLayer(name, on)` ("show me traffic in Tokyo" = fly to the place,
then `setLayer('traffic', true)`).

Every layer follows the layer contract:

```
export const descriptor = { id, label, title, icon, simulated? }
export function create({ globe, bus })
  // returns { setEnabled(on), isEnabled(), destroy(), nearest?(lon, lat), isSimulated?() }
bus 'layer:status' { layer, state: 'ok' | 'zoom-in' | 'empty' | 'error', count?, ... }
```

They load only for the area the camera is looking at, cache and throttle, say "zoom in" when the
camera is too high, and dispose of everything (primitives, listeners, timers, in-flight requests)
when switched off. A small glass chip at the bottom-left states, in words, what is on screen.

## Code layout

Each layer is a folder whose `index.js` holds the descriptor and `create`, which only wires smaller
modules together. The modules share one plain `state` object per layer instead of reaching into
each other. Subfolders are named for the job they do:

| Folder | Contents |
| --- | --- |
| `src/layers/traffic/` | `roads` (network graph, tile loading), `live` (NYC feed), `sim` (population, motion, animation), `render` (dots, car badges), `ui` (chip, clicks), plus `refresh.js` (what to load) and `state.js` |
| `src/layers/transit/` | `data` (tracks, polling), `render` (billboards, glyphs, badges), `ui` (clicks) |
| `src/layers/bikes/` | `model.js` (levels, wording), `data` (polling), `render` (points, labels, badges), `ui` (clicks) |
| `src/layers/shared/` | `geo` (boxes, tiles, viewport reuse), `data` (cache, protobuf reader), `camera` (view target, terrain heights), `clusters` (grid, badge art), `ui` (chips, clicks, bus status) |
| `server/providers/` | `traffic`, `transit`, `bikes`, `overpass`: each `index.js` exports the Vite plugin, the rest is parsing and fetching |

## What is real and what is simulated

| Layer | Data | Real or simulated |
| --- | --- | --- |
| Traffic, New York City | NYC DOT measured link speeds | **Real**, marked "Live speeds" while readings are under 45 minutes old |
| Traffic, everywhere else | OpenStreetMap roads, animated vehicles | **Simulated.** Shown as "Simulated traffic flow, not live" |
| Transit | Agency vehicle-position feeds (15 feeds, see below) | **Real**, positions a few seconds to a minute old |
| Bikes | GBFS station feeds (about 380 docked systems) | **Real** bike and dock counts |

There is no keyless worldwide live congestion API. The traffic layer therefore never claims to be
live outside the places where a measured source exists. The layer descriptor has `simulated: true`
and `api.isSimulated()` returns true only while simulated vehicles are in view, so the voice
assistant can say "simulated traffic" honestly.

### Traffic

* **Roads.** `/api/traffic/roads?level=major|all&x=&y=` serves z14 tiles of the OSM road network.
  Primary source is OpenFreeMap vector tiles (`server/providers/traffic/mvt.js` decodes the
  `transportation` layer; a CDN, about 200 ms per tile). If that is unreachable the server falls back to
  the public Overpass API (`server/providers/overpass/`), which is slower (5 to 25 s per tile) and
  rate limited, so it caches 7 days on disk and queries two at a time. The browser can only ask for
  grid tiles, never raw Overpass QL.
* **Simulation.** Vehicles drive along roads at class-typical speeds (motorway 27 m/s down to service
  roads 5 m/s), two-way on two-way streets, continue onto connected roads at junctions (endpoints
  within 8 m, which also stitches tile seams), turn around at dead ends. Density per km depends on road
  class and the nearest roads to the screen centre get vehicles first, up to 2,400 dots. Motion is a
  1.5x time-lapse so it reads from the air (`SPEED_BOOST` in `traffic/sim/motion.js`). Residential
  streets only appear below 4.5 km camera height; above 14 km the layer asks you to zoom in.
* **Real data, NYC.** `/api/traffic/live` returns the newest reading per link from NYC DOT real-time
  traffic speeds (NYC Open Data dataset `i4gi-tjb9`, keyless, about 65 usable expressway and arterial links).
  Links are drawn as vehicles at the measured speed, coloured green/amber/red (over 25 mph, 12 to 25,
  under 12), and the simulated roads underneath are suppressed. Readings older than 45 minutes are
  not called live. The chip then says how old the feed is. (When this was built the feed had stopped
  updating about 5 hours earlier; corrupt link geometries in the feed are rejected.) For testing
  against an old snapshot set `PHEONIX_TRAFFIC_MAX_AGE_MIN`.
* **Checked and rejected as real sources.** Paris `comptages-routiers-permanents` is hourly with
  roughly a 10 hour lag; the Chicago Traffic Tracker feed last updated in April 2026. Neither is
  live. TfL publishes disruptions, not speeds. TomTom (the original app's source) needs a key.

### Transit

`/api/transit?w&s&e&n` fetches only feeds whose coverage box meets the view, caches each feed 10 s,
and drops positions older than 5 minutes. GTFS-realtime is decoded with a small built-in protobuf
reader (`src/layers/shared/data/pbf.js`, no dependency). The browser glides vehicles between polls.
All of these endpoints returned data without credentials on 2026-10-11:

| Feed | Coverage | Format |
| --- | --- | --- |
| MBTA | Boston | JSON (mode known) |
| SEPTA buses and trolleys, SEPTA Regional Rail | Philadelphia | JSON |
| TTC | Toronto | GTFS-rt |
| Edmonton Transit, Calgary Transit | Alberta | GTFS-rt |
| King County Metro | Seattle | GTFS-rt |
| Metro Transit | Minneapolis-St Paul | GTFS-rt |
| RTD | Denver | GTFS-rt |
| TransLink SEQ | Brisbane | GTFS-rt |
| Adelaide Metro | Adelaide | GTFS-rt |
| Entur | Norway | GTFS-rt |
| HSL | Helsinki | GTFS-rt |
| OVapi | Netherlands | GTFS-rt |
| VR trains (Digitraffic) | Finland | JSON |

Elsewhere the chip reads "No open live transit feed covers this area yet". Not integrated because they
need a key or registration: MTA (New York), TfL vehicle positions, Transport for NSW, PTV Victoria,
SF 511, TriMet, Washington Metro, CTA, most of Germany/France/UK. Add a feed by adding an entry to
`server/providers/transit/feeds.js` (URL, coverage box, `parse`) after confirming it works keyless.
GTFS-realtime does not carry vehicle mode, so those feeds draw as generic vehicles; MBTA and the rail
feeds are drawn as squares, buses as circles. Click a vehicle for route, speed and report age.

### Bikes

`/api/bikes?w&s&e&n` picks the GBFS systems whose station box meets the view
(`server/providers/bikes/systems.json`, built from the MobilityData catalog), caches station metadata
1 hour and availability 30 s, and returns stations in the view (nearest first, at most 2,500).
Dots are green (plenty), amber (2 or fewer, or under 15 percent of capacity), red (none) or grey (out
of service or unknown), and the bike count is printed on the 260 stations nearest the centre when
closer than 2.8 km. Click a station for bikes, electric bikes, free docks and report age.

`systems.json` lists only systems without authentication that publish station capacity. Free-floating
scooter operators and car sharing, whose "stations" are virtual parking spots, are excluded. Rebuild it
occasionally with `node server/providers/bikes/buildIndex.mjs` (about 75 s). Catalog source:
MobilityData GBFS `systems.csv` (CC BY 4.0). Some cities have no open dock-level feed (for example
London's Santander Cycles has no GBFS).

## Default state and cluster badges

The layers are enabled at start but stay idle until the camera is low enough: no requests, nothing
drawn, no chip. The only chip is the honest traffic one ("Simulated traffic flow, not live"), shown
while simulated vehicles are on screen, plus the NYC live-data note when relevant.

Crowded screen cells collapse into one badge: the layer's glyph (bus or train, bicycle, car) on a dark
translucent backing with the count in an orange pill (1.2k format), 38 to 64 px by log of the count.
Transit shows the vehicle count, bikes the total bikes available, traffic the count of **simulated**
vehicles (its click card says so; in badge mode the simulation is paused, only NYC measured vehicles
move). Cells with fewer than 3 items stay individual. The grid is geographic and sized from the camera
(about 78 px), so panning never reshuffles badges. Clicking a badge flies in. Badge canvases are cached
per (glyph, label, size) in `shared/clusters/badges.js`.

## Tests

`test/layers-*.test.mjs` (shared, cluster, traffic network, sim, mvt and feeds, transit, bikes) cover the
pure logic: viewport tiling and cache keys, TTL/LRU/single-flight caches, vehicle motion along
polylines and across junctions, density allocation, the MVT and GTFS-realtime decoders (against
hand-built fixtures), the NYC feed parsing and time zones, GBFS v2/v3 parsing, system selection,
track smoothing, and availability classification.

## Attribution

OpenStreetMap contributors (ODbL), OpenFreeMap, NYC Open Data, the transit agencies named above,
GBFS system operators and the MobilityData catalog. The chips carry the live/simulated wording; the
feed attributions are returned by the proxies (`attribution` fields).
