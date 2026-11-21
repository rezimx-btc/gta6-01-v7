// MARAVELA: NEON TIDE — open-world crime game (top-down, canvas 2D).
// Standard library only. No dependencies, no build step.
// Play: serve this folder (serve.ts) and open index.html in a browser.

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const VIEW_W = 960, VIEW_H = 600;
const WORLD_W = 2400, WORLD_H = 1800;

// Deterministic RNG so the city is identical every load.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261121);
function rand(a, b) { return a + rng() * (b - a); }
function randi(a, b) { return Math.floor(rand(a, b + 1)); }
function pick(arr) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
function angTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }

const ROAD_V = [400, 800, 1200, 1600, 2000];
const ROAD_H = [300, 700, 1100, 1500];
const ROAD_HALF = 35;
function isRoad(x, y) {
  for (const rx of ROAD_V) if (Math.abs(x - rx) < ROAD_HALF) return true;
  for (const ry of ROAD_H) if (Math.abs(y - ry) < ROAD_HALF) return true;
  return false;
}
function onRoadX(x) { for (const rx of ROAD_V) if (Math.abs(x - rx) < ROAD_HALF) return rx; return 0; }
function onRoadY(y) { for (const ry of ROAD_H) if (Math.abs(y - ry) < ROAD_HALF) return ry; return 0; }

// Fixed places in the city.
const PLACES = {
  ammu: { x: 860, y: 330, name: 'Ammu-Neon' },
  garage: { x: 1240, y: 740, name: "Rico's Garage" },
  safehouse: { x: 430, y: 1520, name: 'Safehouse' },
  pier: { x: 140, y: 700, name: 'Pier' },
  cafe: { x: 860, y: 1100, name: 'Cafe Luna' },
  vault: { x: 2040, y: 1560, name: 'Vault' },
  docks: { x: 300, y: 1560, name: 'Docks' },
};

// Buildings fill the blocks between roads. Each has a neon edge colour.
const NEON = ['#ff2ea6', '#00e5ff', '#ffd23e', '#7dff9b', '#b26bff', '#ff7a3d'];
const buildings = [];
(function buildCity() {
  const xBands = [[440, 760], [840, 1160], [1240, 1560], [1640, 1960], [2040, 2360]];
  const yBands = [[20, 260], [340, 660], [740, 1060], [1140, 1460], [1540, 1770]];
  for (const [x0, x1] of xBands) {
    for (const [y0, y1] of yBands) {
      const n = randi(1, 2);
      for (let i = 0; i < n; i++) {
        const w = rand(70, Math.min(180, x1 - x0 - 10));
        const h = rand(60, Math.min(150, y1 - y0 - 10));
        const bx = rand(x0, x1 - w);
        const by = rand(y0, y1 - h);
        buildings.push({ x: bx, y: by, w, h, c: pick(NEON), tall: rand(0.5, 1) });
      }
    }
  }
})();

// Keep mission-critical spots clear of buildings so markers stay reachable.
const CLEAR_SPOTS = [[330, 200], [1240, 740], [140, 700], [860, 330], [2000, 300], [2000, 1500], [400, 1500], [430, 1520], [860, 1100], [300, 1560], [2040, 1560], [1200, 300], [1600, 1100], [400, 1100]];
for (let i = buildings.length - 1; i >= 0; i--) {
  const b = buildings[i];
  for (const [sx, sy] of CLEAR_SPOTS) {
    if (sx > b.x - 90 && sx < b.x + b.w + 90 && sy > b.y - 90 && sy < b.y + b.h + 90) { buildings.splice(i, 1); break; }
  }
}
function insideBuilding(x, y) {
  for (const b of buildings) if (x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) return true;
  return false;
}

const RANKS = ['Street Punk', 'Hustler', 'Wheelman', 'Coast Runner', 'Kingpin', 'Legend of the Coast'];
const RANK_AT = [0, 100, 250, 500, 900, 1500];
function rankOf(rep) {
  let r = 0;
  for (let i = 0; i < RANK_AT.length; i++) if (rep >= RANK_AT[i]) r = i;
  return r;
}

const S = {
  mode: 'menu', // menu | play | win
  paused: false, shop: null,
  time: 0,
  cash: 300, respect: 0,
  wanted: 0, coolTimer: 0,
  missionIdx: 0, stepIdx: 0, stepTimer: 0, stepDone: false,
  pickups: [],
  weapons: { pistol: false, smg: false, rifle: false, kevlar: false },
  weapon: null, // currently equipped
  upgrades: { engine: false, armor: false, nitro: false, paint: false },
  radioIdx: 0, muted: false,
  cam: { x: 0, y: 0 },
  keys: {},
  mouse: { x: 0, y: 0, down: false },
  bullets: [], particles: [],
  fireCd: 0,
  abCd: { nitro: 0, hack: 0, clear: 0 },
  nitroT: 0,
  copSpawnT: 0, copHitCd: 0,
  heli: null,
  toastT: 0,
  player: null, car: null,
  traffic: [], peds: [], cops: [],
  roadblocks: [],
  startedAt: 0,
};

