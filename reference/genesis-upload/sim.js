"use strict";

const WORLD_W = 1000, WORLD_H = 620;
const TILE = 5;
const GW = Math.floor(WORLD_W / TILE);
const GH = Math.floor(WORLD_H / TILE);
const T_WATER = 0, T_SAND = 1, T_GRASS = 2, T_FOREST = 3, T_ROCK = 4;
const SEA = .30, HSCALE = 70;

const TICKS_PER_YEAR = 120;
const DAY_TICKS = 60;
const TICKS_PER_SEC = 20;
let MAX_POP = 260;

const TC = 40, TR = 25;
const CELL_W = WORLD_W / TC, CELL_H = WORLD_H / TR;

const N_IN = 32, N_HID = 16, N_OUT = 14;

const A_FORAGE = 0, A_HUNT = 1, A_REST = 2, A_SOCIAL = 3, A_PLAY = 4, A_WORK = 5,
  A_RESEARCH = 6, A_REPRODUCE = 7, A_ATTACK = 8, A_BUILD = 9, A_WANDER = 10,
  A_TEACH = 11, A_PRAY = 12, A_RAID = 13;

const ACTION_NAMES = ['forage', 'hunt', 'rest', 'talk', 'play', 'work', 'research', 'court', 'fight', 'build', 'explore', 'teach', 'pray', 'raid'];

const I_HUNGER = 0, I_ENERGY = 1, I_SOCIAL = 2, I_FUN = 3, I_REPRO = 4, I_FAITH = 5,
  I_DANGER = 6, I_AGE = 7, I_HEALTH = 8, I_FOOD = 9, I_WOOD = 10, I_STONE = 11,
  I_GOLD = 12, I_MATE = 13, I_FRIEND = 14, I_ENEMY = 15, I_PREY = 16, I_WATER = 17,
  I_NIGHT = 18, I_ERA = 19, I_POP = 20, I_STORE = 21, I_STR = 22, I_INT = 23,
  I_CUR = 24, I_AGG = 25, I_IND = 26, I_DEVOUT = 27, I_WAR = 28, I_WEALTH = 29,
  I_STATUS = 30, I_SHRINE = 31;

const CONCEPTS = ['food', 'water', 'fire', 'danger', 'hunt', 'death', 'love', 'sky', 'friend', 'home', 'yes', 'no', 'god', 'war'];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rnd = (a, b) => a + Math.random() * (b - a);
const rndInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

class Grid {
  constructor(cell) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  insert(o) {
    const k = ((o.y / this.cell) | 0) * 4096 + ((o.x / this.cell) | 0);
    let b = this.map.get(k);
    if (!b) { b = []; this.map.set(k, b); }
    b.push(o);
  }
  query(x, y, r, out) {
    if (out.length) out.length = 0;
    const c = this.cell;
    const x0 = ((x - r) / c) | 0, x1 = ((x + r) / c) | 0;
    const y0 = ((y - r) / c) | 0, y1 = ((y + r) / c) | 0;
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const b = this.map.get(cy * 4096 + cx);
        if (!b) continue;
        for (let i = 0; i < b.length; i++) {
          const o = b[i];
          if (o.dead) continue;
          if (dist2(x, y, o.x, o.y) <= r2) out.push(o);
        }
      }
    }
    return out;
  }
}

const agentGrid = new Grid(130);
const resGrid = new Grid(120);
const animalGrid = new Grid(130);
const buildingGrid = new Grid(140);

let SEED = Math.random() * 1000;
let terrain = new Uint8Array(GW * GH);
let heightMap = new Float32Array(GW * GH);

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function genTerrain() {
  const oct = [[30, 1], [14, .5], [7, .25], [3.5, .12]];
  for (let y = 0; y < GH; y++) {
    for (let x = 0; x < GW; x++) {
      let h = 0, amp = 0;
      for (let i = 0; i < oct.length; i++) {
        h += vnoise(x / oct[i][0] + SEED, y / oct[i][0] + SEED * 1.7) * oct[i][1];
        amp += oct[i][1];
      }
      h /= amp;
      const nx = x / GW - .5, ny = y / GH - .5;
      const r = Math.sqrt(nx * nx * 1.12 + ny * ny);
      h = h * 1.35 - r * r * .95 - .06;
      heightMap[y * GW + x] = h;
      terrain[y * GW + x] = h < .30 ? T_WATER : h < .345 ? T_SAND : h < .52 ? T_GRASS : h < .66 ? T_FOREST : T_ROCK;
    }
  }
}

function heightAt(x, y) {
  const fx = clamp(x / TILE, 0, GW - 1.001);
  const fy = clamp(y / TILE, 0, GH - 1.001);
  const x0 = fx | 0, y0 = fy | 0;
  const tx = fx - x0, ty = fy - y0;
  const i = y0 * GW + x0;
  const h00 = heightMap[i], h10 = heightMap[i + 1], h01 = heightMap[i + GW], h11 = heightMap[i + GW + 1];
  return (h00 * (1 - tx) + h10 * tx) * (1 - ty) + (h01 * (1 - tx) + h11 * tx) * ty;
}
function groundY(x, y) { return (heightAt(x, y) - SEA) * HSCALE; }
function tileAtPx(x, y) {
  const tx = clamp((x / TILE) | 0, 0, GW - 1);
  const ty = clamp((y / TILE) | 0, 0, GH - 1);
  return terrain[ty * GW + tx];
}
const walkable = (x, y) => x > 2 && y > 2 && x < WORLD_W - 2 && y < WORLD_H - 2 && tileAtPx(x, y) !== T_WATER;

function nearestWater(x, y, maxTiles) {
  const tx = (x / TILE) | 0, ty = (y / TILE) | 0;
  let best = null, bd = 1e9;
  for (let r = 1; r <= maxTiles; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const gx = tx + dx, gy = ty + dy;
        if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
        if (terrain[gy * GW + gx] === T_WATER) {
          const px = gx * TILE + 2, py = gy * TILE + 2;
          const d = dist2(x, y, px, py);
          if (d < bd) { bd = d; best = { x: px, y: py }; }
        }
      }
    }
    if (best) return best;
  }
  return null;
}

const NAME_A = ['Ug', 'Gro', 'Nar', 'Ta', 'Kel', 'Mor', 'Ruk', 'Za', 'Lo', 'Bru', 'Han', 'Sen', 'Ovi', 'Dur', 'Pik', 'Yun', 'Ras', 'Emi', 'Tol', 'Wan', 'Cir', 'Fen', 'Gal', 'Ida', 'Jor', 'Set', 'Ama', 'Oru', 'Vek', 'Nim', 'Tal', 'Sur', 'Ilo', 'Bek', 'Rin'];
const NAME_B = ['', 'k', 'n', 'r', 'l', 'm', 'th', 'g', 'b', 'sh', 'v', 'z'];
const NAME_C = ['a', 'o', 'u', 'i', 'e', 'or', 'an', 'un', 'ik', 'el', 'ur', 'ai'];
const NAME_D = ['', '', '', 'a', 'o', 'i', 'us', 'ia', 'ar', 'en'];
function makeName() { return pick(NAME_A) + pick(NAME_B) + pick(NAME_C) + pick(NAME_D); }

const NATION_A = ['Bek', 'Kal', 'Dur', 'Mor', 'Set', 'Ras', 'Gal', 'Tol', 'Nim', 'Vor', 'Hal', 'Zan', 'Or', 'Il', 'Sur'];
const NATION_B = ['thor', 'mar', 'val', 'gard', 'dor', 'heim', 'ria', 'nia', 'topia', 'land', 'stan', 'ora', 'ium', 'esh'];
const TITLES = ['Band of', 'Chiefdom of', 'Kingdom of', 'Empire of', 'Republic of', 'Federation of'];
function makeNationName() { return pick(NATION_A) + pick(NATION_B); }

const RELIG_A = ['Vek', 'Sol', 'Lun', 'Ash', 'Fer', 'Ora', 'Zan', 'Kel', 'Nur', 'Ish', 'Bel', 'Tha', 'Mor', 'Rha'];
const RELIG_B = ['ism', 'anity', 'ism', 'ora', 'atu', 'ism', 'aya', 'ism', 'eth', 'u'];
function makeReligionName() { return pick(RELIG_A) + pick(RELIG_B); }
const DEITY_EPITHET = ['', '', '', '', ' the Bright', ' the Deep', ' the Silent', ' the Cruel', ' the Kind', ' of the Sky', ' of the Dead', ' the Devourer', ' the Mother', ' of the Storm'];
function makeDeityName() { return pick(RELIG_A) + pick(['a', 'o', 'u', 'ra', 'na', 'th', 'ia']) + pick(DEITY_EPITHET); }

const PHON_C = ['k', 't', 'p', 'm', 'n', 's', 'r', 'l', 'g', 'b', 'd', 'h', 'w', 'y', 'sh', 'th', 'ch', 'z', 'v', 'f'];
const PHON_V = ['a', 'e', 'i', 'o', 'u', 'aa', 'ee', 'oo', 'ai', 'au'];
function makeWord() {
  let w = pick(PHON_C) + pick(PHON_V);
  if (Math.random() < .45) w += pick(PHON_C);
  if (Math.random() < .4) w += pick(PHON_V);
  return w;
}
function makeLexicon() {
  const l = {};
  for (const c of CONCEPTS) if (Math.random() < .8) l[c] = makeWord();
  return l;
}

const AGE_LIST = [
  { n: 'Stone Age', t: 0 }, { n: 'Fire', t: 45 }, { n: 'Tools', t: 130 }, { n: 'Hunting Bands', t: 280 },
  { n: 'Agriculture', t: 500 }, { n: 'Bronze Age', t: 900 }, { n: 'Iron Age', t: 1450 }, { n: 'Writing', t: 2250 },
  { n: 'Classical Era', t: 3400 }, { n: 'Medieval', t: 4800 }, { n: 'Gunpowder', t: 6600 }, { n: 'Industrial', t: 9000 },
  { n: 'Electricity', t: 12000 }, { n: 'Modern', t: 16000 }, { n: 'Information', t: 21500 }, { n: 'Space Age', t: 28000 },
  { n: 'Interstellar', t: 36000 }
];

const BUILDING_TYPES = [
  { id: 'campfire', n: 'Campfire', age: 1, cost: { wood: 8 }, col: '#e07a3a', limit: m => Math.max(1, Math.floor(m / 8)), fx: { social: .5 } },
  { id: 'hut', n: 'Hut', age: 2, cost: { wood: 18 }, col: '#a4703c', limit: m => Math.floor(m / 3) + 1, fx: { rest: 1.4 }, hp: 60 },
  { id: 'shrine', n: 'Shrine', age: 3, cost: { wood: 20, stone: 10 }, col: '#c9b6e8', limit: m => Math.max(1, Math.floor(m / 10)), fx: { faith: .6 }, hp: 70 },
  { id: 'granary', n: 'Granary', age: 4, cost: { wood: 26, stone: 8 }, col: '#c9a24a', limit: m => Math.max(1, Math.floor(m / 8)), fx: { foodCap: 250 }, hp: 80 },
  { id: 'farm', n: 'Farm', age: 4, cost: { wood: 16, stone: 4 }, col: '#8fbf4d', limit: m => Math.floor(m / 8) + 1, fx: { food: .028 }, hp: 40 },
  { id: 'mine', n: 'Mine', age: 5, cost: { wood: 34, stone: 18 }, col: '#8a8a8a', limit: m => Math.max(1, Math.floor(m / 12)), fx: { stone: .03, gold: .008 }, hp: 90 },
  { id: 'forge', n: 'Forge', age: 6, cost: { wood: 30, stone: 40 }, col: '#c96a3a', limit: m => Math.max(1, Math.floor(m / 14)), fx: { tech: .0008, weapon: .2 }, hp: 90 },
  { id: 'temple', n: 'Temple', age: 6, cost: { wood: 50, stone: 70 }, col: '#e8dcc0', limit: m => Math.max(1, Math.floor(m / 16)), fx: { faith: 1.5, social: .3 }, hp: 140 },
  { id: 'library', n: 'Library', age: 7, cost: { wood: 60, stone: 50 }, col: '#5aa9e6', limit: m => Math.max(1, Math.floor(m / 16)), fx: { tech: .0016, research: .15 }, hp: 90 },
  { id: 'walls', n: 'Walls', age: 8, cost: { stone: 90 }, col: '#9a9a9a', limit: m => Math.max(1, Math.floor(m / 18)), fx: { defense: .6 }, hp: 260 },
  { id: 'barracks', n: 'Barracks', age: 8, cost: { wood: 60, stone: 50 }, col: '#b05a4a', limit: m => Math.max(1, Math.floor(m / 18)), fx: { weapon: .15, war: .3 }, hp: 130 },
  { id: 'market', n: 'Market', age: 8, cost: { wood: 50, stone: 40, gold: 15 }, col: '#d9b23c', limit: m => Math.max(1, Math.floor(m / 16)), fx: { food: .012, wood: .01, social: .3, trade: 1 }, hp: 90 },
  { id: 'monument', n: 'Monument', age: 9, cost: { stone: 200, gold: 40 }, col: '#d8d2c4', limit: m => Math.max(1, Math.floor(m / 25)), fx: { faith: 2.2, social: .4 }, hp: 300 },
  { id: 'academy', n: 'Academy', age: 10, cost: { wood: 80, stone: 90, gold: 40 }, col: '#6ec9e0', limit: m => Math.max(1, Math.floor(m / 22)), fx: { tech: .003, research: .3 }, hp: 120 },
  { id: 'hospital', n: 'Hospital', age: 10, cost: { wood: 70, stone: 80, gold: 30 }, col: '#e8e8f0', limit: m => Math.max(1, Math.floor(m / 22)), fx: { health: 1 }, hp: 120 },
  { id: 'factory', n: 'Factory', age: 11, cost: { wood: 90, stone: 120, gold: 40 }, col: '#9aa3ad', limit: m => Math.max(1, Math.floor(m / 20)), fx: { food: .05, wood: .03, stone: .03, tech: .001 }, hp: 150 },
  { id: 'power', n: 'Power Plant', age: 12, cost: { stone: 150, gold: 70 }, col: '#e2c04a', limit: m => Math.max(1, Math.floor(m / 25)), fx: { tech: .0025, food: .02 }, hp: 180 },
  { id: 'lab', n: 'Laboratory', age: 13, cost: { stone: 170, gold: 110 }, col: '#6ee7c0', limit: m => Math.max(1, Math.floor(m / 25)), fx: { tech: .005, research: .3 }, hp: 150 },
  { id: 'data', n: 'Data Center', age: 14, cost: { stone: 210, gold: 190 }, col: '#8f7ff0', limit: m => Math.max(1, Math.floor(m / 30)), fx: { tech: .01 }, hp: 160 },
  { id: 'spaceport', n: 'Spaceport', age: 15, cost: { stone: 380, gold: 380 }, col: '#e6e6f0', limit: () => 1, fx: { tech: .03 }, hp: 240 }
];

