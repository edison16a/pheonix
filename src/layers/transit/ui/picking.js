/** Clicking a transit vehicle or a cluster badge. */
import { showPick, hidePick, onLeftClick, flyIntoCluster } from '../../shared/ui/index.js';

export function createPicking({ globe, state, tracks }) {
  const scene = globe.viewer.scene;
  let handler = null;

  function onClick(e) {
    const id = scene.pick(e.position)?.id;
    if (id?.kind === 'transit-cluster') {
      hidePick('transit');
      flyIntoCluster(globe, id, 400);
      return;
    }
    if (id?.kind !== 'transit') return hidePick('transit');
    const t = tracks.tracks.get(id.trackId);
    if (!t) return;
    const feed = state.summary.feeds.find((f) => f.id === t.feed);
    showPick('transit', t.route ? `Route ${t.route}` : 'Vehicle', [
      [t.label && `${t.label}`, t.speed != null && `${Math.round(t.speed * 3.6)} km/h`].filter(Boolean).join(', ') || 'Live position',
      `${feed?.name || t.feed}${t.age != null ? `, reported ${t.age}s ago` : ''}`,
    ]);
  }

  return {
    start() {
      handler = onLeftClick(globe, onClick);
    },
    stop() {
      handler?.destroy();
      handler = null;
      hidePick('transit');
    },
  };
}
