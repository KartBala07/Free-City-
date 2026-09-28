import {
  createWorld,
  tick,
  calendar,
  dateLabel,
  FACTIONS,
  catalyst,
} from "./src/simulation.js";
import { encode, decode, readSave, writeSave } from "./src/persistence.js";
import { Renderer } from "./src/renderer.js";
const $ = (id) => document.getElementById(id),
  escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let world = createWorld(Date.now()),
  view = { speed: 1, angle: 0.65, zoom: 1, panX: 0, panY: 15, selected: 1 },
  started = false,
  accumulator = 0,
  last = performance.now(),
  lastUI = 0,
  lastAuto = performance.now(),
  saveAllowed = true;
const renderer = new Renderer($("city"), view, (id) => {
  view.selected = id;
  renderUI();
});
let toastTimer;
function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("visible"), 5000);
}
function save(manual = false) {
  if (!started || !saveAllowed) return;
  try {
    writeSave(localStorage, world, view);
    $("save-status").textContent =
      `Saved ${new Date().toLocaleTimeString()} · ${dateLabel(world.minutes)} · This browser`;
    if (manual) toast("City saved. Resume from this exact minute.");
  } catch (e) {
    $("save-status").textContent = "Save failed. Download a backup from •••.";
    if (manual) toast("Could not save in this browser. Use Download save.");
  }
}
function restore(data) {
  world = data.world;
  Object.assign(view, data.view);
  accumulator = 0;
  last = performance.now();
  started = true;
  saveAllowed = true;
  $("welcome").close();
  $("options").close();
  renderUI();
  toast(`Resumed ${dateLabel(world.minutes)}. No offline time has elapsed.`);
}
function resume() {
  try {
    const data = readSave(localStorage);
    if (!data) {
      toast("No saved city in this browser yet.");
      return;
    }
    restore(data);
  } catch (e) {
    toast(`Cannot resume: ${e.message}`);
  }
}
function startNew() {
  world = createWorld(Date.now());
  Object.assign(view, {
    speed: 1,
    angle: 0.65,
    zoom: 1,
    panX: 0,
    panY: 15,
    selected: 1,
  });
  accumulator = 0;
  started = true;
  saveAllowed = true;
  last = performance.now();
  $("welcome").close();
  $("options").close();
  save();
  renderUI();
}
function newConfirmed() {
  if (
    confirm(
      "Start a new city? This replaces the local save. Download a backup first if you want to keep it.",
    )
  )
    startNew();
}
$("save").onclick = () => save(true);
$("load").onclick = () => {
  if (
    !started ||
    confirm(
      "Resume the saved city? Changes since the last save will be discarded.",
    )
  )
    resume();
};
$("menu").onclick = () => $("options").showModal();
$("close-options").onclick = () => $("options").close();
$("continue").onclick = resume;
$("start").onclick = () => {
  if ($("continue").disabled) startNew();
  else newConfirmed();
};
$("new").onclick = newConfirmed;
$("export").onclick = () => {
  const blob = new Blob([encode(world, view)], { type: "application/json" }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `free-city-y${calendar(world.minutes).year}-day${calendar(world.minutes).day}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Save backup downloaded.");
};
$("import").onclick = $("welcome-import").onclick = () => $("file").click();
$("file").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 8_000_000) throw new Error("Save exceeds the 8 MB limit.");
    const data = decode(await file.text());
    if (started && !confirm("Replace the current city with this save?")) return;
    restore(data);
    save();
  } catch (e) {
    alert(`Import failed: ${e.message} Your city has not changed.`);
  } finally {
    $("file").value = "";
  }
};
for (const b of document.querySelectorAll("[data-speed]"))
  b.onclick = () => {
    view.speed = Number(b.dataset.speed);
    accumulator = 0;
    renderUI();
  };
for (const b of document.querySelectorAll("[data-catalyst]"))
  b.onclick = () => {
    catalyst(world, b.dataset.catalyst);
    renderUI();
  };
$("reset-view").onclick = () =>
  Object.assign(view, { angle: 0.65, zoom: 1, panX: 0, panY: 15 });
$("directory").onchange = (e) => {
  view.selected = Number(e.target.value);
  renderUI();
};
$("search").oninput = renderDirectory;
function renderDirectory() {
  const query = $("search").value.toLowerCase();
  const list = world.citizens.filter((a) =>
    a.name.toLowerCase().includes(query),
  );
  $("directory").innerHTML = list
    .map(
      (a) =>
        `<option value="${a.id}" ${a.id === view.selected ? "selected" : ""}>${escape(a.name)}${a.health <= 0 ? " · deceased" : ""}</option>`,
    )
    .join("");
  if (!list.some((a) => a.id === view.selected))
    $("directory").selectedIndex = -1;
}
function renderUI() {
  $("calendar").textContent = dateLabel(world.minutes);
  $("weather").textContent =
    `${world.weather.toUpperCase()} · ${calendar(world.minutes).hour >= 6 && calendar(world.minutes).hour < 19 ? "DAYLIGHT" : "NIGHTFALL"}`;
  for (const b of document.querySelectorAll("[data-speed]")) {
    const active = Number(b.dataset.speed) === view.speed;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active);
  }
  const alive = world.citizens.filter((a) => a.health > 0);
  $("population").textContent = alive.length;
  $("generations").textContent =
    `${world.births} births · ${world.deaths} deaths`;
  $("food").textContent = Math.floor(world.food);
  $("price").textContent = `${world.price.toFixed(1)} credits / unit`;
  $("wealth").textContent = Math.round(
    alive.reduce((v, a) => v + a.wealth, 0),
  ).toLocaleString();
  $("treasury").textContent = `${Math.floor(world.treasury)} public credits`;
  $("mood").textContent = world.food < 30 ? "Uneasy" : "Hopeful";
  $("council").textContent = world.leader
    ? `Council: ${world.citizens.find((a) => a.id === world.leader)?.name}`
    : "Council forming";
  renderDirectory();
  const a = world.citizens.find((a) => a.id === view.selected);
  if (a) {
    const family = a.partner
      ? world.citizens.find((b) => b.id === a.partner)?.name
      : "Unpartnered";
    $("inspector").innerHTML =
      `<div class="citizen-head"><div class="avatar">${escape(a.name[0])}</div><div><h2>${escape(a.name)}</h2><p>${escape(a.role)} · Age ${Math.floor(a.age)} · ${a.wealth.toFixed(0)} credits</p></div></div><span class="badge">${FACTIONS[a.faction].toUpperCase()} / ${a.health > 0 ? escape(a.action).toUpperCase() : "DECEASED"}</span><div class="vitals">${[
        ["Health", a.health],
        ["Energy", a.energy],
        ["Fullness", 1 - a.hunger],
      ]
        .map(
          ([n, v]) =>
            `<div><small>${n} ${Math.round(v * 100)}%</small><div class="bar"><i style="width:${v * 100}%"></i></div></div>`,
        )
        .join(
          "",
        )}</div><section class="ins-section"><div class="section-title"><span>DECISION MAP</span><small>Live priorities</small></div><div class="node">${escape(a.goal)}</div><div class="connector">│</div><div class="branches">${a.scores
        .slice(0, 2)
        .map(
          ([n, v]) => `<div class="node">${escape(n)} · ${v.toFixed(2)}</div>`,
        )
        .join(
          "",
        )}</div><div class="connector">↓</div><div class="node">Current action: ${escape(a.action)}</div></section><section class="ins-section"><div class="section-title"><span>INNER MONOLOGUE</span><small>Simulation narration</small></div><div class="thought">“${escape(a.thought)}”</div></section><section class="ins-section"><div class="section-title"><span>ADAPTIVE DRIVES</span><small>0–100</small></div>${Object.entries(
        a.drives,
      )
        .map(
          ([key, v]) =>
            `<div class="drive"><span>${escape(key)}</span><div class="bar"><i style="width:${v * 100}%"></i></div><span>${Math.round(v * 100)}</span></div>`,
        )
        .join(
          "",
        )}</section><section class="ins-section"><div class="section-title"><span>MEMORY VAULT</span><small>${a.memories.length} records</small></div>${
        a.memories
          .slice(0, 5)
          .map(
            (m) =>
              `<div class="memory"><small>${dateLabel(m.time)}</small>${escape(m.text)}</div>`,
          )
          .join("") ||
        '<p class="muted">New memories will appear as encounters shape this citizen.</p>'
      }<p class="muted">${escape(family)} · ${a.children.length} children${a.parents.length ? ` · Parents: ${a.parents.map((id) => escape(world.citizens.find((b) => b.id === id)?.name || "Unknown")).join(", ")}` : ""}</p></section>`;
  }
  $("events").innerHTML = world.events
    .slice(0, 12)
    .map(
      (e) =>
        `<div class="event"><time>${dateLabel(e.time)}</time><span>${escape(e.text)}</span></div>`,
    )
    .join("");
}
try {
  const saved = readSave(localStorage);
  $("continue").disabled = !saved;
  $("saved-detail").textContent = saved
    ? `Saved city: ${dateLabel(saved.world.minutes)} · ${saved.world.citizens.filter((a) => a.health > 0).length} citizens`
    : "Your first city begins with 50 founders at 08:00 on Day 1.";
} catch (e) {
  saveAllowed = false;
  $("continue").disabled = true;
  $("saved-detail").textContent =
    `The existing save could not be read: ${e.message} Import a backup or begin a new city.`;
}
$("welcome").addEventListener("cancel", (e) => {
  if (!started) e.preventDefault();
});
$("welcome").showModal();
renderUI();
function frame(now) {
  const delta = Math.min(0.25, (now - last) / 1000);
  last = now;
  const running =
    started && !document.hidden && !$("welcome").open && !$("options").open;
  if (running && view.speed) {
    accumulator += delta * 10 * view.speed;
    const steps = Math.floor(accumulator);
    accumulator -= steps;
    for (let i = 0; i < steps; i++) tick(world);
  }
  renderer.draw(world);
  if (now - lastUI > 300) {
    renderUI();
    lastUI = now;
  }
  if (started && now - lastAuto > 30000) {
    save();
    lastAuto = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
  last = performance.now();
});
window.addEventListener("pagehide", () => save());
