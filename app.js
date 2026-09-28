import { seedPopulation, resident, POPULATION, activateHousehold, apartmentIds } from "./src/population.js";
import { renderInspector } from "./src/inspector.js";
import {
  createWorld,
  tick,
  calendar,
  dateLabel,
  FACTIONS,
  catalyst,
} from "./src/simulation.js";
import { encode, decode, readSave, writeSave } from "./src/persistence.js";
import { Renderer } from "./src/sf-renderer.js";
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
let world = seedPopulation(createWorld(Date.now()),true),
  view = { speed: 1, angle: 0.65, zoom: 1, panX: 0, panY: 15, selected: 1 },
  started = false,
  accumulator = 0,
  last = performance.now(),
  lastUI = 0,
  lastAuto = performance.now(),
  saveAllowed = true;
const renderer = new Renderer($("city"), view, (id) => {
  view.selected = id;
  $("mind-shell").hidden=false;
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
  world = seedPopulation(data.world);
  Object.assign(view, data.view);
  view.mapCamera = data.view.mapCamera;
  renderer.restoreView();
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
  world = seedPopulation(createWorld(Date.now()),true);
  Object.assign(view, {
    speed: 1,
    angle: 0.65,
    zoom: 1,
    panX: 0,
    panY: 15,
    selected: 1,
  });
  delete view.mapCamera;
  renderer.reset();
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
$("reset-view").onclick = () => renderer.reset();
for (const button of document.querySelectorAll("[data-place]"))
  button.onclick = () => renderer.fly(button.dataset.place);
$("focus-citizen").onclick = () => renderer.focusCitizen();
$("terrain-toggle").onclick = (e) => {
  const on = renderer.toggleTerrain();
  if (on !== undefined) {
    e.currentTarget.classList.toggle("active", on);
    e.currentTarget.setAttribute("aria-pressed", on);
  }
};
$("labels-toggle").onclick = (e) => {
  const on = renderer.toggleLabels();
  if (on !== undefined) {
    e.currentTarget.classList.toggle("active", on);
    e.currentTarget.setAttribute("aria-pressed", on);
  }
};
$("about-map").onclick = () => $("map-info").showModal();
$("close-map-info").onclick = () => $("map-info").close();
$("directory").onchange = (e) => {
  view.selected = Number(e.target.value);
  $("mind-shell").hidden=false;
  renderUI();
};
$("search").oninput = renderDirectory;
let pageStart=1;
function renderDirectory() {
 if(document.activeElement===$("directory"))return;
 const query=$("search").value.trim().toLowerCase();
 let list;
 if(/^\d+$/.test(query)){const id=Number(query);list=id>=1&&id<=POPULATION?[resident(world,id).person]:[];}
 else {const ids=new Set([...world.citizens.map(a=>a.id),...Array.from({length:32},(_,i)=>pageStart+i).filter(id=>id<=POPULATION)]);list=[...ids].map(id=>resident(world,id).person).filter(a=>a.name.toLowerCase().includes(query));}
 $("directory").innerHTML=list.map(a=>`<option value="${a.id}" ${a.id===view.selected?'selected':''}>#${a.id.toLocaleString()} · ${escape(a.name)}</option>`).join('');
 if(!list.some(a=>a.id===view.selected))$("directory").selectedIndex=-1;
 $("page-label").textContent=`Census ${pageStart.toLocaleString()}–${Math.min(POPULATION,pageStart+31).toLocaleString()} + live residents`;
}
$('previous-page').onclick=()=>{pageStart=Math.max(1,pageStart-32);renderDirectory();};
$('next-page').onclick=()=>{pageStart=Math.min(POPULATION-31,pageStart+32);renderDirectory();};
$('random-person').onclick=()=>{view.selected=1+Math.floor(Math.random()*POPULATION);pageStart=Math.floor((view.selected-1)/32)*32+1;$('search').value='';$('mind-shell').hidden=false;renderUI();};
$('open-mind').onclick=()=>{$('mind-shell').hidden=false;renderUI();};
$('inspector').onclick=e=>{const b=e.target.closest('button');if(!b)return;
 if(b.hasAttribute('data-close-mind')){$('mind-shell').hidden=true;return;}
 if(b.dataset.person){view.selected=Number(b.dataset.person);renderUI();}
 if(b.hasAttribute('data-home'))renderer.focusCitizen();
 if(b.hasAttribute('data-activate')){try{const n=activateHousehold(world,view.selected);toast(`${n} household members joined the live simulation.`);renderUI();}catch(e){toast(e.message);}}
 if(b.hasAttribute('data-apartment')){const ids=apartmentIds(Number($('apt-building').value),Number($('apt-floor').value),Number($('apt-unit').value));if(ids.length){view.selected=ids[0];renderUI();}else toast('Choose building 1–25,000, floor 1–25, and apartment 1–20.');}
};
document.addEventListener('keydown',e=>{if(e.key==='Escape')$('mind-shell').hidden=true;});
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
  $("population").textContent = (POPULATION+world.births-world.deaths).toLocaleString();
  $("generations").textContent =
    `${alive.length} live · ${world.births} births · ${world.deaths} deaths`;
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
  const a=resident(world,view.selected).person;
  $('selected-summary').textContent=`${a.name} · ${a.role}`;
  if(!$('mind-shell').hidden && !document.activeElement?.matches('.apartment-panel input')) $('inspector').innerHTML=renderInspector(world,view.selected);
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
    : "50 million virtual residents. 240 run live at 08:00 on Day 1.";
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
    started &&
    !document.hidden &&
    !$("welcome").open &&
    !$("options").open &&
    !$("map-info").open;
  if (running && view.speed) {
    accumulator += delta * 10 * view.speed;
    const steps = Math.floor(accumulator);
    accumulator -= steps;
    for (let i = 0; i < steps; i++) tick(world);
  }
  renderer.draw(world);
  if (now - lastUI > 1000 && view.speed) {
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
