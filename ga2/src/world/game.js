// Gameplay: players and bots made of cells, steering, splitting, spitting, merging, eating each other, and the bot crowd.
import { ARENA, BOT_TARGET, BOT_MAX_MASS, MAX_CELLS, ZSTART, rad, agarSpeed, speedOf, viewRadius, mergeTime, clamp } from '../core/settings.js';
import { strHash, rnd, randUnit, randInSphere } from '../core/rng.js';
import { v3, set, copy, dist, dist2, norm, addS, quat, qmul, qaxis, qnorm, rot, cross, dot } from '../core/math.js';
import { randInGalaxy } from './galaxy.js';

export const G = {
  now: 0, dt: 0, playing: false, me: null, main: null, ents: [], blobs: [],
  zoom: ZSTART, zoomTarget: ZSTART, zoomMax: 1, intro: null, lock: false,
  mult: 1, multUntil: 0, speedMult: 1, speedUntil: 0, allow: 0,
  stats: { peak: 0, eaten: 0, orbs: 0, start: 0 }, killer: '',
  orient: quat(), yawVel: 0, pitchVel: 0, dir: v3(0, 0, -1),
  onDeath: null, onFeed: null,
};
const NAMES = ['Nucleus', 'Blobfather', 'Mitochondria', 'xX_Orb_Xx', 'Plasma', 'Gloop', 'Photon', 'Axolotl', 'Nebula', 'Bubbles', 'Quasar', 'Jellyfish',
  'Snacc', 'Void Kid', 'Chonk', 'Zygote', 'Neutrino', 'Glowworm', 'Ooze', 'Pulsar', 'Moonpie', 'Amoeba', 'Sphere Lord', 'Wobble', 'Kraken', 'Protozoa', 'Big Mood', 'Tardigrade'];
const GIANTS = [['LEVIATHAN', 800000], ['THE VOID WHALE', 420000], ['GARGANTUA', 250000], ['Ω TITAN', 3000000], ['Ω TITAN', 1500000], ['BEHEMOTH', 112000]];
const COLOSSI = ['COLOSSUS', 'WORLD EATER', 'THE ABYSS'];
let idSeq = 0;
const T1 = v3(), T2 = v3(), T3 = v3(), Q1 = quat();

export function lookFor(key) {
  const h = strHash(String(key)), design = h % 10, seed = ((h >>> 5) % 1000) / 1000;
  return { design, seed, spin: (0.08 + ((h >>> 9) % 100) / 100 * 0.22) * ((h >>> 4) & 1 ? 1 : -1),
    ring: design === 4 || ((design === 3 || design === 5 || design === 9) && (h >>> 13) % 3 === 0), tilt: 0.25 + ((h >>> 15) % 100) / 100 * 0.5,
    moon: design !== 7 && (h >>> 17) % 4 === 0 };
}
export function makeEnt(kind, name, key) {
  const e = { id: ++idSeq, kind, name, look: lookFor(key || kind + idSeq + Math.random()), cells: [], dir: randUnit(v3()), throttle: 1, think: Math.random(), wander: randUnit(v3()), wanderT: 0, giant: false, colossus: false, near: false };
  G.ents.push(e); return e;
}
export function addCell(e, x, y, z, mass) {
  const c = { e, p: v3(x, y, z), v: v3(), mass, r: rad(mass), rr: rad(mass) * 0.6, mergeAt: 0, noCollide: 0, pulse: 0, born: G.now };
  e.cells.push(c); return c;
}
export const totalMass = e => { let m = 0; for (const c of e.cells) m += c.mass; return m; };
export const mainOf = e => { let b = null; for (const c of e.cells) if (!b || c.mass > b.mass) b = c; return b; };
export const myR = () => (G.me && G.me.cells.length ? rad(totalMass(G.me)) : 5);
export const viewR = () => viewRadius(myR()) * Math.max(1, G.zoom);
function removeEnt(e) { const i = G.ents.indexOf(e); if (i >= 0) G.ents.splice(i, 1); e.cells.length = 0; }