const DOCTRINES = [
  { id: 'fertility', n: 'Fertility', fx: { birth: 1.45 }, blurb: 'blesses the womb', prayer: 'for children' },
  { id: 'war', n: 'War', fx: { war: 1.4, hostile: 1.5, weapon: .1 }, blurb: 'demands blood', prayer: 'for victory' },
  { id: 'harvest', n: 'Harvest', fx: { food: 1.3 }, blurb: 'feeds the people', prayer: 'for a good harvest' },
  { id: 'wisdom', n: 'Wisdom', fx: { research: 1.25 }, blurb: 'seeks truth', prayer: 'for understanding' },
  { id: 'sky', n: 'Sky', fx: { research: 1.15, happy: .2 }, blurb: 'reads the stars', prayer: 'for clear skies' },
  { id: 'death', n: 'Death', fx: { health: 1.2 }, blurb: 'honours the ancestors', prayer: 'for the ancestors' }
];

class Brain {
  constructor(a, b) {
    this.w1 = new Float32Array(N_IN * N_HID);
    this.b1 = new Float32Array(N_HID);
    this.w2 = new Float32Array(N_HID * N_OUT);
    this.b2 = new Float32Array(N_OUT);
    this.h = new Float32Array(N_HID);
    this.o = new Float32Array(N_OUT);
    if (a) this.inherit(a, b);
    else for (let i = 0; i < this.w1.length; i++) this.w1[i] = gauss() * .55;
  }
  inherit(a, b) {
    const ps = b ? [a, b] : [a];
    for (let i = 0; i < this.w1.length; i++) {
      const p = pick(ps);
      this.w1[i] = clamp(p.w1[i] + (Math.random() < .06 ? gauss() * .4 : 0), -5, 5);
    }
    for (let i = 0; i < this.w2.length; i++) {
      const p = pick(ps);
      this.w2[i] = clamp(p.w2[i] + (Math.random() < .06 ? gauss() * .4 : 0), -5, 5);
    }
    for (let i = 0; i < N_HID; i++) this.b1[i] = clamp(avgB(ps, 'b1', i) + (Math.random() < .1 ? gauss() * .3 : 0), -5, 5);
    for (let i = 0; i < N_OUT; i++) this.b2[i] = clamp(avgB(ps, 'b2', i) + (Math.random() < .1 ? gauss() * .3 : 0), -5, 5);
  }
  forward(x) {
    const { w1, b1, w2, b2, h, o } = this;
    for (let j = 0; j < N_HID; j++) {
      let s = b1[j];
      for (let i = 0; i < N_IN; i++) s += w1[i * N_HID + j] * x[i];
      h[j] = Math.tanh(s);
    }
    for (let k = 0; k < N_OUT; k++) {
      let s = b2[k];
      for (let j = 0; j < N_HID; j++) s += w2[j * N_OUT + k] * h[j];
      o[k] = 1.6 * Math.tanh(s * .5);
    }
    return o;
  }
  learn(x, action, reward) {
    if (reward < .12 && reward > -.12) return;
    const lr = .035 * clamp(reward, -2, 2);
    if (lr === 0) return;
    const h = this.h;
    for (let j = 0; j < N_HID; j++) {
      const dh = lr * h[j] * .5;
      for (let i = 0; i < N_IN; i++) {
        const idx = i * N_HID + j;
        this.w1[idx] = clamp(this.w1[idx] + dh * x[i], -5, 5);
      }
      this.b1[j] = clamp(this.b1[j] + dh * .06, -5, 5);
    }
    for (let k = 0; k < N_OUT; k++) {
      const tk = k === action ? 1 : -1 / (N_OUT - 1);
      const scale = lr * .45 * tk;
      for (let j = 0; j < N_HID; j++) {
        const idx = j * N_OUT + k;
        this.w2[idx] = clamp(this.w2[idx] + scale * h[j], -5, 5);
      }
      this.b2[k] = clamp(this.b2[k] + scale * .12, -5, 5);
    }
  }
}
function avgB(ps, key, i) {
  let s = 0;
  for (const p of ps) s += p[key][i];
  return s / ps.length;
}

class Religion {
  constructor(founder, tick) {
    this.id = world.nextReligId++;
    this.name = makeReligionName();
    this.deity = makeDeityName();
    this.doctrine = pick(DOCTRINES);
    this.founderId = founder.id;
    this.founderName = founder.name;
    this.x = founder.x; this.y = founder.y;
    this.fervor = 35 + Math.random() * 25;
    this.founded = world.year;
    this.adherents = 1;
    this.hue = (world.nextReligId * 97) % 360;
    this.color = 'hsl(' + this.hue + ',55%,62%)';
    this.holyWars = 0;
    this.festivalT = rndInt(4000, 9000);
  }
  get fx() { return this.doctrine.fx; }
}

class Nation {
  constructor(tribe) {
    this.id = world.nextNationId++;
    this.tribe = tribe;
    this.stem = makeNationName();
    this.color = tribe.color;
    this.capitalX = tribe.cx;
    this.capitalY = tribe.cy;
    this.tier = 0;
    this.rulerId = 0;
    this.rulerName = '-';
    this.treasury = 0;
    this.cells = 0;
    this.religion = null;
    this.atWar = new Set();
    this.allies = new Set();
    this.peaceUntil = new Map();
    this.founded = world.year;
    this.warsWon = 0;
    this.warsLost = 0;
    this.warDeaths = 0;
    this.aggression = 0;
    this.wealth = 0;
    this.holyWarFlag = false;
  }
  get name() { return TITLES[this.tier] + ' ' + this.stem; }
  get members() { return this.tribe.members; }
  atWarWith(n) { return this.atWar.has(n.id); }
}

class WarBand {
  constructor(nation, target, tx, ty) {
    this.nation = nation;
    this.target = target;
    this.x = nation.capitalX;
    this.y = nation.capitalY;
    this.tx = tx; this.ty = ty;
    this.memberIds = [];
    this.morale = 1;
    this.dead = false;
  }
  get size() { return this.memberIds.length; }
}

class Animal {
  constructor(kind, x, y) {
    this.kind = kind;
    this.x = x; this.y = y;
    this.dead = false;
    this.dir = rnd(0, Math.PI * 2);
    this.t = rndInt(20, 90);
    this.hp = kind === 'deer' ? 16 : 30;
    this.cool = 0;
    this.giveUp = 0;
    this.walk = 0;
  }
  tick() {
    if (this.dead) return;
    const spd = this.kind === 'deer' ? .55 : .4;
    this.walk += spd * .3;
    if (this.kind === 'deer') {
      const near = agentGrid.query(this.x, this.y, 80, _tmpA2);
      let flee = null, bd = 1e9;
      for (const a of near) {
        if (!a.alive) continue;
        const d = dist2(this.x, this.y, a.x, a.y);
        if (d < bd) { bd = d; flee = a; }
      }
      if (flee) {
        const dx = this.x - flee.x, dy = this.y - flee.y, d = Math.hypot(dx, dy) || 1;
        const ux = dx / d, uy = dy / d;
        if (walkable(this.x + ux * spd, this.y + uy * spd)) { this.x += ux * spd; this.y += uy * spd; }
        else { this.x -= uy * spd; this.y += ux * spd; }
        this.dir = Math.atan2(uy, ux);
      } else this.roam(spd);
    } else {
      this.cool--;
      if (this.giveUp > 0) { this.giveUp--; this.roam(spd); return; }
      const nearDeer = animalGrid.query(this.x, this.y, 110, _tmpAn2);
      let deer = null, bdd = 1e9;
      for (const d of nearDeer) {
        if (d === this || d.kind !== 'deer' || d.dead) continue;
        const dd = dist2(this.x, this.y, d.x, d.y);
        if (dd < bdd) { bdd = dd; deer = d; }
      }
      let t = deer;
      if (!t) {
        const near = agentGrid.query(this.x, this.y, 95, _tmpA2);
        let bd = 1e9;
        for (const a of near) {
          if (!a.alive) continue;
          const sc = a.age < 12 ? .5 : 1;
          const d = dist2(this.x, this.y, a.x, a.y) * sc;
          if (d < bd) { bd = d; t = a; }
        }
      }
      if (t) {
        const dx = t.x - this.x, dy = t.y - this.y, d = Math.hypot(dx, dy) || 1;
        if (d > 10) { this.x += (dx / d) * spd * 1.05; this.y += (dy / d) * spd * 1.05; this.dir = Math.atan2(dy, dx); }
        else if (this.cool <= 0) {
          this.cool = 60;
          if (t.kind) { t.hp -= 10; if (t.hp <= 0) t.dead = true; }
          else {
            t.health -= 8;
            world.log('a wolf mauled ' + t.name, 3);
            if (Math.random() < .6) this.giveUp = 260;
          }
        }
      } else this.roam(spd);
      this.cool--;
    }
    this.x = clamp(this.x, 2, WORLD_W - 2);
    this.y = clamp(this.y, 2, WORLD_H - 2);
  }
  roam(spd) {
    this.t--;
    if (this.t <= 0) { this.t = rndInt(30, 120); this.dir += gauss() * 1.3; }
    const ux = Math.cos(this.dir), uy = Math.sin(this.dir);
    if (!walkable(this.x + ux * spd, this.y + uy * spd)) this.dir += 2.2;
    else { this.x += ux * spd; this.y += uy * spd; }
  }
}

class Agent {
  constructor(x, y, sex, traits, tribe, gen) {
    this.id = world.nextId++;
    this.name = makeName();
    this.sex = sex;
    this.x = x; this.y = y;
    this.dir = rnd(0, Math.PI * 2);
    this.age = 16;
    this.alive = true;
    this.health = 100;
    this.hunger = rnd(60, 100);
    this.energy = rnd(60, 100);
    this.social = rnd(40, 80);
    this.fun = rnd(40, 80);
    this.faith = rnd(40, 80);
    this.reproDrive = rnd(30, 70);
    this.traits = traits || {
      strength: clamp(50 + gauss() * 15, 5, 100),
      intelligence: clamp(50 + gauss() * 15, 5, 100),
      curiosity: clamp(50 + gauss() * 15, 5, 100),
      aggression: clamp(45 + gauss() * 18, 2, 100),
      sociability: clamp(55 + gauss() * 15, 5, 100),
      industry: clamp(50 + gauss() * 15, 5, 100),
      stamina: clamp(50 + gauss() * 15, 5, 100),
      beauty: clamp(50 + gauss() * 15, 5, 100),
      devout: clamp(50 + gauss() * 22, 1, 100)
    };
    if (this.traits.devout === undefined) this.traits.devout = clamp(50 + gauss() * 22, 1, 100);
    this.skills = { forage: rnd(5, 25), hunt: rnd(5, 25), build: rnd(2, 15), fight: rnd(5, 25), craft: rnd(2, 15), farm: 0, research: rnd(2, 15), teach: rnd(2, 15), speak: rnd(5, 30), heal: rnd(2, 12) };
    this.lex = makeLexicon();
    this.rel = new Map();
    this.brain = new Brain();
    this.tribe = tribe;
    this.religion = tribe && tribe.religion ? tribe.religion : null;
    this.motherId = 0; this.fatherId = 0;
    this.children = [];
    this.partnerId = 0;
    this.married = false;
    this.pregnant = 0;
    this.reproCooldown = 0;
    this.generation = gen || 1;
    this.lastAction = A_WANDER;
    this.sleeping = false;
    this.memories = [];
    this.thoughts = [];
    this.birthYear = world.year;
    this.inputs = new Float32Array(N_IN);
    this.biasVec = new Float32Array(N_OUT);
    this.actTally = new Int16Array(N_OUT);
    this.influence = 1;
    this.wanderAngle = rnd(0, Math.PI * 2);
    this.wanderT = 0;
    this.wealth = 0;
    this.profession = 'wanderer';
    this.sick = 0;
    this.immune = false;
    this.walkPhase = rnd(0, 6.28);
    this.moving = false;
    if (tribe) tribe.members++;
  }
  get aliveAdult() { return this.age >= 14; }
  get str() { return this.traits.strength; }
  get int() { return this.traits.intelligence; }
  get devout() { return this.traits.devout; }
  get nation() { return this.tribe ? this.tribe.nation : null; }

  aff(o) { const v = this.rel.get(o.id); return v === undefined ? 0 : v; }
  bumpAff(o, amt) {
    const v = clamp(this.aff(o) + amt, -100, 100);
    this.rel.set(o.id, v);
  }
  remember(text, tone) {
    this.memories.push({ t: world.year, text, tone: tone || 0 });
    if (this.memories.length > 14) this.memories.shift();
  }
  think(text) {
    this.thoughts.push({ t: world.year, text });
    if (this.thoughts.length > 40) this.thoughts.shift();
    if (world.selected === this) world.thoughtDirty = true;
  }

