// Power-ups at fixed spots around the galaxy: growth ×4 / ×8 / ×16 (green, pink, blue) and speed ×4 / ×8 / ×16 (yellow, orange, red).
// Each lasts 36 s; grabbing another restarts the clock and keeps the stronger one. Spacing follows your size, never the zoom.
import { ARENA, foodRadius, clamp } from '../core/settings.js';
import { hash3 } from '../core/rng.js';
import { G, myR, viewR } from './game.js';
const TYPES = [
  { k: 'grow', x: 4, w: 0.42, c: [0.24, 1, 0.48], n: 'GROWTH ×4' }, { k: 'grow', x: 8, w: 0.055, c: [1, 0.31, 0.85], n: 'GROWTH ×8' }, { k: 'grow', x: 16, w: 0.025, c: [0.25, 0.66, 1], n: 'GROWTH ×16' },
  { k: 'speed', x: 4, w: 0.42, c: [1, 0.88, 0.3], n: 'SPEED ×4' }, { k: 'speed', x: 8, w: 0.055, c: [1, 0.54, 0.12], n: 'SPEED ×8' }, { k: 'speed', x: 16, w: 0.025, c: [1, 0.23, 0.23], n: 'SPEED ×16' }];
const DUR = 36;
export function createPickups(bodies, onPick) {
  const taken = new Map();
  return {
    update(now) {
      const pm = G.main; if (!pm || !G.playing) return;
      const L = clamp(Math.round(Math.log2(foodRadius(myR()) / 600)), 0, 3), P = 120 * 2 ** L * 3.5, R = Math.min(viewR() * 1.1, P * 5);
      const rng = Math.ceil(R / P) + 1, ga = Math.floor(pm.p.x / P), gb = Math.floor(pm.p.y / P), gc = Math.floor(pm.p.z / P);
      const size = 3.2 * Math.max(Math.sqrt(foodRadius(myR()) * 2.1 / 750), (myR() * 6.8 + 30) * 0.003);
      for (let a = ga - rng; a <= ga + rng; a++) for (let b = gb - rng; b <= gb + rng; b++) for (let c = gc - rng; c <= gc + rng; c++) {
        if (hash3(a * 3 + L, b * 5 - L, c * 7 + 11) > 0.5) continue;
        const x = (a + 0.15 + 0.7 * hash3(a, b + 31, c)) * P, y = (b + 0.15 + 0.7 * hash3(b, c + 17, a)) * P, z = (c + 0.15 + 0.7 * hash3(c, a + 5, b)) * P;
        if (x * x + y * y + z * z > ARENA * ARENA * 0.9) continue;
        const dx = x - pm.p.x, dy = y - pm.p.y, dz = z - pm.p.z; if (dx * dx + dy * dy + dz * dz > R * R) continue;
        const key = L + '|' + a + ',' + b + ',' + c, t = taken.get(key); if (t !== undefined && now < t) continue;
        let h = hash3(c + 3, a - 9, b + L), T = TYPES[0]; for (const ty of TYPES) { if (h < ty.w) { T = ty; break; } h -= ty.w; }
        const born = t !== undefined ? Math.min(1, (now - t) / 1.5) : 1;   // a respawned power-up fades back in
        bodies.glow(x, y, z, size * 2.2, T.c[0], T.c[1], T.c[2], 0.9 * born);
        bodies.glow(x, y, z, size * 0.9, 1, 1, 1, 0.6 * born);
        for (const cell of G.me.cells) if (Math.hypot(cell.p.x - x, cell.p.y - y, cell.p.z - z) < cell.r + size * 1.2) {
          taken.set(key, now + 40 + Math.random() * 30);
          if (T.k === 'grow') { G.mult = now < G.multUntil ? Math.max(G.mult, T.x) : T.x; G.multUntil = now + DUR; }
          else { G.speedMult = now < G.speedUntil ? Math.max(G.speedMult, T.x) : T.x; G.speedUntil = now + DUR; }
          cell.pulse = 1; onPick(T); break;
        }
      }
    },
  };
}