/* ---------------- player ---------------- */
export function spawnPlayer(name, key) {
  if (G.me) removeEnt(G.me);
  const me = G.me = makeEnt('me', name, key), p = v3();
  for (let k = 0; k < 60; k++) { randInGalaxy(ARENA * 0.85, p); if (!G.ents.some(e => e.giant && e.cells.length && dist(mainOf(e).p, p) < mainOf(e).r * 1.6 + 6000)) break; }
  G.main = addCell(me, p.x, p.y, p.z, 12);
  // face the galactic centre to start
  set(T1, -p.x, -p.y * 0.2, -p.z); norm(T1);
  const yaw = Math.atan2(-T1.x, -T1.z), pitch = Math.asin(clamp(T1.y, -1, 1));
  qaxis(G.orient, 0, 1, 0, yaw); qmul(G.orient, G.orient, qaxis(Q1, 1, 0, 0, pitch));
  G.yawVel = G.pitchVel = 0; G.allow = 0; G.mult = 1; G.multUntil = 0; G.speedMult = 1; G.speedUntil = 0;
  G.stats = { peak: 12, eaten: 0, orbs: 0, start: performance.now() }; G.killer = '';
  G.playing = true;
  return me;
}
// steering: turn about your own axes, ease in/out, and gently level the horizon unless you're pointed straight up or down
export function steer(s, dt) {
  const acc = 1 - Math.exp(-dt * 4);
  G.yawVel += (s.yaw * 1.35 - G.yawVel) * acc; G.pitchVel += (s.pitch * 1.0 - G.pitchVel) * acc;
  qmul(G.orient, G.orient, qaxis(Q1, 0, 1, 0, G.yawVel * dt));
  qmul(G.orient, G.orient, qaxis(Q1, 1, 0, 0, G.pitchVel * dt));
  const f = rot(T1, G.orient, 0, 0, -1), u = rot(T2, G.orient, 0, 1, 0);
  if (Math.abs(f.y) < 0.9) {
    set(T3, -f.x * f.y, 1 - f.y * f.y, -f.z * f.y); norm(T3);   // world-up projected onto the plane facing you
    const ang = Math.atan2(dot(cross(v3(), u, T3), f), dot(u, T3));
    qmul(G.orient, G.orient, qaxis(Q1, 0, 0, 1, ang * (1 - Math.exp(-dt * 1.5))));
  }
  qnorm(G.orient); rot(G.dir, G.orient, 0, 0, -1);
  if (G.me) copy(G.me.dir, G.dir);
}

