/**
 * Procedural 3D phoenix MODEL (pure geometry, no renderer): a sculpted body, neck and head with a hooked
 * beak, crest and mane plumes, two wings built from many individually curved and twisted feather blades
 * in layered rows, and a tail of ribbon feathers.
 *
 * Everything is merged into ONE indexed BufferGeometry (one draw call). Vertex attributes:
 *   position, normal, color (linear RGB)
 *   aInfo  (u along feather 0..1, v across -1..1, seed, kind: 0 feather vane, 1 skin, 2 shaft or beak)
 *   aRig   (side +-1 for wings else 0, span 0..1 weight for wing flex, tail wave gain, breath weight)
 *   aStyle (heat or emissive gain, edge-notch amount, rachis brightness, eyespot flag)
 *
 *   const m = buildPhoenixModel();  // { geometry, bounds, triangles, vertices, embers:[[x,y,z,w]] }
 */
import * as THREE from 'three';
import { Acc } from './accumulator.js';
import { buildBody } from './body.js';
import { buildCrest } from './head.js';
import { buildLegs } from './legs.js';
import { buildTail } from './tail.js';
import { buildWing } from './wing.js';

export { SHOULDER } from './wing.js';

/**
 * Builds the whole bird. The order is fixed (tail, legs, wings, body, crest) because each part draws from
 * its own seeded random stream and keeping the vertex order stable keeps the draw identical.
 */
export function buildPhoenixModel() {
  const A = new Acc();
  const embers = [];
  buildTail(A, embers);
  buildLegs(A);
  buildWing(A, false, embers);
  buildWing(A, true, embers);
  buildBody(A, embers);
  buildCrest(A);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(A.info, 4));
  g.setAttribute('aRig', new THREE.Float32BufferAttribute(A.rig, 4));
  g.setAttribute('aStyle', new THREE.Float32BufferAttribute(A.style, 4));
  g.setIndex(new THREE.Uint32BufferAttribute(A.idx, 1));
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return {
    geometry: g,
    bounds: g.boundingBox,
    triangles: A.idx.length / 3,
    vertices: A.n,
    embers,
  };
}