  decay() {
    const ac = this.age < 3 ? 1.7 : this.age < 14 ? 1.3 : this.age > 55 ? 1.35 : 1;
    if (this.reproCooldown > 0) this.reproCooldown--;
    if (this.sick > 0) this.sick--;
    this.hunger = clamp(this.hunger - .05 * ac, 0, 100);
    this.energy = clamp(this.energy - (this.sleeping ? -.5 : .042 * ac), 0, 100);
    this.social = clamp(this.social - .022 * ac, 0, 100);
    this.fun = clamp(this.fun - .028 * ac, 0, 100);
    this.faith = clamp(this.faith - .02 * ac, 0, 100);
    if (this.age >= 14) this.reproDrive = clamp(this.reproDrive - .3 * ac, 0, 100);
    if (this.pregnant > 0) this.hunger = clamp(this.hunger - .015, 0, 100);
    if (this.hunger <= 0) this.health -= .07;
    else if (this.hunger > 40 && this.energy > 30) this.health = clamp(this.health + .09, 0, 100);
    if (this.sick > 0) this.health -= .05;
    if (this.sleeping) this.energy = clamp(this.energy + .55, 0, 100);
    if ((world.tick & 7) === 0) {
      for (const [k, v] of this.rel) {
        const nv = v * .996;
        if (Math.abs(nv) < .05) this.rel.delete(k); else this.rel.set(k, nv);
      }
    }
  }

  sense() {
    const x = this.x, y = this.y, inputs = this.inputs;
    const nearA = agentGrid.query(x, y, 165, _tmpA);
    let mate = null, friend = null, enemy = null;
    let bestM = 1e9, bestF = 1e9, bestE = 1e9;
    for (let i = 0; i < nearA.length; i++) {
      const o = nearA[i];
      if (o === this || !o.alive) continue;
      const d = dist2(x, y, o.x, o.y);
      const af = this.aff(o);
      if (o.sex !== this.sex && o.age >= 14 && this.age >= 14 && o.pregnant === 0 && d < bestM) { bestM = d; mate = o; }
      if (af > -20 && d < bestF) { bestF = d; friend = o; }
      const foe = (this.tribe && o.tribe && this.tribe.host(o.tribe) > 25) ||
        (this.nation && o.nation && o.nation !== this.nation && this.nation.atWarWith(o.nation)) ||
        af < -45;
      if (foe && d < bestE) { bestE = d; enemy = o; }
    }
    const nearR = resGrid.query(x, y, 115, _tmpR);
    let food = null, wood = null, stone = null, gold = null;
    let bf = 1e9, bw = 1e9, bs = 1e9, bg = 1e9;
    for (let i = 0; i < nearR.length; i++) {
      const r = nearR[i];
      if (r.amount <= .5) continue;
      const d = dist2(x, y, r.x, r.y);
      if ((r.kind === 'berry' || r.kind === 'meat') && d < bf) { bf = d; food = r; }
      else if (r.kind === 'tree' && d < bw) { bw = d; wood = r; }
      else if (r.kind === 'rock' && d < bs) { bs = d; stone = r; }
      else if (r.kind === 'gold' && d < bg) { bg = d; gold = r; }
    }
    let prey = null, wolf = null, bpr = 1e9, bwo = 1e9;
    const nearAn = animalGrid.query(x, y, 140, _tmpAn);
    for (let i = 0; i < nearAn.length; i++) {
      const a2 = nearAn[i];
      const d = dist2(x, y, a2.x, a2.y);
      if (a2.kind === 'deer') { if (d < bpr) { bpr = d; prey = a2; } }
      else if (a2.kind === 'wolf') { if (d < bwo) { bwo = d; wolf = a2; } }
    }
    let shrine = null, bsh = 1e9;
    const nearB = buildingGrid.query(x, y, 70, _tmpB);
    for (let i = 0; i < nearB.length; i++) {
      const b = nearB[i];
      if (b.type !== 'shrine' && b.type !== 'temple' && b.type !== 'monument') continue;
      const d = dist2(x, y, b.x, b.y);
      if (d < bsh) { bsh = d; shrine = b; }
    }
    const water = nearestWater(x, y, this.hunger < 40 ? 6 : 2);
    const tribe = this.tribe;
    const nation = this.nation;
    const era = tribe ? tribe.era : 0;
    const store = tribe ? tribe.store : { food: 0, wood: 0, stone: 0, gold: 0 };

    inputs[I_HUNGER] = 1 - this.hunger / 100;
    inputs[I_ENERGY] = 1 - this.energy / 100;
    inputs[I_SOCIAL] = 1 - this.social / 100;
    inputs[I_FUN] = 1 - this.fun / 100;
    inputs[I_REPRO] = this.age < 14 ? 0 : 1 - this.reproDrive / 100;
    inputs[I_FAITH] = 1 - this.faith / 100;
    inputs[I_DANGER] = wolf ? clamp(1 - Math.sqrt(bwo) / 140, 0, 1) * (this.age < 12 ? 1.4 : 1) : (enemy ? .5 : 0);
    inputs[I_AGE] = clamp(this.age / 75, 0, 1.4);
    inputs[I_HEALTH] = this.health / 100;
    inputs[I_FOOD] = food ? 1 : (store.food > 5 ? .8 : 0);
    inputs[I_WOOD] = wood ? 1 : 0;
    inputs[I_STONE] = stone ? 1 : 0;
    inputs[I_GOLD] = gold ? 1 : 0;
    inputs[I_MATE] = mate ? 1 : 0;
    inputs[I_FRIEND] = friend ? 1 : 0;
    inputs[I_ENEMY] = enemy ? 1 : 0;
    inputs[I_PREY] = prey ? 1 : 0;
    inputs[I_WATER] = water ? 1 : 0;
    inputs[I_NIGHT] = world.night ? 1 : 0;
    inputs[I_ERA] = clamp(era / 16, 0, 1);
    inputs[I_POP] = clamp(world.pop / MAX_POP, 0, 1);
    inputs[I_STORE] = clamp(store.food / 60, 0, 1);
    inputs[I_STR] = this.str / 100;
    inputs[I_INT] = this.int / 100;
    inputs[I_CUR] = this.traits.curiosity / 100;
    inputs[I_AGG] = this.traits.aggression / 100;
    inputs[I_IND] = this.traits.industry / 100;
    inputs[I_DEVOUT] = this.devout / 100;
    inputs[I_WAR] = nation && nation.atWar.size ? 1 : 0;
    inputs[I_WEALTH] = clamp(this.wealth / 40, 0, 1);
    inputs[I_STATUS] = clamp(this.influence / 160, 0, 1);
    inputs[I_SHRINE] = shrine ? 1 : 0;

    return { mate, friend, enemy, food, wood, stone, gold, prey, wolf, water, shrine, era, store, nation };
  }

  bias(s) {
    const b = _biasBuf;
    b.fill(0);
    const hungerU = this.inputs[I_HUNGER], energyU = this.inputs[I_ENERGY];
    const socialU = this.inputs[I_SOCIAL], funU = this.inputs[I_FUN], faithU = this.inputs[I_FAITH];
    b[A_FORAGE] = hungerU * 2.4 + .1;
    b[A_HUNT] = (s.prey ? 1.3 : 0) * hungerU + (this.skills.hunt / 100) * .3;
    b[A_REST] = energyU * 2.6 + (world.night ? .7 : 0) + (this.age < 6 ? .4 : 0);
    b[A_SOCIAL] = socialU * 1.9 + (this.traits.sociability / 100) * .4;
    b[A_PLAY] = funU * 1.5 * (this.age < 15 ? 1.6 : 1);
    b[A_WORK] = (this.traits.industry / 100) * 1.3 * (1 - hungerU * .7) * (this.age < 8 ? 0 : 1);
    b[A_RESEARCH] = (this.int / 100) * 2.7 * (1 - hungerU * .75) * (s.era >= 1 ? 1.15 : .8) * (this.age < 10 ? .2 : 1);
    b[A_REPRODUCE] = this.age < 14 ? -6 : (1 - this.reproDrive / 100) * 3.1 * (s.mate ? 1 : .45) * (this.health > 55 ? 1 : -4) * (world.pop > MAX_POP * 1.15 ? .2 : 1) * (world.pop < 8 ? 3 : 1);
    const foeBoost = s.enemy ? (1.6 + (this.tribe && s.enemy.tribe ? this.tribe.host(s.enemy.tribe) / 45 : 0)) : -6;
    let agg = (this.traits.aggression / 100) * 1.2 * foeBoost * (this.health > 55 ? 1 : -3) * (this.age < 12 ? -3 : 1) * (.55 + s.era * .07);
    if (this.religion && this.religion.doctrine.fx.war) agg *= this.religion.doctrine.fx.war;
    b[A_ATTACK] = agg;
    b[A_BUILD] = (this.traits.industry / 100) * 1.45 * (world.canBuild(this.tribe) ? 1.3 : -4);
    b[A_WANDER] = (this.traits.curiosity / 100) * .8 + .15 + this.inputs[I_DANGER] * 2.6;
    b[A_TEACH] = (world.nearChild(this, s) ? (this.age > 16 ? 1.2 : -2) : -3);
    b[A_PRAY] = faithU * 2.9 * (.6 + this.devout / 100) + (s.shrine ? 1.2 : 0) + (this.profession === 'priest' ? 1.4 : 0);
    const n = this.nation;
    b[A_RAID] = (n && n.atWar.size && this.age >= 14 && this.health > 45) ? (1.4 + this.traits.aggression / 100 * 1.6) * (this.profession === 'warrior' ? 1.8 : 1) : -6;
    if (this.age < 8) { b[A_WORK] = -3; b[A_RESEARCH] = -3; b[A_ATTACK] = -3; b[A_RAID] = -6; }
    if (this.health < 35) { b[A_REST] += 1.2; b[A_ATTACK] -= 2; b[A_HUNT] -= 1; b[A_RAID] -= 4; }
    const starve = Math.max(0, 38 - this.hunger), tire = Math.max(0, 30 - this.energy);
    b[A_FORAGE] += starve * .5 + (this.hunger <= 0 ? 25 : 0);
    b[A_HUNT] += starve * .18;
    b[A_REST] += tire * .6 + (this.energy <= 0 ? 25 : 0);
    if (this.health < 40) b[A_REST] += 2;
    if (this.sick > 0) { b[A_REST] += 2.5; b[A_FORAGE] += 1; b[A_RAID] = -6; }
    if (world.festival && this.religion === world.festival.religion && this.faith < 90) {
      b[A_WANDER] += 3.2;
      b[A_PRAY] += 1.5;
    }
    return b;
  }

  tick() {
    if (!this.alive) return;
    this.age += 1 / TICKS_PER_YEAR;
    this.decay();
    if (this.pregnant > 0) {
      this.pregnant--;
      if (this.pregnant === 0) world.birth(this);
    }
    const s = this.sense();
    this._s = s;
    const out = this.brain.forward(this.inputs);
    const bias = this.bias(s);
    this.biasVec.set(bias);
    let best = -1e9, bi = A_WANDER;
    for (let k = 0; k < N_OUT; k++) {
      const v = out[k] + bias[k] + gauss() * .32;
      if (v > best) { best = v; bi = k; }
    }
    if (Math.random() < .015) bi = rndInt(0, N_OUT - 1);
    const prev = this.lastAction;
    this.lastAction = bi;
    this.actTally[bi]++;
    const reward = this.act(bi, s);
    this.brain.learn(this.inputs, bi, reward);
    if (bi !== prev && (world.tick & 3) === this.id % 4) world.speakFor(this, s);
    this.checkDeath();
  }

  act(a, s) {
    const spd = this.speed();
    this.moving = false;
    switch (a) {
      case A_FORAGE: return this.doForage(s, spd);
      case A_HUNT: return this.doHunt(s, spd);
      case A_REST: this.sleeping = true; this.energy = clamp(this.energy + .5, 0, 100); return this.energy > 85 ? .05 : .45;
      case A_SOCIAL: return this.doSocial(s, spd);
      case A_PLAY: {
        this.fun = clamp(this.fun + 11, 0, 100);
        this.energy = clamp(this.energy - 2.5, 0, 100);
        this.wander(spd);
        if (s.friend && dist2(this.x, this.y, s.friend.x, s.friend.y) < 900) { this.social = clamp(this.social + 4, 0, 100); this.bumpAff(s.friend, 2); }
        return .5;
      }
      case A_WORK: return this.doWork(s, spd);
      case A_RESEARCH: return this.doResearch(s);
      case A_REPRODUCE: return this.doReproduce(s, spd);
      case A_ATTACK: return this.doAttack(s, spd);
      case A_BUILD: return this.doBuild(s, spd);
      case A_WANDER: return this.doWander(s, spd);
      case A_TEACH: return this.doTeach(s, spd);
      case A_PRAY: return this.doPray(s, spd);
      case A_RAID: return this.doRaid(s, spd);
    }
    return 0;
  }

  speed() {
    let sp = .68;
    if (this.age < 3) sp = .34;
    else if (this.age < 8) sp = .45;
    else if (this.age < 14) sp = .55;
    else if (this.age > 60) sp = .42;
    sp *= .7 + .3 * (this.energy / 100);
    if (this.sick > 0) sp *= .6;
    const t = tileAtPx(this.x, this.y);
    if (t === T_FOREST) sp *= .82;
    else if (t === T_ROCK) sp *= .7;
    return sp;
  }

