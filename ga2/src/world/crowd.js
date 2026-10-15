// The far-off crowd: thousands of wandering balls kept as bare positions (no AI, no mesh) so the whole galaxy looks inhabited
// from a distance. One that comes near you is swapped for a real bot of the same size and colour.
import { ARENA, CROWD_N, BOT_TARGET, BOT_MAX_MASS, rad, agarSpeed, viewRadius, clamp } from '../core/settings.js';
import { rnd, randUnit, randInSphere } from '../core/rng.js';
import { randInGalaxy } from './galaxy.js';
import { G, makeEnt, addCell, mainOf, myR, viewR } from './game.js';
const NAMES = ['Drifter', 'Stray', 'Wanderer', 'Nomad', 'Comet', 'Rogue', 'Pilgrim', 'Voyager'];
export function createCrowd(bodies) {
  const B = bodies.beacons, D = B.data, dir = new Float32Array(CROWD_N * 3), mass = new Float32Array(CROWD_N), hue = new Float32Array(CROWD_N), v = { x: 0, y: 0, z: 0 };
  let cursor = 0, show = 0;
  function seed(i, far) {
    for (let k = 0; k < 12; k++) { Math.random() < 0.55 ? randInGalaxy(ARENA * 0.92, v) : randInSphere(ARENA * 0.9, v); if (!far || !G.main || Math.hypot(v.x - G.main.p.x, v.y - G.main.p.y, v.z - G.main.p.z) > viewR() * 8 + 20000) break; }
    const o = i * 8; D[o] = v.x; D[o + 1] = v.y; D[o + 2] = v.z;
    randUnit(v); dir[i * 3] = v.x; dir[i * 3 + 1] = v.y; dir[i * 3 + 2] = v.z;
    const r = Math.random(); mass[i] = r < 0.5 ? rnd(30, 400) : r < 0.8 ? rnd(400, 6000) : r < 0.95 ? rnd(6000, 60000) : rnd(60000, 400000); hue[i] = Math.random();
    D[o + 3] = rad(mass[i]); hslInto(hue[i], D, o + 4); D[o + 7] = 1;
  }
  for (let i = 0; i < CROWD_N; i++) seed(i, false);
  return {
    update(dt) {
      const STEP = 6, pm = G.main, cap = BOT_TARGET + 60;
      let real = 0; for (const e of G.ents) if (e.kind === 'bot' && !e.giant) real++;
      for (let q = 0; q < CROWD_N / STEP; q++) {
        const i = cursor = (cursor + 1) % CROWD_N, o = i * 8, sp = agarSpeed(mass[i]) * dt * STEP;
        let x = D[o] + dir[i * 3] * sp, y = D[o + 1] + dir[i * 3 + 1] * sp, z = D[o + 2] + dir[i * 3 + 2] * sp;
        if (x * x + y * y + z * z > ARENA * ARENA * 0.85) { const L = Math.hypot(x, y, z); dir[i * 3] = -x / L; dir[i * 3 + 1] = -y / L; dir[i * 3 + 2] = -z / L; }
        D[o] = x; D[o + 1] = y; D[o + 2] = z;
        if (pm && G.playing) { const R = viewRadius(myR()) * 2.6 + D[o + 3], dx = x - pm.p.x, dy = y - pm.p.y, dz = z - pm.p.z;
          if (dx * dx + dy * dy + dz * dz < R * R) { if (real < cap) { const e = makeEnt('bot', NAMES[i % NAMES.length]); e.look.design = (hue[i] * 10) | 0; addCell(e, x, y, z, Math.min(mass[i], BOT_MAX_MASS)); real++; } seed(i, true); } }
      }
      // specks for real balls too far off to draw, after the crowd's own slots
      let n = CROWD_N; const lim = CROWD_N + 600, V = viewR();
      for (const e of G.ents) { if (e === G.me || e.near) continue; for (const c of e.cells) { if (n >= lim) break; if (pm && Math.hypot(c.p.x - pm.p.x, c.p.y - pm.p.y, c.p.z - pm.p.z) < V * 0.9) continue;
        const o = n++ * 8; D[o] = c.p.x; D[o + 1] = c.p.y; D[o + 2] = c.p.z; D[o + 3] = c.rr; hslInto((e.look.seed * 7) % 1, D, o + 4); D[o + 7] = 1; } }
      for (let i = n; i < lim; i++) D[i * 8 + 3] = 0;
      B.dirty = true;
      show += ((G.playing ? clamp((G.zoom - 5) / 8, 0, 1) : 1) - show) * Math.min(1, dt * 2);
      bodies.beaconMat.setFloat('uShow', show);
    },
  };
}
function hslInto(h, out, o) { const s = 0.95, l = 0.56, f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); }; out[o] = f(0); out[o + 1] = f(8); out[o + 2] = f(4); }
