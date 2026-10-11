# Cameras

Pheonix shows public traffic and city cameras on the globe. This page says where the cameras come from,
which feeds we have checked by hand, and how the code is laid out. If a number here disagrees with a live
request to `/api/cctv/sources`, trust the request.

## How a camera gets on the globe

1. The server collects cameras from many agencies and merges them into one list.
2. The browser asks `GET /api/cctv/sources` once, caches the answer for 15 minutes, and removes duplicates.
3. Markers are drawn on the globe. Zoomed out they group into count bubbles; zoomed in each camera is a glyph.
   A red glyph is live video, an amber one is a still picture that refreshes.
4. Clicking a marker opens a floating window. The window shows what the feed is actually doing: LIVE only
   while the video clock moves, SNAPSHOT only after a real frame arrived, OFFLINE or UNAVAILABLE with the real
   reason otherwise. Nothing is faked.

## Code layout

Server, in `server/cameras/`:

- `providers/`: one file per source (Caltrans, NYC DOT, TfL, Tokyo, and so on). Each knows how to read its
  agency's open data and turn it into our camera shape.
- `catalog/`: merges every provider, applies per-provider caps, removes duplicates, and fills in credit and
  license text for each pack.
- `media/`: the proxy that fetches frames, video and HLS playlists from the agency (with size and time limits,
  and the HLS puller).
- `routes/`: the `/api/cctv/*` endpoints: `sources`, `health`, `stream`, `media`, `frame`.
- `shared/`: small helpers used by several providers.
- `index.js`: the Vite plugin that mounts the routes.

Browser, in `src/cameras/`:

- `catalog/`: fetch, IndexedDB cache, dedupe, spatial index, and `isLiveFeed`.
- `clusters/`: grouping cameras into count bubbles by view height.
- `markers/`: glyph drawing, billboards, cluster badges, hover tooltip and click picking.
- `fov/`: field-of-view fans (pure geometry, Cesium primitives, and the layer that swaps them in).
- `selection/`: picking helpers such as random near a point, next nearest, and cameras in a box.
- `layer/`: wires the pieces together. `createCameraLayer({ viewer, bus })` lives here and is exported from
  `src/cameras/index.js`.

Browser, in `src/player/`:

- `window/`: the window itself: markup, drag, resize, size clamping.
- `streams/`: one adapter per feed type: HLS and plain video, MJPEG, snapshot polling, YouTube embed.
- `status/`: the pure state reducer, the labels, and the code that paints a state onto a window.
- `grid/` and `toolbar/`: the tiled layout and the bar with the count, grid toggle and close-all.
- `controls/`: the small icon buttons.
- `createPlayerManager({ container, bus })` lives in `manager.js` and is exported from `src/player/index.js`.

The old file paths (`src/cameras/registry.js`, `src/player/playerManager.js`, and a few others) are thin
re-exports so existing imports keep working.

## Verified feeds

Audit run on 2026-10-11, about 07:00 to 07:20 UTC, against the live endpoints. All keyless, with the
User-Agent `pheonix-cctv-proxy/1.0`. The server caches the catalogue for 15 minutes.

The first pass returned 20,173 cameras after deduplication. The Japan and Ottawa pass (second table) added
about 540 more before deduplication, so the catalogue is now a little over 20,700.

| Provider | Count | Feed type | Verified |
|---|---:|---|---|
| TxDOT ITS (25 districts) | 4,019 | still (JSON-wrapped JPEG, decoded on the server) | Yes. 4 of 5 sampled frames loaded, 1 camera offline |
| Caltrans (districts 1 to 12) | 3,390 | still | Yes |
| Fintraffic / Digitraffic (Finland) | 2,266 | still | Yes |
| ODOT TripCheck (Oregon) | 1,180 | still | Yes |
| DriveBC (British Columbia) | 1,045 | still | Yes |
| HK Transport Dept (data.gov.hk) | 1,013 | still, updates about every 2 minutes | Yes |
| NYC DOT TMC | 981 | still, updates every few seconds | Yes |
| Iowa DOT (traffic, RWIS, rest areas) | 861 | still | Yes |
| Statens vegvesen (Norway) | 859 | still | Yes |
| Illinois DOT / Gateway | 838 | still | Yes |
| Transport for London JamCams | 823 | still | Yes |
| Austin Transportation | 821 | still | Yes |
| Seattle DOT and WSDOT (Seattle travelers feed) | 613 | still | Yes |
| DelDOT (Delaware) | 359 | HLS live video | Yes. 6 of 6 random playlists fetched, 1 played in a browser |
| Tallinn | 255 | still | Yes |
| Live Traffic NSW | 248 | still | Yes |
| City of Calgary | 215 | still | Yes |
| NZ Transport Agency | 214 | still | Yes |
| Transpordiamet / Tarktee (Estonia) | 176 | still | Yes |
| Singapore LTA (data.gov.sg) | 8 | still, the image URL changes every minute and is resolved per request | Yes. The API only exposes 8 cameras right now |
| Warendorf | 1 | still | Yes |
| Ontario 511 | 0 | none | Dropped. The endpoint now answers `Invalid Key` and needs a key |

### Japan, Ottawa and embeds (also 2026-10-11)

