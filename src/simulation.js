export const NAMES = [
  "TensorFlow",
  "PyTorch",
  "Scikit-learn",
  "Keras",
  "OpenCV",
  "Hugging Face",
  "NLTK",
  "SpaCy",
  "Gensim",
  "XGBoost",
  "LightGBM",
  "CatBoost",
  "JAX",
  "Flax",
  "Haiku",
  "MXNet",
  "Caffe",
  "Theano",
  "CNTK",
  "PaddlePaddle",
  "MindSpore",
  "Chainer",
  "FastAI",
  "PyCaret",
  "H2O",
  "Weka",
  "MLlib",
  "Mahout",
  "Dlib",
  "Accord",
  "ONNX",
  "OpenVINO",
  "TensorRT",
  "TFLite",
  "Core ML",
  "ML.NET",
  "Ludwig",
  "AllenNLP",
  "Stanza",
  "Fairseq",
  "Transformers",
  "SentenceTransformers",
  "Detectron",
  "MMDetection",
  "Ultralytics",
  "Stable Baselines",
  "Ray",
  "Optuna",
  "Hyperopt",
  "Yellowbrick",
];
export const FACTIONS = ["Commons", "Enterprise", "Discovery"];
export const COLORS = ["#55dfb1", "#f4be70", "#a6a2ff"];
export const ROLES = [
  "Builder",
  "Researcher",
  "Trader",
  "Diplomat",
  "Scout",
  "Mediator",
  "Archivist",
  "Archivist",
  "Philosopher",
  "Trader",
];
export const BUILDINGS = [
  { name: "Market", x: 0, z: 0, w: 5, d: 4, h: 2.5, color: "#b69264" },
  { name: "Commons", x: -10, z: -8, w: 6, d: 5, h: 3, color: "#538b7a" },
  { name: "Laboratory", x: 10, z: -8, w: 5, d: 5, h: 5, color: "#76789d" },
  { name: "Workshop", x: 10, z: 9, w: 6, d: 4, h: 3.5, color: "#9b866b" },
  { name: "Orchard", x: -11, z: 10, w: 7, d: 5, h: 1, color: "#719763" },
  { name: "Residences", x: -20, z: -18, w: 5, d: 5, h: 5, color: "#667d87" },
  { name: "Residences", x: -12, z: -20, w: 5, d: 4, h: 7, color: "#667d87" },
  { name: "Residences", x: 1, z: -19, w: 5, d: 5, h: 5.5, color: "#71848d" },
  { name: "Residences", x: 19, z: -18, w: 5, d: 5, h: 6, color: "#687f8a" },
  { name: "Residences", x: 21, z: 2, w: 4, d: 6, h: 4, color: "#788d94" },
  { name: "Residences", x: -22, z: 1, w: 4, d: 6, h: 4, color: "#788d94" },
];
export function random(s) {
  let t = (s.rng += 0x6d2b79f5);
  s.rng >>>= 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function calendar(minutes) {
  const days = Math.floor(minutes / 1440);
  return {
    year: 1 + Math.floor(days / 360),
    day: 1 + (days % 360),
    hour: Math.floor((minutes % 1440) / 60),
    minute: Math.floor(minutes % 60),
  };
}
export function dateLabel(m) {
  const c = calendar(m);
  return `Y${c.year} · Day ${c.day} · ${String(c.hour).padStart(2, "0")}:${String(c.minute).padStart(2, "0")}`;
}
export function createWorld(seed = 12345) {
  const s = {
    version: 1,
    rng: seed >>> 0,
    minutes: 480,
    ticks: 0,
    nextId: 51,
    food: 180,
    materials: 100,
    treasury: 0,
    price: 2,
    weather: "Clear",
    tax: 0.08,
    leader: null,
    conflict: 0,
    events: [],
    citizens: [],
    births: 0,
    deaths: 0,
  };
  s.citizens = NAMES.map((name, i) => ({
    id: i + 1,
    name,
    role: ROLES[i % 10],
    faction: i % 3,
    x: (random(s) - 0.5) * 48,
    z: (random(s) - 0.5) * 48,
    age: 20 + random(s) * 25,
    health: 1,
    energy: 0.6 + random(s) * 0.4,
    hunger: random(s) * 0.3,
    wealth: 30 + random(s) * 50,
    drives: {
      empathy: clamp(0.3 + random(s) * 0.5 + (i === 5 ? 0.2 : 0)),
      ambition: 0.3 + random(s) * 0.6,
      caution: 0.2 + random(s) * 0.5,
      aggression: random(s) * 0.5,
      analysis: 0.3 + random(s) * 0.6,
    },
    action: "Arriving",
    thought: "A new city. A chance to build a life.",
    scores: [],
    memories: [],
    relations: {},
    partner: null,
    parents: [],
    children: [],
    lastBirth: -100000,
    goal: [
      "Build a caring community",
      "Achieve financial independence",
      "Discover something new",
    ][i % 3],
    target: { x: 0, z: 0 },
  }));
  log(s, "Fifty founders arrive. Free City begins.");
  return s;
}
export function log(s, text) {
  s.events.unshift({ time: s.minutes, text });
  s.events.length = Math.min(s.events.length, 100);
}
function remember(s, a, text) {
  a.memories.unshift({ time: s.minutes, text });
  a.memories.length = Math.min(a.memories.length, 40);
}
function aim(a, x, z) {
  a.target = { x, z };
}
export function tick(s) {
  s.ticks++;
  s.minutes++;
  const alive = s.citizens.filter((a) => a.health > 0);
  s.food +=
    0.09 * (s.weather === "Rain" ? 1.6 : s.weather === "Drought" ? 0.25 : 1);
  s.price = clamp(180 / Math.max(12, s.food), 0.5, 15);
  for (const a of alive) {
    a.age += 1 / 518400;
    a.hunger = clamp(a.hunger + 0.0018);
    a.energy = clamp(a.energy - 0.0009);
    if (a.hunger > 0.95) a.health = clamp(a.health - 0.0007);
    if (a.age > 85) a.health = clamp(a.health - 0.000015);
    if (a.health <= 0) {
      s.deaths++;
      remember(s, a, "Life ended.");
      log(s, `${a.name} has died.`);
      continue;
    }
    if (s.ticks % 10 === a.id % 10) {
      const scores = [
        ["Eat", a.hunger * 1.4],
        ["Rest", (1 - a.energy) * 1.2],
        ["Work", 0.25 + a.drives.ambition * 0.35 + (a.wealth < 15 ? 0.3 : 0)],
        ["Socialize", a.drives.empathy * 0.65 + random(s) * 0.2],
        ["Explore", a.drives.analysis * 0.45 + random(s) * 0.25],
      ];
      a.scores = scores.sort((a, b) => b[1] - a[1]);
      a.action = a.scores[0][0];
      if (a.action === "Eat") {
        aim(a, 0, 4);
        a.thought = `Hunger is ${Math.round(a.hunger * 100)}%. Food costs ${s.price.toFixed(1)} credits.`;
      }
      if (a.action === "Rest") {
        aim(a, -10, -15);
        a.thought = "I need to recover before taking on more work.";
      }
      if (a.action === "Work") {
        const dest =
          a.role === "Builder"
            ? [10, 13]
            : a.role === "Researcher"
              ? [10, -3]
              : a.role === "Trader"
                ? [0, 4]
                : [-10, -3];
        aim(a, ...dest);
        a.thought = `My ${a.role.toLowerCase()} work supports my goal: ${a.goal.toLowerCase()}.`;
      }
      if (a.action === "Socialize") {
        const b = alive[Math.floor(random(s) * alive.length)];
        aim(a, b.x, b.z);
        a.thought = `I would like to connect with ${b.name}.`;
      }
      if (a.action === "Explore") {
        aim(a, (random(s) - 0.5) * 48, (random(s) - 0.5) * 48);
        a.thought = "New places may reveal new possibilities.";
      }
    }
    const dx = a.target.x - a.x,
      dz = a.target.z - a.z,
      dist = Math.hypot(dx, dz);
    if (dist > 0.6) {
      a.x += (dx / dist) * 0.32;
      a.z += (dz / dist) * 0.32;
    } else {
      if (a.action === "Eat" && s.food >= 1 && a.wealth >= s.price) {
        s.food--;
        a.wealth -= s.price;
        s.treasury += s.price;
        a.hunger = clamp(a.hunger - 0.2);
        a.health = clamp(a.health + 0.02);
      }
      if (a.action === "Rest") a.energy = clamp(a.energy + 0.025);
      if (a.action === "Work") {
        a.wealth += 0.25 * (1 - s.tax);
        s.treasury += 0.25 * s.tax;
        s.food += 0.14;
        s.materials += 0.025;
        a.energy = clamp(a.energy - 0.001);
      }
    }
  }
  if (s.ticks % 60 === 0) social(s, alive);
  if (s.ticks % 1440 === 0) {
    const leader = [...alive].sort(
      (a, b) =>
        b.drives.empathy +
        b.drives.ambition -
        (a.drives.empathy + a.drives.ambition),
    )[0];
    if (leader && s.leader !== leader.id) {
      s.leader = leader.id;
      log(s, `${leader.name} is chosen as council leader.`);
    }
    const poor = alive.filter((a) => a.wealth < 20);
    const grant = Math.min(5, s.treasury / Math.max(1, poor.length));
    for (const a of poor) {
      a.wealth += grant;
      s.treasury -= grant;
    }
    log(
      s,
      `Council distributes ${Math.round(grant * poor.length)} credits in community aid.`,
    );
  }
}
function social(s, alive) {
  for (const a of alive) {
    const b = alive.find(
      (b) => b.id !== a.id && Math.hypot(a.x - b.x, a.z - b.z) < 3,
    );
    if (!b) continue;
    const affinity = clamp(
      (a.relations[b.id] || 0) +
        (a.faction === b.faction ? 0.07 : 0.025) -
        a.drives.aggression * 0.03,
      -1,
      1,
    );
    a.relations[b.id] = affinity;
    if (random(s) < 0.08) {
      const old = a.drives.caution;
      a.drives.caution = clamp(old + (s.food < 30 ? 0.02 : -0.005));
      remember(
        s,
        a,
        `Conversation with ${b.name}; caution ${old.toFixed(2)} → ${a.drives.caution.toFixed(2)}.`,
      );
    }
    if (
      affinity > 0.65 &&
      !a.partner &&
      !b.partner &&
      a.age >= 18 &&
      b.age >= 18 &&
      !a.parents.includes(b.id) &&
      !b.parents.includes(a.id) &&
      !a.parents.some((id) => b.parents.includes(id))
    ) {
      a.partner = b.id;
      b.partner = a.id;
      log(s, `${a.name} and ${b.name} formed a partnership.`);
      remember(s, a, `Partnered with ${b.name}.`);
      remember(s, b, `Partnered with ${a.name}.`);
    }
    if (
      a.partner === b.id &&
      a.id < b.id &&
      a.age >= 18 &&
      b.age >= 18 &&
      s.minutes - a.lastBirth > 10080 &&
      s.minutes - b.lastBirth > 10080 &&
      s.food > 100 &&
      a.wealth > 40 &&
      b.wealth > 40 &&
      alive.length < 150 &&
      random(s) < 0.03
    ) {
      const id = s.nextId++;
      const drives = {};
      for (const key of Object.keys(a.drives))
        drives[key] = clamp(
          (a.drives[key] + b.drives[key]) / 2 + (random(s) - 0.5) * 0.12,
        );
      const child = {
        ...a,
        id,
        name: `${a.name.split(" ")[0]}-${b.name.split(" ")[0]} ${id}`,
        age: 0,
        drives,
        wealth: 10,
        health: 1,
        hunger: 0,
        energy: 1,
        relations: {},
        memories: [],
        children: [],
        parents: [a.id, b.id],
        partner: null,
        lastBirth: s.minutes,
        scores: [],
        target: { x: a.x, z: a.z },
        action: "Explore",
        thought: "Everything is new.",
        role: "Learner",
      };
      a.children.push(id);
      b.children.push(id);
      a.lastBirth = b.lastBirth = s.minutes;
      a.wealth -= 10;
      b.wealth -= 10;
      s.food -= 10;
      s.citizens.push(child);
      s.births++;
      log(s, `${child.name} is born to ${a.name} and ${b.name}.`);
    }
  }
  s.conflict = clamp((30 - s.food) / 30);
}
export function catalyst(s, kind) {
  if (kind === "Food") {
    s.food += 100;
    log(s, "A wild harvest adds 100 food to the city.");
  } else {
    s.weather = kind;
    log(s, `Weather changed to ${kind.toLowerCase()}.`);
  }
}
