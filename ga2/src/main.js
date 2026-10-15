// Galaxy Arena 2 — entry point and frame orchestration. Each system owns its own state; this file only wires them together,
// times them (F1), and runs them in order every frame.
import { Q, IS_TOUCH, ARENA, clamp, fmt } from './core/settings.js';
import { input, readSteer } from './core/input.js';
import { perf, tic, toc, frameDone, drawOverlay } from './core/perf.js';
import { loadShader, material } from './core/gpu.js';
import { G, spawnPlayer, steer, stepWorld, ensureBots, split, spit, myR, viewR, totalMass } from './world/game.js';
import { createFood } from './world/food.js';
import { createCrowd } from './world/crowd.js';
import { createPickups } from './world/pickups.js';
import { createCamera, updateCamera, startIntro, cam } from './render/camera.js';
import { createStarfield } from './render/starfield.js';
import { createBodies } from './render/bodies.js';
import { initHud, updateHud, message, showHint, toggleHint } from './ui/hud.js';
const B = window.BABYLON, $ = id => document.getElementById(id);
const loading = t => { $('loadTxt').textContent = t; };

async function boot() {
  if (!navigator.gpu) { $('loading').classList.add('hidden'); $('nogpu').classList.remove('hidden'); return; }
  const canvas = $('c');
  const engine = new B.WebGPUEngine(canvas, { antialias: true, stencil: false, powerPreference: 'high-performance' });
  loading('Starting the GPU…'); await engine.initAsync();
  engine.setHardwareScalingLevel(1 / Math.min(devicePixelRatio || 1, 2));
  const scene = new B.Scene(engine); scene.useRightHandedSystem = true; scene.clearColor = new B.Color4(0, 0, 0, 1);
  scene.skipPointerMovePicking = true; scene.skipFrustumClipping = true;
  loading('Compiling shaders…');
  await Promise.all(['planet', 'orbs', 'sprites', 'sky', 'rings'].map(n => loadShader(n)));
  const camera = createCamera(scene);
  const sky = B.MeshBuilder.CreateSphere('sky', { diameter: 2, segments: 24, sideOrientation: B.Mesh.BACKSIDE }, scene);
  const skyMat = material(scene, 'sky', { uniforms: ['uTime', 'uDim'], depthWrite: false }); sky.material = skyMat; sky.renderingGroupId = 0; sky.alwaysSelectAsActiveMesh = true; sky.isPickable = false;
  loading('Placing 200,000 stars…');
  await new Promise(r => setTimeout(r, 0));
  const stars = createStarfield(scene, engine);
  const bodies = createBodies(scene, engine);
  const food = createFood(scene, engine);
  const crowd = createCrowd(bodies);
  const pickups = createPickups(bodies, T => message(`<b>${T.n}</b> · 36s`, `rgb(${T.c.map(v => Math.round(v * 255)).join(',')})`));
  const post = new B.DefaultRenderingPipeline('post', true, scene, [camera]);
  post.fxaaEnabled = true;
  post.bloomEnabled = !IS_TOUCH; post.bloomThreshold = 0.72; post.bloomWeight = 0.5; post.bloomKernel = 64; post.bloomScale = 0.5;
  post.imageProcessingEnabled = true; post.imageProcessing.toneMappingEnabled = true; post.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  post.imageProcessing.exposure = 1.05; post.imageProcessing.contrast = 1.1; post.imageProcessing.vignetteEnabled = true; post.imageProcessing.vignetteWeight = 1.2;
  initHud();
  G.onFeed = (txt, g) => message(`<b>${txt}</b>${g ? ' +' + fmt(g) : ''}`, '#ff8a3c');
  G.onDeath = () => {
    const secs = Math.round((performance.now() - G.stats.start) / 1000);
    $('dBy').textContent = G.killer ? `Swallowed by ${G.killer}` : 'You were absorbed';
    $('dPeak').textContent = fmt(G.stats.peak); $('dEaten').textContent = G.stats.eaten; $('dOrbs').textContent = fmt(G.stats.orbs); $('dTime').textContent = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
    setTimeout(() => { $('hud').classList.add('hidden'); $('death').classList.remove('hidden'); }, 1200);
  };
  function startGame() {
    const name = ($('name').value || '').trim().slice(0, 16) || 'Planet' + Math.floor(Math.random() * 900 + 100);
    try { localStorage.setItem('ga2_name', name); } catch { }
    food.reset(); spawnPlayer(name); if (!Q.has('nointro')) startIntro(); else G.zoom = G.zoomTarget = +(Q.get('z') || 1.6);
    if (Q.has('mass')) { G.main.mass = +Q.get('mass'); }
    $('home').classList.add('hidden'); $('death').classList.add('hidden'); $('hud').classList.remove('hidden'); showHint(6);
  }
  $('play').onclick = startGame; $('again').onclick = startGame; $('toHome').onclick = () => { $('death').classList.add('hidden'); $('home').classList.remove('hidden'); };
  try { $('name').value = localStorage.getItem('ga2_name') || ''; } catch { }
  addEventListener('resize', () => engine.resize());
  $('loading').classList.add('hidden'); $('home').classList.remove('hidden');
  if (Q.has('autoplay')) startGame();
  window.__ga2 = { G, perf, scene, engine, food };
  if (Q.has('stats')) perf.show = true;

  let last = performance.now(), dim = 1;
  const steerIn = { yaw: 0, pitch: 0, zoom: 0, brake: false, back: false };
  engine.runRenderLoop(() => {
    const t = performance.now(), dt = clamp((t - last) / 1000, 0, 0.05); last = t;
    tic('input');
    readSteer(steerIn, true);
    while (input.actions.length) {
      const a = input.actions.shift();
      if (a === 'perf') perf.show = !perf.show; else if (a === 'help') toggleHint(); else if (a === 'lock') { G.lock = !G.lock; message(G.lock ? 'View locked (V)' : 'View follows you'); }
      else if (G.playing && G.me && G.main) { const m = G.main, k = m.r * 20 + 1000, aim = { x: m.p.x + G.dir.x * k, y: m.p.y + G.dir.y * k, z: m.p.z + G.dir.z * k }; if (a === 'split') split(G.me, aim); if (a === 'spit') spit(G.me, aim); }
    }
    if (G.playing) {
      if (G.intro) { steerIn.yaw = steerIn.pitch = 0; if ((input.wheel || steerIn.zoom) && G.intro.t > 1.75) { G.intro = null; G.zoomTarget = G.zoom; } }
      else { G.zoomTarget *= Math.exp(input.wheel * 0.0022 + steerIn.zoom * dt * 1.8) / input.pinch; }
      steer(steerIn, dt);
      if (G.me) G.me.throttle = steerIn.brake ? 0.12 : (G.now < G.speedUntil ? G.speedMult : 1);
    }
    input.wheel = 0; input.pinch = 1;
    toc('input');
    tic('sim'); ensureBots(dt); stepWorld(dt); toc('sim');
    tic('camera'); updateCamera(dt, steerIn); toc('camera');
    const pix = 2 * Math.tan(camera.fov / 2) / (canvas.clientHeight || innerHeight);
    tic('food'); food.update(G.now, cam.dist, pix); toc('food');
    tic('bodies'); bodies.begin(); pickups.update(G.now); crowd.update(dt); bodies.end(G.now, pix, viewR()); toc('bodies');
    dim += ((G.playing ? 0.4 : 1) - dim) * Math.min(1, dt * 2);
    skyMat.setFloat('uTime', G.now); skyMat.setFloat('uDim', dim);
    stars.mat.setFloat('uPix', pix); stars.mat.setFloat('uDpr', 1); stars.mat.setFloat('uTime', G.now);
    updateHud(dt);
    tic('render'); scene.render(); toc('render');
    frameDone(t, engine);
    if (perf.show) drawOverlay($('perf'), `orbs ${food.count} · balls ${G.ents.reduce((n, e) => n + e.cells.length, 0)} · stars ${stars.count}\nzoom ${G.zoom.toFixed(2)} · draw calls ${engine._drawCalls ? engine._drawCalls.current : '-'}`);
    else $('perf').style.display = 'none';
  });
}
boot().catch(e => { console.error(e); loading('Could not start: ' + e.message); });