// ---- Entities ----
function makePlayerCar(x, y) {
  return { x, y, angle: -Math.PI / 2, speed: 0, health: 100, color: '#ff2ea6', stolen: false, disabled: false };
}
function resetWorld() {
  S.player = { x: 330, y: 760, angle: -Math.PI / 2, speed: 0, inCar: false, color: '#ffffff' };
  S.car = makePlayerCar(330, 800);
  S.traffic = []; S.peds = []; S.cops = []; S.roadblocks = [];
  S.bullets = []; S.particles = []; S.pickups = [];
  S.wanted = 0; S.coolTimer = 0; S.heli = null;
  S.nitroT = 0; S.fireCd = 0;
  S.abCd = { nitro: 0, hack: 0, clear: 0 };
  spawnTraffic(14);
  spawnPeds(60);
}
function spawnTraffic(n) {
  const colors = ['#e8e8e8', '#ffd23e', '#00e5ff', '#ff7a3d', '#b26bff', '#7dff9b', '#ff5b5b'];
  for (let i = 0; i < n; i++) {
    const vertical = rng() < 0.5;
    let x, y, angle;
    if (vertical) {
      const rx = pick(ROAD_V);
      x = rx + (rng() < 0.5 ? -14 : 14);
      y = rand(60, WORLD_H - 60);
      angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = pick(ROAD_H);
      y = ry + (rng() < 0.5 ? -14 : 14);
      x = rand(300, WORLD_W - 60);
      angle = rng() < 0.5 ? 0 : Math.PI;
    }
    S.traffic.push({ x, y, angle, axis: vertical ? 'v' : 'h', speed: rand(1.4, 2.4), color: pick(colors), turnT: rand(2, 6) });
  }
}
function spawnPeds(n) {
  const colors = ['#ffffff', '#ffd23e', '#7dff9b', '#ff9db1', '#9fd8ff', '#e0b3ff'];
  for (let i = 0; i < n; i++) {
    let x, y, tries = 0;
    do {
      x = rand(280, WORLD_W - 40);
      y = rand(40, WORLD_H - 40);
      tries++;
    } while (isRoad(x, y) && tries < 20);
    S.peds.push({ x, y, angle: rand(0, Math.PI * 2), speed: rand(0.4, 0.9), color: pick(colors), turnT: rand(1, 4) });
  }
}
function spawnCop() {
  const a = rand(0, Math.PI * 2);
  const d = rand(450, 650);
  let x = clamp(S.player.x + Math.cos(a) * d, 300, WORLD_W - 40);
  let y = clamp(S.player.y + Math.sin(a) * d, 40, WORLD_H - 40);
  // Snap onto the nearest road so cruisers arrive on asphalt.
  let best = 1e9, bx = x, by = y;
  for (const rx of ROAD_V) { const dd = Math.abs(x - rx); if (dd < best) { best = dd; bx = rx; } }
  let best2 = 1e9;
  for (const ry of ROAD_H) { const dd = Math.abs(y - ry); if (dd < best2) { best2 = dd; by = ry; } }
  if (best < best2) y = clamp(y, 40, WORLD_H - 40), x = bx;
  else x = clamp(x, 300, WORLD_W - 40), y = by;
  S.cops.push({ x, y, angle: 0, speed: 0, health: 3, stunT: 0, hitT: 0 });
}
function spawnRoadblocks() {
  S.roadblocks = [];
  const px = S.player.x, py = S.player.y;
  const rx = onRoadX(px), ry = onRoadY(py);
  const spots = [];
  if (rx) { spots.push({ x: rx, y: py - 260 }); spots.push({ x: rx, y: py + 260 }); }
  if (ry) { spots.push({ x: px - 260, y: ry }); spots.push({ x: px + 260, y: ry }); }
  for (const s of spots.slice(0, 2)) {
    S.roadblocks.push({ x: clamp(s.x, 300, WORLD_W - 40), y: clamp(s.y, 40, WORLD_H - 40), angle: rx ? 0 : Math.PI / 2 });
  }
}

// ---- Input ----
const KEYMAP = {};
window.addEventListener('keydown', (e) => {
  S.keys[e.key.toLowerCase()] = true;
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(e.key.toLowerCase())) e.preventDefault();
  if (e.key.toLowerCase() === 'p' && S.mode === 'play') togglePause();
  if (e.key.toLowerCase() === 'm') toggleMute();
  if (e.key.toLowerCase() === 'f') nextStation();
  if (e.key.toLowerCase() === 's' && S.mode === 'play') saveGame(true);
  if (e.key.toLowerCase() === 'e' && S.mode === 'play' && !S.shop) tryEnterCar();
  if (e.key.toLowerCase() === 'b' && S.mode === 'play') tryShop('ammu');
  if (e.key.toLowerCase() === 'g' && S.mode === 'play') tryShop('garage');
  if (e.key.toLowerCase() === 'j' && S.mode === 'play') fireWeapon();
  if (e.key === '1') crewNitro();
  if (e.key === '2') crewHack();
  if (e.key === '3') crewClear();
  initAudio();
});
window.addEventListener('keyup', (e) => { S.keys[e.key.toLowerCase()] = false; });
cv.addEventListener('mousemove', (e) => {
  const r = cv.getBoundingClientRect();
  S.mouse.x = e.clientX - r.left; S.mouse.y = e.clientY - r.top;
});
cv.addEventListener('mousedown', () => { S.mouse.down = true; if (S.mode === 'play') fireWeapon(); });
window.addEventListener('mouseup', () => { S.mouse.down = false; });
function key(k) { return !!S.keys[k]; }

