"use strict";

const View = {
  ok: false,
  scene: null, camera: null, renderer: null,
  sun: null, hemi: null,
  terrainMesh: null, waterMesh: null,
  parts: {}, people: [], slotAgents: [],
  buildingMeshes: new Map(),
  graveIM: null, resourceIM: {},
  selRing: null, festRing: null, plagueMesh: null,
  ray: null, pointer: null,
  cam: { target: null, dist: 430, yaw: 2.2, pitch: .95, follow: null },
  drag: null, showTerritory: true, shadows: true,
  lastBuildingCount: 0,

  init(canvas) {
    if (typeof THREE === 'undefined') return false;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x9fc4e8, 620, 1800);
    const camera = new THREE.PerspectiveCamera(52, canvas.clientWidth / canvas.clientHeight || 1.6, 1, 2600);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.cam.target = new THREE.Vector3(0, 0, 0);

    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a5a3a, .75);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2cc, 1.05);
    this.sun.castShadow = this.shadows;
    this.sun.shadow.mapSize.set(1024, 1024);
    const d = 620;
    this.sun.shadow.camera.left = -d; this.sun.shadow.camera.right = d;
    this.sun.shadow.camera.top = d; this.sun.shadow.camera.bottom = -d;
    this.sun.shadow.camera.near = 10; this.sun.shadow.camera.far = 2200;
    this.sun.shadow.bias = -.0008;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.buildTerrain();
    this.buildWater();
    this.buildResources();
    this.buildPeople();
    this.buildGraves();
    this.buildEffects();

    this.ray = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.bindInput(canvas);
    this.ok = true;
    return true;
  },

  terrainIndex(ix, iy) { return iy * GW + ix; },

  buildTerrain() {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(GW * GH * 3);
    const col = new Float32Array(GW * GH * 3);
    for (let iy = 0; iy < GH; iy++) {
      for (let ix = 0; ix < GW; ix++) {
        const i = this.terrainIndex(ix, iy);
        const h = heightMap[i];
        pos[i * 3] = ix * TILE - WORLD_W / 2;
        pos[i * 3 + 1] = (h - SEA) * HSCALE;
        pos[i * 3 + 2] = iy * TILE - WORLD_H / 2;
        const c = this.tileColor(ix, iy, h);
        col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      }
    }
    const idx = [];
    for (let iy = 0; iy < GH - 1; iy++) {
      for (let ix = 0; ix < GW - 1; ix++) {
        const a = iy * GW + ix, b = a + 1, c = a + GW, d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const nrm = g.attributes.normal.array;
    if (nrm[1] < 0) {
      const arr = g.index.array;
      for (let i = 0; i < arr.length; i += 3) { const t = arr[i + 1]; arr[i + 1] = arr[i + 2]; arr[i + 2] = t; }
      g.index.needsUpdate = true;
      g.computeVertexNormals();
    }
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    this.terrainMesh = mesh;
    this.scene.add(mesh);
  },

  tileColor(ix, iy, h) {
    const t = terrain[iy * GW + ix];
    let r, g2, b;
    if (t === T_WATER) { r = .10; g2 = .26; b = .42; }
    else if (t === T_SAND) { r = .76; g2 = .68; b = .47; }
    else if (t === T_GRASS) { r = .31; g2 = .49; b = .22; }
    else if (t === T_FOREST) { r = .17; g2 = .34; b = .15; }
    else { r = .42; g2 = .42; b = .43; }
    const v = .82 + hash2(ix * 1.7, iy * 2.3) * .36;
    r *= v; g2 *= v; b *= v;
    if (this.showTerritory && world.territory) {
      const c = world.territory[clamp((iy * TILE / CELL_H) | 0, 0, TR - 1) * TC + clamp((ix * TILE / CELL_W) | 0, 0, TC - 1)];
      if (c) {
        const n = world.nations.find(x => x.id === c);
        if (n) {
          if (!n._col3) n._col3 = new THREE.Color().setHSL((n.tribe ? n.tribe.hue : 0) / 360, .68, .58);
          const col = n._col3;
          r = r * .42 + col.r * .58; g2 = g2 * .42 + col.g * .58; b = b * .42 + col.b * .58;
        }
      }
    }
    return [r, g2, b];
  },

  refreshTerrainColors() {
    if (!this.terrainMesh) return;
    const col = this.terrainMesh.geometry.attributes.color;
    const arr = col.array;
    for (let iy = 0; iy < GH; iy++) {
      for (let ix = 0; ix < GW; ix++) {
        const i = iy * GW + ix;
        const c = this.tileColor(ix, iy, heightMap[i]);
        arr[i * 3] = c[0]; arr[i * 3 + 1] = c[1]; arr[i * 3 + 2] = c[2];
      }
    }
    col.needsUpdate = true;
  },

  buildWater() {
    const g = new THREE.PlaneGeometry(WORLD_W + 400, WORLD_H + 400, 1, 1);
    const m = new THREE.MeshLambertMaterial({ color: 0x2f6f9e, transparent: true, opacity: .82 });
    const mesh = new THREE.Mesh(g, m);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0;
    this.waterMesh = mesh;
    this.scene.add(mesh);
  },

  instanced(geo, mat, count, cast) {
    const im = new THREE.InstancedMesh(geo, mat, count);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    im.castShadow = !!cast;
    im.receiveShadow = false;
    im.frustumCulled = false;
    this.scene.add(im);
    return im;
  },

  buildResources() {
    const dummy = new THREE.Object3D();
    const trunkG = new THREE.CylinderGeometry(.8, 1.1, 7, 5);
    const leafG = new THREE.ConeGeometry(5.5, 13, 7);
    const rockG = new THREE.IcosahedronGeometry(2.4, 0);
    const berryG = new THREE.SphereGeometry(1.6, 6, 5);
    const meatG = new THREE.SphereGeometry(1.5, 6, 5);
    const none = new THREE.MeshLambertMaterial({ color: 0x8a8a8a });
    const trunkM = new THREE.MeshLambertMaterial({ color: 0x5a4028 });
    const leafM = new THREE.MeshLambertMaterial({ color: 0x2f6b2a });
    const berryM = new THREE.MeshLambertMaterial({ color: 0x3f7a30 });
    const rockM = new THREE.MeshLambertMaterial({ color: 0x7d7d80 });
    const goldM = new THREE.MeshLambertMaterial({ color: 0xc9a227 });
    const meatM = new THREE.MeshLambertMaterial({ color: 0x9c3a3a });
    const maxTrees = 900, maxOther = 900;
    this.resourceIM.tree = this.instanced(leafG, leafM, maxTrees, true);
    this.resourceIM.trunk = this.instanced(trunkG, trunkM, maxTrees, true);
    this.resourceIM.berry = this.instanced(berryG, berryM, maxOther, true);
    this.resourceIM.rock = this.instanced(rockG, rockM, maxOther, true);
    this.resourceIM.gold = this.instanced(rockG, goldM, maxOther, true);
    this.resourceIM.meat = this.instanced(meatG, meatM, maxOther, false);
  },

  updateResources() {
    const res = world.resources;
    const dummy = new THREE.Object3D();
    const counts = { tree: 0, berry: 0, rock: 0, gold: 0, meat: 0 };
    const gy = (x, y) => groundY(x, y);
    for (let i = 0; i < res.length; i++) {
      const r = res[i];
      if (r.amount <= .3) continue;
      const X = r.x - WORLD_W / 2, Z = r.y - WORLD_H / 2, Y = gy(r.x, r.y);
      const k = clamp(r.amount / r.max, .3, 1);
      if (r.kind === 'tree') {
        if (counts.tree >= 900) continue;
        dummy.position.set(X, Y + 3.5, Z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(.9 + k * .3);
        dummy.updateMatrix();
        this.resourceIM.trunk.setMatrixAt(counts.tree, dummy.matrix);
        dummy.position.set(X, Y + 7.5 + k * 4, Z); dummy.scale.setScalar(.85 + k * .35); dummy.updateMatrix();
        this.resourceIM.tree.setMatrixAt(counts.tree, dummy.matrix);
        counts.tree++;
      } else if (r.kind === 'berry') {
        dummy.position.set(X, Y + .8, Z); dummy.scale.setScalar(.45 + k * .3); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        this.resourceIM.berry.setMatrixAt(counts.berry, dummy.matrix);
        counts.berry++;
      } else if (r.kind === 'rock' || r.kind === 'gold') {
        const im = r.kind === 'rock' ? this.resourceIM.rock : this.resourceIM.gold;
        const cnt = r.kind === 'rock' ? counts.rock : counts.gold;
        if (cnt >= 900) continue;
        dummy.position.set(X, Y + 1.2, Z); dummy.rotation.set(0, hash2(r.x, r.y) * 6.28, 0); dummy.scale.setScalar((r.kind === 'gold' ? .5 + k * .4 : .8 + k * .7)); dummy.updateMatrix();
        im.setMatrixAt(cnt, dummy.matrix);
        if (r.kind === 'rock') counts.rock++; else counts.gold++;
      } else if (r.kind === 'meat') {
        dummy.position.set(X, Y + .8, Z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(clamp(r.amount / 30, .3, 1)); dummy.updateMatrix();
        this.resourceIM.meat.setMatrixAt(counts.meat, dummy.matrix);
        counts.meat++;
      }
    }
    for (const k in this.resourceIM) {
      const im = this.resourceIM[k];
      if (k === 'tree' || k === 'trunk') im.count = counts.tree;
      else if (k === 'berry') im.count = counts.berry;
      else if (k === 'rock') im.count = counts.rock;
      else if (k === 'gold') im.count = counts.gold;
      else if (k === 'meat') im.count = counts.meat;
      im.instanceMatrix.needsUpdate = true;
    }
  },

  buildPeople() {
    const cap = MAX_POP + 40;
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a878 });
    const torsoM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const legM = new THREE.MeshLambertMaterial({ color: 0x3a3a44 });
    const armM = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const headG = new THREE.SphereGeometry(.32, 8, 6);
    const torsoG = new THREE.BoxGeometry(.72, 1.05, .46);
    const legG = new THREE.BoxGeometry(.28, .95, .28);
    const armG = new THREE.BoxGeometry(.2, .9, .2);
    this.parts.head = this.instanced(headG, skin, cap, true);
    this.parts.torso = this.instanced(torsoG, torsoM, cap, true);
    this.parts.legL = this.instanced(legG, legM, cap, true);
    this.parts.legR = this.instanced(legG, legM, cap, true);
    this.parts.armL = this.instanced(armG, armM, cap, true);
    this.parts.armR = this.instanced(armG, armM, cap, true);
    this.slotAgents = new Array(cap).fill(null);
  },

  updatePeople(t) {
    const dummy = new THREE.Object3D();
    dummy.rotation.order = 'YXZ';
    const agents = world.agents;
    const cap = this.slotAgents.length;
    let count = 0;
    const tmpCol = new THREE.Color();
    for (let i = 0; i < agents.length && count < cap; i++) {
      const a = agents[i];
      if (!a.alive) continue;
      const hue = (a.tribe ? a.tribe.hue : 0) / 360;
      tmpCol.setHSL(hue, .68, .58);
      const scale = (a.age < 3 ? .45 : a.age < 8 ? .62 : a.age < 14 ? .8 : (a.age > 58 ? .95 : 1)) * 1.25;
      const X = a.x - WORLD_W / 2, Z = a.y - WORLD_H / 2, Y = groundY(a.x, a.y);
      const yaw = Math.PI / 2 - a.dir;
      const phase = a.moving ? Math.sin(a.walkPhase) : Math.sin(t * .001 + a.id);
      const swing = a.moving ? phase * .55 : 0;
      const bob = a.moving ? Math.abs(Math.sin(a.walkPhase)) * .07 : 0;

      dummy.position.set(X, Y + (1.15 + bob) * scale, Z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      this.parts.torso.setMatrixAt(count, dummy.matrix);

      dummy.position.set(X, Y + (1.95 + bob) * scale, Z);
      dummy.updateMatrix();
      this.parts.head.setMatrixAt(count, dummy.matrix);

      dummy.position.set(X - Math.cos(yaw) * .22 * scale, Y + (.48 + bob) * scale, Z + Math.sin(yaw) * .22 * scale);
      dummy.rotation.set(swing, yaw, 0);
      dummy.updateMatrix();
      this.parts.legL.setMatrixAt(count, dummy.matrix);

      dummy.position.set(X + Math.cos(yaw) * .22 * scale, Y + (.48 + bob) * scale, Z - Math.sin(yaw) * .22 * scale);
      dummy.rotation.set(-swing, yaw, 0);
      dummy.updateMatrix();
      this.parts.legR.setMatrixAt(count, dummy.matrix);

      dummy.position.set(X - Math.cos(yaw) * .5 * scale, Y + (1.15 + bob) * scale, Z + Math.sin(yaw) * .5 * scale);
      dummy.rotation.set(-swing, yaw, 0);
      dummy.updateMatrix();
      this.parts.armL.setMatrixAt(count, dummy.matrix);

      dummy.position.set(X + Math.cos(yaw) * .5 * scale, Y + (1.15 + bob) * scale, Z - Math.sin(yaw) * .5 * scale);
      dummy.rotation.set(swing, yaw, 0);
      dummy.updateMatrix();
      this.parts.armR.setMatrixAt(count, dummy.matrix);

      const dark = a.sick > 0 ? .55 : 1;
      tmpCol.multiplyScalar(dark);
      this.parts.torso.setColorAt(count, tmpCol);
      this.parts.armL.setColorAt(count, tmpCol);
      this.parts.armR.setColorAt(count, tmpCol);
      tmpCol.multiplyScalar(.75);
      this.parts.legL.setColorAt(count, tmpCol);
      this.parts.legR.setColorAt(count, tmpCol);
      tmpCol.set(a.sick > 0 ? 0x9c8f7a : 0xd9a878);
      this.parts.head.setColorAt(count, tmpCol);

      this.slotAgents[count] = a;
      count++;
    }
    for (let i = count; i < cap; i++) this.slotAgents[i] = null;
    for (const k in this.parts) {
      this.parts[k].count = count;
      this.parts[k].instanceMatrix.needsUpdate = true;
      if (this.parts[k].instanceColor) this.parts[k].instanceColor.needsUpdate = true;
    }
  },

  buildingGeom(type) {
    switch (type) {
      case 'hut': return { w: 3.2, h: 2.4, d: 3.2, roof: 'cone', roofCol: 0x6b4a26, body: 0xb08a56 };
      case 'campfire': return { w: 1.1, h: .5, d: 1.1, roof: 'fire', body: 0x4a3a2a };
      case 'shrine': return { w: 1.8, h: 2.0, d: 1.8, roof: 'cone', roofCol: 0xcdbbed, body: 0xded6c8 };
      case 'granary': return { w: 2.6, h: 2.8, d: 2.6, roof: 'cone', roofCol: 0xc9a24a, body: 0xd8c48a };
      case 'farm': return { w: 8, h: .4, d: 8, roof: 'none', body: 0x6f9a3a };
      case 'mine': return { w: 3, h: 2.2, d: 3, roof: 'flat', body: 0x6d6d70 };
      case 'forge': return { w: 2.8, h: 2.6, d: 2.8, roof: 'gable', roofCol: 0x8a3a22, body: 0x8a6a52 };
      case 'temple': return { w: 5.5, h: 4.4, d: 5.5, roof: 'gable', roofCol: 0xe8dcc0, body: 0xf0ead8 };
      case 'library': return { w: 4.6, h: 3.6, d: 4.6, roof: 'flat', roofCol: 0x5aa9e6, body: 0xd8d8e0 };
      case 'walls': return { w: 9, h: 2.6, d: 1.4, roof: 'none', body: 0x909094 };
      case 'barracks': return { w: 5, h: 3, d: 4.4, roof: 'gable', roofCol: 0x8a3a2a, body: 0x9a7a62 };
      case 'market': return { w: 6, h: 2.6, d: 5, roof: 'flat', roofCol: 0xd9b23c, body: 0xc8a878 };
      case 'monument': return { w: 6, h: 9, d: 6, roof: 'step', roofCol: 0xd8d2c4, body: 0xd8d2c4 };
      case 'academy': return { w: 5, h: 3.6, d: 5, roof: 'dome', roofCol: 0x6ec9e0, body: 0xe0e0e8 };
      case 'hospital': return { w: 5, h: 3.2, d: 5, roof: 'flat', roofCol: 0xf0f0f6, body: 0xf2f2f6 };
      case 'factory': return { w: 6.5, h: 3.6, d: 5.5, roof: 'chimney', roofCol: 0x8a8f96, body: 0x9aa3ad };
      case 'power': return { w: 5, h: 4, d: 5, roof: 'dome', roofCol: 0xe2c04a, body: 0xdadae0 };
      case 'lab': return { w: 5, h: 3.6, d: 5, roof: 'dome', roofCol: 0x6ee7c0, body: 0xe6f4f0 };
      case 'data': return { w: 5.5, h: 3.2, d: 5.5, roof: 'flat', roofCol: 0x8f7ff0, body: 0x2a2a34 };
      case 'spaceport': return { w: 9, h: 1, d: 9, roof: 'tower', roofCol: 0xe6e6f0, body: 0xb0b0b8 };
    }
    return { w: 3, h: 2.5, d: 3, roof: 'flat', roofCol: 0x999999, body: 0xaaaaaa };
  },

  makeBuildingMesh(type) {
    const p = this.buildingGeom(type);
    const grp = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), new THREE.MeshLambertMaterial({ color: p.body }));
    body.position.y = p.h / 2;
    body.castShadow = true; body.receiveShadow = true;
    grp.add(body);
    if (p.roof === 'cone') {
      const r = new THREE.Mesh(new THREE.ConeGeometry(p.w * .78, p.h * .7, 6), new THREE.MeshLambertMaterial({ color: p.roofCol }));
      r.position.y = p.h + p.h * .35; r.castShadow = true; grp.add(r);
    } else if (p.roof === 'gable') {
      const r = new THREE.Mesh(new THREE.ConeGeometry(p.w * .8, p.h * .6, 4), new THREE.MeshLambertMaterial({ color: p.roofCol }));
      r.position.y = p.h + p.h * .3; r.rotation.y = Math.PI / 4; r.castShadow = true; grp.add(r);
    } else if (p.roof === 'fire') {
      const f = new THREE.Mesh(new THREE.SphereGeometry(.55, 6, 5), new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
      f.position.y = .75; grp.add(f);
      grp.userData.fire = f;
    } else if (p.roof === 'dome') {
      const r = new THREE.Mesh(new THREE.SphereGeometry(p.w * .5, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: p.roofCol }));
      r.position.y = p.h; r.castShadow = true; grp.add(r);
    } else if (p.roof === 'chimney') {
      for (const off of [-p.w * .28, p.w * .28]) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(.28, .34, p.h * .9, 6), new THREE.MeshLambertMaterial({ color: p.roofCol }));
        c.position.set(off, p.h + p.h * .45, 0); c.castShadow = true; grp.add(c);
      }
    } else if (p.roof === 'step') {
      for (let i = 1; i <= 3; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(p.w * (1 - i * .22), p.h * .22, p.d * (1 - i * .22)), new THREE.MeshLambertMaterial({ color: p.roofCol }));
        s.position.y = p.h + p.h * .11 + (i - 1) * p.h * .22; s.castShadow = true; grp.add(s);
      }
    } else if (p.roof === 'tower') {
      const t = new THREE.Mesh(new THREE.BoxGeometry(.8, 12, .8), new THREE.MeshLambertMaterial({ color: p.roofCol }));
      t.position.set(p.w * .35, 6, 0); t.castShadow = true; grp.add(t);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, .3, 12), new THREE.MeshLambertMaterial({ color: 0x666670 }));
      pad.position.set(-p.w * .2, .3, 0); grp.add(pad);
    }
    if (type === 'walls' || type === 'hospital') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(p.w * .3, p.h * .1, p.d * .3), new THREE.MeshLambertMaterial({ color: 0xd03030 }));
      top.position.set(0, p.h + p.h * .06, 0); grp.add(top);
    }
    return grp;
  },

  updateBuildings() {
    const seen = new Set();
    for (const t of world.tribes) {
      for (const b of t.buildings) {
        seen.add(b);
        let m = this.buildingMeshes.get(b);
        if (!m) {
          m = this.makeBuildingMesh(b.type);
          m.position.set(b.x - WORLD_W / 2, groundY(b.x, b.y), b.y - WORLD_H / 2);
          m.rotation.y = hash2(b.x, b.y) * 6.28;
          this.scene.add(m);
          this.buildingMeshes.set(b, m);
        }
        m.visible = !b.destroyed;
        if (b.destroyed && !m.userData.rubble) {
          m.userData.rubble = true;
          m.traverse(o => { if (o.material && o.material.color) o.material.color.multiplyScalar(.35); });
        }
        if (m.userData.fire) {
          const s = 1 + Math.sin(performance.now() * .006) * .25;
          m.userData.fire.scale.setScalar(s);
        }
      }
    }
    for (const [b, m] of this.buildingMeshes) {
      if (!seen.has(b)) { this.scene.remove(m); this.buildingMeshes.delete(b); }
    }
  },

  buildGraves() {
    const g = new THREE.BoxGeometry(.5, .9, .25);
    const m = new THREE.MeshLambertMaterial({ color: 0x8d8d92 });
    this.graveIM = this.instanced(g, m, 520, false);
  },

  updateGraves() {
    const dummy = new THREE.Object3D();
    let c = 0;
    for (const gr of world.graves) {
      if (c >= 520) break;
      dummy.position.set(gr.x - WORLD_W / 2, groundY(gr.x, gr.y) + .45, gr.y - WORLD_H / 2);
      dummy.rotation.set(0, hash2(gr.x, gr.y) * 6.28, (hash2(gr.y, gr.x) - .5) * .3);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.graveIM.setMatrixAt(c, dummy.matrix);
      c++;
    }
    this.graveIM.count = c;
    this.graveIM.instanceMatrix.needsUpdate = true;
  },

  buildEffects() {
    this.selRing = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.3, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: .9 }));
    this.selRing.rotation.x = -Math.PI / 2;
    this.selRing.visible = false;
    this.scene.add(this.selRing);

    this.festRing = new THREE.Mesh(new THREE.RingGeometry(9, 13, 28), new THREE.MeshBasicMaterial({ color: 0xffd76a, side: THREE.DoubleSide, transparent: true, opacity: .55 }));
    this.festRing.rotation.x = -Math.PI / 2;
    this.festRing.visible = false;
    this.scene.add(this.festRing);

    this.plagueMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0x5a1f1f, transparent: true, opacity: .22 }));
    this.plagueMesh.visible = false;
    this.scene.add(this.plagueMesh);
  },

  updateEffects(t) {
    const s = world.selected;
    if (s && s.alive) {
      this.selRing.visible = true;
      this.selRing.position.set(s.x - WORLD_W / 2, groundY(s.x, s.y) + .12, s.y - WORLD_H / 2);
      const k = 1 + Math.sin(t * .004) * .08;
      this.selRing.scale.setScalar(k);
      this.selRing.material.color.set(this.cam.follow === s ? 0x6ee7c0 : 0xffffff);
    } else this.selRing.visible = false;

    if (world.festival) {
      this.festRing.visible = true;
      this.festRing.position.set(world.festival.x - WORLD_W / 2, groundY(world.festival.x, world.festival.y) + .2, world.festival.y - WORLD_H / 2);
      const pulse = 1 + Math.sin(t * .003) * .12;
      this.festRing.scale.setScalar(pulse);
      this.festRing.material.opacity = .4 + Math.sin(t * .003) * .2;
    } else this.festRing.visible = false;

    if (world.plague) {
      this.plagueMesh.visible = true;
      this.plagueMesh.position.set(world.plague.x - WORLD_W / 2, 14, world.plague.y - WORLD_H / 2);
      this.plagueMesh.scale.setScalar(world.plague.r * .9);
    } else this.plagueMesh.visible = false;
  },

  updateEnvironment() {
    const sun = world.sun;
    const day = clamp(sun * 1.15, 0, 1);
    this.sun.intensity = .12 + day * 1.05;
    this.hemi.intensity = .22 + day * .58;
    const ang = (world.tick % DAY_TICKS) / DAY_TICKS * Math.PI * 2;
    this.sun.position.set(Math.cos(ang) * 700, 250 + Math.sin(ang) * 620, Math.sin(ang * .6) * 500);
    this.sun.target.position.set(0, 0, 0);
    const skyD = new THREE.Color(0x8fbfe8), skyN = new THREE.Color(0x0a1026);
    const c = skyN.clone().lerp(skyD, day);
    this.scene.background = c;
    this.scene.fog.color.copy(c);
    this.scene.fog.near = 620; this.scene.fog.far = 1800;
    this.waterMesh.material.color.setRGB(.10 + .08 * day, .32 + .1 * day, .52 + .1 * day);
  },

  updateCamera() {
    const cam = this.cam;
    if (cam.follow && cam.follow.alive) {
      cam.target.x += (cam.follow.x - WORLD_W / 2 - cam.target.x) * .08;
      cam.target.z += (cam.follow.y - WORLD_H / 2 - cam.target.z) * .08;
      cam.target.y += (groundY(cam.follow.x, cam.follow.y) + 3 - cam.target.y) * .08;
      cam.dist += (70 - cam.dist) * .03;
    }
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    this.camera.position.set(
      cam.target.x + cam.dist * cp * Math.cos(cam.yaw),
      cam.target.y + cam.dist * sp,
      cam.target.z + cam.dist * cp * Math.sin(cam.yaw)
    );
    const gx = this.camera.position.x + WORLD_W / 2, gz = this.camera.position.z + WORLD_H / 2;
    const floor = groundY(gx, gz) + 6;
    if (this.camera.position.y < floor) this.camera.position.y = floor;
    this.camera.lookAt(cam.target);
  },

  bindInput(canvas) {
    const el = canvas;
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('pointerdown', e => {
      this.drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, btn: e.button, moved: 0 };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.x = e.clientX; this.drag.y = e.clientY;
      this.drag.moved += Math.abs(dx) + Math.abs(dy);
      if (this.drag.btn === 0 && !e.shiftKey) {
        this.cam.yaw -= dx * .006;
        this.cam.pitch = clamp(this.cam.pitch + dy * .005, .08, 1.5);
      } else {
        const sp = this.cam.dist * .0016;
        const cy = Math.cos(this.cam.yaw), sy = Math.sin(this.cam.yaw);
        this.cam.target.x -= (cy * dx - sy * dy) * sp;
        this.cam.target.z -= (sy * dx + cy * dy) * sp;
        this.cam.follow = null;
      }
    });
    el.addEventListener('pointerup', e => {
      if (this.drag && this.drag.moved < 5) this.pick(e);
      this.drag = null;
    });
    el.addEventListener('wheel', e => {
      e.preventDefault();
      this.cam.dist = clamp(this.cam.dist * (1 + Math.sign(e.deltaY) * .12), 22, 1000);
      if (this.cam.dist > 120 && this.cam.follow) this.cam.follow = null;
    }, { passive: false });
  },

  pick(e) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.ray.setFromCamera(this.pointer, this.camera);
    const hits = this.ray.intersectObjects([this.parts.torso], false);
    if (hits.length && hits[0].instanceId !== undefined) {
      const a = this.slotAgents[hits[0].instanceId];
      if (a) { world.selected = a; world.selectedChanged = true; return; }
    }
    world.selected = null;
    world.selectedChanged = true;
  },

  focusOn(agent, follow) {
    world.selected = agent;
    world.selectedChanged = true;
    if (agent) {
      this.cam.target.set(agent.x - WORLD_W / 2, groundY(agent.x, agent.y) + 3, agent.y - WORLD_H / 2);
      if (follow) this.cam.follow = agent;
    }
  },

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  },

  render(t) {
    if (!this.ok) return;
    this.updateEnvironment();
    this.updateResources();
    this.updateBuildings();
    this.updatePeople(t);
    this.updateGraves();
    this.updateEffects(t);
    if (world.territoryDirty) { world.territoryDirty = false; this.refreshTerrainColors(); }
    this.updateCamera();
    this.renderer.render(this.scene, this.camera);
  }
};