| Provider | Count | Feed | Verified |
|---|---:|---|---|
| Tokyo Metropolitan Government river cameras (open data CSV, CC BY) | 105 | YouTube live embed from the official channel | Yes. oEmbed answered 200 for 105 of 106, and one stream played in the real player (`tokyo-river-2`, Kanda River, playerState 1, clock advancing) |
| Tokyo island port cameras (open data CSV) | 0 | embed | No. 16 of 17 streams are gone, so the pack is off by default (`CCTV_TOKYO_ISLANDS=1` turns it on) |
| Curated landmark streams (`embeds.js`): Dotonbori Osaka, Kokusai-dori Naha, Seoul Han River (two) | 4 | YouTube live embed | Yes. oEmbed 200 and live status confirmed by hand |
| City of Ottawa and MTO traffic cameras | 428 | still | Yes |

### Played in a real browser

Checked in Chromium through the Browser pane, with the app on Vite port 4181, between 07:05 and 07:15 UTC.
The status chip was read from the DOM. For stills we checked that the image `naturalWidth` was above 0, and
for video that `currentTime` was moving.

| Camera id | Name | Result |
|---|---|---|
| `deldot-ncam214` | KING ST @ 10TH ST (Wilmington DE) | LIVE over HLS. `currentTime` reached 10.3 s, video 800 px wide |
| `nyc-3a3d7bc0-...` | 5 Ave @ 34 St | SNAPSHOT, 352 px, refreshed every 4 s |
| (NYC) | 10 Ave @ 23 St, 9 Ave @ 23 St | SNAPSHOT. The on-image clock moved from 03:09:48 to 03:10:18 (EDT) |
| `hk-K104F` | Canton Road near China HK City | SNAPSHOT, 320 px |
| `sea-CMR-0311` | 4th Ave S & S Washington St | SNAPSHOT, 1280 px |
| `il-2979` | I-290 IKE @ Van Buren | SNAPSHOT, 1920 px |
| `tfl-00001.06502` | Trafalgar Square | SNAPSHOT, 352 px. The on-image clock read 08:06 BST |
| `no-vegvesen-1129038_1` | Norway (HLS camera) | The proxy refused the HLS. The window showed CONNECTING for about 13 s, then fell back to a SNAPSHOT (800 px) |

We also tried grid layout, dragging, and closing (the HLS lease `DELETE` was sent, and the DOM and timers were
released). The UNAVAILABLE state (embed-only camera) and the OFFLINE state (HTTP 502) both showed their real
reasons.

## Notes on specific sources

- NYC DOT, Hong Kong TD, Singapore LTA, Seattle/WSDOT, Iowa DOT, Illinois, Oregon and NZTA were added in the
  second pass. Each provider supplies its own `officialUrl`, `credit` and `license` through the pack metadata
  in `server/cameras/catalog/packMeta.js`.
- Norway publishes HLS for about 134 cameras, but the segments are 62 s long and the proxy's HLS puller gives
  up after 60 s. So they are served as stills. `CCTV_VEGVESEN_VIDEO=1` turns the video back on.
- Iowa's HLS uses fMP4, which the puller cannot read, so Iowa is stills only.
- Caltrans sometimes serves its own "Temporarily Unavailable" placeholder as a valid JPEG. That is upstream
  content, so it still reads as a snapshot.
- Rejected because they need a key or give no usable media: WSDOT Traveler API (access code), 511 sites in
  NY, GA, MN and IA (key), Maryland CHART (stream only on an HTML player page), KYTC (many dead URLs), Toronto
  (list only), Spain DGT (404), Insecam (forbidden), Germany Autobahn API (webcam lists empty), Taiwan TDX
  (key), Quebec 511 (403), Japan MLIT (no national list).

## Duplicates

The server and the browser both drop duplicates. Two cameras count as the same one when they come from
different providers, sit within 25 m of each other, and their names are at least half alike. The live video
feed wins over the still. The server version is in `server/cameras/catalog/dedupe.js`, the browser version in
`src/cameras/catalog/dedupe.js`.

## Which way a camera points

`/api/cctv/sources` includes `headingDeg`, `fovDeg`, `rangeM`, `pitchDeg` and `headingConfidence: 'high'`
only for cameras whose direction comes from the provider's own data. That is about 4,700 of 20,000:
Caltrans, DriveBC, DelDOT, Tallinn, and parts of TxDOT, NSW and Austin.

Those cameras get a field-of-view fan on the ground. The direction is real but the size is not: the fan grows
with altitude so it stays readable, up to 150 fans at once. A camera with no known heading gets no fan, only
a faint disc while you hover or select it.

## Embeds

Entries with `feedType: 'embed'` carry an `embedId`. The player frames `youtube-nocookie.com/embed/ID` and
reports LIVE only from the embed's own telemetry (playerState 1 and a moving clock). It says OFFLINE after 25 s
without playback and UNAVAILABLE on embed errors 101 and 150.

The server drops an entry only when its oEmbed check fails (rechecked on every refresh, cached 15 minutes).
It does not scrape watch pages for a live flag, because that got the proxy rate limited by Google during
testing. The old `config/cctv_sources.shinjuku.json` demo is not used.

## Limits and switches

- HLS proxy: 2 upstream HLS sessions at once for the whole server, and 8 leases each. A third HLS camera
  fails, and the window says so. It falls back to a still when the camera has one, otherwise it shows OFFLINE.
- Sources response: ETag with 304 support, `Cache-Control: max-age=300`.
- Environment switches: `CCTV_<NYC|HK|SG|SEATTLE|IOWA|ILLINOIS|OREGON|NZTA|...>_ENABLED=0` turns a pack
  off, and `CCTV_MAX_SOURCES` caps the list. Each provider also has its own `CCTV_<NAME>_MAX_SOURCES`.
