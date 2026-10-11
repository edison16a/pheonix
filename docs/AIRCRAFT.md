# Aircraft layer

Live aircraft over the globe. Off by default; toggled from the layer bar.

```
src/layers/aircraft/
  index.js           descriptor + create({ globe, bus }); composes the pieces below, owns the public API
  controller/        selection.js (select, follow, cockpit, stop), frameLoop.js (per-frame work),
                     input.js (click and Esc), lookup.js (nearest, random in view)
  feed/              poller.js (viewport-scoped polling of /api/aircraft, 10 s), lookQuery.js (what the camera
                     looks at), viewport.js (request sizing and re-query rules), applyBatch.js (merge a batch)
  motion/            geo.js (angles, offsets), deadReckon.js (position extrapolation), attitude.js (smoothed
                     heading, pitch, bank), state.js (per-aircraft state and glide-in corrections); pure, unit-tested
  render/            index.js (fleet and per-frame update), sprites.js (glyph, halo, ring billboards),
                     models.js (3D model loading and budget), picking.js, glyphs.js, halo.js, canvas.js (canvas art)
  tracking/          index.js (Follow and Cockpit cameras), session.js, poseWriter.js, targets.js,
                     cameraState.js, cockpitInput.js, cameraMath.js (chase offset, cockpit pose, blends; pure, unit-tested)
  classify/          typeSets.js (ICAO type sets), classify.js (type to class), presentation.js (class to
                     model and glyph), altitude.js (colour ramp)
  card/              index.js (the glass card, DOM in #ui), markup.js, readouts.js, summary.js
src/styles/aircraft.css
server/providers/aircraft/aircraft.js   GET /api/aircraft (adsb.lol, keyless)
server/providers/aircraft/anchors.js    anchor lattice for regional views
public/models/*.glb + README.md         real-metre glTF models (CC BY 4.0, credits in the README)
```

## Using it

- Click an aircraft: a glass card shows callsign, type, registration, altitude, speed, heading, vertical rate.
- **Follow** puts a chase camera behind and above the aircraft. You can still orbit (drag) and zoom (wheel);
  the camera swings with the aircraft when it turns.
- **Cockpit** puts the camera at the nose looking along the heading. It pitches with the climb or descent and banks
  in turns. Drag to glance around; the view springs back. Your own airframe is hidden.
- **Stop**, or Esc, returns to the free camera and restores the view you had before tracking. A second Esc closes the card.
- Anything else that moves the camera (the zoom buttons, a fly-to) simply ends tracking. For zoom buttons while
  following use `zoomTracked(factor)` instead.

## Public API (`layers.get('aircraft').api`)

| member | meaning |
| --- | --- |
| `setEnabled(on)`, `isEnabled()`, `destroy()` | lifecycle; disabling removes every primitive, listener, timer and the card |
| `count()` | aircraft currently drawn (airborne) |
| `status()` | `'idle' \| 'ok' \| 'hidden' \| 'error'` |
| `track(id)` | Follow an aircraft by ICAO hex; `false` if it is not currently known |
| `cockpit(id?)` | Cockpit view (defaults to the selected aircraft) |
| `stopTracking({ restore = true })` | back to the free camera |
| `select(id)` | open the card without moving the camera |
| `nearestTo(lon, lat, { excludeGround = true })`, `nearest(lon, lat)` | nearest drawn aircraft `{ id, callsign, type, lat, lon, altFt, speedKt, headingDeg, ..., distanceKm }` or `null` |
| `randomInView()` | a random airborne aircraft inside the current view, or `null` |
| `getTracked()` | the tracked aircraft with `mode: 'follow' \| 'cockpit'`, or `null` |
| `zoomTracked(factor)` | scale the follow distance (`< 1` closer); `false` unless following |
| `whenReady(timeoutMs = 8000)` | `Promise<boolean>`: true once a data batch for the current view has arrived, false on timeout or when the layer is off |
| `refreshNow()` | force a data refresh |

