// Tiny bloom pipeline: scene target, bright pass with downsample, separable blur at two scales, composite.
export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;
export const BRIGHT_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  varying vec2 vUv;
  void main() {
    vec4 c = (texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)) + texture2D(tSrc, vUv + uTexel * vec2(0.5, -0.5)) +
              texture2D(tSrc, vUv + uTexel * vec2(-0.5, 0.5)) + texture2D(tSrc, vUv + uTexel * vec2(0.5, 0.5))) * 0.25;
    float l = max(c.r, max(c.g, c.b));
    float w = smoothstep(0.55, 1.0, l);
    gl_FragColor = vec4(c.rgb * (0.08 + 0.9 * w), c.a);
  }
`;
export const BLUR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tSrc;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    vec4 s = texture2D(tSrc, vUv) * 0.2270270270;
    s += (texture2D(tSrc, vUv + uDir * 1.3846153846) + texture2D(tSrc, vUv - uDir * 1.3846153846)) * 0.3162162162;
    s += (texture2D(tSrc, vUv + uDir * 3.2307692308) + texture2D(tSrc, vUv - uDir * 3.2307692308)) * 0.0702702703;
    gl_FragColor = s;
  }
`;
export const COMP_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D tScene;
  uniform sampler2D tBloomA;
  uniform sampler2D tBloomB;
  uniform float uBloom;
  varying vec2 vUv;
  void main() {
    vec4 sc = texture2D(tScene, vUv);
    vec3 b = texture2D(tBloomA, vUv).rgb * 0.75 + texture2D(tBloomB, vUv).rgb * 1.05;
    vec3 rgb = sc.rgb + b * uBloom;
    float a = clamp(max(sc.a, max(rgb.r, max(rgb.g, rgb.b))), 0.0, 1.0);
    gl_FragColor = vec4(min(rgb, vec3(a)), a);
  }
`;
