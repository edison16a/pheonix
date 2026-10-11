/**
 * Keyless live vehicle-position feeds. Every endpoint below was fetched without
 * credentials and decoded successfully on 2026-10-11 (see docs/LAYERS.md).
 * Order matters only for the coverage list shown to users.
 *
 * kind: 'bus' | 'rail' | 'tram' | 'ferry' | 'other' (feeds that mix modes and do not say which)
 */
import { decodeVehiclePositions } from './gtfsrt.js';

/** A plain GTFS-realtime feed. These do not say what kind of vehicle it is, so the kind is 'other'. */
const rt = (id, name, city, bbox, url, attribution) => ({
  id, name, city, bbox, url, attribution, format: 'gtfsrt',
  parse: (bytes) => decodeVehiclePositions(bytes).map((v) => ({ ...v, kind: 'other' })),
});

/** MBTA v3 JSON:API, with route type from the included routes. */
function parseMbta(json) {
  const type = new Map((json.included || []).filter((x) => x.type === 'route').map((r) => [r.id, r.attributes]));
  const out = [];
  for (const v of json.data || []) {
    const a = v.attributes || {};
    if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) continue;
    const routeId = v.relationships?.route?.data?.id || '';
    const r = type.get(routeId) || {};
    out.push({
      id: v.id, lat: a.latitude, lon: a.longitude, bearing: a.bearing ?? null, speed: a.speed ?? null,
      route: r.short_name || r.long_name || routeId, label: a.label || '',
      ts: a.updated_at ? Math.floor(Date.parse(a.updated_at) / 1000) : 0,
      kind: r.type === 3 ? 'bus' : r.type === 0 ? 'tram' : r.type === 4 ? 'ferry' : r.type === 1 || r.type === 2 ? 'rail' : 'other',
    });
  }
  return out;
}

/** SEPTA TransitView: vehicles grouped by route. */
function parseSeptaBuses(json) {
  const out = [];
  for (const group of json.routes || [])
    for (const [route, list] of Object.entries(group))
      for (const v of list) {
        const lat = Number(v.lat);
        const lon = Number(v.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        out.push({
          id: v.VehicleID || v.label, lat, lon, bearing: Number.isFinite(+v.heading) ? +v.heading : null,
          speed: null, route, label: v.destination || '', ts: v.timestamp || 0, kind: 'bus',
        });
      }
  return out;
}

/** SEPTA TrainView: a flat list of trains. */
function parseSeptaRail(json) {
  const out = [];
  for (const v of Array.isArray(json) ? json : []) {
    const lat = Number(v.lat);
    const lon = Number(v.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: `rr${v.trainno}`, lat, lon, bearing: Number.isFinite(+v.heading) ? +v.heading : null,
      speed: null, route: v.line || '', label: v.dest || '', ts: 0, kind: 'rail',
    });
  }
  return out;
}

/** Finnish VR trains (Digitraffic). Speed arrives in km/h and is converted to m/s. */
function parseDigitraffic(json) {
  const out = [];
  for (const t of Array.isArray(json) ? json : []) {
    const [lon, lat] = t.location?.coordinates || [];
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({
      id: `${t.trainNumber}-${t.departureDate}`, lat, lon, bearing: null,
      speed: Number.isFinite(t.speed) ? t.speed / 3.6 : null, route: `Train ${t.trainNumber}`, label: '',
      ts: t.timestamp ? Math.floor(Date.parse(t.timestamp) / 1000) : 0, kind: 'rail',
    });
  }
  return out;
}

