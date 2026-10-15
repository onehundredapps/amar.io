// The map is a spiral galaxy: a disc with a bright bulge and two winding arms, a faint halo, and wide golden feeding grounds
// above and below the plane (orbs there are worth three times as much).
import { ARENA } from '../core/settings.js';
import { hash3, randInSphere } from '../core/rng.js';
const FEED = (() => { const a = []; for (let i = 0; i < 40; i++) {
  const u = hash3(i, 11, 3) * 2 - 1, t = hash3(i, 5, 17) * Math.PI * 2, rr = (0.22 + 0.6 * hash3(i, 23, 9)) * ARENA, sq = Math.sqrt(1 - u * u);
  let y = u * rr; if (Math.abs(y) < 0.1 * ARENA) y = (y < 0 ? -1 : 1) * (0.1 + 0.12 * hash3(i, 2, 2)) * ARENA;
  const sg = (0.035 + 0.04 * hash3(i, 7, 29)) * ARENA; a.push(sq * Math.cos(t) * rr, y, sq * Math.sin(t) * rr, 1 / (2 * sg * sg)); } return new Float64Array(a); })();
export function feedingGround(x, y, z) {
  let d = 0;
  for (let n = 0; n < FEED.length; n += 4) { const dx = x - FEED[n], dy = y - FEED[n + 1], dz = z - FEED[n + 2], q = (dx * dx + dy * dy + dz * dz) * FEED[n + 3]; if (q < 9) d += 0.45 * Math.exp(-q); }
  return d;
}
export function galaxy(x, y, z) {
  const r = Math.sqrt(x * x + z * z) / ARENA, yy = y / ARENA, h = 0.035 + 0.11 * Math.exp(-r * 4.5);
  const arm = 0.5 + 0.5 * Math.cos(2 * (Math.atan2(z, x) - Math.log(r + 0.04) * 3.4));
  const disc = Math.exp(-(yy * yy) / (h * h)) * Math.exp(-r * 2.1) * 1.9 * (0.22 + 0.78 * arm * arm);
  const bulge = Math.exp(-(r * r + yy * yy * 3) / 0.014);
  return Math.min(1, disc + bulge + 0.04 * Math.exp(-Math.hypot(r, yy) * 3) + feedingGround(x, y, z));
}
export function randInGalaxy(R, o) {
  for (let k = 0; k < 80; k++) { randInSphere(R, o); o.y *= 0.3; if (galaxy(o.x, o.y, o.z) > 0.12 + Math.random() * 0.5) break; }
  return o;
}
