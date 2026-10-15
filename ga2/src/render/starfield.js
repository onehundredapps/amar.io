// The galaxy itself, star by star: a fixed cloud of points laid along the arms, bulge and halo, with dark dust lanes on the inner
// edge of each arm and pink star-forming knots. Built once at load into a storage buffer; costs one draw call.
import { ARENA, STAR_N } from '../core/settings.js';
import { randInSphere, vnoise } from '../core/rng.js';
import { galaxy } from '../world/galaxy.js';
import { GpuArray, material, quadBatch } from '../core/gpu.js';
export function createStarfield(scene, engine) {
  const arr = new GpuArray(engine, STAR_N, 8), d = arr.data, v = { x: 0, y: 0, z: 0 };
  let n = 0, guard = 0;
  while (n < STAR_N && guard++ < STAR_N * 60) {
    let x, y, z; const halo = Math.random() < 0.07;
    if (halo) { randInSphere(ARENA * 0.95, v); x = v.x; y = v.y * 0.7; z = v.z; }
    else { const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * ARENA * 0.92; x = Math.cos(a) * rr; z = Math.sin(a) * rr;
      const h = (0.03 + 0.11 * Math.exp(-rr / ARENA * 4.5)) * ARENA; y = (Math.random() + Math.random() + Math.random() - 1.5) * h * 1.7; }
    const r = Math.sqrt(x * x + z * z) / ARENA, g = galaxy(x, y * 0.5, z);
    let cr, cg, cb, size, b;
    if (!halo) {
      const ph = 2 * (Math.atan2(z, x) - Math.log(r + 0.04) * 3.4), nz = vnoise(x / ARENA * 14 + 40, z / ARENA * 14 + 40) * 0.6 + vnoise(x / ARENA * 40, z / ARENA * 40) * 0.4;
      const lane = Math.max(0, Math.cos(ph + 1.15)) ** 3 * Math.min(1, r / 0.12) * (0.5 + nz);
      if (Math.random() > g * (1 - 0.92 * Math.min(1, lane)) * (0.55 + 0.9 * nz)) continue;
      const knot = Math.max(0, Math.cos(ph)) ** 6 * (vnoise(x / ARENA * 60 + 9, z / ARENA * 60 + 9) > 0.72 ? 1 : 0) * (r > 0.12 ? 1 : 0);
      const t = Math.min(1, Math.max(0, (r - 0.06) / 0.3)), k = Math.random();
      cr = 1 - 0.38 * t; cg = 0.82 - 0.04 * t; cb = 0.55 + 0.45 * t;
      if (knot && k < 0.6) { cr = 1; cg = 0.38; cb = 0.62; } else if (k < 0.08) { cr = 1; cg = 0.55; cb = 0.35; } else if (k < 0.2) { cr = (cr + 1) / 2; cg = (cg + 1) / 2; cb = (cb + 1) / 2; }
      b = (0.35 + 0.65 * Math.random() ** 3) * (knot ? 1.5 : 1) * 0.62; size = knot ? 2.6 : 1 + 1.6 * Math.random() ** 6;
    } else { if (Math.random() > 0.25 + g) continue; b = (0.25 + 0.3 * Math.random()) * 0.62; cr = 1; cg = 0.9; cb = 0.8; size = 1; }
    const o = n * 8; d[o] = x; d[o + 1] = y; d[o + 2] = z; d[o + 3] = size; d[o + 4] = cr; d[o + 5] = cg; d[o + 6] = cb; d[o + 7] = b; n++;
  }
  arr.upload();
  const mesh = quadBatch(scene, 'stars', STAR_N), mat = material(scene, 'sprites', { uniforms: ['uKind', 'uPix', 'uDpr', 'uShow', 'uTime'], storage: ['sprites'], blend: 'add', depthWrite: false });
  mat.setStorageBuffer('sprites', arr.buf); mat.setFloat('uKind', 0); mat.setFloat('uShow', 1);
  mesh.material = mat; mesh.renderingGroupId = 1;
  return { mesh, mat, count: n };
}
