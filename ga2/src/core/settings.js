// World constants, sizes and quality budgets. Everything else reads from here.
export const Q = new URLSearchParams(location.search);
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches && 'ontouchstart' in window;
export const ARENA = 960000;                       // radius of the playable galaxy
export const FOOD_N = IS_TOUCH ? 9000 : 30000;     // orb pool
export const FOOD_TARGET = Math.round(FOOD_N * 0.7);
export const STAR_N = IS_TOUCH ? 60000 : 200000;   // scenery stars
export const CROWD_N = IS_TOUCH ? 3000 : 8000;     // far-off wandering balls
export const BALL_MAX = 512;                       // real balls + moons + spit blobs drawn at once
export const RING_MAX = 96;
export const BOT_TARGET = IS_TOUCH ? 90 : 150;      // real bots kept around the player
export const BOT_MAX_MASS = 400000;
export const MAX_CELLS = 16;
export const ZMIN = 0.06, ZSTART = 1.6, ZREF = 1.6;
export const INTRO = { hold: 0.8, glide: 5.5 };
export const rad = m => 1.5 * Math.sqrt(m);
export const agarSpeed = m => 145 * Math.pow(m, -0.2195);
export const speedOf = m => Math.max(agarSpeed(m), 0.9 * Math.sqrt(m));
export const viewRadius = r => 2240 + 56 * r;
export const foodRadius = r => 560 + 14 * r;
export const camBase = r => r * 6.8 + 30;
export const mergeTime = m => 8 + Math.min(22, Math.sqrt(m) * 0.12);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : Math.round(n).toLocaleString();
// performance budget the auto-scaler works to (ms per frame)
export const BUDGET = { target: IS_TOUCH ? 33 : 16.7, high: IS_TOUCH ? 40 : 21, low: IS_TOUCH ? 24 : 13, floor: 0.6 };
