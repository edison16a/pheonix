/**
 * Layer alias table: add a layer with ONE entry. `words` are the spoken names (normalised);
 * `name` is what actions.setLayer and actions.showLayerIn receive. Earlier entries win, which is
 * why "air traffic" sits before "traffic". It is exported and mutable on purpose so other code
 * (and the tests) can add a layer at runtime.
 */
export const LAYERS = [
  { name: 'aircraft', label: 'aircraft', words: ['aircraft', 'airplane', 'airplanes', 'plane', 'planes', 'flight', 'flights', 'air traffic', 'flight traffic', 'jets'] },
  { name: 'traffic', label: 'traffic', words: ['traffic', 'road traffic', 'congestion', 'cars'] },
  { name: 'transit', label: 'transit', words: ['transit', 'public transport', 'buses', 'bus', 'trains', 'train', 'trams', 'subway', 'metro'] },
  { name: 'labels', label: 'location labels', words: ['location labels', 'place labels', 'map labels', 'labels', 'place names', 'city names'] },
  { name: 'bikes', label: 'bike share', words: ['bike share', 'bike sharing', 'bikes', 'bike', 'bicycles', 'citi bike'] },
];

/** Regex alternation of every layer word, longest first so "air traffic" is tried before "traffic". */
export const layerAlt = () => LAYERS.flatMap((l) => l.words).sort((a, b) => b.length - a.length).join('|');

/** Spoken layer word to the layer name the actions expect. Unknown words mean aircraft. */
export function layerName(raw = 'aircraft') {
  const t = String(raw).toLowerCase();
  for (const l of LAYERS) if (l.words.some((w) => w === t)) return l.name;
  return 'aircraft';
}
