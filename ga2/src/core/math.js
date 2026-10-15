// Small allocation-free vector and quaternion helpers (Hamilton product, right-handed, -Z forward).
export const v3 = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const set = (o, x, y, z) => { o.x = x; o.y = y; o.z = z; return o; };
export const copy = (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; return o; };
export const len = a => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const dist2 = (a, b) => { const x = a.x - b.x, y = a.y - b.y, z = a.z - b.z; return x * x + y * y + z * z; };
export const dist = (a, b) => Math.sqrt(dist2(a, b));
export const norm = o => { const l = len(o) || 1; o.x /= l; o.y /= l; o.z /= l; return o; };
export const addS = (o, a, s) => { o.x += a.x * s; o.y += a.y * s; o.z += a.z * s; return o; };
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (o, a, b) => set(o, a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const quat = () => ({ x: 0, y: 0, z: 0, w: 1 });
export function qmul(o, a, b) {
  const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y, y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w, w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  o.x = x; o.y = y; o.z = z; o.w = w; return o;
}
export function qaxis(o, ax, ay, az, ang) { const s = Math.sin(ang / 2); o.x = ax * s; o.y = ay * s; o.z = az * s; o.w = Math.cos(ang / 2); return o; }
export function qnorm(q) { const l = Math.hypot(q.x, q.y, q.z, q.w) || 1; q.x /= l; q.y /= l; q.z /= l; q.w /= l; return q; }
export function rot(o, q, vx, vy, vz) {   // o = q * v * q^-1
  const tx = 2 * (q.y * vz - q.z * vy), ty = 2 * (q.z * vx - q.x * vz), tz = 2 * (q.x * vy - q.y * vx);
  return set(o, vx + q.w * tx + q.y * tz - q.z * ty, vy + q.w * ty + q.z * tx - q.x * tz, vz + q.w * tz + q.x * ty - q.y * tx);
}
export function qslerp(o, a, b, t) {
  let bx = b.x, by = b.y, bz = b.z, bw = b.w, c = a.x * bx + a.y * by + a.z * bz + a.w * bw;
  if (c < 0) { c = -c; bx = -bx; by = -by; bz = -bz; bw = -bw; }
  let k0 = 1 - t, k1 = t;
  if (c < 0.9995) { const th = Math.acos(c), s = Math.sin(th); k0 = Math.sin(k0 * th) / s; k1 = Math.sin(k1 * th) / s; }
  o.x = a.x * k0 + bx * k1; o.y = a.y * k0 + by * k1; o.z = a.z * k0 + bz * k1; o.w = a.w * k0 + bw * k1; return qnorm(o);
}
export const qcopy = (o, a) => { o.x = a.x; o.y = a.y; o.z = a.z; o.w = a.w; return o; };
