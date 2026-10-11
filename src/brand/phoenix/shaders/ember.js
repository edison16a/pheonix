/** Ember particles: each point rises along its own life cycle, drifts, shrinks and fades. */
export const EMBER_VERT = /* glsl */ `
  attribute vec4 aSeed;   // x speed, y phase, z drift, w size
  attribute vec3 aOrigin;
  uniform float uTime;
  uniform float uScale;
  varying float vLife;
  void main() {
    float t = fract(uTime * aSeed.x * 0.12 + aSeed.y);
    vec3 p = aOrigin;
    p.y += t * (1.2 + aSeed.x * 1.4);
    p.x += sin(uTime * 0.8 + aSeed.y * 20.0) * 0.18 * t + aSeed.z * t * 0.7;
    p.z += sin(uTime * 0.6 + aSeed.y * 9.0) * 0.12 * t + 0.05;
    vLife = t;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSeed.w * (1.0 - t * 0.65) * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
export const EMBER_FRAG = /* glsl */ `
  precision highp float;
  varying float vLife;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    a *= a * smoothstep(0.0, 0.1, vLife) * (1.0 - smoothstep(0.5, 1.0, vLife));
    vec3 c = mix(vec3(1.0, 0.85, 0.42), vec3(1.0, 0.34, 0.08), vLife);
    gl_FragColor = vec4(c * a, a);
  }
`;
