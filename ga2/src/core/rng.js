// Deterministic hashes (the world is the same for everyone) and a few random-direction helpers.
export function hash3(a, b, c) {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export const hash4 = (a, b, c, k) => hash3(a + k * 7919, b - k * 104729, c + k * 1299709);
export function strHash(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const rnd = (a, b) => a + Math.random() * (b - a);
export function randUnit(o) { const u = rnd(-1, 1), t = rnd(0, Math.PI * 2), s = Math.sqrt(1 - u * u); o.x = s * Math.cos(t); o.y = u; o.z = s * Math.sin(t); return o; }
export function randInSphere(R, o) { randUnit(o); const k = R * Math.cbrt(Math.random()); o.x *= k; o.y *= k; o.z *= k; return o; }
// smooth 2D value noise for star-cloud structure
export function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  return (hash3(ix, iz, 7) * (1 - ux) + hash3(ix + 1, iz, 7) * ux) * (1 - uz) + (hash3(ix, iz + 1, 7) * (1 - ux) + hash3(ix + 1, iz + 1, 7) * ux) * uz;
}
