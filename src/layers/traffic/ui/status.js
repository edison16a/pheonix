/** What the traffic layer tells the user and the bus: the chip text and 'layer:status' events. */
import { createNote, createStatusEmitter } from '../../shared/ui/index.js';
import { SIM_LABEL } from '../policy.js';

/** Plain-language age of the NYC feed's newest reading, e.g. "12 min" or "5 h". */
const feedAge = (min) => (min >= 90 ? `${Math.round(min / 60)} h` : `${min} min`);

export function createStatus({ bus, state, store }) {
  const note = createNote('traffic', 'Traffic');
  const out = createStatusEmitter(bus, 'traffic');

  /** Refresh the chip and the bus status from the current vehicle population. */
  function publish() {
    const { vehicles } = store;
    const { live } = state;
    const simCount = vehicles.reduce((n, v) => n + (v.road.live ? 0 : 1), 0);
    const liveCount = vehicles.length - simCount;
    state.status = { state: 'ok', simulated: simCount > 0, live: live.links.length > 0 };
    // The only chip: shown while simulated vehicles are on screen (and the NYC live note when relevant).
    if (live.links.length) {
      note.set('live', `Live speeds: NYC DOT, ${live.links.length} road links. Simulated flow on other roads`);
    } else if (simCount > 0) {
      const why = live.stale != null ? ` (NYC DOT feed ${feedAge(live.stale)} old)` : '';
      note.set('sim', `${SIM_LABEL}${why}`);
    } else note.hide();
    if (!vehicles.length) return;
    out.emit('ok', {
      count: vehicles.length, simulated: simCount > 0, live: live.links.length, liveVehicles: liveCount,
    });
  }

  return {
    emit: out.emit,
    publish,
    zoomIn() {
      note.hide();
      state.status = { state: 'zoom-in', simulated: false };
      out.emit('zoom-in');
    },
    /** Layer switched off: no chip, and the next status is announced afresh. */
    reset() {
      out.reset();
      note.hide();
      state.status = { state: 'idle', simulated: false };
    },
    destroy: () => note.destroy(),
  };
}
