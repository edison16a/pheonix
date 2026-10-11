/**
 * Collects every vertex of the bird into flat arrays so it can become ONE BufferGeometry (one draw call).
 * While `mirror` is on, x is flipped and triangle winding reversed, so one wing definition builds both wings.
 */
export class Acc {
  constructor() {
    this.pos = [];
    this.col = [];
    this.info = [];
    this.rig = [];
    this.style = [];
    this.idx = [];
    this.n = 0;
    this.mirror = false;
  }
  vert(p, c, info, rig, style) {
    const m = this.mirror ? -1 : 1;
    if (p.isVector3) this.pos.push(p.x * m, p.y, p.z);
    else this.pos.push(p[0] * m, p[1], p[2]);
    this.col.push(c[0], c[1], c[2]);
    this.info.push(info[0], info[1], info[2], info[3]);
    this.rig.push(rig[0], rig[1], rig[2], rig[3]);
    this.style.push(style[0], style[1], style[2], style[3]);
    return this.n++;
  }
  tri(a, b, c) {
    if (this.mirror) this.idx.push(a, c, b);
    else this.idx.push(a, b, c);
  }
}