// ---- Missions ----
const MISSIONS = [
  { title: '1. Welcome to Maravela', brief: 'Head to the boardwalk marker to start your story.',
    reward: { cash: 200, respect: 50 },
    steps: [{ type: 'goto', x: 330, y: 200, label: 'Reach the north end of the boardwalk' }] },
  { title: '2. First Wheels', brief: 'Carjack a traffic car (E), then bring it to Rico\'s Garage.',
    reward: { cash: 350, respect: 80 },
    steps: [
      { type: 'carjack', label: 'Carjack a traffic car — press E next to one' },
      { type: 'goto', x: 1240, y: 740, label: 'Drive to Rico\'s Garage' }] },
  { title: '3. Tide Runner', brief: 'Pick up the package at the pier, deliver it to Ammu-Neon.',
    reward: { cash: 500, respect: 120 },
    steps: [
      { type: 'goto', x: 140, y: 700, label: 'Pick up the package at the pier' },
      { type: 'goto', x: 860, y: 330, label: 'Deliver to Ammu-Neon' }] },
  { title: '4. Neon Run', brief: 'Race the checkpoints — 90 seconds, three markers.',
    reward: { cash: 800, respect: 200 },
    steps: [
      { type: 'goto', x: 2000, y: 300, time: 90, label: 'Checkpoint 1 — north avenue' },
      { type: 'goto', x: 2000, y: 1500, time: 90, label: 'Checkpoint 2 — south avenue' },
      { type: 'goto', x: 400, y: 1500, time: 90, label: 'Checkpoint 3 — finish line' }] },
  { title: '5. Heat Check', brief: 'The MVPD is on you. Lose the 2-star heat to prove you can vanish.',
    reward: { cash: 600, respect: 150 },
    steps: [
      { type: 'heat', stars: 2, label: 'Heat is on — 2 stars' },
      { type: 'cool', label: 'Break line of sight until the heat cools off' }] },
  { title: '6. Boardwalk Hustle', brief: 'Five cash drops are stashed around the boardwalk. Grab them all.',
    reward: { cash: 700, respect: 180 },
    steps: [{ type: 'collect', n: 5, cx: 330, cy: 700, r: 220, label: 'Collect 5 cash drops (0/5)' }] },
  { title: '7. The Informant', brief: 'Pick up Lena at Cafe Luna, then get her to the safehouse.',
    reward: { cash: 900, respect: 220 },
    steps: [
      { type: 'goto', x: 860, y: 1100, label: 'Pick up Lena at Cafe Luna' },
      { type: 'goto', x: 430, y: 1520, label: 'Drive Lena to the safehouse' }] },
  { title: '8. Smuggler\'s Tide', brief: 'Grab the cargo at the docks and run it to the vault with heat on your tail.',
    reward: { cash: 1200, respect: 300 },
    steps: [
      { type: 'goto', x: 300, y: 1560, label: 'Pick up the cargo at the docks' },
      { type: 'heat', stars: 2, label: 'Heat is on — run!' },
      { type: 'goto', x: 2040, y: 1560, label: 'Deliver to the vault' }] },
  { title: '9. High Roller', brief: 'Three stashes hidden across the city. Collect them all.',
    reward: { cash: 1500, respect: 350 },
    steps: [
      { type: 'goto', x: 1200, y: 300, label: 'Stash 1 — north avenue' },
      { type: 'goto', x: 1600, y: 1100, label: 'Stash 2 — midtown' },
      { type: 'goto', x: 400, y: 1100, label: 'Stash 3 — west side' }] },
  { title: '10. Neon Tide', brief: 'The vault finale. Grab the loot at 5 stars and escape to the safehouse.',
    reward: { cash: 5000, respect: 1000 },
    steps: [
      { type: 'goto', x: 2040, y: 1560, label: 'Reach the vault' },
      { type: 'heat', stars: 5, label: 'Five stars — grab the loot!' },
      { type: 'collect', n: 1, cx: 2040, cy: 1560, r: 60, label: 'Grab the loot (0/1)' },
      { type: 'goto', x: 430, y: 1520, label: 'Escape to the safehouse' }] },
];
function curMission() { return MISSIONS[Math.min(S.missionIdx, MISSIONS.length - 1)]; }
function curStep() { const m = curMission(); return m.steps[Math.min(S.stepIdx, m.steps.length - 1)]; }
function startStep() {
  const st = curStep();
  S.stepTimer = st.time || 0;
  if (st.type === 'collect') spawnPickups(st.n, st.cx, st.cy, st.r);
  if (st.type === 'heat') { setWanted(st.stars); toast(st.stars + ' stars! The MVPD is coming.'); }
  updateMissionHud();
}
function spawnPickups(n, cx, cy, r) {
  S.pickups = [];
  for (let i = 0; i < n; i++) {
    let px = 0, py = 0, tries = 0;
    do {
      const a = rand(0, Math.PI * 2), d = rand(30, r);
      px = clamp(cx + Math.cos(a) * d, 140, WORLD_W - 40);
      py = clamp(cy + Math.sin(a) * d, 40, WORLD_H - 40);
      tries++;
    } while (insideBuilding(px, py) && tries < 12);
    S.pickups.push({ x: px, y: py, got: false });
  }
}
function advanceStep() {
  const m = curMission();
  S.stepIdx++;
  if (S.stepIdx >= m.steps.length) {
    S.cash += m.reward.cash;
    S.respect += m.reward.respect;
    toast('Mission complete! +$' + m.reward.cash + '  +' + m.reward.respect + ' REP');
    saveGame(false);
    S.missionIdx++;
    S.stepIdx = 0;
    if (S.missionIdx >= MISSIONS.length) {
      S.mode = 'win';
      document.getElementById('winText').textContent =
        'You pulled the Neon Tide job and vanished into the dusk. Cash $' + S.cash + ' — Rank: ' + RANKS[rankOf(S.respect)] + '.';
      document.getElementById('win').classList.remove('hidden');
      return;
    }
  }
  startStep();
}
function failStep() {
  toast('Too slow! Mission step restarted.');
  S.stepIdx = 0;
  startStep();
}

// ---- Crew abilities ----
function crewNitro() {
  if (S.mode !== 'play' || S.paused || !S.player.inCar) return;
  if (S.abCd.nitro > 0) { toast('Nitro recharging (' + Math.ceil(S.abCd.nitro) + 's)'); return; }
  S.nitroT = S.upgrades.nitro ? 4.5 : 3;
  S.abCd.nitro = 20;
  toast('RICO: Nitro!');
}
function crewHack() {
  if (S.mode !== 'play' || S.paused) return;
  if (S.abCd.hack > 0) { toast('Camera hack recharging (' + Math.ceil(S.abCd.hack) + 's)'); return; }
  if (S.wanted === 0) { toast('LENA: No heat to hack.'); return; }
  setWanted(S.wanted - 1);
  S.abCd.hack = 45;
  toast('LENA: Cameras looped. -1 star.');
}
function crewClear() {
  if (S.mode !== 'play' || S.paused) return;
  if (S.abCd.clear > 0) { toast('Marco recharging (' + Math.ceil(S.abCd.clear) + 's)'); return; }
  let cleared = 0;
  S.traffic = S.traffic.filter((t) => { if (dist(t.x, t.y, S.player.x, S.player.y) < 500) { cleared++; return false; } return true; });
  S.cops = S.cops.filter((c) => { if (dist(c.x, c.y, S.player.x, S.player.y) < 500) { cleared++; return false; } return true; });
  S.roadblocks = [];
  spawnTraffic(6);
  S.abCd.clear = 30;
  toast('MARCO: Street cleared (' + cleared + ' vehicles gone).');
}
function setWanted(n) {
  S.wanted = clamp(n, 0, 5);
  S.coolTimer = 0;
  if (S.wanted >= 3 && S.roadblocks.length === 0) spawnRoadblocks();
  if (S.wanted < 3) S.roadblocks = [];
}

