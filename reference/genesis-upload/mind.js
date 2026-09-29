"use strict";

const INPUT_NAMES = [
  'hunger', 'tiredness', 'loneliness', 'boredom', 'desire', 'spiritual hunger',
  'fear', 'age', 'health', 'food near', 'wood near', 'stone near', 'gold near',
  'mate near', 'friend near', 'enemy near', 'prey near', 'water near',
  'night', 'era', 'crowding', 'food stored', 'strength', 'intelligence',
  'curiosity', 'aggression', 'industry', 'devotion', 'at war', 'wealth',
  'status', 'holy place near'
];

const Mind = {
  agent: null, open: false, canvas: null, ctx: null, accum: 0,

  init() {
    this.canvas = document.getElementById('netCanvas');
    this.ctx = this.canvas.getContext('2d');
    document.getElementById('mindClose').addEventListener('click', () => this.close());
    document.getElementById('mindFollow').addEventListener('click', () => {
      if (this.agent) View.focusOn(this.agent, true);
    });
    document.getElementById('mindLocate').addEventListener('click', () => {
      if (this.agent) View.focusOn(this.agent, false);
    });
  },

  show(a) {
    this.agent = a;
    this.open = true;
    document.getElementById('mind').classList.remove('hidden');
    this.render(0, true);
  },

  close() {
    this.open = false;
    this.agent = null;
    document.getElementById('mind').classList.add('hidden');
  },

  update() {
    if (!this.open) return;
    this.accum++;
    if (this.accum % 8 !== 0) return;
    if (!this.agent || !this.agent.alive) {
      document.getElementById('mindInfo').innerHTML = '<div class="dead">This person is dead.</div>';
      return;
    }
    this.render(this.accum, false);
  },

  bar(label, v, max, col) {
    const pct = clamp(v / (max || 100) * 100, 0, 100);
    return '<div class="mrow"><span class="mk">' + label + '</span><span class="mv">' + Math.round(v) + '</span></div>' +
      '<div class="mbar"><i style="width:' + pct + '%;background:' + (col || '#57d1a0') + '"></i></div>';
  },

  render(_, full) {
    const a = this.agent;
    if (!a || !a.alive) return;
    const n = a.nation;
    const R = a.religion;

    let rel = [];
    for (const [id, v] of a.rel) {
      const o = world.agents.find(z => z.id === id);
      if (o && o.alive) rel.push([o, v]);
    }
    rel.sort((p, q) => q[1] - p[1]);
    const likes = rel.slice(0, 4).map(r => r[0].name + ' <span class="' + (r[1] > 0 ? 'good' : 'bad') + '">' + Math.round(r[1]) + '</span>').join(', ') || '<span class="mut">no one yet</span>';
    const hates = rel.filter(r => r[1] < -10).sort((p, q) => p[1] - q[1]).slice(0, 4).map(r => r[0].name + ' <span class="bad">' + Math.round(r[1]) + '</span>').join(', ') || '<span class="mut">no one</span>';

    const byId = (id) => { const o = world.agents.find(z => z.id === id); return o ? o.name : null; };
    const kids = a.children.map(id => byId(id)).filter(Boolean).slice(0, 8).join(', ') || '<span class="mut">none</span>';
    const mother = byId(a.motherId) || '<span class="mut">unknown</span>';
    const father = byId(a.fatherId) || '<span class="mut">unknown</span>';
    const partner = a.partnerId ? (byId(a.partnerId) || '<span class="mut">gone</span>') : '<span class="mut">single</span>';

    const drives = [];
    const st = [['hunger', a.inputs[I_HUNGER]], ['tiredness', a.inputs[I_ENERGY]], ['loneliness', a.inputs[I_SOCIAL]],
      ['boredom', a.inputs[I_FUN]], ['spiritual hunger', a.inputs[I_FAITH]], ['desire', a.inputs[I_REPRO]],
      ['fear', a.inputs[I_DANGER]], ['war', a.inputs[I_WAR]], ['wealth', a.inputs[I_WEALTH]]];
    for (const [k, v] of st) if (v > .35) drives.push(k + ' ' + Math.round(v * 100) + '%');

    let scored = [];
    for (let k = 0; k < N_OUT; k++) scored.push({ k, v: a.brain.o[k] + a.biasVec[k], o: a.brain.o[k], b: a.biasVec[k] });
    scored.sort((p, q) => q.v - p.v);

    let thoughts = a.thoughts.slice(-22).map(t =>
      '<div class="th"><span class="ty">yr ' + Math.floor(t.t) + '</span>' + t.text + '</div>').join('');
    if (!thoughts) thoughts = '<div class="mut">still learning to think...</div>';

    const mem = a.memories.slice(-8).reverse().map(m =>
      '<div class="th"><span class="ty">yr ' + Math.floor(m.t) + '</span>' + m.text + '</div>').join('') || '<div class="mut">nothing remembered</div>';

    const skillBar = (k, v) => '<div class="mrow"><span class="mk">' + k + '</span><span class="mv">' + Math.round(v) + '</span></div><div class="mbar"><i style="width:' + clamp(v, 0, 100) + '%;background:#7f9fe8"></i></div>';

    document.getElementById('mindHead').innerHTML =
      '<div class="mh-name">' + a.name + (a.alive ? '' : ' (dead)') + '</div>' +
      '<div class="mh-tags">' +
      '<span class="tag">' + a.sex + '</span>' +
      '<span class="tag">' + a.age.toFixed(1) + ' yrs</span>' +
      '<span class="tag">gen ' + a.generation + '</span>' +
      '<span class="tag" style="border-color:' + (n ? n.color : '#888') + '">' + (n ? n.name : (a.tribe ? a.tribe.name : 'no clan')) + '</span>' +
      '<span class="tag">' + a.profession + '</span>' +
      (R ? '<span class="tag" style="border-color:' + R.color + '">' + R.name + '</span>' : '<span class="tag">no religion</span>') +
      '</div>';

    document.getElementById('mindInfo').innerHTML =
      '<div class="msec"><h3>Inner voice</h3><div class="thscroll">' + thoughts + '</div></div>' +
      '<div class="msec"><h3>What they want</h3><div class="drives">' + (drives.join(' &middot; ') || 'content') + '</div></div>' +
      '<div class="msec"><h3>Body</h3>' +
      this.bar('health', a.health, 100, a.health < 40 ? '#e2603c' : '#57d1a0') +
      this.bar('food', a.hunger, 100, '#e2b13c') +
      this.bar('energy', a.energy, 100, '#5aa9e6') +
      this.bar('company', a.social, 100) +
      this.bar('joy', a.fun, 100, '#e88fd0') +
      this.bar('faith', a.faith, 100, '#c9b6e8') +
      this.bar('desire', a.reproDrive, 100, '#ff9ad2') +
      '</div>' +
      '<div class="msec"><h3>Character</h3><div class="mgrid">' +
      '<div>strength <b>' + Math.round(a.traits.strength) + '</b></div>' +
      '<div>intellect <b>' + Math.round(a.traits.intelligence) + '</b></div>' +
      '<div>curiosity <b>' + Math.round(a.traits.curiosity) + '</b></div>' +
      '<div>aggression <b>' + Math.round(a.traits.aggression) + '</b></div>' +
      '<div>sociability <b>' + Math.round(a.traits.sociability) + '</b></div>' +
      '<div>industry <b>' + Math.round(a.traits.industry) + '</b></div>' +
      '<div>stamina <b>' + Math.round(a.traits.stamina) + '</b></div>' +
      '<div>devotion <b>' + Math.round(a.traits.devout) + '</b></div>' +
      '</div></div>' +
      '<div class="msec"><h3>Skills</h3>' +
      skillBar('foraging', a.skills.forage) + skillBar('hunting', a.skills.hunt) +
      skillBar('building', a.skills.build) + skillBar('fighting', a.skills.fight) +
      skillBar('crafting', a.skills.craft) + skillBar('healing', a.skills.heal) +
      skillBar('scholarship', a.skills.research) + skillBar('speaking', a.skills.speak) +
      '</div>' +
      '<div class="msec"><h3>Family</h3>' +
      '<div class="mrow"><span class="mk">mother</span><span class="mv">' + mother + '</span></div>' +
      '<div class="mrow"><span class="mk">father</span><span class="mv">' + father + '</span></div>' +
      '<div class="mrow"><span class="mk">partner</span><span class="mv">' + partner + (a.married ? ' (wed)' : '') + '</span></div>' +
      '<div class="mrow"><span class="mk">children</span><span class="mv">' + kids + '</span></div>' +
      '</div>' +
      '<div class="msec"><h3>Bonds</h3>' +
      '<div class="mrow"><span class="mk">loves</span><span class="mv">' + likes + '</span></div>' +
      '<div class="mrow"><span class="mk">hates</span><span class="mv">' + hates + '</span></div>' +
      '</div>' +
      '<div class="msec"><h3>Life</h3>' +
      '<div class="mrow"><span class="mk">wealth</span><span class="mv">' + a.wealth.toFixed(2) + '</span></div>' +
      '<div class="mrow"><span class="mk">influence</span><span class="mv">' + Math.round(a.influence) + '</span></div>' +
      (R ? '<div class="mrow"><span class="mk">god</span><span class="mv">' + R.deity + '</span></div>' +
        '<div class="mrow"><span class="mk">faith doctrine</span><span class="mv">' + R.doctrine.n + ' - ' + R.doctrine.blurb + '</span></div>' : '') +
      (n ? '<div class="mrow"><span class="mk">ruler</span><span class="mv">' + n.rulerName + '</span></div>' : '') +
      '</div>' +
      '<div class="msec"><h3>Memories</h3>' + mem + '</div>' +
      '<div class="msec"><h3>Making a decision</h3>' +
      '<table class="mtable">' + scored.slice(0, 6).map(s =>
        '<tr' + (s.k === a.lastAction ? ' class="pick"' : '') + '><td>' + ACTION_NAMES[s.k] + '</td>' +
        '<td class="num">' + s.v.toFixed(2) + '</td>' +
        '<td class="num mut">brain ' + s.o.toFixed(2) + '</td>' +
        '<td class="num mut">instinct ' + s.b.toFixed(2) + '</td></tr>').join('') + '</table>' +
      '<div class="mut small">The chosen action is the highest total. Instincts are hard-wired drives; the brain weighs experience.</div>' +
      '</div>';

    this.drawNet(a);
  },

  drawNet(a) {
    const ctx = this.ctx;
    const W = this.canvas.width, H = this.canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#080b12';
    ctx.fillRect(0, 0, W, H);
    const padY = 18;
    const colX = [70, W / 2, W - 96];
    const yFor = (i, n) => padY + (H - padY * 2) * (n <= 1 ? .5 : i / (n - 1));
    const x = a.inputs, h = a.brain.h, o = a.brain.o;
    const w1 = a.brain.w1, w2 = a.brain.w2;

    for (let i = 0; i < N_IN; i++) {
      const ai = Math.abs(x[i]);
      if (ai < .12) continue;
      for (let j = 0; j < N_HID; j++) {
        const w = w1[i * N_HID + j];
        const v = Math.abs(w) * ai * Math.abs(h[j]);
        if (v < .35) continue;
        ctx.strokeStyle = w > 0 ? 'rgba(87,209,160,' + Math.min(.5, v / 6) + ')' : 'rgba(226,96,60,' + Math.min(.5, v / 6) + ')';
        ctx.lineWidth = Math.min(1.6, .3 + v / 5);
        ctx.beginPath(); ctx.moveTo(colX[0], yFor(i, N_IN)); ctx.lineTo(colX[1], yFor(j, N_HID)); ctx.stroke();
      }
    }
    for (let j = 0; j < N_HID; j++) {
      const ah = Math.abs(h[j]);
      if (ah < .15) continue;
      for (let k = 0; k < N_OUT; k++) {
        const w = w2[j * N_OUT + k];
        const v = Math.abs(w) * ah * Math.abs(o[k]);
        if (v < .35) continue;
        ctx.strokeStyle = w > 0 ? 'rgba(87,209,160,' + Math.min(.5, v / 6) + ')' : 'rgba(226,96,60,' + Math.min(.5, v / 6) + ')';
        ctx.lineWidth = Math.min(1.6, .3 + v / 5);
        ctx.beginPath(); ctx.moveTo(colX[1], yFor(j, N_HID)); ctx.lineTo(colX[2] - 12, yFor(k, N_OUT)); ctx.stroke();
      }
    }

    ctx.font = '9px ui-monospace, monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < N_IN; i++) {
      const y = yFor(i, N_IN);
      const v = clamp(x[i], 0, 1.3);
      ctx.fillStyle = v > .5 ? '#8fe8c4' : v > .2 ? '#5f8f7f' : '#2c3a44';
      ctx.beginPath(); ctx.arc(colX[0], y, 2 + v * 2.6, 0, 7); ctx.fill();
      if (v > .28) { ctx.fillStyle = 'rgba(200,215,230,' + Math.min(1, v) + ')'; ctx.fillText(INPUT_NAMES[i], 4, y + 3); }
    }
    for (let j = 0; j < N_HID; j++) {
      const y = yFor(j, N_HID);
      const v = clamp(Math.abs(h[j]), 0, 1);
      ctx.fillStyle = h[j] > 0 ? 'rgba(120,230,190,' + (.25 + v * .75) + ')' : 'rgba(230,120,90,' + (.25 + v * .75) + ')';
      ctx.beginPath(); ctx.arc(colX[1], y, 2.4 + v * 3.2, 0, 7); ctx.fill();
    }
    for (let k = 0; k < N_OUT; k++) {
      const y = yFor(k, N_OUT);
      const v = o[k] + a.biasVec[k];
      const chosen = k === a.lastAction;
      ctx.fillStyle = chosen ? '#ffd76a' : (v > 0 ? '#4a8fd0' : '#243040');
      ctx.beginPath(); ctx.arc(colX[2] - 12, y, chosen ? 6 : 3.4, 0, 7); ctx.fill();
      if (chosen) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4; ctx.stroke(); }
      ctx.fillStyle = chosen ? '#ffd76a' : (v > 0 ? '#9fc8e8' : '#4a5a6a');
      ctx.fillText(ACTION_NAMES[k] + ' ' + v.toFixed(1), colX[2], y + 3);
    }
    ctx.fillStyle = '#5b6a7a';
    ctx.fillText('SENSES', 4, 11);
    ctx.textAlign = 'center';
    ctx.fillText('THOUGHT', colX[1], 11);
    ctx.textAlign = 'right';
    ctx.fillText('URGES', W - 4, 11);
  }
};
