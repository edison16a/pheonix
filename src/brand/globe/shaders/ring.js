import { GRADIENT } from './gradient.js';

/** Comet-tail orbit ring: bright at the spark, fading behind it, dimmer on the far side. */
export const RING_VERT = /* glsl */ `
  varying float vA;
  varying vec3 vViewN;
  varying vec3 vViewPos;
  void main() {
    vA = uv.x;
    vViewN = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vViewPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`;
export const RING_FRAG = /* glsl */ `
  precision highp float;
  uniform float uPhase;
  varying float vA;
  varying vec3 vViewN;
  varying vec3 vViewPos;
  ${GRADIENT}
  void main() {
    float d = fract(uPhase - vA);                  // 0 at the spark, 1 behind it
    float tail = pow(1.0 - d, 1.6);
    float near = smoothstep(-0.7, 0.9, (vViewPos.z + 9.4) / 1.5);
    float a = (0.5 + 0.5 * tail) * (0.5 + 0.5 * near);
    vec3 col = brandGrad(0.05 + 0.7 * d) * 1.12;
    col = mix(col, vec3(1.0, 0.86, 0.5), pow(tail, 6.0) * 0.8);
    gl_FragColor = vec4(col * a, a);
  }
`;

/** The spark riding the ring: one soft round point. */
export const SPARK_FRAG = /* glsl */ `
  precision highp float;
  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float d = length(q) * 2.0;
    float a = smoothstep(1.0, 0.25, d);
    gl_FragColor = vec4(vec3(1.0, 0.82, 0.42) * a, a);
  }
`;
export const SPARK_VERT = /* glsl */ `
  uniform float uSize;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize;
    gl_Position = projectionMatrix * mv;
  }
`;