// ---- Shops ----
const SHOP_AMMU = [
  { id: 'pistol', name: 'Pistol', desc: 'Basic sidearm. Press J / click to fire.', price: 500, rank: 1 },
  { id: 'smg', name: 'SMG', desc: 'Rapid fire. High fire rate, low damage.', price: 1500, rank: 2 },
  { id: 'rifle', name: 'Rifle', desc: 'Heavy rounds. Big damage, slow fire.', price: 4000, rank: 3 },
  { id: 'kevlar', name: 'Kevlar Vest', desc: 'Halves damage you take on foot.', price: 800, rank: 1 },
];
const SHOP_GARAGE = [
  { id: 'engine', name: 'Engine Tune', desc: '+15% top speed.', price: 1000, rank: 0 },
  { id: 'armor', name: 'Armor Plating', desc: '+50 car health.', price: 1200, rank: 0 },
  { id: 'nitro', name: 'Nitro Kit', desc: 'Nitro lasts 4.5s instead of 3s.', price: 800, rank: 0 },
  { id: 'paint', name: 'Neon Paint', desc: 'Your ride glows with the tide.', price: 300, rank: 0 },
];
function tryShop(kind) {
  if (S.mode !== 'play' || S.paused) return;
  const place = kind === 'ammu' ? PLACES.ammu : PLACES.garage;
  if (dist(S.player.x, S.player.y, place.x, place.y) > 130) {
    toast(kind === 'ammu' ? 'Find Ammu-Neon (pink marker) to buy weapons.' : "Find Rico's Garage (orange marker) for upgrades.");
    return;
  }
  openShop(kind);
}
function openShop(kind) {
  S.shop = kind;
  S.paused = true;
  const items = kind === 'ammu' ? SHOP_AMMU : SHOP_GARAGE;
  document.getElementById('shopTitle').textContent = kind === 'ammu' ? 'AMMU-NEON' : "RICO'S GARAGE";
  const box = document.getElementById('shopItems');
  box.innerHTML = '';
  for (const it of items) {
    const owned = kind === 'ammu' ? !!S.weapons[it.id] : !!S.upgrades[it.id];
    const locked = rankOf(S.respect) < it.rank;
    const row = document.createElement('div');
    row.className = 'shop-row';
    const left = document.createElement('div');
    const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = it.name;
    const ds = document.createElement('div'); ds.className = 'desc'; ds.textContent = it.desc + (it.rank > 0 ? ' (needs ' + RANKS[it.rank] + ')' : '');
    left.appendChild(nm); left.appendChild(ds);
    const btn = document.createElement('button');
    btn.textContent = owned ? 'OWNED' : locked ? 'LOCKED' : 'BUY $' + it.price;
    btn.disabled = owned || locked || S.cash < it.price;
    btn.addEventListener('click', () => buyItem(kind, it));
    row.appendChild(left); row.appendChild(btn);
    box.appendChild(row);
  }
  document.getElementById('shop').classList.remove('hidden');
}
function buyItem(kind, it) {
  if (S.cash < it.price) { toast('Not enough cash.'); return; }
  S.cash -= it.price;
  if (kind === 'ammu') { S.weapons[it.id] = true; if (it.id !== 'kevlar') S.weapon = it.id; }
  else {
    S.upgrades[it.id] = true;
    if (it.id === 'armor') S.car.health = Math.min(150, S.car.health + 50);
  }
  toast('Bought: ' + it.name + ' (-$' + it.price + ')');
  openShop(kind);
}
function closeShop() {
  S.shop = null; S.paused = false;
  document.getElementById('shop').classList.add('hidden');
}
document.getElementById('btnCloseShop').addEventListener('click', closeShop);

// ---- Actions ----
function tryEnterCar() {
  const p = S.player;
  if (p.inCar) {
    p.inCar = false;
    p.x = S.car.x + Math.cos(S.car.angle + Math.PI / 2) * 30;
    p.y = S.car.y + Math.sin(S.car.angle + Math.PI / 2) * 30;
    p.angle = S.car.angle;
    return;
  }
  if (dist(p.x, p.y, S.car.x, S.car.y) < 60 && !S.car.disabled) {
    p.inCar = true;
    return;
  }
  for (const t of S.traffic) {
    if (dist(p.x, p.y, t.x, t.y) < 55) {
      S.traffic = S.traffic.filter((c) => c !== t);
      S.car = { x: t.x, y: t.y, angle: t.angle, speed: 0, health: 100, color: t.color, stolen: true, disabled: false };
      p.inCar = true;
      setWanted(S.wanted + 1);
      toast('Carjacked! +1 star.');
      return;
    }
  }
}
function fireWeapon() {
  if (S.mode !== 'play' || S.paused || !S.weapon || S.fireCd > 0) return;
  const stats = { pistol: { dmg: 1, cd: 0.35, sp: 12 }, smg: { dmg: 1, cd: 0.12, sp: 13 }, rifle: { dmg: 3, cd: 0.5, sp: 16 } };
  const w = stats[S.weapon];
  S.fireCd = w.cd;
  let ax, ay;
  if (S.player.inCar) { ax = S.car.x; ay = S.car.y; }
  else { ax = S.player.x; ay = S.player.y; }
  const ta = Math.atan2(S.mouse.y + S.cam.y - ay, S.mouse.x + S.cam.x - ax);
  S.bullets.push({ x: ax + Math.cos(ta) * 22, y: ay + Math.sin(ta) * 22, vx: Math.cos(ta) * w.sp, vy: Math.sin(ta) * w.sp, dmg: w.dmg, life: 0.45 });
  S.particles.push({ x: ax + Math.cos(ta) * 26, y: ay + Math.sin(ta) * 26, vx: 0, vy: 0, life: 0.12, c: '#ffe66d', r: 5 });
}
function collideBuildings(e, r) {
  for (const b of buildings) {
    if (e.x > b.x - r && e.x < b.x + b.w + r && e.y > b.y - r && e.y < b.y + b.h + r) {
      const dxl = e.x - (b.x - r), dxr = (b.x + b.w + r) - e.x;
      const dyt = e.y - (b.y - r), dyb = (b.y + b.h + r) - e.y;
      const m = Math.min(dxl, dxr, dyt, dyb);
      if (m === dxl) e.x = b.x - r;
      else if (m === dxr) e.x = b.x + b.w + r;
      else if (m === dyt) e.y = b.y - r;
      else e.y = b.y + b.h + r;
    }
  }
  if (e.x < 30) e.x = 30;
  if (e.x > WORLD_W - 30) e.x = WORLD_W - 30;
  if (e.y < 30) e.y = 30;
  if (e.y > WORLD_H - 30) e.y = WORLD_H - 30;
}