  moveToward(tx, ty, spd) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d, uy = dy / d;
    this.moving = true;
    this.walkPhase += spd * .55;
    if (d < spd) { this.x = tx; this.y = ty; this.dir = Math.atan2(uy, ux); return; }
    if (this.tryStep(ux * spd, uy * spd)) { this.dir = Math.atan2(uy, ux); return; }
    if (this.tryStep(-uy * spd, ux * spd)) return;
    if (this.tryStep(uy * spd, -ux * spd)) return;
    this.dir = rnd(0, Math.PI * 2);
  }
  tryStep(dx, dy) {
    const nx = this.x + dx, ny = this.y + dy;
    if (walkable(nx, ny)) { this.x = nx; this.y = ny; return true; }
    return false;
  }
  wander(spd) {
    const s = this._s;
    if (world.festival && this.religion === world.festival.religion && this.faith < 92) {
      this.moveToward(world.festival.x, world.festival.y, spd);
      return;
    }
    if (s && s.wolf) {
      const dx = this.x - s.wolf.x, dy = this.y - s.wolf.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d < 80) {
        const ux = dx / d, uy = dy / d;
        this.wanderAngle = Math.atan2(uy, ux);
        if (!this.tryStep(ux * spd * 1.2, uy * spd * 1.2)) { this.wanderAngle += 1.6; this.tryStep(-uy * spd, ux * spd); }
        this.dir = this.wanderAngle;
        this.moving = true;
        return;
      }
    }
    this.wanderT--;
    if (this.wanderT <= 0) { this.wanderT = rndInt(30, 120); this.wanderAngle += gauss() * 1.2; }
    const ux = Math.cos(this.wanderAngle), uy = Math.sin(this.wanderAngle);
    this.moving = true;
    this.walkPhase += spd * .5;
    if (!this.tryStep(ux * spd, uy * spd)) this.wanderAngle += 2;
    this.dir = this.wanderAngle;
  }
  doWander(s, spd) {
    if (world.festival && this.religion === world.festival.religion) {
      const d = Math.sqrt(dist2(this.x, this.y, world.festival.x, world.festival.y));
      if (d > 25) { this.moveToward(world.festival.x, world.festival.y, spd); return .3; }
      this.faith = clamp(this.faith + .05, 0, 100);
      this.social = clamp(this.social + .04, 0, 100);
      this.fun = clamp(this.fun + .04, 0, 100);
      return .3;
    }
    this.wander(spd);
    return s.wolf ? .3 : .06;
  }

  doForage(s, spd) {
    const tribe = this.tribe;
    if (this.hunger < 75 && tribe && tribe.store.food >= 1) {
      tribe.store.food -= 1;
      this.hunger = clamp(this.hunger + 40, 0, 100);
      this.fun = clamp(this.fun + 1, 0, 100);
      return 1;
    }
    let t = s.food;
    if (!t) {
      const wide = resGrid.query(this.x, this.y, 430, _tmpR2);
      let bd = 1e9;
      for (const r of wide) {
        if (r.amount <= .5 || (r.kind !== 'berry' && r.kind !== 'meat')) continue;
        const d = dist2(this.x, this.y, r.x, r.y);
        if (d < bd) { bd = d; t = r; }
      }
    }
    if (!t) { this.wander(spd); return -.05; }
    const d = Math.sqrt(dist2(this.x, this.y, t.x, t.y));
    if (d > 9) { this.moveToward(t.x, t.y, spd); return .02; }
    t.amount -= 1;
    const gain = (t.kind === 'meat' ? 40 : 30) * (1 + (tribe ? tribe.era : 0) * .02);
    this.hunger = clamp(this.hunger + gain, 0, 100);
    if (tribe && this.hunger > 99) tribe.store.food = Math.min(tribe.store.food + 2, 60 + tribe.members * 3);
    this.skills.forage = clamp(this.skills.forage + .05, 0, 100);
    this.wealth += .006;
    return 1;
  }

  doHunt(s, spd) {
    const t = s.prey;
    if (!t) return this.doForage(s, spd) * .5;
    const dx = t.x - this.x, dy = t.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d > 12) { this.moveToward(t.x, t.y, spd * 1.12); return .02; }
    const dmg = (.7 + this.str / 55 + this.skills.hunt / 60) * (1 + (this.tribe ? this.tribe.weapon : 0));
    t.hp -= dmg;
    this.skills.hunt = clamp(this.skills.hunt + .08, 0, 100);
    this.energy = clamp(this.energy - .25, 0, 100);
    if (t.hp <= 0) {
      t.dead = true;
      this.hunger = clamp(this.hunger + 30, 0, 100);
      this.remember('hunted a deer', 1);
      this.wealth += .04;
      return 1.3;
    }
    return .35;
  }

  doSocial(s, spd) {
    let o = s.friend;
    if (!o) {
      const near = agentGrid.query(this.x, this.y, 420, _tmpA2);
      let bd = 1e9;
      for (let i = 0; i < near.length; i++) {
        const a2 = near[i];
        if (!a2.alive || a2 === this) continue;
        const dd = dist2(this.x, this.y, a2.x, a2.y);
        if (dd < bd) { bd = dd; o = a2; }
      }
    }
    if (!o) { this.wander(spd); return .05; }
    const d = Math.sqrt(dist2(this.x, this.y, o.x, o.y));
    if (d > 18) { this.moveToward(o.x, o.y, spd); return .03; }
    this.talk(o);
    return .85;
  }

  talk(o) {
    this.social = clamp(this.social + 15, 0, 100);
    o.social = clamp(o.social + 15, 0, 100);
    this.fun = clamp(this.fun + 4, 0, 100);
    o.fun = clamp(o.fun + 4, 0, 100);
    const bias = (o.aff(this) > this.aff(o) ? -1 : 1);
    this.bumpAff(o, 5 + bias);
    o.bumpAff(this, 5 - bias);
    const mine = this.influence, theirs = o.influence;
    for (const c of CONCEPTS) {
      const a = this.lex[c], b = o.lex[c];
      if (a && !b) o.lex[c] = a;
      else if (!a && b) this.lex[c] = b;
      else if (a && b && a !== b) {
        const winner = mine >= theirs ? this : o;
        const loser = winner === this ? o : this;
        if (Math.random() < .3 + winner.influence / 300) loser.lex[c] = winner.lex[c];
      }
    }
    if (this.religion && o.religion && this.religion !== o.religion) {
      const pa = this.devout * (this.religion.fervor + 20);
      const pb = o.devout * (o.religion.fervor + 20);
      if (pa > pb * 1.35 && Math.random() < .05) { o.convertTo(this.religion, this); }
      else if (pb > pa * 1.35 && Math.random() < .05) { this.convertTo(o.religion, o); }
    } else if (this.religion && !o.religion && Math.random() < .08) {
      o.convertTo(this.religion, this);
    }
    const teacher = mine >= theirs ? this : o;
    const student = teacher === this ? o : this;
    if (Math.random() < .5) {
      const keys = ['forage', 'hunt', 'build', 'fight', 'craft', 'farm', 'research', 'teach', 'heal'];
      const k = pick(keys);
      if (teacher.skills[k] > student.skills[k] + 4) {
        student.skills[k] = clamp(student.skills[k] + .06 + teacher.skills[k] * .0006, 0, 100);
        student.skills.speak = clamp(student.skills.speak + .03, 0, 100);
        if (teacher.tribe && student.tribe === teacher.tribe && teacher.tribe.era >= 7) teacher.tribe.tech += .004;
      }
    }
    if (this.tribe && o.tribe === this.tribe) {
      this.tribe.chatter++;
      if (Math.random() < .03) this.tribe.tech += .0016;
    } else if (this.tribe && o.tribe && this.tribe !== o.tribe) {
      if (this.tribe.host(o.tribe) > 0) this.tribe.hostility.set(o.tribe.id, Math.max(0, this.tribe.host(o.tribe) - .15));
      if (o.tribe.host(this.tribe) > 0) o.tribe.hostility.set(this.tribe.id, Math.max(0, o.tribe.host(this.tribe) - .15));
    }
  }

  convertTo(r, by) {
    this.religion = r;
    r.adherents++;
    this.remember('converted to ' + r.name, 1);
    this.think('The ' + r.name + ' way is the true way. ' + r.deity + ' watches over me.');
  }

  doWork(s, spd) {
    const tribe = this.tribe;
    if (!tribe) { this.wander(spd); return 0; }
    let kind = 'tree';
    if (tribe.store.wood < 30) kind = 'tree';
    else if (tribe.store.stone < 25) kind = 'rock';
    else if (tribe.store.gold < 12 && tribe.era >= 5) kind = 'gold';
    else if (Math.random() < .5) kind = 'tree';
    let t = kind === 'tree' ? s.wood : kind === 'rock' ? s.stone : s.gold;
    if (!t) {
      const wide = resGrid.query(this.x, this.y, 380, _tmpR2);
      let bd = 1e9;
      for (const r of wide) {
        if (r.kind !== kind || r.amount <= .5) continue;
        const d = dist2(this.x, this.y, r.x, r.y);
        if (d < bd) { bd = d; t = r; }
      }
    }
    if (!t) { this.wander(spd); return -.05; }
    const d = Math.sqrt(dist2(this.x, this.y, t.x, t.y));
    if (d > 10) { this.moveToward(t.x, t.y, spd); return .02; }
    const rate = (.02 + this.skills.craft / 5000) * (1 + tribe.era * .06);
    if (kind === 'tree') tribe.store.wood += rate;
    else if (kind === 'rock') tribe.store.stone += rate * .8;
    else tribe.store.gold += rate * .35;
    t.amount -= rate * 2;
    this.wealth += rate * .6;
    this.skills.craft = clamp(this.skills.craft + .02, 0, 100);
    return .3;
  }

  doResearch(s) {
    const tribe = this.tribe;
    if (!tribe) return 0;
    if (this.hunger < 25 || this.health < 30) return -.2;
    let bonus = tribe.researchBonus;
    if (this.religion && this.religion.doctrine.fx.research) bonus *= this.religion.doctrine.fx.research;
    const behind = clamp(world.eraPeak - tribe.era, 0, 8);
    const rate = .004 * (1 + this.int / 50) * (1 + Math.min(tribe.members, 60) / 60) * Math.pow(1.22, tribe.era) * bonus * (1 + behind * .8);
    const before = tribe.era;
    tribe.tech += rate;
    this.skills.research = clamp(this.skills.research + .03, 0, 100);
    this.fun = clamp(this.fun - .05, 0, 100);
    world.updateEra(tribe);
    if (tribe.era > before) return 3;
    return .22;
  }

  doReproduce(s, spd) {
    if (this.age < 14 || this.age > 55) return -.4;
    if (this.pregnant > 0 || this.reproCooldown > 0) return -.3;
    if (this.health < 55 || this.hunger < 35) return -.3;
    let m = s.mate;
    if (m && this.married && this.partnerId && m.id !== this.partnerId) m = s.mate;
    if (!m) {
      const near = agentGrid.query(this.x, this.y, 420, _tmpA2);
      let bd = 1e9;
      for (const o of near) {
        if (!o.alive || o === this || o.sex === this.sex || o.age < 14 || o.age > 58 || o.pregnant > 0 || o.reproCooldown > 0) continue;
        const dd = dist2(this.x, this.y, o.x, o.y);
        if (dd < bd) { bd = dd; m = o; }
      }
    }
    if (!m) { this.wander(spd); return -.05; }
    const d = Math.sqrt(dist2(this.x, this.y, m.x, m.y));
    if (d > 22) { this.moveToward(m.x, m.y, spd); return .03; }
    this.bumpAff(m, 3);
    m.bumpAff(this, 3);
    this.social = clamp(this.social + 8, 0, 100);
    m.social = clamp(m.social + 8, 0, 100);
    this.fun = clamp(this.fun + 3, 0, 100);
    const willing = m.age >= 14 && m.age <= 58 && m.pregnant === 0 && m.reproCooldown === 0 &&
      m.health > 50 && m.hunger > 25 && this.aff(m) > -30;
    if (willing) {
      let crowd = clamp((MAX_POP * 1.15 - world.pop) / (MAX_POP * .45), 0, 1);
      const R = this.religion || m.religion;
      if (R && R.doctrine.fx.birth) crowd *= R.doctrine.fx.birth;
      if (world.festival && (this.religion === world.festival.religion || m.religion === world.festival.religion)) crowd *= 2.2;
      if (crowd > 0 && Math.random() < .2 * crowd) {
        const female = this.sex === 'F' ? this : m;
        const male = this.sex === 'F' ? m : this;
        if (female.pregnant === 0) {
          female.pregnant = 150;
          female.reproDrive = 100;
          male.reproDrive = 100;
          female.partnerId = male.id;
          male.partnerId = female.id;
          const wed = female.aff(male) > 25 && male.aff(female) > 25;
          if (wed) { female.married = true; male.married = true; }
          female.bumpAff(male, 25);
          male.bumpAff(female, 25);
          female.remember('carrying a child', 1);
          male.remember('fathering a child', 1);
          world.log(male.name + ' and ' + female.name + (wed ? ' were wed' : ' are expecting') + '.', 1);
          if (male.nation && female.nation && male.nation !== female.nation) {
            world.marriageAlliance(male.nation, female.nation);
          }
          return 4;
        }
      }
      return .55;
    }
    return .3;
  }

  doAttack(s, spd) {
    let t = s.enemy;
    const wolf = s.wolf;
    if (wolf && (!t || dist2(this.x, this.y, wolf.x, wolf.y) < dist2(this.x, this.y, t.x, t.y)) && (this.str > 45 || Math.random() < .5)) t = wolf;
    if (!t) { this.wander(spd); return -.15; }
    const d = Math.sqrt(dist2(this.x, this.y, t.x, t.y));
    if (d > 11) { this.moveToward(t.x, t.y, spd * 1.15); return .02; }
    let dmg = (.9 + this.str / 45 + this.skills.fight / 45) * (1 + (this.tribe ? this.tribe.weapon : 0));
    const n = this.nation;
    if (n && t.nation && n.atWarWith(t.nation)) {
      dmg *= 1 + n.aggression;
      if (n.religion && n.religion.doctrine.fx.war) dmg *= 1.15;
    }
    if (this.religion && this.religion.doctrine.fx.war) dmg *= 1.1;
    if (t.kind) {
      t.hp -= dmg;
      if (t.hp <= 0) t.dead = true;
    } else {
      t.health -= dmg;
    }
    this.skills.fight = clamp(this.skills.fight + .07, 0, 100);
    this.energy = clamp(this.energy - .3, 0, 100);
    this.traits.aggression = clamp(this.traits.aggression + .02, 1, 100);
    if (!t.kind && t.alive && t.health <= 0) {
      t.health = 0;
      this.remember('killed ' + t.name, 3);
      t.remember('slain by ' + this.name, 3);
      world.kills++;
      if (n && t.nation && n !== t.nation) n.warDeaths++;
      if (this.tribe && t.tribe && this.tribe !== t.tribe) {
        const a = this.tribe, b = t.tribe;
        a.killCount++;
        b.lost++;
        a.hostility.set(b.id, Math.min(100, a.host(b) + 10));
        b.hostility.set(a.id, Math.min(100, b.host(a) + 34));
        world.log(this.name + ' of ' + a.name + ' killed ' + t.name + ' of ' + b.name + '!', 3);
        if (b.host(a) > 25 && !b.feuds.has(a.id)) {
          b.feuds.add(a.id);
          world.log('*** BLOOD FEUD: ' + b.name + ' vs ' + a.name + ' ***', 3);
        }
      }
      t.die('murder');
      const wit = agentGrid.query(this.x, this.y, 110, _tmpA2);
      for (let i = 0; i < wit.length; i++) {
        const w = wit[i];
        if (w === this || !w.alive) continue;
        w.bumpAff(this, -30);
        if (w.tribe === t.tribe) w.bumpAff(this, -20);
      }
      return 2.2;
    }
    if (t.kind && t.dead) {
      world.spawnMeat(t.x, t.y, t.kind === 'deer' ? 26 : 20);
      this.remember('slew a ' + t.kind, 1);
      return 1.6;
    }
    return .5;
  }

  doRaid(s, spd) {
    const n = this.nation;
    if (!n || !n.atWar.size) return this.doWander(s, spd) * .5;
    if (this.age < 14 || this.health < 40) return -.2;
    const band = world.bandFor(n);
    const tx = band ? band.tx : world.enemyCapitalX(n);
    const ty = band ? band.ty : world.enemyCapitalY(n);
    if (band && band.memberIds.indexOf(this.id) < 0) band.memberIds.push(this.id);
    if (s.enemy) {
      const d = Math.sqrt(dist2(this.x, this.y, s.enemy.x, s.enemy.y));
      if (d > 11) { this.moveToward(s.enemy.x, s.enemy.y, spd * 1.15); return .1; }
      return this.doAttack(s, spd);
    }
    const nearB = buildingGrid.query(this.x, this.y, 90, _tmpB2);
    for (let i = 0; i < nearB.length; i++) {
      const b = nearB[i];
      if (!b.destroyed && b.nation && b.nation !== n) {
        const d = Math.sqrt(dist2(this.x, this.y, b.x, b.y));
        if (d > 14) { this.moveToward(b.x, b.y, spd * 1.1); return .1; }
        b.hp -= .15 + this.str / 300;
        this.energy = clamp(this.energy - .1, 0, 100);
        if (b.hp <= 0) {
          b.destroyed = true;
          world.onBuildingDestroyed(b, n);
          return 2.5;
        }
        return .6;
      }
    }
    const d = Math.sqrt(dist2(this.x, this.y, tx, ty));
    if (d > 40) { this.moveToward(tx, ty, spd * 1.08); return .08; }
    this.wander(spd);
    return .05;
  }

  doBuild(s, spd) {
    const tribe = this.tribe;
    if (!tribe) return 0;
    const plan = world.planBuilding(tribe);
    if (!plan) return -.3;
    const cx = tribe.cx, cy = tribe.cy;
    const d = Math.sqrt(dist2(this.x, this.y, cx, cy));
    if (d > 70) { this.moveToward(cx, cy, spd); return .02; }
    if (!walkable(this.x + 8, this.y + 8)) { this.wander(spd); return 0; }
    if (!world.pay(tribe, plan.cost)) return -.2;
    world.placeBuilding(tribe, plan, this.x + rnd(-18, 18), this.y + rnd(-18, 18));
    this.skills.build = clamp(this.skills.build + .5, 0, 100);
    this.wealth += .08;
    this.remember('built a ' + plan.n, 1);
    return 1.4;
  }

  doTeach(s, spd) {
    const near = agentGrid.query(this.x, this.y, 46, _tmpA2);
    let k = null, bd = 1e9;
    for (let i = 0; i < near.length; i++) {
      const a2 = near[i];
      if (!a2.alive || a2.age >= 14 || a2.tribe !== this.tribe) continue;
      const dd = dist2(this.x, this.y, a2.x, a2.y);
      if (dd < bd) { bd = dd; k = a2; }
    }
    if (!k) { this.wander(spd); return -.05; }
    const d = Math.sqrt(dist2(this.x, this.y, k.x, k.y));
    if (d > 20) { this.moveToward(k.x, k.y, spd); return .02; }
    const keys = ['forage', 'hunt', 'build', 'fight', 'craft', 'farm', 'research', 'teach', 'heal'];
    const sk = pick(keys);
    k.skills[sk] = clamp(k.skills[sk] + .025 + this.skills[sk] * .0004, 0, 100);
    k.skills.speak = clamp(k.skills.speak + .02, 0, 100);
    if (this.religion && !k.religion) k.convertTo(this.religion, this);
    this.social = clamp(this.social + 3, 0, 100);
    this.bumpAff(k, 2);
    k.bumpAff(this, 3);
    return .55;
  }

  doPray(s, spd) {
    if (this.faith > 96 && this.health > 60) return .1;
    let target = s.shrine;
    if (!target && this.religion) {
      const far = buildingGrid.query(this.x, this.y, 420, _tmpB2);
      let bd = 1e9;
      for (const b of far) {
        if (b.destroyed) continue;
        if (b.type !== 'shrine' && b.type !== 'temple' && b.type !== 'monument') continue;
        const d = dist2(this.x, this.y, b.x, b.y);
        if (d < bd) { bd = d; target = b; }
      }
    }
    const R = this.religion;
    if (target) {
      const d = Math.sqrt(dist2(this.x, this.y, target.x, target.y));
      if (d > 12) { this.moveToward(target.x, target.y, spd); return .04; }
      const boost = target.type === 'monument' ? 40 : target.type === 'temple' ? 34 : 26;
      this.faith = clamp(this.faith + boost, 0, 100);
      this.social = clamp(this.social + 5, 0, 100);
      this.fun = clamp(this.fun + 4, 0, 100);
      if (R) { R.fervor = clamp(R.fervor + .12, 0, 100); R.adherents = R.adherents; }
      this.wealth += .001;
      if (Math.random() < .004) world.prophecyCheck(this);
      return .7;
    }
    this.faith = clamp(this.faith + 12, 0, 100);
    this.think('I pray to ' + (R ? R.deity : 'the spirits') + '.');
    if (Math.random() < .001) world.prophecyCheck(this);
    return .3;
  }

  checkDeath() {
    if (!this.alive) return;
    const lifespan = 52 + this.traits.stamina * .18 + world.eraGlobal * 1.3;
    if (this.health <= 0) { this.die(this.hunger <= 0 ? 'starved' : this.sick > 0 ? 'plague' : 'injuries'); return; }
    if (this.age > lifespan) {
      const over = this.age - lifespan;
      if (Math.random() < .0004 + over * .00035) { this.die('old age'); return; }
    }
    if (world.eraGlobal < 8 && this.age < 12 && Math.random() < .000012) this.die('sickness');
  }

  die(cause) {
    if (!this.alive) return;
    this.alive = false;
    world.deaths++;
    this.dead = true;
    if (this.pregnant > 0) this.pregnant = 0;
    if (this.tribe) this.tribe.members--;
    this.remember('died (' + cause + ')', 3);
    world.spawnMeat(this.x, this.y, cause === 'old age' ? 22 : 34);
    world.log(this.name + (cause === 'murder' ? ' was murdered' : ' died of ' + cause) + (this.tribe ? ' [' + this.tribe.name + ']' : ''), cause === 'old age' ? 0 : 2);
    const n = this.nation;
    if (n && (n.tier >= 2 || this.religion)) world.addGrave(this.x, this.y, n, this.religion);
    if (this.tribe && this.tribe.era >= 7) {
      for (const k in this.skills) this.tribe.knowledge[k] = Math.max(this.tribe.knowledge[k] || 0, this.skills[k] * .55);
    }
  }
}

