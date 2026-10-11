# Third party notices

Pheonix is MIT licensed (see `LICENSE`). Some of the camera provider code, the aircraft
tracking ideas and the 3D aircraft models come from God's Eye View by Bilawal Sidhu
(https://github.com/bilawalsidhu/gods-eye-view), also MIT licensed. His copyright notice is
kept in `LICENSE`.

## Libraries used at runtime

* CesiumJS (Apache 2.0, Cesium GS, Inc.). Its credit is shown on the globe.
* three.js (MIT, three.js authors). Used for the logo and the globe mark only.
* hls.js (Apache 2.0). Plays live HLS camera streams.
* Vite (MIT). Dev server and bundler.

## Imagery and map data (fetched at runtime, not covered by the MIT license)

* Esri World Imagery, and Esri World Boundaries and Places for the location labels. Imagery by
  Esri, Maxar, Earthstar Geographics and the GIS user community. The attribution is shown on the globe.
* Re:Earth terrain (https://terrain.reearth.land), used as keyless Cesium terrain.
* OpenStreetMap Nominatim for place and address search, under its usage policy (one request
  per second at most). Data by OpenStreetMap contributors, ODbL.
* OpenFreeMap vector tiles for the simulated traffic road network (OpenStreetMap data, ODbL).
* adsb.lol for live aircraft positions (community ADS-B data, ODbL 1.0).
* GBFS feeds for bike share availability, listed through the MobilityData catalog.
* GTFS realtime feeds from the transit agencies named in `docs/LAYERS.md`.
* NYC DOT traffic speeds, used for the New York traffic layer when the feed is fresh.

## Camera feeds

Every camera carries its own credit and license from the operator that publishes it, for example
city and state open data portals, Transport for London, the Tokyo Metropolitan Government (CC BY)
and the DOTs listed in `docs/CAMERAS.md`. Pheonix only shows feeds that their operators publish
for public use.

## Aircraft 3D models

The files in `public/models/` are third party assets under CC BY 4.0. Each model's author, source
link and the changes made to it are listed in `public/models/README.md`.

## Local voice stack (downloaded by `scripts/setup-voice.sh`, never committed)

* openWakeWord (Apache 2.0 code). Its pretrained models are CC BY NC SA 4.0, so they are for
  non commercial use only.
* Kokoro 82M and kokoro-onnx (Apache 2.0). Speech synthesis.
* whisper.cpp and OpenAI Whisper (MIT). Speech recognition.