/* ---------------- movement ---------------- */
function move(e, dt) {
  const m = e === G.me && G.main && e.cells.includes(G.main) ? G.main : mainOf(e); if (!m) return;
  const ax = m.p.x + e.dir.x * (m.r * 6 + 60), ay = m.p.y + e.dir.y * (m.r * 6 + 60), az = m.p.z + e.dir.z * (m.r * 6 + 60);
  const whole = e.kind === 'me' ? totalMass(e) : 0;
  for (const c of e.cells) {
    const dx = ax - c.p.x, dy = ay - c.p.y, dz = az - c.p.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const sp = (e.colossus ? c.r * 0.03 : e.giant ? Math.max(agarSpeed(c.mass), c.r * 0.12) : e.kind === 'me' ? Math.max(speedOf(c.mass), speedOf(whole)) : agarSpeed(c.mass)) * e.throttle * Math.min(1, d / (c.r + 10) + 0.35);
    if (d > 0.001) { const k = sp * dt / d; c.p.x += dx * k; c.p.y += dy * k; c.p.z += dz * k; }
    addS(c.p, c.v, dt); const damp = Math.exp(-3 * dt); c.v.x *= damp; c.v.y *= damp; c.v.z *= damp;
    const L = Math.sqrt(c.p.x * c.p.x + c.p.y * c.p.y + c.p.z * c.p.z), lim = ARENA - c.r * 0.4;
    if (L > lim) { const k = lim / L; c.p.x *= k; c.p.y *= k; c.p.z *= k; }
    if (!e.giant && c.mass > 500) c.mass -= c.mass * 0.0002 * dt;
    c.r = rad(c.mass); c.rr += (c.r - c.rr) * Math.min(1, dt * 4); c.pulse *= Math.exp(-dt * 4);
  }
  const cs = e.cells;   // own cells: push apart until merge time, then merge
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i], b = cs[j]; if (a.dead || b.dead) continue;
    const d = dist(a.p, b.p), rs = a.r + b.r; if (d >= rs) continue;
    if (G.now > a.mergeAt && G.now > b.mergeAt) {
      if (d < Math.max(a.r, b.r) * 0.75) { const [big, small] = b === G.main ? [b, a] : a === G.main ? [a, b] : a.mass >= b.mass ? [a, b] : [b, a]; big.mass += small.mass; big.r = rad(big.mass); big.pulse = 0.6; small.dead = true; }
      else { const k = dt * 1.5; set(T1, (b.p.x - a.p.x) * k, (b.p.y - a.p.y) * k, (b.p.z - a.p.z) * k); addS(a.p, T1, 1); addS(b.p, T1, -1); }
    } else if (G.now > a.noCollide && G.now > b.noCollide) {
      const push = (rs - d) * Math.min(1, dt * 12); set(T1, b.p.x - a.p.x, b.p.y - a.p.y, b.p.z - a.p.z); if (d < 0.001) randUnit(T1); norm(T1);
      const wa = b.mass / (a.mass + b.mass); addS(a.p, T1, -push * wa); addS(b.p, T1, push * (1 - wa));
    }
  }
  for (let i = cs.length - 1; i >= 0; i--) if (cs[i].dead) cs.splice(i, 1);
}
export function split(e, aim) {
  const list = [...e.cells].sort((a, b) => b.mass - a.mass); let did = false;
  for (const c of list) {
    if (e.cells.length >= MAX_CELLS) break; if (c.mass < 36) continue;
    set(T1, aim.x - c.p.x, aim.y - c.p.y, aim.z - c.p.z); if (dist2(aim, c.p) < 1e-6) copy(T1, e.dir); norm(T1);
    const half = c.mass / 2; c.mass = half; c.r = rad(half);
    const n = addCell(e, c.p.x + T1.x * c.r * 0.3, c.p.y + T1.y * c.r * 0.3, c.p.z + T1.z * c.r * 0.3, half);
    n.rr = c.rr * 0.8; set(n.v, T1.x, T1.y, T1.z); const k = 110 + n.r * 16; n.v.x *= k; n.v.y *= k; n.v.z *= k;
    n.mergeAt = c.mergeAt = G.now + mergeTime(c.mass * 2); n.noCollide = G.now + 0.45; n.pulse = c.pulse = 1; did = true;
  }
  return did;
}
export function spit(e, aim) {
  for (const c of e.cells) {
    if (c.mass < 35) continue;
    set(T1, aim.x - c.p.x, aim.y - c.p.y, aim.z - c.p.z); norm(T1); c.mass -= 16; c.r = rad(c.mass);
    const k = 140 + c.r * 3;
    G.blobs.push({ p: v3(c.p.x + T1.x * (c.r + 3), c.p.y + T1.y * (c.r + 3), c.p.z + T1.z * (c.r + 3)), v: v3(T1.x * k, T1.y * k, T1.z * k), mass: 13, r: rad(13), owner: e, born: G.now, seed: Math.random() });
  }
}
// burst one ball into up to 8 pieces (three spits from you do this to anything bigger)
function popCell(e, c) {
  const n = Math.min(8, MAX_CELLS - e.cells.length + 1); if (n < 2) return false;
  const piece = c.mass / n, R0 = c.r; c.mass = piece; c.r = rad(piece); c.pulse = 1; c.mergeAt = G.now + mergeTime(piece * n);
  for (let k = 1; k < n; k++) { randUnit(T1); const q = addCell(e, c.p.x + T1.x * R0 * 0.5, c.p.y + T1.y * R0 * 0.5, c.p.z + T1.z * R0 * 0.5, piece); const s = 110 + R0 * 6; set(q.v, T1.x * s, T1.y * s, T1.z * s); q.mergeAt = c.mergeAt; q.noCollide = G.now + 0.45; q.pulse = 1; }
  return true;
}

