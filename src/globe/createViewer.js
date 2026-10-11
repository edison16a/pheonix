import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import { IMAGERY_URL, TERRAIN_URL } from '../config.js';

/**
 * Builds the fullscreen Cesium viewer on keyless satellite imagery and terrain.
 * Cesium's own chrome is switched off because Pheonix draws its own glass controls.
 * Rendering is on demand (see keepAlive.js), which saves a lot of GPU time while idle.
 */
export async function createViewer(container) {
  const viewer = new Cesium.Viewer(container, {
    baseLayer: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    requestRenderMode: true,
    maximumRenderTimeChange: Infinity,
    msaaSamples: 4,
    contextOptions: { webgl: { powerPreference: 'high-performance' } },
  });

  const scene = viewer.scene;
  scene.globe.enableLighting = false;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#0b0d12');
  scene.skyAtmosphere.show = true;
  scene.screenSpaceCameraController.minimumZoomDistance = 80;
  scene.screenSpaceCameraController.maximumZoomDistance = 40_000_000;
  scene.globe.maximumScreenSpaceError = 2;
  // Keep the horizon crisp on a big display without paying for retina-x2.
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);

  await addImagery(scene);
  addTerrain(scene);
  return viewer;
}

/** Esri satellite imagery, with OpenStreetMap tiles as the fallback if Esri is down. */
async function addImagery(scene) {
  try {
    const imagery = await Cesium.ArcGisMapServerImageryProvider.fromUrl(IMAGERY_URL, {
      enablePickFeatures: false,
    });
    scene.imageryLayers.addImageryProvider(imagery);
  } catch (err) {
    console.warn('[globe] Esri imagery unavailable, using OpenStreetMap', err);
    scene.imageryLayers.addImageryProvider(
      new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' }),
    );
  }
}

/** Terrain loads in the background: a terrain failure must never block the globe. */
function addTerrain(scene) {
  Cesium.CesiumTerrainProvider.fromUrl(TERRAIN_URL)
    .then((terrain) => {
      scene.terrainProvider = terrain;
      scene.requestRender();
    })
    .catch((err) => console.warn('[globe] terrain unavailable', err));
}
