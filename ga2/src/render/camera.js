// Chase camera: trails your heading by a beat, zooms by your size, opens every life with a fly-in from the whole galaxy, slides to
// the nose of your ball (first person) at full zoom-in, can lock its direction (V) or look back (C).
import { ARENA, ZMIN, ZSTART, INTRO, camBase, clamp } from '../core/settings.js';
import { G, myR, totalMass } from '../world/game.js';
import { v3, set, copy, norm, quat, qslerp, qcopy, qmul, qaxis, rot } from '../core/math.js';
const B = window.BABYLON;
export const cam = { cam: null, camQ: quat(), pos: v3(0, 0, 900), look: v3(), tilt: 0.18, dist: 100, back: false };
const planes = new Float32Array(24), F = v3(), U = v3(), T = v3(), Q = quat(), V = new B.Vector3(), UP = new B.Vector3(), TG = new B.Vector3();
let camPf = null;
export function createCamera(scene) {
  const c = new B.TargetCamera('cam', new B.Vector3(0, 0, 900), scene);
  c.fov = 66 * Math.PI / 180; c.minZ = 0.5; c.maxZ = ARENA * 12; c.fovMode = B.Camera.FOVMODE_VERTICAL_FIXED;
  scene.activeCamera = c; cam.cam = c; return c;
}
export function startIntro() {
  G.intro = { t: 0 }; G.zoom = G.zoomTarget = ARENA / 60; cam.tilt = 1.13; qcopy(cam.camQ, G.orient); camPf = null;
}
export function inView(x, y, z, m) { for (let p = 0; p < 24; p += 4) if (planes[p] * x + planes[p + 1] * y + planes[p + 2] * z + planes[p + 3] < -m) return false; return true; }
export function updateCamera(dt, s) {
  const c = cam.cam, m = G.main; if (!c) return;
  if (G.playing && m) {
    const r = myR();
    if (!camPf) camPf = v3(m.p.x, m.p.y, m.p.z); else { const k = 1 - Math.exp(-dt * 9); camPf.x += (m.p.x - camPf.x) * k; camPf.y += (m.p.y - camPf.y) * k; camPf.z += (m.p.z - camPf.z) * k; }
    G.zoomMax = Math.max(1, ARENA / camBase(r));
    if (G.intro) {   // hold the whole galaxy for a beat, then glide in (eased, in zoom-octaves so the pace feels even)
      G.intro.t += dt; const u = clamp((G.intro.t - INTRO.hold) / INTRO.glide, 0, 1), e = u * u * (3 - 2 * u);
      G.zoom = G.zoomTarget = Math.exp(Math.log(G.zoomMax) * (1 - e) + Math.log(ZSTART) * e);
      if (u >= 1) G.intro = null;
    } else {
      G.zoomTarget = clamp(G.zoomTarget, ZMIN, G.zoomMax);
      G.zoom += (G.zoomTarget - G.zoom) * (1 - Math.exp(-dt * 7));
    }
    if (!G.lock) qslerp(cam.camQ, cam.camQ, G.orient, 1 - Math.exp(-dt * 3.5));
    qcopy(Q, cam.camQ); if (s.back) qmul(Q, Q, qaxis(T, 0, 1, 0, Math.PI));
    rot(F, Q, 0, 0, -1); rot(U, Q, 0, 1, 0);
    let spread = 0; for (const cc of G.me.cells) spread = Math.max(spread, Math.hypot(cc.p.x - camPf.x, cc.p.y - camPf.y, cc.p.z - camPf.z) + cc.rr);
    const need = spread > 0 ? spread * 1.25 / Math.tan(c.fov / 2) : 0;
    const dist = Math.max(camBase(r) * G.zoom, need);
    cam.tilt += (0.18 + (G.intro ? 0.95 * Math.max(0, 1 - Math.max(0, G.intro.t - INTRO.hold) / (INTRO.glide * 0.8)) : 0) - cam.tilt) * (1 - Math.exp(-dt * 3));
    set(cam.look, camPf.x, camPf.y, camPf.z);
    set(cam.pos, camPf.x - F.x * dist + U.x * dist * cam.tilt, camPf.y - F.y * dist + U.y * dist * cam.tilt, camPf.z - F.z * dist + U.z * dist * cam.tilt);
    const f = clamp((0.2 - G.zoom) / (0.2 - ZMIN * 1.5), 0, 1), fp = f * f * (3 - 2 * f);   // first person from the nose of your ball
    if (fp > 0) { set(T, m.p.x + F.x * m.rr * 1.04, m.p.y + F.y * m.rr * 1.04, m.p.z + F.z * m.rr * 1.04); cam.pos.x += (T.x - cam.pos.x) * fp; cam.pos.y += (T.y - cam.pos.y) * fp; cam.pos.z += (T.z - cam.pos.z) * fp;
      const L = m.rr * 40 + 400; cam.look.x += (T.x + F.x * L - cam.look.x) * fp; cam.look.y += (T.y + F.y * L - cam.look.y) * fp; cam.look.z += (T.z + F.z * L - cam.look.z) * fp; }
    cam.dist = Math.hypot(cam.pos.x - m.p.x, cam.pos.y - m.p.y, cam.pos.z - m.p.z);
    c.minZ = clamp(Math.max(r * 0.04, dist * 0.01) * (G.zoom < 0.2 ? 0.25 : 1), 0.05, 30000);
  } else {   // attract mode: a slow orbit around the biggest thing in the galaxy
    cam.orbit = (cam.orbit || 0) + dt * 0.05; let best = null;
    for (const e of G.ents) for (const cc of e.cells) if (!best || cc.mass > best.mass) best = cc;
    const P = best ? best.p : v3(), R = best ? best.rr * 3.2 + 60 : 1e5;
    set(T, P.x + Math.cos(cam.orbit) * R, P.y + R * 0.4, P.z + Math.sin(cam.orbit) * R);
    cam.pos.x += (T.x - cam.pos.x) * (1 - Math.exp(-dt * 1.2)); cam.pos.y += (T.y - cam.pos.y) * (1 - Math.exp(-dt * 1.2)); cam.pos.z += (T.z - cam.pos.z) * (1 - Math.exp(-dt * 1.2));
    copy(cam.look, P); set(U, 0, 1, 0); c.minZ = 1;
  }
  c.position.set(cam.pos.x, cam.pos.y, cam.pos.z); UP.set(U.x, U.y, U.z); c.upVector.copyFrom(UP);
  TG.set(cam.look.x, cam.look.y, cam.look.z); c.setTarget(TG);
  c.getViewMatrix(true);
  // frustum planes for "is this spot on screen?" checks
  const pl = B.Frustum.GetPlanes(c.getTransformationMatrix(true));
  for (let i = 0; i < 6; i++) { const p = pl[i]; planes[i * 4] = p.normal.x; planes[i * 4 + 1] = p.normal.y; planes[i * 4 + 2] = p.normal.z; planes[i * 4 + 3] = p.d; }
}
