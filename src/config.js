/** Shared application configuration. Everything here is keyless. */
export const APP_NAME = 'Pheonix';

export const IMAGERY_URL =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer';
export const TERRAIN_URL = 'https://terrain.reearth.land/cesium-mesh/ellipsoid';

export const WORLD_VIEW = Object.freeze({
  lon: -30,
  lat: 25,
  height: 13_500_000,
});

export const GEOCODER_URL = 'https://nominatim.openstreetmap.org/search';
