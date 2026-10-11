/**
 * Minimal protobuf wire-format reader (varint, fixed32/64, length-delimited).
 * Enough for Mapbox Vector Tiles and GTFS-realtime without a dependency.
 * Usage: const r = new PbfReader(bytes); while (r.more()) { const [f, w] = r.tag(); ... r.skip(w) }
 */
export class PbfReader {
  constructor(buf, pos = 0, end = buf.length) {
    this.buf = buf;
    this.pos = pos;
    this.end = end;
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  }
  more() {
    return this.pos < this.end;
  }
  varint() {
    // Up to 53 safe bits; high bits of 64-bit values are dropped (we never need them).
    let result = 0;
    let shift = 0;
    for (let k = 0; k < 10; k++) {
      const b = this.buf[this.pos++];
      result += (b & 0x7f) * 2 ** shift;
      if (b < 0x80) return result;
      shift += 7;
    }
    throw new Error('bad varint');
  }
  svarint() {
    const n = this.varint();
    return n % 2 === 1 ? -(n + 1) / 2 : n / 2;
  }
  tag() {
    const v = this.varint();
    return [Math.floor(v / 8), v & 7];
  }
  float() {
    const v = this.view.getFloat32(this.pos, true);
    this.pos += 4;
    return v;
  }
  double() {
    const v = this.view.getFloat64(this.pos, true);
    this.pos += 8;
    return v;
  }
  /** length-delimited payload as a sub-reader */
  sub() {
    const len = this.varint();
    const r = new PbfReader(this.buf, this.pos, this.pos + len);
    this.pos += len;
    return r;
  }
  string() {
    const len = this.varint();
    const s = new TextDecoder().decode(this.buf.subarray(this.pos, this.pos + len));
    this.pos += len;
    return s;
  }
  /** packed repeated varints */
  packed() {
    const r = this.sub();
    const out = [];
    while (r.more()) out.push(r.varint());
    return out;
  }
  skip(wire) {
    if (wire === 0) this.varint();
    else if (wire === 1) this.pos += 8;
    else if (wire === 2) {
      const n = this.varint(); // read first: `pos += varint()` would use the stale pos
      this.pos += n;
    }
    else if (wire === 5) this.pos += 4;
    else throw new Error(`bad wire type ${wire}`);
  }
}
