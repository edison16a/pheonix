<p align="center">
  <img src="assets/brand/logo.svg" width="72" alt="Pheonix logo">
</p>

<h1 align="center">Pheonix</h1>

<p align="center">
  A 3D globe for browsing public cameras around the world, with live planes and voice control.
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-ff7a1a?style=flat-square&amp;labelColor=ff7a1a&amp;cacheSeconds=3600">
  <img alt="Node 22 or newer" src="https://img.shields.io/badge/node-%3E%3D22-ff7a1a?style=flat-square&amp;labelColor=ff7a1a&amp;cacheSeconds=3600">
  <img alt="Platform: web browser" src="https://img.shields.io/badge/platform-web%20browser-ff7a1a?style=flat-square&amp;labelColor=ff7a1a&amp;cacheSeconds=3600">
</p>

## What it is

Pheonix is a globe you can fly around. Public traffic and city cameras show up on it as small camera icons.
Click one and the camera opens in a floating window.

You can also watch live planes, follow one, or sit in its cockpit. And you can talk to it. Say "Hey Pheonix,
take me to Tokyo" and it flies there.

## Screenshots

<p align="center">
  <img src="assets/screenshots/home.png" alt="The Pheonix globe with camera clusters" width="100%">
</p>

<table>
  <tr>
    <td width="50%"><img src="assets/screenshots/camera.png" alt="A London camera in a floating window"><br><sub>A London traffic camera.</sub></td>
    <td width="50%"><img src="assets/screenshots/follow-plane.png" alt="Following an Airbus A320 over London"><br><sub>Following a plane.</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="assets/screenshots/cockpit.png" alt="Cockpit view from the same plane"><br><sub>Cockpit view of the same plane.</sub></td>
    <td width="50%"><img src="assets/screenshots/loading.png" alt="The 3D phoenix on the loading screen"><br><sub>The loading screen.</sub></td>
  </tr>
</table>

## What you can do

- Browse about 20,000 public cameras. Red icons are live video. Amber icons are photos that refresh.
- Watch several cameras at once in a grid.
- See live planes, then follow one or sit in its cockpit.
- Turn on traffic, transit, bike share and place labels from the Data button.
- Use your voice, a chat box or a typed command box. They all do the same things.

## How it works

The page is plain JavaScript. CesiumJS draws the globe. Three.js draws the logo and the little globe in the corner.

A small Vite server sits behind the page. It fetches camera lists, camera images, plane positions and the
other data, and the page asks it instead of calling those sites directly. It also caches what it fetches
so it does not hammer them.

Cameras: each source has its own small file in `server/cameras/providers/`. The server merges them into one
list. The page downloads that list once and draws the markers. A video only starts when you open a camera.

Voice: a Python program runs on your computer. It waits for "hey pheonix", turns your speech into text with
whisper.cpp, and speaks the reply with Kokoro. The page then matches the text to a command with plain rules.
No AI model decides what to do.

## Project layout

```
src/app/         startup, and the actions the voice assistant can call
src/globe/       the Cesium globe, camera moves, zoom, place search
src/cameras/     camera list, clusters, markers, field of view cones
src/player/      the floating camera windows
src/layers/      planes, traffic, transit, bikes, labels
src/voice/       the assistant, command router, chat box
src/brand/       3D phoenix, 3D globe, loading screen
server/cameras/  camera sources, merging, video proxy
server/voice/    speech to text, text to speech, wake word (Python)
test/            unit tests
docs/            more detail on each part
```

## Getting started

You need Node 22 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:4173. You do not need an account or any API keys.

To build for production:

```bash
npm run build
npm run preview
```

### Voice

Voice is optional. You also need Python 3.10 or newer. The setup downloads about 0.7 GB of models into
`.voice/`, which git ignores.

```bash
bash scripts/setup-voice.sh --yes
npm run voice
```

Then click the microphone in the bar at the bottom of the page and allow microphone access. No microphone?
The keyboard and chat buttons next to it take typed commands.

To change your name, the assistant's name or the voice, copy `.env.example` to `.env` and edit it.

Things to say: "take me to Tokyo", "take me to the nearest camera", "show me a live camera in London",
"follow the nearest plane", "show me traffic in Paris", or a street address.

### Tests

```bash
npm test
```

## Limitations

- Only a few cameras are live video (Delaware, plus some streams in Japan and Korea). The rest are photos
  that refresh. Cameras go offline without warning.
- Traffic is a simulation on real roads. It only uses real data in New York, when that feed is fresh.
  The app labels it as simulated.
- The plane data source limits heavy use, so planes only show when you are zoomed in.
- "Hey Pheonix" works by transcribing what you say and looking for the phrase. It is less exact than a
  trained wake word.
- The voice setup was only tested on a Mac with Apple Silicon.
- The proxies run inside the Vite server. To host this on a static site you would need to move them to a
  real server.

## Credits and licenses

MIT licensed. Some code and the plane models come from God's Eye View by Bilawal Sidhu (also MIT).
Imagery, camera feeds and voice models have their own terms. See `THIRD_PARTY_NOTICES.md`.