// ---- Update ----
function update(dt) {
  S.time += dt;
  const p = S.player;
  // Cooldowns tick down.
  S.fireCd = Math.max(0, S.fireCd - dt);
  for (const k of ['nitro', 'hack', 'clear']) S.abCd[k] = Math.max(0, S.abCd[k] - dt);
  S.nitroT = Math.max(0, S.nitroT - dt);

  // Movement.
  if (p.inCar && !S.car.disabled) {
    const c = S.car;
    const top = (S.upgrades.engine ? 6.9 : 6) * (S.nitroT > 0 ? 1.6 : 1);
    if (key('w') || key('arrowup')) c.speed = Math.min(top, c.speed + 0.22);
    else if (key('s') || key('arrowdown')) c.speed = Math.max(-2.2, c.speed - 0.3);
    else c.speed *= 0.985;
    if (key(' ')) c.speed *= 0.94; // handbrake
    const steer = (key('a') || key('arrowleft') ? -1 : 0) + (key('d') || key('arrowright') ? 1 : 0);
    c.angle += steer * 0.055 * Math.sign(c.speed) * (key(' ') ? 1.6 : 1) * Math.min(1, Math.abs(c.speed) / 2.5 + 0.25);
    c.x += Math.cos(c.angle) * c.speed;
    c.y += Math.sin(c.angle) * c.speed;
    collideBuildings(c, 16);
    if (S.nitroT > 0) S.particles.push({ x: c.x - Math.cos(c.angle) * 18, y: c.y - Math.sin(c.angle) * 18, vx: -Math.cos(c.angle) * 2 + rand(-1, 1), vy: -Math.sin(c.angle) * 2 + rand(-1, 1), life: 0.3, c: pick(['#00e5ff', '#ff7ad9', '#ffd23e']), r: 4 });
    p.x = c.x; p.y = c.y; p.angle = c.angle;
  } else if (!p.inCar) {
    const sp = 2.4;
    let mx = 0, my = 0;
    if (key('w') || key('arrowup')) my -= 1;
    if (key('s') || key('arrowdown')) my += 1;
    if (key('a') || key('arrowleft')) mx -= 1;
    if (key('d') || key('arrowright')) mx += 1;
    if (mx || my) {
      const l = Math.sqrt(mx * mx + my * my);
      p.x += (mx / l) * sp; p.y += (my / l) * sp;
      p.angle = Math.atan2(my, mx);
    }
    collideBuildings(p, 12);
  }

  // Traffic AI: cruise along roads, sometimes turn at intersections.
  for (const t of S.traffic) {
    t.turnT -= dt;
    if (t.turnT <= 0) {
      t.turnT = rand(3, 8);
      const rx = onRoadX(t.x), ry = onRoadY(t.y);
      if (rx && ry && rng() < 0.4) {
        if (t.axis === 'v') { t.axis = 'h'; t.angle = rng() < 0.5 ? 0 : Math.PI; }
        else { t.axis = 'v'; t.angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
      }
    }
    t.x += Math.cos(t.angle) * t.speed;
    t.y += Math.sin(t.angle) * t.speed;
    if (t.x < 280) { t.x = 280; t.angle = 0; }
    if (t.x > WORLD_W - 40) { t.x = WORLD_W - 40; t.angle = Math.PI; }
    if (t.y < 40) { t.y = 40; t.angle = Math.PI / 2; }
    if (t.y > WORLD_H - 40) { t.y = WORLD_H - 40; t.angle = -Math.PI / 2; }
  }
  if (S.traffic.length < 12 && rng() < 0.01) spawnTraffic(1);

  // Pedestrians wander sidewalks.
  for (const pd of S.peds) {
    pd.turnT -= dt;
    if (pd.turnT <= 0) { pd.turnT = rand(2, 6); pd.angle = rand(0, Math.PI * 2); }
    pd.x += Math.cos(pd.angle) * pd.speed;
    pd.y += Math.sin(pd.angle) * pd.speed;
    if (pd.x < 130 || pd.x > WORLD_W - 30 || pd.y < 30 || pd.y > WORLD_H - 30 || isRoad(pd.x, pd.y)) pd.angle += Math.PI;
    collideBuildings(pd, 8);
  }
  // Police: spawn to match wanted level, chase, ram. Roadblocks + heli at high heat.
  const want = S.wanted;
  S.copSpawnT -= dt;
  if (S.cops.length < want && S.copSpawnT <= 0) { spawnCop(); S.copSpawnT = 2; }
  if (S.cops.length > want) S.cops.length = want;
  let copNear = false;
  for (const c of S.cops) {
    if (c.stunT > 0) { c.stunT -= dt; continue; }
    const d = dist(c.x, c.y, p.x, p.y);
    if (d < 450) copNear = true;
    const ta = angTo(c.x, c.y, p.x, p.y);
    let da = ta - c.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    c.angle += clamp(da, -0.06, 0.06);
    c.speed = Math.min(5.6, c.speed + 0.12);
    c.x += Math.cos(c.angle) * c.speed;
    c.y += Math.sin(c.angle) * c.speed;
    collideBuildings(c, 16);
    c.hitT -= dt;
    if (d < 34 && c.hitT <= 0) {
      c.hitT = 0.6;
      if (p.inCar) {
        S.car.health -= 6;
        S.car.speed *= 0.5;
        toast('MVPD rammed you! Car health ' + Math.max(0, Math.round(S.car.health)));
        if (S.car.health <= 0) {
          S.car.disabled = true;
          p.inCar = false;
          p.x = S.car.x + 40; p.y = S.car.y + 40;
          setWanted(S.wanted + 1);
          toast('Your ride is wrecked!');
        }
      } else {
        busted();
      }
    }
  }
  // Helicopter at 4+ stars: orbits, blocks heat cooldown.
  if (want >= 4) {
    if (!S.heli) S.heli = { a: 0 };
    S.heli.a += dt * 0.7;
    S.heli.x = p.x + Math.cos(S.heli.a) * 130;
    S.heli.y = p.y + Math.sin(S.heli.a) * 130;
  } else S.heli = null;

  // Heat cools off when nobody is close and no heli is overhead.
  if (want > 0 && !copNear && !S.heli) {
    S.coolTimer += dt;
    if (S.coolTimer > 8) setWanted(want - 1);
  } else S.coolTimer = 0;

  // Bullets.
  for (const b of S.bullets) {
    b.x += b.vx; b.y += b.vy; b.life -= dt;
    for (const c of S.cops) {
      if (dist(b.x, b.y, c.x, c.y) < 22) {
        c.health -= b.dmg; b.life = 0;
        if (c.health <= 0) { c.stunT = 10; c.health = 3; toast('Cruiser disabled!'); setWanted(S.wanted + 1); }
        break;
      }
    }
    for (const pd of S.peds) {
      if (dist(b.x, b.y, pd.x, pd.y) < 12) { b.life = 0; setWanted(S.wanted + 1); toast('You hit a pedestrian! +1 star.'); break; }
    }
  }
  S.bullets = S.bullets.filter((b) => b.life > 0 && b.x > 0 && b.x < WORLD_W && b.y > 0 && b.y < WORLD_H);
  for (const pt of S.particles) { pt.x += pt.vx; pt.y += pt.vy; pt.life -= dt; }
  S.particles = S.particles.filter((pt) => pt.life > 0);

  // Pickups.
  for (const pk of S.pickups) {
    if (!pk.got && dist(p.x, p.y, pk.x, pk.y) < 40) {
      pk.got = true;
      S.cash += 50;
      toast('+$50 cash');
    }
  }

  // Mission step checks.
  if (S.mode === 'play') checkStep(dt);

  // Camera follows the player.
  S.cam.x = clamp(p.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  S.cam.y = clamp(p.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
}
function busted() {
  const lost = Math.floor(S.cash * 0.15);
  S.cash -= lost;
  setWanted(0);
  S.cops = []; S.roadblocks = []; S.heli = null;
  S.player.x = PLACES.safehouse.x; S.player.y = PLACES.safehouse.y;
  S.player.inCar = false;
  if (S.car) { S.car.x = PLACES.safehouse.x + 60; S.car.y = PLACES.safehouse.y; S.car.health = 100; S.car.disabled = false; }
  toast('BUSTED! You lost $' + lost + '.');
}
function checkStep(dt) {
  const st = curStep();
  const p = S.player;
  if (st.type === 'goto') {
    if (st.time) {
      S.stepTimer -= dt;
      if (S.stepTimer <= 0) { failStep(); return; }
    }
    if (dist(p.x, p.y, st.x, st.y) < 70) advanceStep();
  } else if (st.type === 'carjack') {
    if (p.inCar && S.car.stolen) advanceStep();
  } else if (st.type === 'collect') {
    const got = S.pickups.filter((pk) => pk.got).length;
    if (got >= st.n) advanceStep();
  } else if (st.type === 'heat') {
    if (S.wanted >= st.stars) advanceStep();
  } else if (st.type === 'cool') {
    if (S.wanted === 0) advanceStep();
  }
  updateMissionHud();
}

// ---- Rendering ----
function drawCarShape(x, y, angle, color, opts) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(-14, -6, 32, 16);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-16, -9, 32, 18, 5);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,230,255,0.85)';
  ctx.fillRect(2, -7, 8, 14);
  ctx.fillStyle = '#ffe66d';
  ctx.fillRect(15, -7, 3, 4);
  ctx.fillRect(15, 3, 3, 4);
  if (opts && opts.light) {
    ctx.fillStyle = (Math.floor(S.time * 6) % 2 === 0) ? '#ff3b3b' : '#3b82ff';
    ctx.fillRect(-6, -8, 6, 3);
    ctx.fillStyle = (Math.floor(S.time * 6) % 2 === 0) ? '#3b82ff' : '#ff3b3b';
    ctx.fillRect(0, -8, 6, 3);
  }
  if (opts && opts.glow) {
    ctx.strokeStyle = opts.glow;
    ctx.lineWidth = 2;
    ctx.shadowColor = opts.glow; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.roundRect(-16, -9, 32, 18, 5); ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.restore();
}
function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-S.cam.x, -S.cam.y);
  // Ground: ocean, sand, boardwalk, city base.
  ctx.fillStyle = '#160a2e';
  ctx.fillRect(S.cam.x, S.cam.y, VIEW_W, VIEW_H);
  // Ocean (x < 120) and sand (120..260), clipped to the viewport.
  ctx.fillStyle = '#0d3a5c';
  ctx.fillRect(Math.max(S.cam.x, 0), S.cam.y, Math.max(0, 120 - S.cam.x), VIEW_H);
  ctx.fillStyle = '#c9a06a';
  ctx.fillRect(Math.max(S.cam.x, 120), S.cam.y, Math.max(0, 260 - Math.max(S.cam.x, 120)), VIEW_H);
  // Ocean waves.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const wy = ((i * 340 + S.time * 24) % (WORLD_H + 200)) - 100;
    ctx.beginPath();
    for (let wx = 0; wx <= 120; wx += 12) ctx.lineTo(wx, wy + Math.sin(wx * 0.1 + S.time * 2 + i) * 4);
    ctx.stroke();
  }
  // Boardwalk planks.
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(260, S.cam.y, 140, VIEW_H);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  for (let py = Math.floor(S.cam.y / 26) * 26; py < S.cam.y + VIEW_H; py += 26) {
    ctx.beginPath(); ctx.moveTo(260, py); ctx.lineTo(400, py); ctx.stroke();
  }
  // Roads.
  ctx.fillStyle = '#241a33';
  for (const rx of ROAD_V) ctx.fillRect(rx - ROAD_HALF, 0, ROAD_HALF * 2, WORLD_H);
  for (const ry of ROAD_H) ctx.fillRect(0, ry - ROAD_HALF, WORLD_W, ROAD_HALF * 2);
  ctx.strokeStyle = 'rgba(255,210,62,0.4)';
  ctx.setLineDash([18, 18]);
  ctx.lineWidth = 2;
  for (const rx of ROAD_V) { ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD_H); ctx.stroke(); }
  for (const ry of ROAD_H) { ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD_W, ry); ctx.stroke(); }
  ctx.setLineDash([]);
  // Pier.
  ctx.fillStyle = '#5a3d26';
  ctx.fillRect(0, 660, 260, 80);
  ctx.strokeStyle = '#ff2ea6';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 660, 260, 80);
  // Buildings with height shadow + neon edge.
  for (const b of buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
    ctx.fillStyle = '#2c1b4d';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#3a2566';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.strokeStyle = b.c;
    ctx.lineWidth = 2;
    ctx.shadowColor = b.c; ctx.shadowBlur = 10;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.shadowBlur = 0;
  }
  // Place markers.
  drawPlace(PLACES.ammu.x, PLACES.ammu.y, '#ff2ea6', 'AMMU');
  drawPlace(PLACES.garage.x, PLACES.garage.y, '#ff7a3d', 'GARAGE');
  drawPlace(PLACES.safehouse.x, PLACES.safehouse.y, '#7dff9b', 'HOME');
  drawPlace(PLACES.vault.x, PLACES.vault.y, '#ffd23e', 'VAULT');
  // Mission marker.
  if (S.mode === 'play') {
    const st = curStep();
    const mx = st.x !== undefined ? st.x : st.cx;
    const my = st.y !== undefined ? st.y : st.cy;
    if (mx !== undefined) {
      const pulse = 1 + Math.sin(S.time * 5) * 0.25;
      ctx.save();
      ctx.translate(mx, my);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd23e';
      ctx.shadowColor = '#ffd23e'; ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(13, 0); ctx.lineTo(0, 18); ctx.lineTo(-13, 0);
      ctx.closePath(); ctx.fill();
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,210,62,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx, my - 60); ctx.lineTo(mx, my + 60); ctx.stroke();
    }
  }
  // Pickups.
  for (const pk of S.pickups) {
    if (pk.got) continue;
    ctx.fillStyle = '#7dff9b';
    ctx.shadowColor = '#7dff9b'; ctx.shadowBlur = 12;
    ctx.beginPath(); ctx.arc(pk.x, pk.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b0714';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$', pk.x, pk.y + 0.5);
  }
  // Pedestrians.
  for (const pd of S.peds) {
    ctx.fillStyle = pd.color;
    ctx.beginPath(); ctx.arc(pd.x, pd.y, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Traffic.
  for (const t of S.traffic) drawCarShape(t.x, t.y, t.angle, t.color, null);
  // Roadblocks.
  for (const rb of S.roadblocks) drawCarShape(rb.x, rb.y, rb.angle, '#e8e8f2', { light: true });
  // Player car / player.
  const p = S.player;
  if (p.inCar) {
    const glow = S.upgrades.paint ? (Math.floor(S.time * 2) % 2 === 0 ? '#00e5ff' : '#ff2ea6') : null;
    drawCarShape(S.car.x, S.car.y, S.car.angle, S.car.color, glow ? { glow } : null);
    if (S.car.disabled) {
      ctx.fillStyle = 'rgba(120,120,120,0.6)';
      ctx.beginPath(); ctx.arc(S.car.x, S.car.y, 22, 0, Math.PI * 2); ctx.fill();
    }
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + Math.cos(p.angle) * 14, p.y + Math.sin(p.angle) * 14); ctx.stroke();
  }
  // Cops.
  for (const c of S.cops) drawCarShape(c.x, c.y, c.angle, '#dfe6f2', { light: true });
  // Helicopter + searchlight.
  if (S.heli) {
    ctx.fillStyle = 'rgba(255,230,109,0.14)';
    ctx.beginPath();
    ctx.moveTo(S.heli.x, S.heli.y);
    ctx.lineTo(p.x - 40, p.y - 40);
    ctx.lineTo(p.x + 40, p.y + 40);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#222233';
    ctx.beginPath(); ctx.arc(S.heli.x, S.heli.y, 14, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 3;
    const ra = S.time * 12;
    ctx.beginPath();
    ctx.moveTo(S.heli.x - Math.cos(ra) * 22, S.heli.y - Math.sin(ra) * 22);
    ctx.lineTo(S.heli.x + Math.cos(ra) * 22, S.heli.y + Math.sin(ra) * 22);
    ctx.stroke();
  }
  // Bullets.
  ctx.fillStyle = '#ffe66d';
  for (const b of S.bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
  // Particles.
  for (const pt of S.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / 0.3);
    ctx.fillStyle = pt.c;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawMinimap();
  updateHud();
}
function drawPlace(x, y, color, label) {
  ctx.fillStyle = color;
  ctx.shadowColor = color; ctx.shadowBlur = 12;
  ctx.fillRect(x - 5, y - 5, 10, 10);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x, y - 12);
}

// ---- Minimap + HUD ----
const mm = document.getElementById('minimap');
const mmc = mm.getContext('2d');
function drawMinimap() {
  const sx = 180 / WORLD_W, sy = 135 / WORLD_H;
  mmc.clearRect(0, 0, 180, 135);
  mmc.fillStyle = '#0d3a5c'; mmc.fillRect(0, 0, 120 * sx, 135);
  mmc.fillStyle = '#c9a06a'; mmc.fillRect(120 * sx, 0, 140 * sx, 135);
  mmc.fillStyle = '#241a33';
  for (const rx of ROAD_V) mmc.fillRect(rx * sx - 2, 0, 4, 135);
  for (const ry of ROAD_H) mmc.fillRect(0, ry * sy - 2, 180, 4);
  mmc.fillStyle = '#7dff9b';
  mmc.fillRect(PLACES.ammu.x * sx - 2, PLACES.ammu.y * sy - 2, 4, 4);
  mmc.fillStyle = '#ff7a3d';
  mmc.fillRect(PLACES.garage.x * sx - 2, PLACES.garage.y * sy - 2, 4, 4);
  if (S.mode === 'play') {
    const st = curStep();
    const mx = st.x !== undefined ? st.x : st.cx;
    const my = st.y !== undefined ? st.y : st.cy;
    if (mx !== undefined) {
      mmc.fillStyle = '#ffd23e';
      mmc.beginPath(); mmc.arc(mx * sx, my * sy, 4, 0, Math.PI * 2); mmc.fill();
    }
  }
  mmc.fillStyle = '#ff3b3b';
  for (const c of S.cops) { mmc.beginPath(); mmc.arc(c.x * sx, c.y * sy, 2.5, 0, Math.PI * 2); mmc.fill(); }
  mmc.fillStyle = '#ffffff';
  mmc.beginPath(); mmc.arc(S.player.x * sx, S.player.y * sy, 3, 0, Math.PI * 2); mmc.fill();
}
function el(id) { return document.getElementById(id); }
function updateHud() {
  el('cash').textContent = '$' + S.cash;
  el('respect').textContent = 'REP ' + S.respect;
  el('rank').textContent = RANKS[rankOf(S.respect)];
  el('stars').textContent = '★'.repeat(S.wanted) + '☆'.repeat(5 - S.wanted);
  el('radio').textContent = (S.muted ? 'MUTED — ' : 'RADIO ') + STATIONS[S.radioIdx].name;
  el('speed').textContent = S.player.inCar ? Math.round(Math.abs(S.car.speed) * 18) + ' mph' : '';
}
function updateMissionHud() {
  const m = curMission();
  const st = curStep();
  el('missionTitle').textContent = m.title;
  let txt = st.label || '';
  if (st.time) txt += '  (' + Math.max(0, Math.ceil(S.stepTimer)) + 's)';
  if (st.type === 'collect') {
    const got = S.pickups.filter((pk) => pk.got).length;
    txt = txt.replace(/\(\d+\/\d+\)/, '(' + got + '/' + st.n + ')');
  }
  el('missionText').textContent = txt;
}
let toastTimer = null;
function toast(msg) {
  const t = el('toast');
  t.textContent = msg;
  t.style.opacity = 1;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.style.opacity = 0; }, 2600);
}
function togglePause() {
  if (S.shop) { closeShop(); return; }
  S.paused = !S.paused;
  el('paused').classList.toggle('hidden', !S.paused);
}

