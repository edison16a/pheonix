/** Clicking a bike station or a cluster badge. */
import { describe, ageText } from '../model.js';
import { showPick, hidePick, onLeftClick, flyIntoCluster } from '../../shared/ui/index.js';

export function createPicking({ globe, state }) {
  const scene = globe.viewer.scene;
  let handler = null;

  function onClick(e) {
    const id = scene.pick(e.position)?.id;
    if (id?.kind === 'bikes-cluster') {
      hidePick('bikes');
      flyIntoCluster(globe, id, 350);
      return;
    }
    if (id?.kind !== 'bikes') return hidePick('bikes');
    const st = state.stations.find((s) => s.id === id.stationId && s.sys === id.sys);
    if (!st) return;
    const sys = state.summary.systems.find((s) => s.id === st.sys);
    showPick('bikes', st.name || 'Bike station', [...describe(st), [sys?.name, ageText(st.at)].filter(Boolean).join(', ')]);
  }

  return {
    start() {
      handler = onLeftClick(globe, onClick);
    },
    stop() {
      handler?.destroy();
      handler = null;
      hidePick('bikes');
    },
  };
}
