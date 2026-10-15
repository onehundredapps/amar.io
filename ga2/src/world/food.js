// Food orbs. The world is tiled into chunks at a level of detail set by how far you can see; every orb has a fixed home in its
// chunk (same for everyone). Orbs load in even sweeps across the whole view, fade in and out, and once a view has loaded new
// orbs only appear out of sight. Eaten orbs regrow at their spot after 25–45 s, so the galaxy never runs dry.
import { ARENA, FOOD_N, FOOD_TARGET, ZREF, foodRadius, clamp } from '../core/settings.js';
import { hash4, vnoise, rnd } from '../core/rng.js';
import { galaxy, feedingGround } from './galaxy.js';
import { G, myR, feedOrb } from './game.js';
import { GpuArray, material, quadBatch } from '../core/gpu.js';
import { inView } from '../render/camera.js';

const NOFADE = new URLSearchParams(location.search).has('nofade');   // (test hook: headless capture has no frame time)
const C0 = 120, K_MIN = 1, K_MAX = 60000, ST = 12, PP = new BABYLON.Vector3();
export function createFood(scene, engine) {
  const arr = new GpuArray(engine, FOOD_N, ST), D = arr.data;
  const alive = new Uint8Array(FOOD_N), val = new Float32Array(FOOD_N), slotK = new Int32Array(FOOD_N), slotCh = new Array(FOOD_N).fill(null);
  const free = new Int32Array(FOOD_N); let nFree = FOOD_N; for (let i = 0; i < FOOD_N; i++) free[i] = FOOD_N - 1 - i;
  const dying = new Uint8Array(FOOD_N);
  const chunks = new Map();
  let level = -1, K = 24, fillOrder = [], fillIdx = 0, fillCap = 0, refreshT = 0, levelFill = true, accTry = 1, accHit = 0.15;
  const cx = { x: 1e9, y: 1e9, z: 1e9 };
  for (let i = 0; i < FOOD_N; i++) D[i * ST + 8] = 1e9;

  const keyOf = (L, a, b, c) => ((L * 32768 + a + 16384) * 32768 + b + 16384) * 32768 + c + 16384;
  function retire(i, now) { if (!dying[i]) { dying[i] = 1; D[i * ST + 8] = now; arr.dirty = true; } }
  function freeSlot(i) { alive[i] = 0; dying[i] = 0; D[i * ST + 3] = 0; D[i * ST + 8] = 1e9; const ch = slotCh[i]; if (ch) ch.slots.delete(i); slotCh[i] = null; free[nFree++] = i; arr.dirty = true; }
  function unload(ch, now) { for (const i of ch.slots) { slotCh[i] = null; retire(i, now); } ch.slots.clear(); ch.dead = true; chunks.delete(ch.key); }

  function tryCandidate(ch, k, now, noPop, popV2) {
    const C = C0 * 2 ** ch.L, L = ch.L;
    const x = (ch.a + hash4(ch.a, ch.b, ch.c, k * 3 + L * 7)) * C, y = (ch.b + hash4(ch.a, ch.b, ch.c, k * 3 + 1 + L * 7)) * C, z = (ch.c + hash4(ch.a, ch.b, ch.c, k * 3 + 2 + L * 7)) * C;
    accTry++;
    const h = hash4(ch.c, ch.a, ch.b, k + L * 131), g = galaxy(x, y, z), clump = vnoise(x / 2600 + y / 5200, z / 2600);
    if (h > 0.006 + g * (0.1 + 0.9 * clump) * 0.9) return true;   // dense in the arms and the core, sparse pockets everywhere
    accHit++;
    const t = ch.eaten.get(k); if (t !== undefined) { if (now < t) { ch.pending.push(k, t); return true; } ch.eaten.delete(k); }
    if (noPop && G.main) { const dx = x - G.main.p.x, dy = y - G.main.p.y, dz = z - G.main.p.z;
      if (dx * dx + dy * dy + dz * dz < popV2 && inView(x, y, z, 10)) { ch.pending.push(k, now + 0.7); return true; } }   // never born where you can see it
    if (!nFree) return false;
    const i = free[--nFree], o = i * ST, big = hash4(ch.b, ch.c, ch.a, k) < 0.05, fg = feedingGround(x, y, z) > 0.2;
    alive[i] = 1; dying[i] = 0; slotCh[i] = ch; slotK[i] = k; ch.slots.add(i);
    let hue = hash4(ch.b, ch.a, ch.c, k), l = 0.58; if (fg) { hue = 0.1 + 0.05 * hue; l = 0.64; }
    hsl(hue, 1, l, D, o + 4);
    D[o] = x; D[o + 1] = y; D[o + 2] = z; D[o + 3] = big ? 4.2 : 2 + 0.8 * hash4(ch.a, ch.c, ch.b, k); D[o + 7] = now; D[o + 8] = 1e9;
    val[i] = (big ? 45 : 12) * (fg ? 3 : 1);
    arr.dirty = true; return true;
  }
  function refresh(px, py, pz, R, V, now, noPop, popV2) {
    const Lf = Math.log2(Math.min(V, 1.3e6) / (5 * C0));
    let L = level; if (L < 0 || Math.abs(Lf - L) > 0.75) L = clamp(Math.round(Lf), 0, 13);
    const T = FOOD_TARGET * Math.min(1, (Math.max(1, G.zoom) / ZREF) ** 3), C = C0 * 2 ** L;
    if (L !== level) { for (const ch of [...chunks.values()]) unload(ch, now); levelFill = true; level = L; }
    R = Math.min(R, ARENA * 2.4); const AL = (ARENA + C) * (ARENA + C);
    const rng = Math.ceil(R / C) + 1, ga = Math.floor(px / C), gb = Math.floor(py / C), gc = Math.floor(pz / C), lim = R + C * 0.87, want = [];
    for (let a = ga - rng; a <= ga + rng; a++) for (let b = gb - rng; b <= gb + rng; b++) for (let c = gc - rng; c <= gc + rng; c++) {
      const wx = (a + 0.5) * C, wy = (b + 0.5) * C, wz = (c + 0.5) * C; if (wx * wx + wy * wy + wz * wz > AL) continue;
      const x = wx - px, y = wy - py, z = wz - pz, d = Math.sqrt(x * x + y * y + z * z);
      if (d < lim) want.push(d, a, b, c);
    }
    const order = []; for (let i = 0; i < want.length; i += 4) order.push(i); order.sort((p, q) => want[p] - want[q]);
    const keep = new Set();
    fillOrder = [];
    for (const i of order) { const a = want[i + 1], b = want[i + 2], c = want[i + 3], key = keyOf(L, a, b, c); keep.add(key);
      let ch = chunks.get(key); if (!ch) { ch = { key, L, a, b, c, done: 0, slots: new Set(), pending: [], eaten: new Map(), dead: false }; chunks.set(key, ch); } fillOrder.push(ch); }
    for (const ch of [...chunks.values()]) if (!keep.has(ch.key)) unload(ch, now);
    fillIdx = 0; fillCap = 0;
    const n = Math.max(1, fillOrder.length), acc = clamp(accHit / accTry, 0.01, 1);
    if (levelFill && fillOrder.length) K = clamp(Math.ceil(T / n / acc), K_MIN, K_MAX);
    // regrow: retry orbs whose timer is up (or that were waiting to appear out of sight)
    for (const ch of fillOrder) if (ch.pending.length) { const p = ch.pending; ch.pending = []; for (let j = 0; j < p.length; j += 2) { if (now < p[j + 1] || !tryCandidate(ch, p[j], now, noPop, popV2)) ch.pending.push(p[j], p[j + 1]); } }
    // keep about T orbs in view: more candidates per chunk if short, fewer if over
    let owned = FOOD_N - nFree, waiting = 0; for (const ch of fillOrder) waiting += ch.pending.length / 2;
    for (let i = 0; i < FOOD_N; i++) if (dying[i]) owned--;
    let filled = true; for (const ch of fillOrder) if (ch.done < K) { filled = false; break; }
    if (filled && owned + waiting < T * 0.85 && K < K_MAX) K = Math.min(K_MAX, Math.ceil(K * clamp(T / Math.max(owned + waiting, 1), 1.1, 8)));
    else if (owned + waiting > T * 1.2 && K > K_MIN) {
      K = Math.max(K_MIN, Math.floor(K * clamp(T / (owned + waiting), 0.4, 0.9)));
      for (const ch of fillOrder) { for (const i of [...ch.slots]) if (slotK[i] >= K) { ch.slots.delete(i); slotCh[i] = null; retire(i, now); } if (ch.done > K) ch.done = K; }
    }
  }
  function fill(ms, now, noPop, popV2) {
    const t0 = performance.now(), step = Math.max(1, Math.ceil(K / 10)); let n = 0;
    if (fillCap <= 0) fillCap = Math.min(K, step);
    for (;;) {
      const cap = Math.min(K, fillCap);
      while (fillIdx < fillOrder.length) {
        const ch = fillOrder[fillIdx];
        if (ch.dead || ch.done >= cap) { fillIdx++; continue; }
        if (!tryCandidate(ch, ch.done, now, noPop, popV2)) return;
        ch.done++;
        if ((++n & 15) === 0 && performance.now() - t0 > ms) return;
      }
      if (cap >= K) return;
      fillCap = cap + step; fillIdx = 0;
    }
  }

  const mesh = quadBatch(scene, 'orbs', FOOD_N);
  const mat = material(scene, 'orbs', { uniforms: ['uTime', 'uPix', 'uFar', 'uPP', 'uCamD', 'uFadeIn', 'uScale', 'uFarK'], storage: ['orbs'], blend: 'premul', depthWrite: false });
  mat.setStorageBuffer('orbs', arr.buf); mesh.material = mat; mesh.renderingGroupId = 1;

  return {
    mesh, mat, D, alive, get count() { return FOOD_N - nFree; },
    update(now, camDist, pix) {
      const pm = G.main; if (!pm || !G.me || !G.me.cells.length) { arr.upload(); return; }
      const V0 = foodRadius(myR()), V = V0 * Math.max(1, G.zoom), cells = G.me.cells;
      let gx = 0, gy = 0, gz = 0, tm = 0, gR = 0, reachMax = 0;
      for (const c of cells) { gx += c.p.x * c.mass; gy += c.p.y * c.mass; gz += c.p.z * c.mass; tm += c.mass; }
      gx /= tm; gy /= tm; gz /= tm;
      const sc = Math.sqrt(V0 * 2.1 / 750);
      for (const c of cells) { gR = Math.max(gR, Math.hypot(c.p.x - gx, c.p.y - gy, c.p.z - gz) + c.r); reachMax = Math.max(reachMax, c.r + Math.min(c.r * 1.2, 30 * sc) + 10); }
      const filling = fillIdx < fillOrder.length || fillCap < K;
      if (!filling) levelFill = false;
      const noPop = !levelFill && !G.intro, popV2 = (V * 0.86) ** 2;
      refreshT -= G.dt;
      const Cnow = C0 * 2 ** Math.max(0, level);
      if (level < 0 || refreshT <= 0 || Math.hypot(gx - cx.x, gy - cx.y, gz - cx.z) > Cnow * 0.5) { refresh(gx, gy, gz, gR + V, V, now, noPop, popV2); refreshT = 0.25; cx.x = gx; cx.y = gy; cx.z = gz; }
      fill(level < 0 ? 12 : (G.intro ? 9 : 5), now, noPop, popV2);
      // eat and vacuum; finished fade-outs free their slots
      const pk = Math.max(sc, (myR() * 6.8 + 30) * 0.003);
      for (let i = 0; i < FOOD_N; i++) {
        if (!alive[i]) continue; const o = i * ST;
        if (dying[i]) { if (now - D[o + 8] > 1.3) freeSlot(i); continue; }
        const s = pk * D[o + 3];
        let x = D[o], y = D[o + 1], z = D[o + 2];
        const ex = x - gx, ey = y - gy, ez = z - gz, dG = Math.sqrt(ex * ex + ey * ey + ez * ez);
        if (dG > gR + reachMax) continue;
        for (const c of cells) {
          const dx = c.p.x - x, dy = c.p.y - y, dz = c.p.z - z, d = Math.sqrt(dx * dx + dy * dy + dz * dz), reach = c.r + Math.min(c.r * 1.2, 30 * sc) + 10;
          if (d >= reach) continue;
          if (d < c.r + s * 0.5) {   // touched = eaten (growth is still capped by the budget)
            feedOrb(c, val[i]);
            const ch = slotCh[i]; if (ch) { const t = now + rnd(25, 45); ch.eaten.set(slotK[i], t); ch.pending.push(slotK[i], t); }
            freeSlot(i);
          } else {   // vacuum: orbs speed up as they fall in
            const pull = Math.min(d, G.dt * (140 + c.r * 6) * (1.6 - d / reach) * 1.6) / d;
            D[o] = x + dx * pull; D[o + 1] = y + dy * pull; D[o + 2] = z + dz * pull; arr.dirty = true;
          }
          break;
        }
      }
      mat.setFloat('uTime', now); mat.setFloat('uPix', pix); mat.setFloat('uFar', V); PP.set(pm.p.x, pm.p.y, pm.p.z); mat.setVector3('uPP', PP);
      mat.setFloat('uCamD', Math.max(1, camDist)); mat.setFloat('uFadeIn', NOFADE ? 0.0001 : G.intro ? 0.9 : G.zoom > 1.6 ? 1.4 : 2.2);
      mat.setFloat('uScale', pk); mat.setFloat('uFarK', clamp(Math.log(Math.max(1, G.zoom)) / Math.log(Math.max(2, G.zoomMax)), 0, 1));   // far out, each point stands for a crowd: keep the disc from blowing out   // pellets grow with you, like the original game, so they stay visible when you're huge
      arr.upload();
    },
    reset() { for (const ch of [...chunks.values()]) unload(ch, -10); for (let i = 0; i < FOOD_N; i++) if (alive[i]) freeSlot(i); level = -1; levelFill = true; fillOrder = []; fillIdx = 0; fillCap = 0; },
  };
}
function hsl(h, s, l, out, o) {
  const f = n => { const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l); return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
  out[o] = f(0); out[o + 1] = f(8); out[o + 2] = f(4);
}