// ---- Radio (WebAudio synth, three stations) ----
const STATIONS = [
  { name: '98.7 Tide FM', scale: [0, 3, 5, 7, 10, 12, 15], tempo: 0.34, wave: 'sawtooth', bass: [0, 0, 7, 5] },
  { name: '104.5 Neon Latina', scale: [0, 2, 4, 7, 9, 12, 14], tempo: 0.22, wave: 'square', bass: [0, 5, 7, 3] },
  { name: '89.1 Boardwalk Talk', scale: [0, 5, 7, 12], tempo: 0.52, wave: 'triangle', bass: [0, 0, 0, 7] },
];
let AC = null, master = null, nextNote = 0, noteStep = 0;
function initAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain();
    master.gain.value = S.muted ? 0 : 0.16;
    master.connect(AC.destination);
    nextNote = AC.currentTime + 0.1;
    setInterval(scheduleRadio, 120);
  } catch (e) { AC = null; }
}
function noteFreq(semi) { return 110 * Math.pow(2, semi / 12); }
function playNote(freq, t, dur, wave, vol) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = wave; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}
function scheduleRadio() {
  if (!AC || S.muted) return;
  const st = STATIONS[S.radioIdx];
  while (nextNote < AC.currentTime + 0.35) {
    const bar = noteStep % 4;
    playNote(noteFreq(st.bass[bar] - 12), nextNote, st.tempo * 1.8, 'sine', 0.5);
    const lead = st.scale[(noteStep * 2 + (noteStep % 3)) % st.scale.length];
    playNote(noteFreq(lead), nextNote, st.tempo * 0.9, st.wave, 0.22);
    nextNote += st.tempo;
    noteStep++;
  }
}
function nextStation() {
  S.radioIdx = (S.radioIdx + 1) % STATIONS.length;
  noteStep = 0;
  toast('Radio: ' + STATIONS[S.radioIdx].name);
}
function toggleMute() {
  S.muted = !S.muted;
  if (master) master.gain.value = S.muted ? 0 : 0.16;
}

