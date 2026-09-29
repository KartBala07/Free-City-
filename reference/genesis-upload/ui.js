"use strict";

let paused = false, speed = 4, lastT = performance.now(), acc = 0, frameT = 0;

function fmt(n, d) { return (Math.round(n * Math.pow(10, d || 0)) / Math.pow(10, d || 0)).toFixed(d || 0); }

function aliveNations() { return world.nations.filter(n => n.members > 0); }
function activeWars() {
  const seen = new Set(), out = [];
  for (const n of aliveNations()) {
    for (const id of n.atWar) {
      const key = Math.min(n.id, id) + ':' + Math.max(n.id, id);
      if (seen.has(key)) continue;
      seen.add(key);
      const m = world.nations.find(x => x.id === id);
      if (m) out.push([n, m]);
    }
  }
  return out;
}

function updateHUD() {
  const nat = aliveNations();
  document.getElementById('h-era').textContent = AGE_LIST[world.eraGlobal].n;
  document.getElementById('h-year').textContent = Math.floor(world.year);
  document.getElementById('h-pop').textContent = world.pop;
  document.getElementById('h-nations').textContent = nat.length;
  document.getElementById('h-religions').textContent = world.religions.filter(r => r.adherents > 0).length;
  document.getElementById('h-wars').textContent = activeWars().length;
  const c = document.getElementById('h-clock');
  c.textContent = world.night ? 'NIGHT' : 'DAY';
  c.style.color = world.night ? '#5aa9e6' : '#e2b13c';
}

function updateSide() {
  const alive = world.agents.filter(a => a.alive);
  const children = alive.filter(a => a.age < 14).length;
  const elders = alive.filter(a => a.age > 50).length;
  const pregnant = alive.filter(a => a.pregnant > 0).length;
  const nat = aliveNations();
  const wars = activeWars();
  const lead = nat.slice().sort((a, b) => b.tribe.tech - a.tribe.tech)[0];
  const topEra = lead ? lead.tribe.era : world.eraGlobal;
  const atMax = topEra >= AGE_LIST.length - 1;
  const nextAge = AGE_LIST[Math.min(topEra + 1, AGE_LIST.length - 1)];

  document.getElementById('sec-world').innerHTML = '<h2>World</h2><div class="grid2">' +
    '<div class="row"><span class="k">Year</span><span>' + fmt(world.year, 1) + '</span></div>' +
    '<div class="row"><span class="k">People</span><span>' + world.pop + '</span></div>' +
    '<div class="row"><span class="k">Children</span><span>' + children + '</span></div>' +
    '<div class="row"><span class="k">Elders</span><span>' + elders + '</span></div>' +
    '<div class="row"><span class="k">Pregnant</span><span>' + pregnant + '</span></div>' +
    '<div class="row"><span class="k">Born</span><span>' + world.births + '</span></div>' +
    '<div class="row"><span class="k">Died</span><span>' + world.deaths + '</span></div>' +
    '<div class="row"><span class="k">Slain</span><span>' + world.kills + '</span></div>' +
    '<div class="row"><span class="k">Wars</span><span>' + world.stats.wars + '</span></div>' +
    '<div class="row"><span class="k">Treaties</span><span>' + world.stats.treaties + '</span></div>' +
    '<div class="row"><span class="k">Plagues</span><span>' + world.stats.plagues + '</span></div>' +
    '<div class="row"><span class="k">Festivals</span><span>' + world.stats.festivals + '</span></div>' +
    '<div class="row"><span class="k">Graves</span><span>' + world.graves.length + '</span></div>' +
    '<div class="row"><span class="k">Generation</span><span>' + world.maxGen + '</span></div>' +
    '</div>' +
    (lead ? '<div class="row" style="margin-top:5px"><span class="k">Most advanced</span><span>' + lead.name + '</span></div>' +
      (atMax ? '<div class="mut" style="font-size:10px">' + AGE_LIST[topEra].n + ' &middot; ' + fmt(lead.tribe.tech, 0) + ' knowledge &middot; the summit of this world</div>'
        : '<div class="bar"><i style="width:' + clamp(lead.tribe.tech / nextAge.t * 100, 2, 100) + '%"></i></div>' +
          '<div class="mut" style="font-size:10px">' + AGE_LIST[topEra].n + ' &rarr; ' + nextAge.n + ' &middot; ' + fmt(lead.tribe.tech, 0) + '/' + nextAge.t + '</div>') : '');

  let h = '<h2>Nations (' + nat.length + ')</h2>';
  for (const n of nat.slice().sort((a, b) => b.members - a.members).slice(0, 9)) {
    h += '<div class="row"><span><span class="sw" style="background:' + n.color + '"></span>' + n.name + '</span>' +
      '<span class="mut">' + n.members + ' ppl</span></div>' +
      '<div class="mini">' +
      '<span>lands <b>' + n.cells + '</b></span>' +
      '<span>gold <b>' + Math.floor(n.treasury) + '</b></span>' +
      '<span>' + (n.religion ? n.religion.name : 'no faith') + '</span>' +
      (n.atWar.size ? '<span class="warnrow">at war ' + n.atWar.size + '</span>' : '<span>at peace</span>') +
      '</div>' +
      '<div class="mut" style="font-size:10px">ruler ' + n.rulerName + (n.allies.size ? ' &middot; ' + n.allies.size + ' allies' : '') + '</div>';
  }
  if (!nat.length) h += '<div class="mut">still wandering bands</div>';
  document.getElementById('sec-nations').innerHTML = h;

  let f = '<h2>Faiths</h2>';
  const rels = world.religions.filter(r => r.adherents > 0).sort((a, b) => b.adherents - a.adherents);
  for (const r of rels.slice(0, 7)) {
    f += '<div class="row"><span style="color:' + r.color + '">' + r.name + '</span><span class="mut">' + r.adherents + ' faithful</span></div>' +
      '<div class="mut" style="font-size:10px">' + r.deity + ' &middot; doctrine of ' + r.doctrine.n + ' (' + r.doctrine.blurb + ')' +
      (r.holyWars ? ' &middot; ' + r.holyWars + ' holy wars' : '') + '</div>' +
      '<div class="bar"><i style="width:' + r.fervor + '%;background:' + r.color + '"></i></div>';
  }
  if (!rels.length) f += '<div class="mut">no one has imagined a god yet</div>';
  if (world.festival) f += '<div class="warnrow" style="margin-top:4px">a festival is underway for ' + world.festival.religion.deity + '</div>';
  document.getElementById('sec-faiths').innerHTML = f;

  let w = '<h2>Wars</h2>';
  if (wars.length) {
    for (const [a, b] of wars.slice(0, 6)) {
      w += '<div class="row"><span class="warnrow">' + a.stem + ' vs ' + b.stem + '</span>' +
        '<span class="mut">y' + fmt(world.year - (a.founded || 0), 0) + '</span></div>' +
        '<div class="mini"><span>' + a.stem + ' dead <b>' + Math.round(a.warDeaths) + '</b></span>' +
        '<span>' + b.stem + ' dead <b>' + Math.round(b.warDeaths) + '</b></span></div>';
    }
  } else w += '<div class="mut">the world is at peace</div>';
  if (world.plague) w += '<div class="warnrow" style="margin-top:4px">plague burning in the land</div>';
  document.getElementById('sec-wars').innerHTML = w;

  const log = document.getElementById('log');
  log.innerHTML = world.events.slice(0, 46).map(e => '<div class="t' + e.tone + '">yr ' + Math.floor(e.year) + ' - ' + e.text + '</div>').join('');
}

