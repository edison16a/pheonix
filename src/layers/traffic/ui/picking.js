/** Clicking a vehicle or a car badge. */
import { showPick, hidePick, onLeftClick, flyIntoCluster } from '../../shared/ui/index.js';

export function createPicking({ globe }) {
  const scene = globe.viewer.scene;
  let handler = null;

  function onClick(e) {
    const id = scene.pick(e.position)?.id;
    if (id?.kind === 'traffic-cluster') {
      showPick('traffic', `${id.count.toLocaleString()} simulated vehicles`, ['Simulated traffic flow, not live data']);
      flyIntoCluster(globe, id, 350);
    } else if (id?.kind === 'traffic' && !id.simulated) hidePick('traffic');
    else if (id?.kind === 'traffic') showPick('traffic', 'Simulated vehicle', ['Not a real vehicle: simulated flow along this road']);
    else hidePick('traffic');
  }

  return {
    start() {
      handler = onLeftClick(globe, onClick);
    },
    stop() {
      handler?.destroy();
      handler = null;
      hidePick('traffic');
    },
  };
}