/* ---------------- who eats whom ---------------- */
const ALL = [];
function interactions() {
  ALL.length = 0; for (const e of G.ents) for (const c of e.cells) ALL.push(c);
  for (const a of ALL) {
    if (a.dead) continue;
    for (const b of ALL) {
      if (b === a || b.e === a.e || b.dead || b.mass < a.mass * 1.25 || (G.intro && a.e === G.me)) continue;
      const lim = b.r - a.r * 0.35; if (lim <= 0) continue;
      if (dist2(a.p, b.p) < lim * lim) {
        a.dead = true; const g = a.mass * (b.e === G.me ? 1.5 : 1); b.mass += g; b.r = rad(b.mass); b.pulse = 1;
        if (b.e === G.me && G.onFeed && g > totalMass(G.me) * 0.08) G.onFeed(`Ate ${a.e.name}`, g);
        if (b.e === G.me) G.stats.eaten++;
        if (a.e === G.me) G.killer = b.e.name;
        break;
      }
    }
  }
  for (const e of G.ents) for (let i = e.cells.length - 1; i >= 0; i--) if (e.cells[i].dead) e.cells.splice(i, 1);
  for (let i = G.ents.length - 1; i >= 0; i--) { const e = G.ents[i]; if (!e.cells.length && e.kind !== 'me') G.ents.splice(i, 1); }
  // spit blobs: anyone can swallow them; three from you burst a bigger ball apart
  for (let i = G.blobs.length - 1; i >= 0; i--) {
    const b = G.blobs[i]; addS(b.p, b.v, G.dt); const damp = Math.exp(-3 * G.dt); b.v.x *= damp; b.v.y *= damp; b.v.z *= damp;
    let gone = G.now - b.born > 40;
    if (!gone) for (const c of ALL) {
      if (c.dead || c.mass < 20 || (c.e === b.owner && G.now - b.born < 1.2) || dist2(c.p, b.p) > c.r * c.r) continue;
      c.mass += b.mass; c.pulse = 0.4; gone = true;
      if (c.e !== b.owner && b.owner === G.me && c.mass >= 150) { c.spitN = G.now - (c.spitT || -99) < 10 ? (c.spitN || 0) + 1 : 1; c.spitT = G.now; if (c.spitN >= 3) { c.spitN = 0; if (popCell(c.e, c) && G.onFeed) G.onFeed(`POP! ${c.e.name} burst apart`, 0); } }
      break;
    }
    if (gone) G.blobs.splice(i, 1);
  }
}