Bus events: `layer:status` `{ layer: 'aircraft', state: 'ok' | 'error', count }` (`error` is sent once per episode; there is no
`zoom-in` any more), `aircraft:select` `{ id, callsign }`, `aircraft:track` `{ id, mode }`
(`mode: null` when tracking ends), `aircraft:lost` `{ id }`.

## How it behaves

**Visibility.** Glyphs are 30 px at regional zoom up to 45 px close in (`scaleByDistance`), with a soft halo, and are
tinted by altitude (orange low, amber, warm white, cyan at cruise). Shape follows the class (jet, prop, helicopter,
fast jet). Within about 24 km of the camera the nearest 44 aircraft are drawn as the real glTF models
(`classify/presentation.js` maps class to `airplane`, `b789`, `atr72`, `c172`, `bell206`, `citation2`, `jet`, `mq9`), with
hysteresis (kept out to 32 km); the tracked aircraft always gets its model. Models use `minimumPixelSize`, so the
glyph-to-model swap does not change apparent size.

**Real-time motion.** Every aircraft is advanced every frame from ground speed, track and vertical rate
(`motion/`). The report's age (`seen_pos` plus cache age, supplied by the server) is folded in, so the drawn
position is where the aircraft is now, not where it was. A turn rate is estimated from successive tracks and held
for at most 15 s; extrapolation stops after 150 s. When a new report arrives the gap between where the aircraft was
drawn and where the report says it is becomes an offset that decays with a 2.5 s time constant: no teleporting.
A jump over 4 km is treated as bad data or a reused hex and snapped. Heading is slewed (50 deg/s), pitch comes from
vertical rate and bank from turn rate, both smoothed; the model uses them.

**Data.** `/api/aircraft?lat&lon&radius` (radius in nm, max 450). Up to 150 nm: one anchor snapped to 0.25 degrees.
Up to 450 nm: up to 9 anchors of a fixed 5-degree lattice with 250 nm radius, so different viewers share upstream requests.
Each anchor is cached 10 s and single-flighted; on a failure or a 429 the proxy serves stale data (up to 60 s) and
leaves upstream alone for 20 s. Output is deduplicated by hex (freshest report wins) and capped at 3000, nearest
first. The client sizes the query from the distance to the point the camera looks at, polls every 10 s (rarely when
the tab is hidden) and re-queries after a pan or zoom that leaves the last query's inner area. Above about 3,000 km from the look point nothing is fetched or drawn, silently (internal status `hidden`; no event, no toast). Aircraft on the ground are not drawn (except one
you have selected).

## Ported from the original God's Eye View

Reused in spirit or directly: the type-code classification sets and the per-class model table with measured radii
(`src/data/aircraftClass.js`), the cockpit camera rules (eye just ahead of and above the origin, heading slew, view
pitch; `src/ui/cockpitCamera.js`, `src/cockpitMath.js`), the tracked-camera minimum range and per-frame rebasing
(`src/data/trackedCamera.js`) and the glTF assets with their licence notes. Not carried over: the intelligence and
military layers, vision filters, the HUD instrument panels, Google 3D tiles ground probing, and the Entity-based
tracking (the aircraft are dead-reckoned primitives here, so the camera is driven from the layer's own pose).
Roll in the cockpit view is new.

## Limits

- Data is whatever adsb.lol hears; coverage varies and positions can be seconds old. Altitude is geometric height
  when reported, otherwise barometric, so a low aircraft can sit a few tens of metres off the terrain.
- No route, origin or destination (not available keylessly).
- Model lighting follows the scene's sun, so models look dark on the night side of the globe; the glyphs do not.
- At 3000 aircraft the per-frame update is cheap (about 1 ms CPU in the test browser) but billboard buffers are
  re-uploaded every frame; idle frames are throttled to about 22 Hz, models and tracking run at full rate.