const _tmpA = [], _tmpA2 = [], _tmpR = [], _tmpR2 = [], _tmpAn = [], _tmpAn2 = [], _tmpB = [], _tmpB2 = [];
const _biasBuf = new Float32Array(N_OUT);

class Tribe {
  constructor(id, hue) {
    this.id = id;
    this.hue = hue;
    this.name = makeName() + ' Clan';
    this.color = 'hsl(' + hue + ',68%,58%)';
    this.store = { food: 25, wood: 14, stone: 6, gold: 0 };
    this.tech = 0;
    this.era = 0;
    this.members = 0;
    this.buildings = [];
    this.cx = WORLD_W / 2; this.cy = WORLD_H / 2;
    this.researchBonus = 1;
    this.weapon = 0;
    this.knowledge = {};
    this.chatter = 0;
    this._plan = null;
    this.hostility = new Map();
    this.feuds = new Set();
    this.killCount = 0;
    this.lost = 0;
    this.nation = null;
    this.religion = null;
  }
  host(t) { return this.hostility.get(t.id) || 0; }
}
const world = {
  agents: [], animals: [], resources: [], tribes: [], nations: [], religions: [], warBands: [], graves: [],
  nextId: 1, nextTribeId: 4, nextNationId: 1, nextReligId: 1,
  tick: 0, year: 0, sun: 1, night: false,
  pop: 0, eraGlobal: 0, eraPeak: 0, kills: 0, deaths: 0, births: 0, maxGen: 1,
  events: [], selected: null, history: [],
  territory: null, territoryDirty: true,
  festival: null, plague: null,
  stats: { wars: 0, treaties: 0, plagues: 0, festivals: 0, religions: 0, nations: 0 },

  reset() {
    SEED = Math.random() * 1000;
    genTerrain();
    this.agents = []; this.animals = []; this.resources = []; this.tribes = [];
    this.nations = []; this.religions = []; this.warBands = []; this.graves = [];
    this.nextId = 1; this.nextTribeId = 4; this.nextNationId = 1; this.nextReligId = 1;
    this.tick = 0; this.year = 0;
    this.pop = 0; this.eraGlobal = 0; this.eraPeak = 0;
    this.kills = 0; this.deaths = 0; this.births = 0; this.maxGen = 1;
    this.events = []; this.selected = null; this.history = [];
    this.festival = null; this.plague = null;
    this.stats = { wars: 0, treaties: 0, plagues: 0, festivals: 0, religions: 0, nations: 0 };
    this.territory = new Uint16Array(TC * TR);
    this.territoryDirty = true;
    resGrid.clear(); agentGrid.clear(); animalGrid.clear(); buildingGrid.clear();
    this.seedResources();
    this.seedTribes();
    this.seedAnimals();
    this.log('A band of 50 cavemen wakes on an unknown shore.', 4);
    this.log('They know nothing. They will learn everything.', 4);
  },

  addResource(kind, x, y, amount, max, regrow) {
    const r = { kind, x, y, amount, max, regrow };
    this.resources.push(r);
    resGrid.insert(r);
    return r;
  },

  seedResources() {
    for (let y = 1; y < GH - 1; y++) {
      for (let x = 1; x < GW - 1; x++) {
        const t = terrain[y * GW + x];
        const px = x * TILE + TILE / 2, py = y * TILE + TILE / 2;
        if (t === T_FOREST && Math.random() < .13) this.addResource('tree', px + rnd(-2, 2), py + rnd(-2, 2), 30, 30, .004);
        else if (t === T_GRASS && Math.random() < .028) this.addResource('berry', px + rnd(-2, 2), py + rnd(-2, 2), 10, 10, .02);
        else if (t === T_ROCK) {
          if (Math.random() < .03) this.addResource('rock', px, py, 44, 44, .003);
          if (Math.random() < .008) this.addResource('gold', px, py, 22, 22, .0012);
        }
      }
    }
  },

  randomLand(nearX, nearY, radius) {
    for (let i = 0; i < 400; i++) {
      const a = rnd(0, Math.PI * 2), d = Math.sqrt(Math.random()) * radius;
      const x = clamp((nearX || WORLD_W / 2) + Math.cos(a) * d, 10, WORLD_W - 10);
      const y = clamp((nearY || WORLD_H / 2) + Math.sin(a) * d, 10, WORLD_H - 10);
      if (walkable(x, y)) return { x, y };
    }
    return { x: WORLD_W / 2, y: WORLD_H / 2 };
  },

  seedTribes() {
    for (let i = 0; i < 3; i++) {
      const t = new Tribe(i + 1, (i * 360 / 3 + rnd(0, 50)) % 360);
      this.tribes.push(t);
    }
  },

  seedAnimals() {
    for (let i = 0; i < 46; i++) {
      const p = this.randomLand(null, null, 420);
      this.animals.push(new Animal('deer', p.x, p.y));
    }
    for (let i = 0; i < 3; i++) {
      const p = this.randomLand(null, null, 420);
      this.animals.push(new Animal('wolf', p.x, p.y));
    }
  },

  spawnInitialPeople() {
    for (let i = 0; i < 50; i++) {
      const tribe = this.tribes[i % 3];
      const cx = WORLD_W / 2 + Math.cos(tribe.id * 2.1) * 220;
      const cy = WORLD_H / 2 + Math.sin(tribe.id * 2.1) * 160;
      const p = this.randomLand(cx, cy, rnd(120, 300));
      const a = new Agent(p.x, p.y, i % 2 === 0 ? 'F' : 'M', null, tribe, 1);
      a.age = rnd(15, 30);
      this.agents.push(a);
    }
  },

  log(text, tone) {
    this.events.unshift({ text, tone: tone || 0, year: this.year });
    if (this.events.length > 260) this.events.pop();
  },

  countType(t, id) { let n = 0; for (const b of t.buildings) if (b.type === id && !b.destroyed) n++; return n; },
  canPay(t, cost) { for (const k in cost) if (t.store[k] < cost[k]) return false; return true; },
  pay(t, cost) {
    if (!this.canPay(t, cost)) return false;
    for (const k in cost) t.store[k] -= cost[k];
    return true;
  },
  computePlan(t) {
    for (const d of BUILDING_TYPES) {
      if (d.age > t.era) continue;
      if (this.countType(t, d.id) >= d.limit(t.members)) continue;
      if (!this.canPay(t, d.cost)) continue;
      return d;
    }
    return null;
  },
  canBuild(t) { return !!t && !!t._plan; },
  planBuilding(t) { return t ? t._plan : null; },

  placeBuilding(t, plan, x, y) {
    const b = {
      type: plan.id, x: clamp(x, 6, WORLD_W - 6), y: clamp(y, 6, WORLD_H - 6),
      col: plan.col, hp: plan.hp || 60, maxHp: plan.hp || 60, destroyed: false,
      nation: t.nation, tribe: t, year: this.year
    };
    t.buildings.push(b);
    if (t.buildings.length > 80) t.buildings.shift();
    this.log(t.name + ' raised a ' + plan.n + '.', 1);
  },

  updateEra(t) {
    while (t.era + 1 < AGE_LIST.length && t.tech >= AGE_LIST[t.era + 1].t) {
      t.era++;
      if (t.era > this.eraGlobal) {
        this.eraGlobal = t.era;
        this.log('*** ' + t.name + ' entered the ' + AGE_LIST[t.era].n + ' ***', 4);
      } else {
        this.log(t.name + ' reached the ' + AGE_LIST[t.era].n + '.', 1);
      }
    }
  },

  updateTribes() {
    let pop = 0, maxEra = 0;
    for (const t of this.tribes) { t.members = 0; t.cx = 0; t.cy = 0; }
    for (const a of this.agents) {
      if (!a.alive) continue;
      pop++;
      const t = a.tribe;
      if (t) { t.members++; t.cx += a.x; t.cy += a.y; }
    }
    this.pop = pop;
    for (const t of this.tribes) {
      if (t.members > 0) { t.cx /= t.members; t.cy /= t.members; }
      else { const p = this.randomLand(t.cx, t.cy, 100); t.cx = p.x; t.cy = p.y; }
      let foodR = 0, woodR = 0, stoneR = 0, goldR = 0, techR = 0, resM = 0, weapon = 0, socialR = 0, capF = 0, faithR = 0, tradeF = 0, defM = 0, healthM = 0, warM = 0;
      for (const b of t.buildings) {
        if (b.destroyed) continue;
        const d = BUILDING_TYPES.find(x => x.id === b.type);
        if (!d) continue;
        const f = d.fx;
        foodR += f.food || 0; woodR += f.wood || 0; stoneR += f.stone || 0; goldR += f.gold || 0;
        techR += f.tech || 0; resM += f.research || 0; weapon += f.weapon || 0; socialR += f.social || 0;
        capF += f.foodCap || 0; faithR += f.faith || 0; tradeF += f.trade || 0;
        defM += f.defense || 0; healthM += f.health || 0; warM += f.war || 0;
      }
      if (t.religion && t.religion.doctrine.fx.food) foodR *= t.religion.doctrine.fx.food;
      if (t.religion && t.religion.doctrine.fx.weapon) weapon += t.religion.doctrine.fx.weapon;
      t.researchBonus = 1 + resM;
      t.weapon = t.era * .04 + weapon;
      t.socialBonus = socialR;
      t.faithBonus = faithR;
      t.defense = defM;
      t.healthBonus = healthM;
      t.warBonus = warM;
      t.trade = tradeF;
      t.store.food = clamp(t.store.food + foodR, 0, 90 + capF + t.members * 2);
      t.store.wood = clamp(t.store.wood + woodR, 0, 150 + t.members * 4);
      t.store.stone = clamp(t.store.stone + stoneR, 0, 150 + t.members * 4);
      t.store.gold = clamp(t.store.gold + goldR, 0, 80 + t.members * 3);
      t.tech += techR;
      this.updateEra(t);
      if (t.era > maxEra) maxEra = t.era;
      t._plan = this.computePlan(t);
    }
    this.eraGlobal = maxEra;
    if (maxEra > this.eraPeak) this.eraPeak = maxEra;

    for (let i = 0; i < this.tribes.length; i++) {
      const a = this.tribes[i];
      if (a.members === 0) continue;
      for (let j = i + 1; j < this.tribes.length; j++) {
        const b = this.tribes[j];
        if (b.members === 0) continue;
        let hostMul = 1;
        if (a.religion && b.religion && a.religion !== b.religion) hostMul *= a.religion.doctrine.fx.hostile || 1;
        const near = dist2(a.cx, a.cy, b.cx, b.cy) < 300 * 300;
        const peace = (a.peaceUntil && a.peaceUntil.get(b.id) || 0) > this.tick;
        if (peace) continue;
        const friction = near ? (.07 + (a.era + b.era) * .008) * hostMul : -.03;
        const na = clamp(a.host(b) + friction, 0, 100);
        const nb = clamp(b.host(a) + friction, 0, 100);
        if (na > 0) a.hostility.set(b.id, na); else a.hostility.delete(b.id);
        if (nb > 0) b.hostility.set(a.id, nb); else b.hostility.delete(a.id);
        if (na > 25 && !a.feuds.has(b.id)) { a.feuds.add(b.id); this.log('*** BLOOD FEUD: ' + a.name + ' vs ' + b.name + ' ***', 3); }
        if (nb > 25 && !b.feuds.has(a.id)) { b.feuds.add(a.id); this.log('*** BLOOD FEUD: ' + b.name + ' vs ' + a.name + ' ***', 3); }
        if (na < 6) a.feuds.delete(b.id);
        if (nb < 6) b.feuds.delete(a.id);
      }
    }

    for (const t of this.tribes) {
      if (!t.nation && t.members >= 12 && t.era >= 3) {
        t.nation = new Nation(t);
        t.nation.tribe = t;
        this.nations.push(t.nation);
        this.stats.nations++;
        this.log('>>> ' + t.name + ' is now a ' + TITLES[t.nation.tier] + ' ' + t.nation.stem + '.', 4);
      }
    }
    for (const a of this.agents) {
      if (!a.alive) continue;
      a.influence = a.age * .5 + (a.skills.speak + a.skills.teach + a.skills.research) * .25 + a.traits.intelligence * .3 + a.traits.sociability * .2 + a.wealth * .6;
    }
  },

  cellOf(x, y) { return clamp((y / CELL_H) | 0, 0, TR - 1) * TC + clamp((x / CELL_W) | 0, 0, TC - 1); },

  claimTerritory() {
    const votes = new Map();
    const add = (cell, nid, w) => {
      let m = votes.get(cell);
      if (!m) { m = new Map(); votes.set(cell, m); }
      m.set(nid, (m.get(nid) || 0) + w);
    };
    for (const n of this.nations) {
      if (n.members === 0) continue;
      add(this.cellOf(n.capitalX, n.capitalY), n.id, 14);
      for (const b of n.tribe.buildings) {
        if (b.destroyed) continue;
        add(this.cellOf(b.x, b.y), n.id, 5);
        const cx = clamp((b.x / CELL_W) | 0, 0, TC - 1), cy = clamp((b.y / CELL_H) | 0, 0, TR - 1);
        if (cx > 0) add(cy * TC + cx - 1, n.id, 2);
        if (cx < TC - 1) add(cy * TC + cx + 1, n.id, 2);
        if (cy > 0) add((cy - 1) * TC + cx, n.id, 2);
        if (cy < TR - 1) add((cy + 1) * TC + cx, n.id, 2);
      }
      for (const a of this.agents) {
        if (!a.alive || a.tribe !== n.tribe) continue;
        add(this.cellOf(a.x, a.y), n.id, 1);
      }
    }
    let changed = false;
    for (let c = 0; c < this.territory.length; c++) {
      const m = votes.get(c);
      let best = 0, bestN = 0;
      if (m) for (const [nid, v] of m) if (v > best) { best = v; bestN = nid; }
      const cur = this.territory[c];
      if (best >= 2) { if (cur !== bestN) { this.territory[c] = bestN; changed = true; } }
      else if (cur !== 0 && best === 0 && Math.random() < .02) { this.territory[c] = 0; changed = true; }
    }
    if (changed) {
      this.territoryDirty = true;
      for (const n of this.nations) n.cells = 0;
      for (let c = 0; c < this.territory.length; c++) {
        const o = this.territory[c];
        if (!o) continue;
        const n = this.nations.find(x => x.id === o);
        if (n) n.cells++;
      }
    }
  },

  nationTick() {
    for (const n of this.nations) {
      if (!n.affinity) n.affinity = new Map();
      if (n.members === 0) continue;
      const mem = this.agents.filter(a => a.alive && a.tribe === n.tribe);
      n.aggression = 0;
      let w = 0;
      for (const a of mem) { w += a.wealth; n.aggression += a.traits.aggression; }
      n.wealth = w;
      if (mem.length) n.aggression = n.aggression / mem.length / 100;
      let best = null;
      for (const a of mem) if (a.alive && a.age >= 14 && (!best || a.influence > best.influence)) best = a;
      if (!n.rulerId || !mem.some(a => a.id === n.rulerId)) {
        if (best && best.id !== n.rulerId) {
          const heir = n.rulerId ? mem.find(a => a.fatherId === n.rulerId || a.motherId === n.rulerId) : null;
          let next = best;
          if (heir && heir.age >= 14 && heir.influence > best.influence * .8) next = heir;
          if (n.rulerId && best.influence > next.influence * 1.15) {
            this.log('*** ' + n.name + ': a succession struggle! ' + next.name + ' vs ' + best.name + ' ***', 3);
            best.bumpAff(next, -50);
            next.bumpAff(best, -50);
          }
          n.rulerId = next.id;
          n.rulerName = next.name;
          this.log(next.name + ' became ruler of the ' + n.name + '.', 2);
        }
      }
      n.capitalX = n.tribe.cx; n.capitalY = n.tribe.cy;
      n.tier = this.nationTier(n);
      if (n.rulerId) { const r = mem.find(a => a.id === n.rulerId); if (r) r.wealth += .05; }
      let tax = 0;
      for (const a of mem) {
        if (a.age < 14) continue;
        const t = Math.min(a.wealth * .04, 1.2);
        a.wealth = Math.max(0, a.wealth - t);
        tax += t;
      }
      n.treasury = Math.min(n.treasury + tax + mem.length * .035 * (1 + n.tribe.era * .25), 400 + n.members * 6);
      if (n.tier >= 1) {
        n.buildCd = (n.buildCd === undefined ? 6 : n.buildCd) - 1;
        if (n.buildCd <= 0) { n.buildCd = 4; this.nationBuild(n); }
      }
      const rc = {};
      for (const a of mem) if (a.religion) rc[a.religion.id] = (rc[a.religion.id] || 0) + 1;
      let top = null, tv = 0;
      for (const k in rc) if (rc[k] > tv) { tv = rc[k]; top = this.religions.find(r => r.id === +k); }
      if (top && tv >= mem.length * .4) { n.religion = top; n.tribe.religion = top; }
      for (const a of mem) if (!a.religion && n.religion && Math.random() < .05) a.convertTo(n.religion, null);
    }
    if (this.tick % 300 === 0) this.allianceTick();
    if (this.tick % 300 === 0) this.tradeTick();
    if (this.tick % 90 === 0) this.warDeclareTick();
  },

  nationBuild(n) {
    const t = n.tribe;
    let plan = null, price = 0;
    for (const d of BUILDING_TYPES) {
      if (d.age > t.era) continue;
      if (this.countType(t, d.id) >= d.limit(t.members)) continue;
      const p = ((d.cost.wood || 0) + (d.cost.stone || 0) * 1.3 + (d.cost.gold || 0) * 2.5) * 3;
      if (n.treasury < p) continue;
      plan = d; price = p; break;
    }
    if (!plan) return;
    n.treasury -= price;
    const p = this.randomLand(n.capitalX, n.capitalY, 60);
    this.placeBuilding(t, plan, p.x, p.y);
  },

  nationTier(n) {
    const m = n.members, e = n.tribe.era;
    if (e >= 13 && m >= 60) return 5;
    if (e >= 11 && m >= 45) return 4;
    if ((m >= 55 || n.cells >= 26) && e >= 9) return 3;
    if (m >= 32 && e >= 6) return 2;
    if (m >= 12 && e >= 3) return 1;
    return 0;
  },

  marriageAlliance(a, b) {
    if (!a.affinity) a.affinity = new Map();
    if (!b.affinity) b.affinity = new Map();
    a.affinity.set(b.id, clamp((a.affinity.get(b.id) || 0) + 22, -100, 100));
    b.affinity.set(a.id, clamp((b.affinity.get(a.id) || 0) + 22, -100, 100));
    for (const t of [a.tribe, b.tribe]) for (const o of [a.tribe, b.tribe]) if (t !== o) t.hostility.set(o.id, Math.max(0, t.host(o) - 15));
  },

  allianceTick() {
    for (let i = 0; i < this.nations.length; i++) {
      for (let j = i + 1; j < this.nations.length; j++) {
        const a = this.nations[i], b = this.nations[j];
        if (!a.affinity || !b.affinity) continue;
        if (a.members === 0 || b.members === 0) continue;
        const af = a.affinity.get(b.id) || 0, bf = b.affinity.get(a.id) || 0;
        if (af > 55 && bf > 55 && !a.allies.has(b.id) && !a.atWar.has(b.id)) {
          a.allies.add(b.id); b.allies.add(a.id);
          this.log('~~~ ' + a.name + ' and ' + b.name + ' formed an alliance. ~~~', 4);
        }
        if (af < -60 && bf < -60) {
          if (a.allies.has(b.id)) { a.allies.delete(b.id); b.allies.delete(a.id); }
        }
      }
    }
  },

  tradeTick() {
    for (const n of this.nations) {
      if (n.members === 0 || n.tribe.trade <= 0) continue;
      for (const m of this.nations) {
        if (m === n || m.members === 0) continue;
        if (n.atWar.has(m.id)) continue;
        if (dist2(n.capitalX, n.capitalY, m.capitalX, m.capitalY) > 320 * 320) continue;
        const gain = (1.2 + n.tribe.era * .8) * (n.tribe.trade + m.tribe.trade);
        n.treasury = Math.min(n.treasury + gain, 500 + n.members * 8);
        m.treasury = Math.min(m.treasury + gain, 500 + m.members * 8);
        if (Math.random() < .05) this.log('a trade caravan travels between ' + n.stem + ' and ' + m.stem + '.', 1);
      }
    }
  },

  warDeclareTick() {
    for (let i = 0; i < this.nations.length; i++) {
      const a = this.nations[i];
      if (a.members < 10 || a.atWar.size >= 2) continue;
      for (let j = 0; j < this.nations.length; j++) {
        if (i === j) continue;
        const b = this.nations[j];
        if (b.members < 10 || a.atWar.has(b.id) || b.atWar.size >= 2) continue;
        if ((a.peaceUntil.get(b.id) || 0) > this.tick) continue;
        if (a.allies.has(b.id)) continue;
        const host = a.tribe.host(b.tribe);
        const near = dist2(a.capitalX, a.capitalY, b.capitalX, b.capitalY) < 320 * 320;
        const diffFaith = a.religion && b.religion && a.religion !== b.religion;
        const holy = diffFaith && a.religion.fervor > 55 && a.religion.doctrine.fx.war && near;
        const greedy = near && a.aggression > .62 && a.tier >= 2 && this.eraGlobal >= 6;
        if (host > 45 || holy || (greedy && Math.random() < .02)) {
          this.declareWar(a, b, holy ? 'holy war' : host > 45 ? 'blood feud' : 'conquest');
        }
      }
    }
  },

  declareWar(a, b, reason) {
    a.atWar.add(b.id); b.atWar.add(a.id);
    a.peaceUntil.delete(b.id); b.peaceUntil.delete(a.id);
    a.tribe.hostility.set(b.tribe.id, 85); b.tribe.hostility.set(a.tribe.id, 85);
    a.warDeaths = Math.floor(a.warDeaths * .3); b.warDeaths = Math.floor(b.warDeaths * .3);
    if (reason === 'holy war') { a.religion.holyWars++; a.holyWarFlag = true; }
    this.stats.wars++;
    this.log('### ' + a.name + ' declared ' + (reason === 'holy war' ? 'HOLY WAR' : 'war') + ' on ' + b.name + ' (' + reason + ')! ###', 3);
    this.bandFor(a, b);
  },

  bandFor(n, target) {
    let band = null;
    for (const w of this.warBands) if (w.nation === n && !w.dead) { band = w; break; }
    if (!band) {
      let foe = null;
      for (const id of n.atWar) { const m = this.nations.find(x => x.id === id); if (m && m.members > 0) { foe = m; break; } }
      if (!foe) return null;
      band = new WarBand(n, foe, foe.capitalX, foe.capitalY);
      this.warBands.push(band);
    }
    if (target) band.target = target;
    return band;
  },

  enemyCapitalX(n) {
    for (const id of n.atWar) { const m = this.nations.find(x => x.id === id); if (m) return m.capitalX; }
    return n.capitalX;
  },
  enemyCapitalY(n) {
    for (const id of n.atWar) { const m = this.nations.find(x => x.id === id); if (m) return m.capitalY; }
    return n.capitalY;
  },

  warTick() {
    this.warBands = this.warBands.filter(w => !w.dead);
    for (const band of this.warBands) {
      const n = band.nation;
      const foe = band.target;
      const mem = this.agents.filter(a => a.alive && a.tribe === n.tribe && band.memberIds.indexOf(a.id) >= 0);
      if (!foe || foe.members === 0 || !n.atWar.has(foe.id) || mem.length < 2) { band.dead = true; continue; }
      band.x = 0; band.y = 0;
      for (const a of mem) { band.x += a.x; band.y += a.y; }
      band.x /= mem.length; band.y /= mem.length;
      band.tx = foe.capitalX; band.ty = foe.capitalY;
      const dist = Math.sqrt(dist2(band.x, band.y, band.tx, band.ty));
      if (dist < 90) {
        const near = buildingGrid.query(foe.capitalX, foe.capitalY, 110, _tmpB2);
        let hit = 0;
        for (const b of near) {
          if (b.destroyed || b.nation !== foe) continue;
          b.hp -= .3 + mem.length * .05;
          hit++;
          if (b.hp <= 0 && !b.destroyed) { b.destroyed = true; this.onBuildingDestroyed(b, n); }
        }
        band.morale = clamp(band.morale - .002 + hit * .0005, 0, 1);
      }
      if (mem.length < 2) band.dead = true;
    }
    for (const n of this.nations) {
      if (n.atWar.size === 0) continue;
      n.warExhaust = (n.warExhaust || 0) + n.warDeaths * .05 + .01;
      for (const id of Array.from(n.atWar)) {
        const m = this.nations.find(x => x.id === id);
        if (!m || m.members === 0) {
          n.atWar.delete(id);
          if (!m) { n.warsWon++; this.log(n.name + ' has destroyed its enemy.', 2); }
          continue;
        }
        if (!n.atWar.has(m.id)) continue;
        const dur = (n.warStart && n.warStart[id]) ? this.tick - n.warStart[id] : 0;
        if (!n.warStart) n.warStart = {};
        if (!n.warStart[id]) n.warStart[id] = this.tick;
        const myPow = n.members * (1 + n.tribe.weapon) * (1 + n.aggression);
        const thPow = m.members * (1 + m.tribe.weapon) * (1 + m.aggression);
        const weary = n.warExhaust > 6 + n.members * .12;
        const outmatched = myPow < thPow * .35;
        const stalemate = dur > TICKS_PER_YEAR * 12;
        const enforced = dur > TICKS_PER_YEAR * 2;
        if (enforced && (weary || outmatched || stalemate)) this.peaceDeal(n, m);
      }
    }
  },

  peaceDeal(a, b) {
    if (!a.atWar.has(b.id)) return;
    a.atWar.delete(b.id); b.atWar.delete(a.id);
    const powA = a.members * (1 + a.tribe.weapon) + a.treasury * .1;
    const powB = b.members * (1 + b.tribe.weapon) + b.treasury * .1;
    const winner = powA >= powB ? a : b;
    const loser = winner === a ? b : a;
    const tribute = Math.min(loser.treasury, 12 + winner.tribe.era * 4);
    loser.treasury -= tribute;
    winner.treasury += tribute;
    let ceded = 0;
    for (let c = 0; c < this.territory.length && ceded < 3; c++) {
      if (this.territory[c] !== loser.id) continue;
      const cx = c % TC, cy = (c / TC) | 0;
      const px = cx * CELL_W + CELL_W / 2, py = cy * CELL_H + CELL_H / 2;
      if (dist2(px, py, winner.capitalX, winner.capitalY) < 320 * 320) { this.territory[c] = winner.id; ceded++; }
    }
    if (ceded) this.territoryDirty = true;
    winner.warsWon++; loser.warsLost++;
    a.warDeaths = 0; b.warDeaths = 0; a.warExhaust = 0; b.warExhaust = 0;
    a.warStart = {}; b.warStart = {};
    a.peaceUntil.set(b.id, this.tick + 2600);
    b.peaceUntil.set(a.id, this.tick + 2600);
    a.tribe.hostility.set(b.tribe.id, 8); b.tribe.hostility.set(a.tribe.id, 8);
    a.tribe.feuds.delete(b.tribe.id); b.tribe.feuds.delete(a.tribe.id);
    if (!a.affinity) a.affinity = new Map();
    if (!b.affinity) b.affinity = new Map();
    a.affinity.set(b.id, 15); b.affinity.set(a.id, 15);
    this.stats.treaties++;
    this.log('=== PEACE: ' + winner.name + ' dictates terms to ' + loser.name +
      ' (tribute ' + tribute.toFixed(0) + ', ' + ceded + ' lands ceded) ===', 4);
    for (const w of this.warBands) if ((w.nation === a && w.target === b) || (w.nation === b && w.target === a)) w.dead = true;
  },

  onBuildingDestroyed(b, byNation) {
    this.log(byNation.name + ' razed a ' + (BUILDING_TYPES.find(x => x.id === b.type) || { n: b.type }).n + '!', 3);
    byNation.treasury += 4;
    if (b.type === 'monument' || b.type === 'temple') {
      this.log('*** a holy place has been desecrated ***', 3);
      if (b.tribe && b.tribe.religion) { b.tribe.religion.fervor = clamp(b.tribe.religion.fervor - 8, 0, 100); }
    }
  },

  addGrave(x, y, nation, religion) {
    if (this.graves.length > 500) this.graves.shift();
    this.graves.push({ x, y, nation: nation ? nation.id : 0, year: this.year, holy: !!religion });
  },

  religionTick() {
    if (this.religions.length < 14 && this.tick % 60 === 0) {
      for (const a of this.agents) {
        if (!a.alive || a.age < 18 || a.int < 55 || a.devout < 60 || a.faith > 60) continue;
        if (Math.random() < .003) this.prophecyCheck(a);
      }
    }
    for (const r of this.religions) {
      let adherents = 0, devout = 0;
      for (const a of this.agents) {
        if (!a.alive || a.religion !== r) continue;
        adherents++; devout += a.devout;
      }
      r.adherents = adherents;
      const target = adherents ? devout / adherents : 30;
      r.fervor = clamp(r.fervor + (target - r.fervor) * .01 + (r.doctrine.fx.war ? .02 : 0), 0, 100);
      if (adherents >= 8) {
        r.festivalT -= 60;
        if (r.festivalT <= 0) {
          const site = this.holySite(r);
          this.festival = { religion: r, x: site.x, y: site.y, until: this.tick + 320 };
          r.festivalT = rndInt(2200, 4200);
          this.stats.festivals++;
          this.log('~~~ the ' + r.name + ' hold a great festival for ' + r.deity + ' ~~~', 4);
        }
      }
    }
    if (this.festival && this.tick > this.festival.until) {
      this.log('the ' + this.festival.religion.name + ' festival ends.', 0);
      this.festival = null;
    }
  },

  holySite(r) {
    for (const n of this.nations) {
      if (!n.tribe) continue;
      for (const b of n.tribe.buildings) {
        if (b.destroyed) continue;
        if ((b.type === 'monument' || b.type === 'temple' || b.type === 'shrine') && n.tribe.religion === r) return { x: b.x, y: b.y };
      }
    }
    return { x: r.x, y: r.y };
  },

  prophecyCheck(a) {
    if (this.religions.length >= 14) return;
    if (a.age < 18 || a.int < 55 || a.devout < 60 || a.faith > 60) return;
    if (a._prophecyCd && this.tick - a._prophecyCd < 3000) return;
    const r = new Religion(a, this.tick);
    this.religions.push(r);
    this.stats.religions++;
    a.religion = r;
    a._prophecyCd = this.tick;
    a.remember('founded ' + r.name, 3);
    this.log('*** ' + a.name + ' had a vision of ' + r.deity + ' and founded ' + r.name + ' (' + r.doctrine.n + ')! ***', 4);
    const near = agentGrid.query(a.x, a.y, 200, _tmpA2);
    for (const o of near) if (o.alive && o !== a && Math.random() < .45) o.convertTo(r, a);
  },

  plagueTick() {
    if (this.tick % 20 !== 0) return;
    if (!this.plague) {
      if (this.eraGlobal >= 14 || this.tick % 600 !== 0) return;
      let bestX = 0, bestY = 0, bestN = 5;
      for (let c = 0; c < this.territory.length; c++) {
        if (!this.territory[c]) continue;
        const cx = c % TC, cy = (c / TC) | 0;
        const px = cx * CELL_W + CELL_W / 2, py = cy * CELL_H + CELL_H / 2;
        const near = agentGrid.query(px, py, 60, _tmpA2).length;
        if (near > bestN) { bestN = near; bestX = px; bestY = py; }
      }
      if (bestN >= 7 && Math.random() < .35) {
        this.plague = { x: bestX, y: bestY, r: 95, until: this.tick + 1800 };
        this.stats.plagues++;
        this.log('!!! A PLAGUE breaks out near ' + Math.round(bestX) + ',' + Math.round(bestY) + ' !!!', 3);
      }
      return;
    }
    if (this.tick > this.plague.until) {
      this.log('the plague has passed. The survivors are immune.', 1);
      this.plague = null;
      return;
    }
    const near = agentGrid.query(this.plague.x, this.plague.y, this.plague.r, _tmpA2);
    for (let i = 0; i < near.length; i++) {
      const a = near[i];
      if (!a.alive || a.immune) continue;
      if (a.sick > 0) {
        const hugs = agentGrid.query(a.x, a.y, 25, _tmpA3);
        for (const o of hugs) if (o.alive && !o.immune && o !== a && o.sick === 0 && Math.random() < .25) o.sick = 900;
      } else if (Math.random() < .05) {
        a.sick = 900;
      }
    }
    for (const a of this.agents) {
      if (!a.alive || a.sick === 0) continue;
      if (Math.random() < .0006) { a.sick = 1; a.immune = true; a.remember('survived the plague', 1); }
    }
    for (const h of this.agents) {
      if (!h.alive || h.sick > 0 || h.skills.heal < 30) continue;
      const near = agentGrid.query(h.x, h.y, 30, _tmpA3);
      for (let i = 0; i < near.length; i++) {
        const o = near[i];
        if (!o.alive || o.sick === 0 || Math.random() > .03) continue;
        o.sick = 1;
        o.immune = true;
        o.health = clamp(o.health + 10, 0, 100);
        h.skills.heal = clamp(h.skills.heal + .1, 0, 100);
        h.wealth += .05;
        h.remember('healed ' + o.name, 1);
      }
    }
  },

  professionTick() {
    for (const a of this.agents) {
      if (!a.alive) continue;
      let best = 0, bi = 0;
      for (let k = 0; k < N_OUT; k++) {
        if (a.actTally[k] > best) { best = a.actTally[k]; bi = k; }
        a.actTally[k] = Math.max(0, a.actTally[k] - 1);
      }
      const n = a.nation;
      if (n && n.rulerId === a.id && n.tier >= 1) a.profession = 'ruler';
      else if (a.religion && a.religion.founderId === a.id) a.profession = 'prophet';
      else if (a.skills.heal > 40 && a.actTally[A_PRAY] > 0) a.profession = 'healer';
      else if (a.age < 14) a.profession = 'child';
      else a.profession = ['gatherer', 'hunter', 'resting', 'storyteller', 'dancer', 'builder', 'scholar', 'lover', 'fighter', 'architect', 'explorer', 'teacher', 'priest', 'warrior'][bi];
    }
  },

  nearChild(a, s) {
    if (a.age < 16) return false;
    const near = agentGrid.query(a.x, a.y, 46, _tmpA2);
    for (const o of near) if (o.alive && o !== a && o.age < 14 && o.tribe === a.tribe) return true;
    return false;
  },

  speakFor(a, s) {
    if (world.selected !== a && Math.random() > .03) return;
    if (a._lastThought && this.tick - a._lastThought < 25) return;
    a._lastThought = this.tick;
    const dirName = (tx, ty) => {
      const dx = tx - a.x, dy = ty - a.y;
      let ang = Math.atan2(-dy, dx) * 180 / Math.PI;
      const names = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east'];
      return names[Math.round(((ang % 360) + 360) % 360 / 45) % 8];
    };
    const R = a.religion;
    const n = a.nation;
    let t = null;
    if (a.health < 30) t = 'I am badly hurt. Everything aches.';
    else if (a.hunger < 20) t = s.food ? 'My belly is empty. Food lies to the ' + dirName(s.food.x, s.food.y) + '.' : 'My belly is empty and I can find nothing.';
    else if (a.sick > 0) t = 'Fever. My skin burns. I may die.';
    else if (s.wolf) t = 'A wolf! I must get away from it.';
    else if (s.enemy && n && n.atWar.size) t = 'An enemy of the ' + n.stem + '. I will kill them before they kill me.';
    else if (a.sick === 0 && a.faith < 20) t = 'My spirit is dry. I must pray' + (R ? ' to ' + R.deity : '') + '.';
    else {
      switch (a.lastAction) {
        case A_FORAGE: t = s.food ? 'Berries to the ' + dirName(s.food.x, s.food.y) + '. I am going.' : 'I search for something to eat.'; break;
        case A_HUNT: t = 'A deer. If I bring meat home today, they will remember it.'; break;
        case A_REST: t = a.sleeping ? 'I will sleep now. Tomorrow there is work.' : 'I am tired.'; break;
        case A_SOCIAL: t = s.friend ? 'I will sit with ' + s.friend.name + ' and speak of ' + pick(['the hunt', 'the gods', 'the dead', 'the sky', 'the others across the water', 'food']) + '.' : 'I want company.'; break;
        case A_PLAY: t = 'Enough work. I will dance and shout and be young.'; break;
        case A_WORK: t = 'The ' + (n ? n.stem : 'clan') + ' needs wood and stone. I will gather.'; break;
        case A_RESEARCH: t = pick(['What if stone could hold an edge?', 'The stars move. Why?', 'Fire obeys us if we feed it right.', 'If we plant the seed, will it return tenfold?', 'Numbers. I can count the days.']); break;
        case A_REPRODUCE: t = s.mate ? s.mate.name + '. I want a child with them.' : 'I want a family of my own.'; break;
        case A_ATTACK: t = 'I am going to hurt someone. They deserve it.'; break;
        case A_RAID: t = n ? 'For the ' + n.stem + '! We march on the enemy.' : 'War.'; break;
        case A_BUILD: t = 'A new ' + (world.planBuilding(a.tribe) ? world.planBuilding(a.tribe).n.toLowerCase() : 'house') + ' for us.'; break;
        case A_TEACH: t = 'The little ones must learn. Else we are lost when I am gone.'; break;
        case A_PRAY: t = R ? 'I pray to ' + R.deity + ' ' + R.doctrine.prayer + '.' : 'I pray to the spirits of the water and the trees.'; break;
        default:
          if (n && n.rulerId === a.id) t = 'They look to me. The ' + n.name + ' must survive.';
          else t = pick(['The wind is cold today.', 'I wonder what is beyond the hills.', 'My mother taught me to be careful.', 'We are more than we were.', 'I do not want to die.']);
      }
    }
    a.think(t);
  },

  birth(mother) {
    let father = null;
    if (mother.partnerId) for (const a of this.agents) if (a.alive && a.id === mother.partnerId) { father = a; break; }
    if (!father) {
      let best = -1e9;
      for (const a of this.agents) {
        if (!a.alive || a.sex !== 'M' || a.age < 14) continue;
        const sc = mother.aff(a) + 40 - Math.sqrt(dist2(mother.x, mother.y, a.x, a.y)) * .3;
        if (sc > best) { best = sc; father = a; }
      }
    }
    const traits = {};
    for (const k in mother.traits) {
      const m2 = father ? father.traits[k] : 50;
      traits[k] = clamp((mother.traits[k] + m2) / 2 + gauss() * 8, 3, 100);
    }
    const tribe = mother.tribe;
    const gen = Math.max(mother.generation, father ? father.generation : 1) + 1;
    if (gen > this.maxGen) this.maxGen = gen;
    const child = new Agent(clamp(mother.x + rnd(-14, 14), 6, WORLD_W - 6), clamp(mother.y + rnd(-14, 14), 6, WORLD_H - 6), Math.random() < .5 ? 'F' : 'M', traits, tribe, gen);
    child.brain = new Brain(mother.brain, father ? father.brain : null);
    child.age = 0;
    child.health = 70; child.hunger = 80; child.energy = 80;
    child.social = 40; child.fun = 60; child.faith = 50; child.reproDrive = 0;
    child.motherId = mother.id;
    child.fatherId = father ? father.id : 0;
    child.religion = mother.religion;
    child.skills = { forage: 1, hunt: 1, build: 1, fight: 1, craft: 1, farm: 1, research: 1, teach: 1, speak: 3, heal: 1 };
    if (tribe && tribe.era >= 7) for (const k in tribe.knowledge) child.skills[k] = Math.max(child.skills[k], tribe.knowledge[k] * .7);
    child.lex = {};
    for (const c of CONCEPTS) child.lex[c] = mother.lex[c] || (father && father.lex[c]) || makeWord();
    this.agents.push(child);
    if (tribe) tribe.members++;
    mother.children.push(child.id);
    if (father) father.children.push(child.id);
    mother.partnerId = 0;
    if (father) father.partnerId = 0;
    mother.reproCooldown = 200;
    this.births++;
    this.log(mother.name + ' gave birth to ' + child.name + ' (' + child.sex + ', gen ' + gen + ').', 1);
    return child;
  },

  spawnMeat(x, y, amount) {
    return this.addResource('meat', clamp(x + rnd(-6, 6), 4, WORLD_W - 4), clamp(y + rnd(-6, 6), 4, WORLD_H - 4), amount, amount, -.02);
  },

  regen() {
    for (let i = 0; i < this.resources.length; i++) {
      const r = this.resources[i];
      if (r.amount >= r.max) continue;
      r.amount = Math.min(r.max, r.amount + r.regrow * 5);
    }
  },

  updateAnimals() {
    let deer = 0, wolves = 0;
    for (const a of this.animals) {
      if (a.dead) continue;
      if (a.kind === 'deer') deer++; else wolves++;
    }
    if (deer < 60 && this.eraGlobal < 10 && Math.random() < .0035) {
      const a = this.animals.find(x => x.kind === 'deer' && !x.dead);
      if (a) { const p = this.randomLand(a.x, a.y, 120); this.animals.push(new Animal('deer', p.x, p.y)); }
    }
    if (wolves < 3 && this.eraGlobal < 5 && Math.random() < .0006) {
      const p = this.randomLand(null, null, 420);
      this.animals.push(new Animal('wolf', p.x, p.y));
    }
  },

  maybeSplit() {
    const deadN = this.nations.filter(n => n.members === 0);
    if (deadN.length) {
      for (const n of deadN) this.log('*** ' + n.name + ' has fallen ***', 3);
      this.nations = this.nations.filter(n => n.members > 0);
      const alive = new Set();
      for (const a of this.agents) if (a.alive) alive.add(a.tribe);
      this.tribes = this.tribes.filter(t => t.members > 0 || alive.has(t));
      for (const t of this.tribes) if (t.nation && t.nation.members === 0) t.nation = null;
    }
    for (const t of this.tribes) {
      if (t.members < 30 || this.tribes.length >= 8) continue;
      const members = this.agents.filter(a => a.alive && a.tribe === t);
      const adults = members.filter(a => a.age >= 14 && a.age < 45);
      if (adults.length < 16) continue;
      const take = adults.filter((_, i) => i % 2 === 0).slice(0, Math.floor(adults.length * .35));
      if (take.length < 6) continue;
      const nt = new Tribe(this.nextTribeId++, (t.hue + rnd(50, 140)) % 360);
      nt.tech = t.tech * .7;
      nt.store.food = Math.min(t.store.food * .3, 50);
      nt.store.wood = t.store.wood * .3;
      nt.store.stone = t.store.stone * .3;
      nt.store.gold = t.store.gold * .25;
      nt.religion = t.religion;
      t.store.food *= .8;
      for (const k in t.knowledge) nt.knowledge[k] = t.knowledge[k];
      this.tribes.push(nt);
      nt.members = take.length;
      this.updateEra(nt);
      for (const a of take) { t.members--; a.tribe = nt; }
      this.log(nt.name + ' split from ' + t.name + ' with ' + take.length + ' settlers.', 2);
      break;
    }
  },

  sample() {
    this.history.push({ y: this.year, pop: this.pop, era: this.eraGlobal, kills: this.kills, wars: this.stats.wars, nations: this.nations.length, religions: this.religions.length });
    if (this.history.length > 500) this.history.shift();
  },

  cleanup() {
    if (this.tick % 10 !== 0) return;
    let dirty = false;
    for (const a of this.agents) if (!a.alive) { dirty = true; break; }
    if (dirty) this.agents = this.agents.filter(a => a.alive);
    let ad = false;
    for (const a of this.animals) if (a.dead) { ad = true; break; }
    if (ad) this.animals = this.animals.filter(a => !a.dead);
    let md = false;
    for (const r of this.resources) if (r.kind === 'meat' && r.amount <= .2) { md = true; break; }
    if (md) {
      for (const d of this.resources) {
        if (d.kind !== 'meat' || d.amount > .2) continue;
        const b = resGrid.map.get(((d.y / resGrid.cell) | 0) * 4096 + ((d.x / resGrid.cell) | 0));
        if (b) { const i = b.indexOf(d); if (i >= 0) b.splice(i, 1); }
      }
      this.resources = this.resources.filter(r => !(r.kind === 'meat' && r.amount <= .2));
    }
    if (this.selected && !this.selected.alive) this.selected = null;
  },

  rebuildBuildingGrid() {
    buildingGrid.clear();
    for (const n of this.nations) for (const b of n.tribe.buildings) if (!b.destroyed) buildingGrid.insert(b);
    for (const t of this.tribes) if (!t.nation) for (const b of t.buildings) if (!b.destroyed) buildingGrid.insert(b);
  },

  step() {
    this.tick++;
    this.year = this.tick / TICKS_PER_YEAR;
    const phase = (this.tick % DAY_TICKS) / DAY_TICKS;
    this.sun = .5 - .5 * Math.cos(phase * Math.PI * 2);
    this.night = this.sun < .28;
    agentGrid.clear();
    for (const a of this.agents) if (a.alive) agentGrid.insert(a);
    animalGrid.clear();
    for (const a of this.animals) if (!a.dead) animalGrid.insert(a);
    this.updateTribes();
    const n = this.agents.length;
    for (let i = 0; i < n; i++) this.agents[i].tick();
    for (let i = 0; i < this.animals.length; i++) this.animals[i].tick();
    if (this.tick % 5 === 0) this.regen();
    this.updateAnimals();
    if (this.tick % 30 === 0) { this.rebuildBuildingGrid(); this.nationTick(); this.warTick(); }
    if (this.tick % 60 === 0) this.religionTick();
    if (this.tick % 90 === 0) this.claimTerritory();
    if (this.tick % 120 === 0) this.professionTick();
    if (this.tick % 240 === 0) this.sample();
    if (this.tick % 900 === 0) this.maybeSplit();
    this.plagueTick();
    this.cleanup();
  }
};

const _tmpA3 = [];

world.reset();
world.spawnInitialPeople();
world.updateTribes();
world.rebuildBuildingGrid();
world.claimTerritory();

