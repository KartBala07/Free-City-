import { validMapCamera } from "./geography.js";
import { createWorld } from "./simulation.js";
export const SAVE_KEY = "free-city.save.v1";
export function encode(world, view) {
  return JSON.stringify({
    format: "free-city",
    version: 1,
    savedAt: new Date().toISOString(),
    world,
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
    w.nextId > 1000000 ||
    !["Clear", "Rain", "Drought"].includes(w.weather) ||
    !logs(w.events) ||
    !Array.isArray(w.citizens) ||
    w.citizens.length < 1 ||
    w.citizens.length > 500
  )
    throw new Error("Invalid world state.");
  const ids = new Set();
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
      (a.partner !== null && !ids.has(a.partner)) ||
      [
        ...a.parents,
        ...a.children,
        ...Object.keys(a.relations).map(Number),
      ].some((id) => !ids.has(id))
    )
      throw new Error("Invalid family references.");
  const v = data.view;
  if (
    !v ||
    ![0, 1, 5, 20].includes(v.speed) ||
    !finite(v.angle, -10000, 10000) ||
    !finite(v.zoom, 0.3, 3) ||
    !finite(v.panX, -10000, 10000) ||
    !finite(v.panY, -10000, 10000) ||
    (v.selected !== null && !ids.has(v.selected))
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
