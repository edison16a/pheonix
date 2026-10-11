/**
 * Live aircraft layer (secondary, off by default).
 *
 *  - Data: viewport-scoped /api/aircraft (adsb.lol), refreshed every 10 s (feed/).
 *  - Motion: every aircraft is dead-reckoned every frame between refreshes and
 *    corrections glide in (motion/).
 *  - Look: glowing, altitude-tinted glyphs that grow with zoom; real 3D models
 *    when the camera is close (render/).
 *  - Click an aircraft: glass card with Follow (chase camera) and Cockpit
 *    (view from the nose, banking with the aircraft); Esc / Stop returns to the
 *    free camera (tracking/, card/).
 *
 * This file only wires those pieces together; see docs/AIRCRAFT.md.
 */
import '../../styles/aircraft.css';
import { createCard, summarize } from './card/index.js';
import { createFrameLoop } from './controller/frameLoop.js';
import { createInput } from './controller/input.js';
import { createLookup } from './controller/lookup.js';
import { createSelection, normId } from './controller/selection.js';
import { createBatchHandler, createFeed } from './feed/index.js';
import { createRenderer } from './render/index.js';
import { createTracker } from './tracking/index.js';

export const descriptor = {
  id: 'aircraft',
  label: 'Aircraft',
  title: 'Live aircraft',
  icon: '<svg viewBox="0 0 24 24"><path d="M10.5 13.5 3 11l1-2 8 .5 4-5 2 1-2.5 5.5 4.5 1.5v2l-6-.5-2 5-2-.5z"/></svg>',
};

export function create({ globe, bus }) {
  const { viewer, Cesium } = globe;
  const scene = viewer.scene;
  /** Everything the controller modules share. They read and write it directly. */
  const state = {
    enabled: false,
    renderer: null,
    tracker: null,
    feed: null,
    card: null,
    selectedId: null,
    trackedMode: null, // 'follow' | 'cockpit' | null
    shown: 0,
    status: 'idle',
    readyWaiters: [],
  };

  const emit = (detail) => {
    state.status = detail.state;
    bus?.emit('layer:status', { layer: 'aircraft', ...detail });
  };

  const selection = createSelection({ state, bus, scene });
  const { select, deselect, startTracking, stopTracking } = selection;
  const batch = createBatchHandler({ state, emit, deselect });
  const frameLoop = createFrameLoop({ state, scene, bus, deselect });
  const input = createInput({
    state,
    viewer,
    Cesium,
    select,
    deselect,
    stopTracking,
  });
  const lookup = createLookup({ state, globe });

  function enable() {
    state.renderer = createRenderer({ viewer, Cesium });
    state.tracker = createTracker({
      viewer,
      Cesium,
      getEntry: (id) => state.renderer?.get(id),
      onStopped: selection.onTrackerStopped,
    });
    state.card = createCard(document.getElementById('ui') || document.body, {
      onFollow: () =>
        state.trackedMode === 'follow'
          ? stopTracking()
          : startTracking(state.selectedId, 'follow'),
      onCockpit: () =>
        state.trackedMode === 'cockpit'
          ? stopTracking()
          : startTracking(state.selectedId, 'cockpit'),
      onStop: () => stopTracking(),
      onClose: () => deselect(),
    });
    state.feed = createFeed({
      globe,
      onBatch: batch.onBatch,
      onStatus: batch.onStatus,
      getTrackedCenter: () => {
        const t = state.tracker.current();
        return t ? state.renderer.get(t.id)?.motion.pose : null;
      },
    });
    scene.preUpdate.addEventListener(frameLoop.onPreUpdate);
    input.attach();
    frameLoop.start();
    state.feed.start();
  }

  function disable() {
    for (const w of state.readyWaiters.splice(0)) w(false);
    state.feed?.stop();
    frameLoop.stop();
    input.detach();
    if (!scene.isDestroyed())
      scene.preUpdate.removeEventListener(frameLoop.onPreUpdate);
    if (!viewer.isDestroyed()) state.tracker?.dispose();
    state.card?.destroy();
    state.renderer?.dispose();
    state.renderer = state.tracker = state.feed = state.card = null;
    state.selectedId = null;
    state.trackedMode = null;
    state.shown = 0;
    state.status = 'idle';
    bus?.emit('aircraft:track', { id: null, mode: null });
    if (!viewer.isDestroyed()) scene.requestRender();
  }

  const api = {
    setEnabled(on) {
      on = !!on;
      if (on === state.enabled) return;
      state.enabled = on;
      if (on) enable();
      else disable();
    },
    isEnabled: () => state.enabled,
    count: () => state.shown,
    status: () => state.status,
    destroy() {
      if (state.enabled) {
        state.enabled = false;
        disable();
      }
    },
    /** Follow (chase camera) an aircraft by hex id. Returns false if it is not currently known. */
    track: (id) => startTracking(id, 'follow'),
    /** View from inside the aircraft (defaults to the selected one). */
    cockpit: (id) => startTracking(id, 'cockpit'),
    /** Back to the free camera (restores the view from before tracking). */
    stopTracking: (opts) => stopTracking(opts),
    nearestTo: lookup.nearestTo,
    nearest: (lon, lat) => lookup.nearestTo(lon, lat),
    /**
     * Resolves true once a data batch for the current view has arrived, false on
     * timeout or if the layer is off. Forces a refresh so the batch matches the view now.
     */
    whenReady(timeoutMs = 8000) {
      if (!state.enabled) return Promise.resolve(false);
      return new Promise((resolve) => {
        const done = (v) => {
          clearTimeout(timer);
          const i = state.readyWaiters.indexOf(done);
          if (i >= 0) state.readyWaiters.splice(i, 1);
          resolve(v);
        };
        const timer = setTimeout(() => done(false), timeoutMs);
        state.readyWaiters.push(done);
        state.feed?.refresh({ force: true });
      });
    },
    randomInView: lookup.randomInView,
    /** The tracked aircraft ({..., mode}) or null. */
    getTracked() {
      const t = state.tracker?.current();
      if (!t) return null;
      return { ...summarize(state.renderer.get(t.id)), mode: t.mode };
    },
    /** Select (open the card for) an aircraft without moving the camera. */
    select: (id) => (state.renderer ? select(normId(id)) : false),
    /** Zoom the follow camera by a factor (<1 closer). Returns false when not following. */
    zoomTracked: (factor) => !!state.tracker?.zoomFollow(factor),
    /** Force a data refresh now (also used by tests). */
    refreshNow: () => state.feed?.refresh({ force: true }),
    /** Internals for debugging and tests. */
    _debug: () => ({
      renderer: state.renderer,
      tracker: state.tracker,
      feed: state.feed,
      card: state.card,
    }),
  };
  return api;
}
