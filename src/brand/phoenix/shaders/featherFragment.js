/**
 * Fragment shader for the bird: notched, barbed, shafted feather vanes (alpha to coverage), skin and beak,
 * a flame flicker travelling up each feather, key, rim and fill lights, fresnel rim, back-light
 * translucency, then ACES tone mapping and sRGB encoding (the renderer itself does no colour conversion).
 */
export const FEATHER_FRAG = /* glsl */ `
  precision highp float;
  uniform float uTime;
  uniform vec3 uCam;
  uniform float uGlow;
  varying vec3 vN;
  varying vec3 vW;
  varying vec3 vCol;
  varying vec4 vInfo;
  varying vec4 vStyle;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }

  void main() {
    float u = vInfo.x, v = vInfo.y, seed = vInfo.z, kind = vInfo.w;
    float heat = vStyle.x, notch = vStyle.y, rachisAmt = vStyle.z, eyespot = vStyle.w;
    vec3 N = normalize(vN);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(uCam - vW);
    vec3 col = vCol;
    float m = abs(v);
    float alpha = 1.0;
    float spec = 0.35;
    float shaft = 0.0;

    if (kind < 0.5) {
      // ---- feather vane: notched, barbed, shafted
      float G = 6.0 + seed * 7.0;
      float ph = fract(u * G - m * 0.95 + (v > 0.0 ? 0.43 : 0.0) + seed * 5.0);
      float depth = notch * 0.62 * smoothstep(0.18, 0.95, u) * ph * ph * smoothstep(0.1, 0.5, u + 0.25);
      float d = (1.0 - depth) - m;
      float fw = fwidth(m) * 1.6 + 1e-4;
      alpha = smoothstep(0.0, fw, d);
      if (alpha < 0.01) discard;
      float barb = sin(u * 95.0 - m * 22.0 + seed * 30.0);
      float streak = vnoise(vec2(u * 46.0 + seed * 9.0, v * 7.0));
      col *= 0.9 + 0.08 * barb + 0.16 * (streak - 0.5);
      // roots sit under the feathers above them: ambient-occlusion-style darkening gives the layers depth
      col *= mix(0.32, 1.0, smoothstep(0.0, 0.42, u + 0.08 * (1.0 - m)));
      // edges burn deeper
      col = mix(col, col * vec3(1.0, 0.62, 0.42), smoothstep(0.5, 1.0, m) * 0.55);
      // shaft
      shaft = (1.0 - smoothstep(0.0, 0.085, m)) * rachisAmt;
      col = mix(col, vec3(1.0, 0.74, 0.34) * 1.05, shaft * 0.55);
      spec = 0.28 + 0.5 * shaft;
      if (eyespot > 0.5) {
        vec2 q = vec2((u - 0.8) / 0.075, v / 0.6);
        float r = length(q);
        vec3 ring = mix(vec3(1.0, 0.7, 0.2), vec3(0.95, 0.22, 0.06), smoothstep(0.55, 1.0, r));
        ring = mix(vec3(0.09, 0.012, 0.006), ring, smoothstep(0.22, 0.4, r));
        col = mix(col, ring, (1.0 - smoothstep(0.92, 1.12, r)) * 0.95);
      }
    } else if (kind < 1.5) {
      float sc = vnoise(vec2(u * 70.0, v * 22.0));
      col *= 0.9 + 0.18 * sc;
      spec = 0.3;
    } else if (kind < 2.5) {
      spec = 0.9;
    } else {
      spec = 1.8;
    }

    // ---- flame flicker travelling up the feather
    float fl = vnoise(vec2(u * 3.6 - uTime * 1.5, seed * 17.0 + v * 1.1));
    float fl2 = vnoise(vec2(u * 9.0 - uTime * 2.6, seed * 31.0));
    float tip = smoothstep(0.4, 1.0, u);
    float heatNow = heat * (0.55 + 0.75 * fl + 0.25 * fl2) * (0.4 + 0.6 * tip);
    col = mix(col, vec3(1.0, 0.7, 0.22) * 1.1, clamp(tip * (fl - 0.35) * 0.7 * heat, 0.0, 0.4) * (kind < 0.5 ? 1.0 : 0.0));

    // ---- lighting: key / rim / fill + hemisphere
    vec3 L1 = normalize(vec3(-0.5, 0.75, 0.85));
    vec3 L2 = normalize(vec3(0.8, 0.35, -0.7));
    vec3 L3 = normalize(vec3(0.6, -0.6, 0.6));
    float d1 = max(0.0, (dot(N, L1) + 0.3) / 1.3);
    float d2 = max(0.0, (dot(N, L2) + 0.2) / 1.2);
    float d3 = max(0.0, dot(N, L3));
    float hemi = 0.5 + 0.5 * N.y;
    vec3 light = vec3(1.0, 0.9, 0.78) * d1 * 0.95 + vec3(1.0, 0.42, 0.1) * d2 * 1.15 + vec3(0.9, 0.3, 0.1) * d3 * 0.25 +
                 mix(vec3(0.18, 0.05, 0.03), vec3(0.45, 0.22, 0.12), hemi);
    vec3 H = normalize(L1 + V);
    float s1 = pow(max(dot(N, H), 0.0), 56.0) * spec;
    vec3 H2 = normalize(L2 + V);
    float s2 = pow(max(dot(N, H2), 0.0), 40.0) * spec * 0.8;
    float ndv = max(dot(N, V), 0.0);
    float fres = pow(1.0 - ndv, 3.0);
    vec3 rim = vec3(1.0, 0.6, 0.2) * fres * (0.55 + 0.45 * heat);
    // light bleeding through thin vanes
    float tr = (max(dot(-N, L2), 0.0) * 0.55 + max(dot(-N, L1), 0.0) * 0.25) * (kind < 0.5 ? 1.0 : 0.3);
    vec3 trans = col * vec3(1.2, 0.45, 0.12) * tr;
    vec3 emissive = col * (0.07 + heatNow * 0.24) * uGlow;

    vec3 outc = col * light * 0.42 + emissive + rim * 0.45 + vec3(1.0, 0.86, 0.62) * (s1 + s2) * 0.6 + trans * 0.6;
    outc = toSRGB(aces(outc * 0.86));
    gl_FragColor = vec4(outc, alpha);
  }
`;
