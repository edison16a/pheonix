# Pheonix voice assistant

You talk to the globe and it answers. Say "hey pheonix, take me to Paris" and the camera flies there.

Everything runs on your own machine. The wake word, speech recognition and the spoken replies are all
local, and the browser only talks to a service on `127.0.0.1`. There is no cloud audio, no paid API and
no language model. A fixed router turns what you said into a call on the app's `actions`, so the same
words always do the same thing.

## How it fits together

The browser side (`src/voice`) and the local service (`server/voice`, on 127.0.0.1:8791) talk like this:

1. The microphone feeds an AudioWorklet that makes 16 kHz audio, sent to the service over the WebSocket `/voice/ws`.
2. The service finds the wake word, records one utterance and turns it into text with whisper.cpp.
3. It sends back `wake`, `transcript` or `no_speech` events. A state machine in the browser decides what happens next.
4. The router turns the text into a call on the globe `actions`.
5. The reply is spoken. The browser posts the text to `/voice/tts` and gets a WAV from the Kokoro voice
   (`bm_george`), which the service caches on disk and in memory.
6. `GET /voice/config` gives the page the names, wake phrase, voice, timeouts and which models are installed.

The browser asks the service for its settings when the page loads. If the service is not running,
the page uses built-in defaults and typed commands still work.

## Setup

The first run downloads about 0.7 GB, so setup shows you the plan and does nothing until you say yes.

```
scripts/setup-voice.sh            # print the plan and sizes, change nothing
scripts/setup-voice.sh --yes      # create the venv, install packages, download models
npm run voice                     # start the service (same as scripts/voice-service.sh)
npm run dev                       # start the app, it proxies /voice to the service
```

Setup can be run again safely. It skips whatever is already there. Options: `--tiny` uses the smaller
`tiny.en` speech model (set `STT_MODEL=tiny.en` in `.env` too), `--no-brew` skips installing whisper.cpp,
and `--python /path/to/python3` picks the Python used for the venv. The package pins target Python 3.10 to
3.13 on Apple Silicon. If pip fails on your Python, try 3.12.

| What | Size |
|---|---|
| pip packages (onnxruntime, numpy, openwakeword, kokoro-onnx, fastapi, uvicorn) | about 250 MB |
| openWakeWord feature models and `hey_jarvis` | about 10 MB |
| Kokoro `kokoro-v1.0.onnx` and `voices-v1.0.bin` | about 310 MB and 27 MB |
| whisper.cpp `ggml-base.en.bin` (`tiny.en` is about 75 MB) | about 142 MB |
| `brew install whisper-cpp` | about 30 MB |

Everything lands in `.voice/`, which git ignores. The service prefers a resident `whisper-server`, which
keeps the model loaded and answers fastest. It falls back to `whisper-cli` if the server is not installed.

## Settings

Copy `.env.example` to `.env`. Nothing in it is secret. Vite only passes `VITE_*` variables to the page,
so the browser gets these values from `GET /voice/config` instead.

| Variable | Default | Meaning |
|---|---|---|
| `ASSISTANT_NAME` | `Pheonix` | The name it answers to. It is ignored when it appears in a command |
| `USER_NAME` | empty | Used in the greeting. If empty it uses `ADDRESS_AS` |
| `ADDRESS_AS` | `sir` | How replies address you |
| `WAKE_WORD` | `hey pheonix` | The wake phrase. If unset it is "hey" plus the assistant name |
| `WAKE_MODEL` | empty | A pretrained model name or a path to your own `.onnx` file |
| `WAKE_MODE` | `model` | `model` or `transcript`, see below |
| `WAKE_THRESHOLD` | `0.5` | 0.05 to 0.99. Raise it for fewer false wakes, lower it if it misses you |
| `TTS_VOICE` | `bm_george` | Kokoro voice. Also `bm_lewis`, `bm_daniel`, `bm_fable` |
| `STT_MODEL` | `base.en` | whisper.cpp model, `base.en` or `tiny.en` |
| `FOLLOWUP_TIMEOUT_S` | `12` | Seconds it keeps listening after a reply without a wake word |
| `LISTEN_TIMEOUT_S` | `8` | Seconds it waits for you to speak after waking |
| `VOICE_PORT` | `8791` | Service port, always bound to 127.0.0.1 |

