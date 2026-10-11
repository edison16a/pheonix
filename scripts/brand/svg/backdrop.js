/** Dark card gradient and warm glow used behind the globe on the maskable icon and the OG image. */
export const bgDefs = (id) =>
  `<linearGradient id="${id}-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b1210"/><stop offset="1" stop-color="#0a0809"/></linearGradient>` +
  `<radialGradient id="${id}-glow" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="#ff7a1a" stop-opacity=".26"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>`;