// ---- Save / load ----
const SAVE_KEY = 'maravela-save-v7';
function saveGame(manual) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      missionIdx: S.missionIdx, cash: S.cash, respect: S.respect,
      weapons: S.weapons, weapon: S.weapon, upgrades: S.upgrades, radioIdx: S.radioIdx,
    }));
    if (manual) toast('Game saved.');
  } catch (e) { /* storage unavailable — ignore */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    S.missionIdx = d.missionIdx || 0;
    S.cash = d.cash || 0;
    S.respect = d.respect || 0;
    S.weapons = d.weapons || S.weapons;
    S.weapon = d.weapon || null;
    S.upgrades = d.upgrades || S.upgrades;
    S.radioIdx = d.radioIdx || 0;
    return true;
  } catch (e) { return false; }
}

// ---- Menu / start ----
function startGame(fresh) {
  resetWorld();
  if (fresh) {
    S.cash = 300; S.respect = 0;
    S.weapons = { pistol: false, smg: false, rifle: false, kevlar: false };
    S.weapon = null;
    S.upgrades = { engine: false, armor: false, nitro: false, paint: false };
    S.missionIdx = 0;
  }
  S.stepIdx = 0;
  S.mode = 'play';
  S.paused = false;
  el('menu').classList.add('hidden');
  el('win').classList.add('hidden');
  startStep();
}
el('btnStart').addEventListener('click', () => { initAudio(); startGame(true); });
el('btnContinue').addEventListener('click', () => {
  initAudio();
  resetWorld();
  loadGame();
  S.stepIdx = 0;
  S.mode = 'play';
  el('menu').classList.add('hidden');
  startStep();
});
el('btnFreeRoam').addEventListener('click', () => {
  el('win').classList.add('hidden');
  S.mode = 'play';
});
try {
  if (localStorage.getItem(SAVE_KEY)) el('btnContinue').classList.remove('hidden');
} catch (e) { /* ignore */ }