The greeting is "Good evening, Edison. How may I assist you?". Within five minutes of the last exchange,
waking it just gets "Yes, sir?".

## The wake word

The default wake phrase is "hey pheonix". openWakeWord only ships trained models for hey jarvis, alexa,
hey mycroft, hey rhasspy, timer and weather, so there is none for "hey pheonix". Instead the service
listens for short bursts of speech while on standby, transcribes them locally with whisper, and checks
whether the text starts with the phrase. It accepts common mishearings such as Phoenix, Fenix and Hay.
Audio still never leaves the machine.

This is the honest trade: it costs some CPU for every burst of speech it hears on standby, and it is a
little less accurate than a trained model. `/voice/config` reports it as `wakeMode: transcript`.

For model based detection, either set `WAKE_WORD` to one of the pretrained phrases (for example
`WAKE_WORD="hey jarvis"`), or train your own model with openWakeWord's synthetic data notebook
(`automatic_model_training.ipynb`, which needs Colab or a GPU) and set `WAKE_MODEL=models/hey_pheonix.onnx`.
The path is relative to the repo root.

## What you can say

The router matches phrases with patterns, so there is some room in the wording. A leading "hey", "please",
"could you" or the assistant's name is ignored.

- Move: "take me to Tokyo", "fly to Paris", "show me London", "where is Cairo".
- Zoom: "zoom in", "zoom out", "closer", "pull back". "World view" or "show the whole earth" resets the globe.
- Cameras: "show cameras near me", "show cameras in Rome", "open the nearest camera", "nearest live camera",
  "a random camera in Seoul", "next camera" (also "another one", "something else"), "close all camera feeds".
- Aircraft: "follow the nearest plane", "show me a random plane over London", "cockpit view",
  "ride the nearest plane". "Stop following", "exit cockpit" or "leave the plane" lets go.
- Layers: "show aircraft", "hide traffic", "buses in Paris", "bike share in Taipei", "show location labels".
- Street addresses, with or without a verb: "1600 Pennsylvania Avenue Washington DC", "1 Infinite Loop, Cupertino".
  Spoken numbers like "sixteen hundred" or "one two three" become digits. This is the last thing the router
  tries, so it never steals a phrase from a real command. It needs a house number plus a street word,
  or at least two comma separated parts with a digit.
- The assistant: "what can you do", "stop listening", "go to sleep", "goodbye".

Replies describe what really happened. A failure is spoken as a failure, "a live feed" is only said when
the camera is live, and simulated data is called simulated. An unknown phrase gets "I didn't understand that".

### Adding commands

A layer takes one entry in the `LAYERS` table (`src/voice/router/layerTable.js`): a name, a label and the
words people say. Any other command is a registry entry:

```js
router.register({ id, patterns, handler, speak });
```

`patterns` are regexes on the normalised text (named groups become `args`). `handler(actions, args, ctx)`
calls the app and returns a result. `speak(result, args, ctx)` turns that result into the reply. Optional:
`guard(args)` to reject a match, `defaults`, and `sleep: true` to drop back to standby after the reply.

## What each action receives

| Action | Result the reply uses |
|---|---|
| `flyToPlace(name)` | `{ ok, name }` |
| `worldView()`, `zoom('in' or 'out')` | `{ ok }` |
| `showCamerasNear(place or null)` | `{ ok, count }` |
| `randomCamera({ live, place? })`, `openNearestCamera({ live })` | `{ ok, camera }` |
| `nextNearest()` (or the older `nextCamera()`) | `{ ok, camera }` |
| `closeAllCameras()` | `{ ok, closed }` |
| `setLayer(name, on)`, `showLayerIn(name, place)` | `{ ok, simulated?, place? }` |
| `followAircraft({ mode, pick, place? })`, `stopFollowing()` | `{ ok, aircraft }` |

