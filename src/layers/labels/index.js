/**
 * Location labels: country names at world zoom, then states/provinces, then cities and
 * towns as you zoom in. Uses Esri's keyless "World Boundaries and Places" reference tiles,
 * which carry that hierarchy natively and are meant to sit on top of satellite imagery.
 */
const REFERENCE_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer';

export const descriptor = {
  id: 'labels',
  label: 'Location labels',
  title: 'Country, state and city names that follow your zoom',
  defaultOn: false,
  icon: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.3"/></svg>',
};

export function create({ globe, bus }) {
  const { viewer, Cesium } = globe;
  let layer = null;
  let enabled = false;
  let loading = null;

  async function ensure() {
    if (layer || loading) return loading;
    loading = Cesium.ArcGisMapServerImageryProvider.fromUrl(REFERENCE_URL, {
      enablePickFeatures: false,
    })
      .then((provider) => {
        if (!enabled) return;
        layer = viewer.scene.imageryLayers.addImageryProvider(provider);
        layer.alpha = 1;
        viewer.scene.requestRender();
      })
      .catch((err) => {
        console.warn('[labels] reference tiles unavailable', err);
        bus?.emit('layer:status', { layer: 'labels', state: 'error' });
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  return {
    setEnabled(on) {
      enabled = on;
      if (on) {
        if (layer) layer.show = true;
        else ensure();
      } else if (layer) {
        layer.show = false;
      }
      viewer.scene.requestRender();
    },
    isEnabled: () => enabled,
    destroy() {
      enabled = false;
      if (layer && !viewer.isDestroyed()) viewer.scene.imageryLayers.remove(layer, true);
      layer = null;
    },
  };
}
