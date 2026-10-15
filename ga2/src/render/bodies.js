// Draws every ball, moon, ring, spit blob, star corona, power-up glow and far-off speck from three storage buffers.
// Three draw calls for all of it, refilled from game state each frame into pre-sized arrays.
import { BALL_MAX, RING_MAX, CROWD_N } from '../core/settings.js';
import { G } from '../world/game.js';
import { GpuArray, material, quadBatch, repeatMesh } from '../core/gpu.js';
const B = window.BABYLON;
const GLOW_MAX = 1024;
export function createBodies(scene, engine) {
  const sphere = B.CreateSphereVertexData({ segments: 22, diameter: 2 });
  const balls = repeatMesh(scene, 'balls', { positions: sphere.positions, indices: sphere.indices }, BALL_MAX);
  const ballBuf = new GpuArray(engine, BALL_MAX, 12);
  const ballMat = material(scene, 'planet', { uniforms: ['uVPB', 'uTime', 'uPP', 'uViewR'], storage: ['balls'], blend: 'alpha', depthWrite: true });
  ballMat.setStorageBuffer('balls', ballBuf.buf); ballMat.setFloat('uVPB', balls.vpc); ballMat.backFaceCulling = true;
  balls.mesh.material = ballMat; balls.mesh.renderingGroupId = 1;

  const ringT = { positions: [], indices: [] }, SEG = 96;
  for (let i = 0; i <= SEG; i++) { const a = i / SEG * Math.PI * 2, c = Math.cos(a), s = Math.sin(a); ringT.positions.push(c * 1.32, s * 1.32, 0, c * 2.35, s * 2.35, 0); if (i < SEG) { const v = i * 2; ringT.indices.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); } }
  const rings = repeatMesh(scene, 'rings', ringT, RING_MAX), ringBuf = new GpuArray(engine, RING_MAX, 12);
  const ringMat = material(scene, 'rings', { uniforms: ['uVPR', 'uPP', 'uViewR'], storage: ['rings'], blend: 'alpha', depthWrite: false });
  ringMat.setStorageBuffer('rings', ringBuf.buf); ringMat.setFloat('uVPR', rings.vpc); rings.mesh.material = ringMat; rings.mesh.renderingGroupId = 1;

  const glowBuf = new GpuArray(engine, GLOW_MAX, 8), glowMesh = quadBatch(scene, 'glows', GLOW_MAX);
  const glowMat = material(scene, 'sprites', { uniforms: ['uKind', 'uPix', 'uDpr', 'uShow', 'uTime'], storage: ['sprites'], blend: 'add', depthWrite: false });
  glowMat.setStorageBuffer('sprites', glowBuf.buf); glowMat.setFloat('uKind', 2); glowMat.setFloat('uShow', 1); glowMesh.material = glowMat; glowMesh.renderingGroupId = 1;

  const beaconBuf = new GpuArray(engine, CROWD_N + 600, 8), beaconMesh = quadBatch(scene, 'beacons', CROWD_N + 600);
  const beaconMat = material(scene, 'sprites', { uniforms: ['uKind', 'uPix', 'uDpr', 'uShow', 'uTime'], storage: ['sprites'], blend: 'add', depthWrite: false });
  beaconMat.setStorageBuffer('sprites', beaconBuf.buf); beaconMat.setFloat('uKind', 1); beaconMesh.material = beaconMat; beaconMesh.renderingGroupId = 1;

  let nGlow = 0;
  const PP = new B.Vector3();
  const STAR = [[1, 0.48, 0.25], [1, 0.82, 0.48], [0.66, 0.78, 1]];
  return {
    glow(x, y, z, r, cr, cg, cb, b) { if (nGlow >= GLOW_MAX) return; const o = nGlow++ * 8, d = glowBuf.data; d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = r; d[o + 4] = cr; d[o + 5] = cg; d[o + 6] = cb; d[o + 7] = b; },
    beacons: beaconBuf, beaconMat,
    begin() { nGlow = 0; },
    end(now, pix, viewR) {
      const bd = ballBuf.data, rd = ringBuf.data; let nb = 0, nr = 0;
      const put = (x, y, z, r, design, seed, spin, alpha, own, pulse) => { if (nb >= BALL_MAX) return; const o = nb++ * 12; bd[o] = x; bd[o + 1] = y; bd[o + 2] = z; bd[o + 3] = r; bd[o + 4] = design; bd[o + 5] = seed; bd[o + 6] = spin; bd[o + 7] = alpha; bd[o + 8] = own; bd[o + 9] = pulse; bd[o + 10] = 0; bd[o + 11] = 0; };
      const pm = G.main;
      for (const e of G.ents) {
        const L = e.look, own = e === G.me ? 1 : 0;
        for (const c of e.cells) {
          if (!own && pm && Math.hypot(c.p.x - pm.p.x, c.p.y - pm.p.y, c.p.z - pm.p.z) - c.rr > viewR * 1.05) continue;   // beyond the fog: drawn as a speck instead
          const appear = Math.min(1, (now - c.born) / 0.6);
          put(c.p.x, c.p.y, c.p.z, c.rr * (0.6 + 0.4 * appear), L.design, L.seed, L.spin, 1, own, c.pulse);
          if (L.ring && nr < RING_MAX) { const o = nr++ * 12, t = L.tilt, a = L.seed * 6.283;
            rd[o] = c.p.x; rd[o + 1] = c.p.y; rd[o + 2] = c.p.z; rd[o + 3] = c.rr; rd[o + 4] = Math.sin(t) * Math.cos(a); rd[o + 5] = Math.cos(t); rd[o + 6] = Math.sin(t) * Math.sin(a); rd[o + 7] = L.seed; rd[o + 8] = 1; rd[o + 9] = own; rd[o + 10] = 0; rd[o + 11] = 0; }
          if (L.design === 7) { const s = STAR[L.seed < 0.33 ? 0 : L.seed > 0.75 ? 2 : 1]; this.glow(c.p.x, c.p.y, c.p.z, c.rr * 1.9, s[0], s[1], s[2], 0.5); }
          if (L.moon && c === (e === G.me ? G.main : e.cells[0])) { const a = now * 0.35 + L.seed * 50, R = c.rr * 1.75;
            put(c.p.x + Math.cos(a) * R, c.p.y + Math.sin(a * 0.7) * R * 0.2, c.p.z + Math.sin(a) * R, c.rr * 0.2, L.seed > 0.5 ? 0 : 8, (L.seed * 3) % 1, 0.2, 1, own, 0); }
        }
      }
      for (const b of G.blobs) put(b.p.x, b.p.y, b.p.z, b.r, 0, b.seed, 0.5, 1, b.owner === G.me ? 1 : 0, 0);
      for (let i = nb; i < BALL_MAX; i++) bd[i * 12 + 3] = 0;
      for (let i = nr; i < RING_MAX; i++) rd[i * 12 + 3] = 0;
      const gd = glowBuf.data; for (let i = nGlow; i < GLOW_MAX; i++) gd[i * 8 + 3] = 0;
      ballBuf.dirty = ringBuf.dirty = glowBuf.dirty = true; ballBuf.upload(); ringBuf.upload(); glowBuf.upload(); beaconBuf.upload();
      if (pm) PP.set(pm.p.x, pm.p.y, pm.p.z);
      ballMat.setFloat('uTime', now); ballMat.setVector3('uPP', PP); ballMat.setFloat('uViewR', viewR);
      ringMat.setVector3('uPP', PP); ringMat.setFloat('uViewR', viewR);
      for (const m of [glowMat, beaconMat]) { m.setFloat('uPix', pix); m.setFloat('uDpr', 1); m.setFloat('uTime', now); }
    },
  };
}