On failure, `{ ok: false, reason }` is spoken honestly. Reasons it knows: `not-found`, `none-nearby`,
`no-coverage`, `no-current`, `unsupported-layer`.

## How it behaves

- States are `off`, `standby`, `activated`, `listening`, `processing` and `speaking`. Every change is sent
  on the bus as `voice:state`.
- While it speaks, the mic frames are dropped, the service is put in idle, and wake and transcript events
  are ignored. They stay ignored for 700 ms after, so it cannot hear its own echo. Browser echo cancellation
  is on as well.
- Wake events are debounced for 1.5 s in the browser and 2 s in the service.
- After each reply it keeps listening for `FOLLOWUP_TIMEOUT_S` with no wake word. "Stop listening" ends that early.
- The dot in the voice pill is lit only while the microphone is open.
- The chat button in the pill opens a panel at the top right. It shows what was heard and what it said,
  and you can type commands there. The keyboard button opens a smaller command bar that works with voice off.
- If the mic is denied or missing, voice stays off with a clear message and the app carries on.
  If the service goes down, the browser retries with backoff (0.5 s up to 8 s) and typing keeps working.
  If the Kokoro model is missing, replies use the browser's own speech voice.

## Limits

- English only. The speech model is `base.en` (or `tiny.en`) and replies use a British English voice.
- Commands are phrases, not conversation. Anything the patterns do not cover gets "I didn't understand that".
- Waking by the phrase "hey pheonix" is less accurate than a trained model, see above.
- Setup and the pins are written for macOS on Apple Silicon. Other systems may need changes.
- The browser only gives microphone access on `localhost` or `https`.
- Reply text sent to the voice service is capped at 600 characters.
- Place lookups and camera coverage depend on the app's own data, so some places answer "no cameras there yet".

## Working on it without models or a mic

- Press the keyboard button in the pill to type commands. It works even with voice off.
- Open `/?voice=mock` (or set `localStorage['pheonix.voice.mock']` to `'1'`) to use the fake backend in
  `src/voice/service/mockService.js`. Typing `hey pheonix go to Paris` then runs the whole path: wake,
  state machine, router and actions, spoken with the browser's voice.

## Where the code is

```
src/voice/
  index.js            public API: createVoiceAssistant, createVoiceIndicator, createRouter, normalise,
                      defaultRegistry, createTextFallback, createChat
  router.js           thin re-export of router/, so old imports keep working
  router/             engine.js (match and route), normalise.js, places.js, numbers.js, replies.js,
                      layerTable.js, commands/ (one file per command family)
  assistant/          index.js (public surface), session.js (shared state), flow.js (events and state
                      machine glue), speaking.js (echo suppression), backends.js (config, client and
                      speaker loading), textPath.js (typed commands), config.js, stateMachine.js
  service/            serviceClient.js (WebSocket and mic), audioCapture.js, micWorklet.js, speech.js
                      (spoken replies), mockService.js (dev only)
  ui/                 indicator.js (the pill), chat.js, textFallback.js, icons.js, typedInput.js
src/styles/voice/     surface.css (shared look), pill.css, chat.css, text-input.css
server/voice/         app.py, config.py, session.py, stt.py, tts.py, wake.py, audio.py, phrases.py
scripts/              setup-voice.sh, voice-service.sh
```

## Tests

```
npm test                                         # everything, includes the voice tests
node --test test/voice*.test.mjs                 # voice only: router, address, aircraft, state, config, assistant
.voice/venv/bin/python -m server.voice.selfcheck # config, wake matching, endpointing, session (no models needed)
```