// ---- Screenshot hooks (?shot=menu|drive|chase|mission, ?autostart=1) ----
const QP = new URLSearchParams(window.location.search);
(function applyShotPreset() {
  const shot = QP.get('shot');
  // Only gameplay presets auto-start; 'menu' (or no param) shows the title screen.
  if (shot !== 'drive' && shot !== 'chase' && shot !== 'mission' && !QP.get('autostart')) return;
  startGame(true);
  if (shot === 'drive') {
    S.player.inCar = true;
    S.car.x = 330; S.car.y = 700; S.car.angle = Math.PI / 2; S.car.speed = 3;
    S.player.x = 330; S.player.y = 700;
  } else if (shot === 'chase') {
    S.player.inCar = true;
    S.car.x = 1200; S.car.y = 700; S.car.angle = 0; S.car.speed = 4;
    S.player.x = 1200; S.player.y = 700;
    setWanted(3);
    spawnCop(); spawnCop(); spawnCop();
  } else if (shot === 'mission') {
    S.missionIdx = 5; S.stepIdx = 0;
    S.player.inCar = true;
    S.car.x = 330; S.car.y = 800; S.car.angle = -Math.PI / 2;
    S.player.x = 330; S.player.y = 800;
    startStep();
  }
})();

// ---- Main loop ----
// A shot preset already started the game (and placed the player); only
// initialise the world when no preset ran.
if (!S.player) resetWorld();
S.cam.x = clamp(S.player.x - VIEW_W / 2, 0, WORLD_W - VIEW_W);
S.cam.y = clamp(S.player.y - VIEW_H / 2, 0, WORLD_H - VIEW_H);
let lastT = 0;
function frame(t) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016);
  lastT = t;
  if (S.mode === 'play' && !S.paused) update(dt);
  else if (S.mode === 'menu') { S.time += dt; S.cam.x = 120; S.cam.y = 480; }
  draw();
}
requestAnimationFrame(frame);
