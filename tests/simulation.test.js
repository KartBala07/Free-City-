import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, tick, calendar, catalyst } from "../src/simulation.js";
import {
  encode,
  decode,
  writeSave,
  readSave,
  SAVE_KEY,
} from "../src/persistence.js";
const view = { speed: 5, angle: 0.65, zoom: 1, panX: 0, panY: 15, selected: 1 };
test("50 distinct founders and a 360 day calendar", () => {
  const w = createWorld();
  assert.equal(new Set(w.citizens.map((a) => a.name)).size, 50);
  assert.deepEqual(calendar(518400), { year: 2, day: 1, hour: 0, minute: 0 });
  assert.deepEqual(calendar(1440), { year: 1, day: 2, hour: 0, minute: 0 });
});
test("save and resume preserves exact future simulation including RNG, memories and relationships", () => {
  const original = createWorld(42);
  for (let i = 0; i < 1800; i++) tick(original);
  const restored = decode(encode(original, view));
  assert.deepEqual(restored.world, original);
  assert.deepEqual(restored.view, view);
  for (let i = 0; i < 1800; i++) {
    tick(original);
    tick(restored.world);
  }
  assert.deepEqual(restored.world, original);
});
test("corrupt, unsupported and malformed saves are rejected", () => {
  const data = JSON.parse(encode(createWorld(), view));
  assert.throws(() => decode("invalid"));
  assert.throws(() => decode(JSON.stringify({ ...data, version: 2 })));
  data.world.citizens[0].energy = Infinity;
  assert.throws(() => decode(JSON.stringify(data)));
});
test("invalid reference, drive and camera cannot replace a world", () => {
  for (const change of [
    (d) => (d.world.citizens[0].partner = 9999),
    (d) => delete d.world.citizens[0].drives.empathy,
    (d) => (d.view.zoom = -1),
    (d) => (d.world.citizens[1].id = 1),
  ]) {
    const data = JSON.parse(encode(createWorld(), view));
    change(data);
    assert.throws(() => decode(JSON.stringify(data)));
  }
});
test("browser storage roundtrip and storage failure", () => {
  const m = new Map(),
    storage = {
      setItem: (k, v) => m.set(k, v),
      getItem: (k) => m.get(k) || null,
    };
  assert.equal(readSave(storage), null);
  const world = createWorld();
  writeSave(storage, world, view);
  assert.ok(m.has(SAVE_KEY));
  assert.deepEqual(readSave(storage).world, world);
  assert.throws(() =>
    writeSave(
      {
        setItem() {
          throw Error("quota");
        },
      },
      world,
      view,
    ),
  );
});
test("long run stays serializable and advances days without wall clock", () => {
  const w = createWorld(91);
  catalyst(w, "Drought");
  for (let i = 0; i < 15000; i++) tick(w);
  assert.equal(w.minutes, 15480);
  assert.ok(
    w.citizens.every((a) => Number.isFinite(a.wealth) && a.health >= 0),
  );
  assert.deepEqual(decode(encode(w, view)).world, w);
});