/* ---------------- bots ---------------- */
function spawnBot(near) {
  const me = G.me, mm = me && me.cells.length ? totalMass(me) : 12, pm = G.main || mainOf(me);
  const e = makeEnt('bot', NAMES[Math.floor(Math.random() * NAMES.length)]);
  const k = Math.random(); let m;
  if (k < 0.45) m = clamp(mm * rnd(0.08, 0.5), 10, 3000); else if (k < 0.7) m = rnd(12, 120); else if (k < 0.9) m = Math.min(BOT_MAX_MASS, mm * rnd(1.4, 5)); else m = rnd(6000, 150000);
  const p = v3();
  if (near && pm) { randUnit(T1); const D = viewR() * rnd(1.15, 1.9) + rad(m); set(p, pm.p.x + T1.x * D, pm.p.y + T1.y * D, pm.p.z + T1.z * D); e.near = true; }
  else randInGalaxy(ARENA * 0.9, p);
  if (Math.hypot(p.x, p.y, p.z) > ARENA * 0.95) { const s = ARENA * 0.9 / Math.hypot(p.x, p.y, p.z); p.x *= s; p.y *= s; p.z *= s; }
  addCell(e, p.x, p.y, p.z, m); return e;
}
function spawnGiant(i) {
  const [name, m] = GIANTS[i % GIANTS.length], e = makeEnt('bot', name); e.giant = true;
  const p = randInSphere(ARENA * 0.75, v3()); addCell(e, p.x, p.y, p.z, m); return e;
}
function spawnColossus(i) {
  const e = makeEnt('bot', COLOSSI[i % 3]); e.giant = e.colossus = true;
  const p = randInSphere(ARENA * 0.8, v3()); addCell(e, p.x, p.y, p.z, (ARENA / 20 / 1.5) ** 2 * rnd(0.6, 1.1)); return e;
}
let crowdT = 0;
export function ensureBots(dt) {
  crowdT -= dt; if (crowdT > 0) return; crowdT = 0.5;
  let giants = 0, colossi = 0, near = 0; const pm = G.main, V = viewR();
  for (const e of G.ents) { if (e.colossus) colossi++; else if (e.giant) giants++; else if (e.kind === 'bot' && pm && e.cells.length && dist(mainOf(e).p, pm.p) < V * 2.6) near++; }
  while (colossi < 3) spawnColossus(colossi++);
  while (giants < GIANTS.length) spawnGiant(giants++);
  if (!pm) return;
  let added = 0; while (near < BOT_TARGET && added < 12) { spawnBot(true); near++; added++; }
  for (let i = G.ents.length - 1; i >= 0; i--) {   // bots left far behind leave (out of sight); giants are brought back near you
    const e = G.ents[i]; if (e.kind !== 'bot' || !e.cells.length) continue; const m = mainOf(e), d = dist(m.p, pm.p);
    if (!e.giant && d > V * 3.4) G.ents.splice(i, 1);
    else if (e.giant && !e.colossus && d > 70000) { randUnit(T1); const D = Math.max(V * 1.6 + m.r, 16000) + rnd(0, 40000); set(m.p, pm.p.x + T1.x * D, pm.p.y + T1.y * D, pm.p.z + T1.z * D); }
  }
}
function think(e) {
  const m = mainOf(e); if (!m) return;
  const sense = viewRadius(m.r) * (e.giant ? 0.6 : 1.1);
  let flee = null, fd = 1e18, prey = null, pd = 1e18;
  for (const o of G.ents) {
    if (o === e || !o.cells.length) continue;
    for (const c of o.cells) {
      const d = dist2(c.p, m.p); if (d > sense * sense) continue;
      if (c.mass > m.mass * 1.25 && d < fd) { fd = d; flee = c; }
      else if (m.mass > c.mass * 1.25 && d < pd && !(e.giant && o === G.me && Math.random() < 0.6)) { pd = d; prey = c; }
    }
  }
  if (flee && Math.sqrt(fd) < sense * 0.7) { set(e.dir, m.p.x - flee.p.x, m.p.y - flee.p.y, m.p.z - flee.p.z); norm(e.dir); e.throttle = 1; return; }
  if (prey) { set(e.dir, prey.p.x + prey.e.dir.x * prey.r - m.p.x, prey.p.y + prey.e.dir.y * prey.r - m.p.y, prey.p.z + prey.e.dir.z * prey.r - m.p.z); norm(e.dir); e.throttle = 1;
    if (!e.giant && Math.sqrt(pd) < m.r * 3 && m.mass > prey.mass * 2.6 && Math.random() < 0.08) split(e, prey.p); return; }
  e.wanderT -= 0.4; if (e.wanderT <= 0) { e.wanderT = rnd(3, 7); randUnit(e.wander); if (e.near && G.main) { set(T1, G.main.p.x - m.p.x, G.main.p.y - m.p.y, G.main.p.z - m.p.z); norm(T1); addS(e.wander, T1, 0.6); norm(e.wander); } }
  copy(e.dir, e.wander); e.throttle = 0.7;
}

/* ---------------- one simulation step ---------------- */
export function stepWorld(dt) {
  G.dt = dt; G.now += dt;
  for (const e of G.ents) {
    if (e.kind === 'bot') { e.think -= dt; if (e.think <= 0) { e.think = rnd(0.3, 0.5); think(e); } for (const c of e.cells) if (!e.giant && c.mass < BOT_MAX_MASS) c.mass += Math.pow(c.mass, 0.6) * 0.012 * dt; }
    move(e, dt);
  }
  interactions();
  if (G.me) {
    const tm = totalMass(G.me);
    if (G.main && !G.me.cells.includes(G.main)) G.main = mainOf(G.me);
    if (tm > G.stats.peak) G.stats.peak = tm;
    const gRate = (1.06 * Math.pow(tm, 0.7) + 4.8) * (G.now < G.multUntil ? G.mult : 1);   // growth budget: orbs can't grow you faster than this
    G.allow = Math.min(G.allow + gRate * dt, gRate * 1.5 + 4);
    if (G.playing && !G.me.cells.length) { G.playing = false; if (G.onDeath) G.onDeath(); }
  }
}
// orbs call this: returns the mass actually gained (the budget keeps growth gradual)
export function feedOrb(c, val) {
  const valK = 1 + myR() / 30, g0 = Math.min(val * valK * 4.8, c.mass * 0.2 + 2) * (G.now < G.multUntil ? G.mult : 1);
  const gain = Math.max(0, Math.min(g0, G.allow)); G.allow -= gain; c.mass += gain; c.pulse = Math.max(c.pulse, 0.35); G.stats.orbs++;
  return gain;
}