function simTick() {
  const now = performance.now();
  const dt = Math.min(200, now - lastT);
  lastT = now;
  if (paused) return;
  acc += dt / 1000 * TICKS_PER_SEC * speed;
  let steps = 0;
  while (acc >= 1 && steps < 420) { world.step(); acc--; steps++; }
  if (acc > 1) acc = 1;
}

function frame(t) {
  if (world.selectedChanged) {
    world.selectedChanged = false;
    if (world.selected) Mind.show(world.selected); else Mind.close();
  }
  View.render(t);
  Mind.update();
  updateHUD();
  frameT++;
  if (frameT % 14 === 0) updateSide();
  requestAnimationFrame(frame);
}

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const c = document.getElementById('scene');
  c.width = Math.floor(w * Math.min(window.devicePixelRatio || 1, 1.75));
  c.height = Math.floor(h * Math.min(window.devicePixelRatio || 1, 1.75));
  if (View.ok) View.resize(c.width, c.height);
}

window.addEventListener('resize', resize);

document.getElementById('btn-pause').addEventListener('click', (e) => {
  paused = !paused;
  e.target.classList.toggle('on', paused);
  e.target.textContent = paused ? 'PLAY' : 'PAUSE';
});
document.querySelectorAll('.spd').forEach(b => {
  b.addEventListener('click', () => {
    speed = Number(b.dataset.speed);
    document.querySelectorAll('.spd').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
  });
});
document.getElementById('btn-terr').addEventListener('click', (e) => {
  View.showTerritory = !View.showTerritory;
  e.target.classList.toggle('on', View.showTerritory);
  View.refreshTerrainColors();
});
document.getElementById('btn-shadow').addEventListener('click', (e) => {
  View.shadows = !View.shadows;
  View.renderer.shadowMap.enabled = View.shadows;
  View.sun.castShadow = View.shadows;
  View.renderer.shadowMap.needsUpdate = true;
  e.target.classList.toggle('on', View.shadows);
  for (const k in View.parts) View.parts[k].castShadow = View.shadows;
  for (const k in View.resourceIM) View.resourceIM[k].castShadow = View.shadows;
  View.scene.traverse(o => { if (o.isMesh) o.castShadow = View.shadows; });
});
document.getElementById('btn-reset').addEventListener('click', () => {
  world.reset();
  world.spawnInitialPeople();
  world.updateTribes();
  world.rebuildBuildingGrid();
  world.claimTerritory();
  world.selected = null;
  Mind.close();
  View.terrainMesh.geometry.attributes.color.needsUpdate = true;
  View.buildingsForReset && View.buildingsForReset();
  for (const [b, m] of View.buildingMeshes) View.scene.remove(m);
  View.buildingMeshes.clear();
  View.refreshTerrainColors();
  updateSide();
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') { e.preventDefault(); document.getElementById('btn-pause').click(); }
  if (e.key === 'Escape') { if (Mind.open) Mind.close(); else { world.selected = null; world.selectedChanged = true; } }
  if (e.key === 'f' && world.selected) View.focusOn(world.selected, !View.cam.follow);
  if (e.key >= '1' && e.key <= '4') {
    const b = document.querySelector('.spd[data-speed="' + [1, 4, 8, 16][Number(e.key) - 1] + '"]');
    if (b) b.click();
  }
});

function boot() {
  resize();
  const ok = View.init(document.getElementById('scene'));
  if (!ok) {
    document.getElementById('loadingMsg').textContent = 'Could not start 3D (WebGL or vendor/three.min.js missing).';
    return;
  }
  Mind.init();
  document.getElementById('btn-terr').classList.add('on');
  document.getElementById('btn-shadow').classList.add('on');
  document.getElementById('loading').classList.add('hidden');
  updateSide();
  updateHUD();
  setInterval(simTick, 16);
  requestAnimationFrame(frame);
}

boot();
