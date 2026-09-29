import { ACTIONS, INPUTS, HIDDEN } from "./brain.js";
import { DISEASES } from "./life.js";
import { validMapCamera } from "./geography.js";
import { createWorld } from "./simulation.js";
export const SAVE_KEY = "free-city.save.v1";
export function encode(world, view) {
  return JSON.stringify({
    format: "free-city",
    version: 1,
    savedAt: new Date().toISOString(),
    world: world.player ? {...world,player:{...world.player,move:{x:0,z:0}}} : world,
    view,
  });
}
export function decode(raw) {
  if (typeof raw !== "string" || raw.length > 8_000_000)
    throw new Error("Save is too large or unreadable.");
  const data = JSON.parse(raw);
  if (data?.format !== "free-city" || data.version !== 1)
    throw new Error("Unsupported save format or version.");
  const w = data.world,
    t = createWorld();
  const finite = (n, min = 0, max = Number.MAX_SAFE_INTEGER) =>
    typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
  const text = (v) => typeof v === "string" && v.length <= 500;
  const logs = (v) =>
    Array.isArray(v) &&
    v.length <= 100 &&
    v.every((e) => e && finite(e.time) && text(e.text));
  for (const key of [
    "rng",
    "minutes",
    "ticks",
    "nextId",
    "food",
    "materials",
    "treasury",
    "price",
    "tax",
    "conflict",
    "births",
    "deaths",
  ])
    if (!finite(w?.[key])) throw new Error(`Invalid world field: ${key}`);
  if (
    w.version !== 1 ||
    !Number.isInteger(w.ticks) ||
    !Number.isInteger(w.nextId) ||
    w.nextId > 51000000 ||
    !["Clear", "Rain", "Drought"].includes(w.weather) ||
    !logs(w.events) ||
    !Array.isArray(w.citizens) ||
    w.citizens.length < 1 ||
    w.citizens.length > 500
  )
    throw new Error("Invalid world state.");
  const census = w.population;
  if(census && (census.total!==50000000 || census.modelVersion!==1 || !Number.isInteger(census.seed) || !finite(census.seed,0,4294967295))) throw new Error("Invalid population model.");
  const ids = new Set();
  const known = id => ids.has(id) || (census && Number.isInteger(id) && id>=1 && id<=census.total);

  for (const a of w.citizens) {
    if (!a || !Number.isInteger(a.id) || a.id < 1 || ids.has(a.id))
      throw new Error("Invalid citizen ID.");
    ids.add(a.id);
    for (const key of ["name", "role", "action", "thought", "goal"])
      if (!text(a[key])) throw new Error(`Invalid citizen ${key}.`);
    for (const key of ["age", "wealth", "lastBirth"])
      if (!finite(a[key], key === "lastBirth" ? -100000 : 0))
        throw new Error(`Invalid citizen ${key}.`);
    for (const key of ["health", "energy", "hunger"])
      if (!finite(a[key], 0, 1)) throw new Error(`Invalid citizen ${key}.`);
    if (
      !Number.isInteger(a.faction) ||
      a.faction < 0 ||
      a.faction > 2 ||
      !finite(a.x, -100, 100) ||
      !finite(a.z, -100, 100) ||
      !finite(a.target?.x, -100, 100) ||
      !finite(a.target?.z, -100, 100)
    )
      throw new Error("Invalid citizen position.");
    for (const key of Object.keys(t.citizens[0].drives))
      if (!finite(a.drives?.[key], 0, 1)) throw new Error("Invalid drives.");
    if (
      !logs(a.memories) ||
      !Array.isArray(a.scores) ||
      a.scores.length > 10 ||
      !a.scores.every(
        (v) => Array.isArray(v) && text(v[0]) && finite(v[1], 0, 10),
      )
    )
      throw new Error("Invalid diagnostics.");
    if (
      !a.relations ||
      typeof a.relations !== "object" ||
      Array.isArray(a.relations) ||
      !Object.entries(a.relations).every(
        ([k, v]) => /^\d+$/.test(k) && finite(v, -1, 1),
      )
    )
      throw new Error("Invalid relationships.");
    if(a.home && (!Number.isInteger(a.home.building) || !finite(a.home.building,1,25000) || !Number.isInteger(a.home.floor) || !finite(a.home.floor,1,25) || !Number.isInteger(a.home.unit) || !finite(a.home.unit,1,20) || !finite(a.home.x,-100,100) || !finite(a.home.z,-100,100) || !text(a.home.label))) throw new Error("Invalid apartment.");
    if(a.job && (!text(a.job.title)||!text(a.job.sector)||!text(a.job.employer)||!finite(a.job.wage,0,10))) throw new Error("Invalid job.");
    if(a.skills && (typeof a.skills!=="object" || !Object.entries(a.skills).every(([k,v])=>text(k)&&finite(v,0,100)))) throw new Error("Invalid skills.");
    if(a.friends && (!Array.isArray(a.friends)||a.friends.length>500||!a.friends.every(id=>Number.isInteger(id)&&id>0))) throw new Error("Invalid friends.");
    for(const key of ['skin','clothes']) if(a[key] && !/^#[a-f0-9]{6}$/i.test(a[key])) throw new Error("Invalid appearance.");
    const vector=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(x=>finite(x,-5,5));
    if(a.brain && (a.brain.version!==1 || !vector(a.brain.w1,INPUTS*HIDDEN)||!vector(a.brain.b1,HIDDEN)||!vector(a.brain.w2,HIDDEN*ACTIONS.length)||!vector(a.brain.b2,ACTIONS.length)||!Number.isInteger(a.brain.lessons)||!finite(a.brain.lessons))) throw Error("Invalid learned brain.");
    if(a.life){const l=a.life;if(!['loneliness','boredom','stress','satisfaction'].every(k=>finite(l[k],0,1))||!logs(l.history)||!logs(l.thoughts)||!l.recent||Array.isArray(l.recent)||!Object.entries(l.recent).every(([k,v])=>ACTIONS.includes(k)&&finite(v)))throw Error("Invalid life state.");
      const p=l.plan;if(p && (!ACTIONS.includes(p.action)||!finite(p.started)||!finite(p.remaining,0,1000)||!finite(p.worked,0,10000)||!vector(p.x,INPUTS)||!finite(p.reward,-100,100)||typeof p.controlled!=='boolean'||(p.peer!==null&&!Number.isInteger(p.peer)))) throw Error("Invalid action plan.");
    }
    if(a.illness && (!Object.hasOwn(DISEASES,a.illness.kind)||!finite(a.illness.since)||!finite(a.illness.ends)||a.illness.ends<a.illness.since||typeof a.illness.treated!=='boolean')) throw Error("Invalid illness.");
    if(a.immunity && (typeof a.immunity!=='object'||Array.isArray(a.immunity)||!Object.entries(a.immunity).every(([k,v])=>Object.hasOwn(DISEASES,k)&&finite(v))))throw Error("Invalid immunity.");
    for (const key of ["parents", "children"])
      if (
        !Array.isArray(a[key]) ||
        a[key].length > 500 ||
        !a[key].every(Number.isInteger)
      )
        throw new Error("Invalid family.");
  }
  if (w.nextId <= Math.max(...ids) || (w.leader !== null && !ids.has(w.leader)))
    throw new Error("Invalid world references.");
  for (const a of w.citizens)
    if (
      (a.partner !== null && !known(a.partner)) ||
      [
        ...a.parents,
        ...a.children,
        ...Object.keys(a.relations).map(Number),
      ].some((id) => !known(id))
    )
      throw new Error("Invalid family references.");
  if(w.player && (!ids.has(w.player.id)||typeof w.player.controlled!=='boolean'||(w.player.command!==null&&!ACTIONS.includes(w.player.command))||!finite(w.player.move?.x,-1,1)||!finite(w.player.move?.z,-1,1))) throw Error("Invalid player character.");
  for(const a of w.citizens)if(a.life?.plan?.peer!==null&&a.life?.plan?.peer!==undefined&&!ids.has(a.life.plan.peer))throw Error("Invalid action partner.");
  const v = data.view;
  if (
    !v ||
    ![0, 1, 5, 20].includes(v.speed) ||
    !finite(v.angle, -10000, 10000) ||
    !finite(v.zoom, 0.3, 3) ||
    !finite(v.panX, -10000, 10000) ||
    !finite(v.panY, -10000, 10000) ||
    (v.selected !== null && !known(v.selected))
  )
    throw new Error("Invalid camera settings.");
  if (v.mapCamera !== undefined && !validMapCamera(v.mapCamera))
    throw new Error("Invalid geographic camera.");
  if (!text(data.savedAt) || !Number.isFinite(Date.parse(data.savedAt)))
    throw new Error("Invalid save date.");
  return data;
}
export function writeSave(storage, world, view) {
  const raw = encode(world, view);
  decode(raw);
  storage.setItem(SAVE_KEY, raw);
  return raw;
}
export function readSave(storage) {
  const raw = storage.getItem(SAVE_KEY);
  return raw ? decode(raw) : null;
}