export const FEEDS = [
  { id: 'mbta', name: 'MBTA', city: 'Boston', bbox: [-71.9, 41.8, -70.6, 42.9], format: 'json', parse: parseMbta,
    url: 'https://api-v3.mbta.com/vehicles?include=route&fields%5Bvehicle%5D=latitude,longitude,bearing,speed,label,updated_at,route&fields%5Broute%5D=type,short_name,long_name',
    attribution: 'MBTA V3 API' },
  { id: 'septa-bus', name: 'SEPTA buses and trolleys', city: 'Philadelphia', bbox: [-76.2, 39.6, -74.5, 40.5], format: 'json', parse: parseSeptaBuses,
    url: 'https://www3.septa.org/api/TransitViewAll/index.php', attribution: 'SEPTA TransitView' },
  { id: 'septa-rail', name: 'SEPTA Regional Rail', city: 'Philadelphia', bbox: [-76.2, 39.6, -74.5, 40.5], format: 'json', parse: parseSeptaRail,
    url: 'https://www3.septa.org/api/TrainView/index.php', attribution: 'SEPTA TrainView' },
  rt('ttc', 'TTC', 'Toronto', [-79.8, 43.5, -79.0, 43.95], 'https://bustime.ttc.ca/gtfsrt/vehicles', 'Toronto Transit Commission'),
  rt('edmonton', 'Edmonton Transit', 'Edmonton', [-113.8, 53.3, -113.2, 53.7], 'https://gtfs.edmonton.ca/TMGTFSRealTimeWebService/Vehicle/VehiclePositions.pb', 'City of Edmonton Open Data'),
  rt('calgary', 'Calgary Transit', 'Calgary', [-114.3, 50.8, -113.8, 51.3], 'https://data.calgary.ca/download/am7c-qe3u/application%2Foctet-stream', 'City of Calgary Open Data'),
  rt('kcm', 'King County Metro', 'Seattle', [-122.6, 47.0, -121.8, 47.9], 'https://s3.amazonaws.com/kcm-alerts-realtime-prod/vehiclepositions.pb', 'King County Metro'),
  rt('metrotransit', 'Metro Transit', 'Minneapolis-St Paul', [-93.6, 44.6, -92.7, 45.2], 'https://svc.metrotransit.org/mtgtfs/vehiclepositions.pb', 'Metro Transit'),
  rt('rtd', 'RTD', 'Denver', [-105.5, 39.4, -104.4, 40.2], 'https://www.rtd-denver.com/files/gtfs-rt/VehiclePosition.pb', 'Regional Transportation District'),
  rt('seq', 'TransLink', 'Brisbane', [152.0, -28.5, 153.8, -26.2], 'https://gtfsrt.api.translink.com.au/api/realtime/SEQ/VehiclePositions', 'TransLink Queensland (CC BY 4.0)'),
  rt('adelaide', 'Adelaide Metro', 'Adelaide', [138.3, -35.4, 139.0, -34.5], 'https://gtfs.adelaidemetro.com.au/v1/realtime/vehicle_positions', 'Adelaide Metro (CC BY 4.0)'),
  rt('entur', 'Entur', 'Norway', [4.0, 57.5, 31.5, 71.5], 'https://api.entur.io/realtime/v1/gtfs-rt/vehicle-positions', 'Entur (NLOD)'),
  rt('hsl', 'HSL', 'Helsinki', [23.5, 59.9, 25.9, 61.3], 'https://realtime.hsl.fi/realtime/vehicle-positions/v2/hsl', 'HSL / Digitransit (CC BY 4.0)'),
  rt('ovapi', 'OVapi', 'Netherlands', [3.0, 50.7, 7.3, 53.6], 'https://gtfs.ovapi.nl/nl/vehiclePositions.pb', 'OVapi / NDOV'),
  { id: 'vr', name: 'VR trains', city: 'Finland', bbox: [19.0, 59.5, 32.0, 70.5], format: 'json', parse: parseDigitraffic,
    url: 'https://rata.digitraffic.fi/api/v1/train-locations/latest/', attribution: 'Fintraffic / digitraffic.fi (CC BY 4.0)' },
];

/** Look a feed up by its id (undefined if unknown). */
export const feedById = (id) => FEEDS.find((f) => f.id === id);
