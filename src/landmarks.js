import * as THREE from "../vendor/three.module.js";
// Simplified landmark silhouettes; street/footprint geometry comes from OSM.
// Model coordinates: metres east / north / up, anchored in geographic space.
export function landmarkLayer(maplibre) {
  const origins = [
    [-122.4783, 37.8199],
    [-122.4058, 37.8024],
    [-122.3933, 37.7955],
  ];
  const materials = {
    orange: new THREE.MeshStandardMaterial({ color: 0xc6492c, roughness: 0.7 }),
    stone: new THREE.MeshStandardMaterial({ color: 0xe6d6b4, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x424c50 }),
    white: new THREE.MeshStandardMaterial({ color: 0xf3ead6 }),
  };
  function box(g, x, y, z, w, d, h, mat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat);
    m.position.set(x, y, z);
    g.add(m);
    return m;
  }
  function tube(g, points, r, mat) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
    );
    g.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          curve,
          Math.max(2, points.length * 2),
          r,
          5,
          false,
        ),
        mat,
      ),
    );
  }
  const groups = origins.map(() => new THREE.Group());
  const bridge = groups[0];
  bridge.rotation.z = 0.06;
  box(bridge, 0, 0, 68, 28, 2740, 4, materials.dark);
  for (const side of [-1, 1]) {
    box(bridge, side * 15, 0, 68, 2.4, 2740, 8, materials.orange);
    for (const y of [-640, 640]) {
      box(bridge, side * 17, y, 116, 9, 12, 228, materials.orange);
      box(bridge, side * 17, y, 7, 18, 27, 14, materials.stone);
    }
    const points = [];
    for (let y = -1370; y <= 1370; y += 10) {
      const z =
        Math.abs(y) <= 640
          ? 91 + 136 * (y / 640) ** 2
          : 227 - (156 * (Math.abs(y) - 640)) / 730;
      points.push([side * 17, y, z]);
    }
    tube(bridge, points, 1.1, materials.orange);
    for (let y = -1330; y <= 1330; y += 38) {
      const z =
        Math.abs(y) <= 640
          ? 91 + 136 * (y / 640) ** 2
          : 227 - (156 * (Math.abs(y) - 640)) / 730;
      tube(
        bridge,
        [
          [side * 17, y, 72],
          [side * 17, y, z],
        ],
        0.4,
        materials.orange,
      );
    }
  }
  for (const y of [-640, 640])
    for (const z of [77, 122, 170, 215])
      box(bridge, 0, y, z, 42, 7, 5, materials.orange);
  const coit = groups[1];
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(7.4, 9, 60, 24),
    materials.stone,
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = 30;
  coit.add(shaft);
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    box(
      coit,
      Math.sin(a) * 7.6,
      Math.cos(a) * 7.6,
      54,
      1.5,
      1.5,
      6,
      materials.dark,
    );
  }
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(9, 9, 4, 24),
    materials.white,
  );
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 62;
  coit.add(cap);
  const ferry = groups[2];
  ferry.rotation.z = -0.58;
  box(ferry, 0, 0, 13, 180, 32, 26, materials.stone);
  box(ferry, 0, 0, 28, 187, 37, 4, materials.dark);
  box(ferry, 0, 0, 43, 14, 14, 30, materials.stone);
  box(ferry, 0, 0, 63, 18, 18, 10, materials.stone);
  const spire = new THREE.Mesh(
    new THREE.ConeGeometry(10, 14, 4),
    materials.dark,
  );
  spire.rotation.x = Math.PI / 2;
  spire.rotation.y = Math.PI / 4;
  spire.position.z = 75;
  ferry.add(spire);
  for (let x = -80; x <= 80; x += 8)
    box(ferry, x, -16.2, 15, 4, 0.3, 9, materials.dark);
  return {
    id: "sf-landmark-models",
    type: "custom",
    renderingMode: "3d",
    onAdd(map, gl) {
      this.map = map;
      this.scene = new THREE.Scene();
      this.scene.add(new THREE.AmbientLight(0xffffff, 2));
      const sun = new THREE.DirectionalLight(0xffedcf, 3);
      sun.position.set(-100, -200, 600);
      this.scene.add(sun);
      groups.forEach((g) => this.scene.add(g));
      this.camera = new THREE.Camera();
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      this.renderer.autoClear = false;
    },
    render(gl, args) {
      const matrix = args.defaultProjectionData?.mainMatrix || args;
      const origin = maplibre.MercatorCoordinate.fromLngLat(origins[0], 0),
        scale = origin.meterInMercatorCoordinateUnits();
      groups.forEach((g, i) => {
        const elevation =
          i === 0 || !this.map.getTerrain()
            ? 0
            : (this.map.queryTerrainElevation(origins[i]) ??
              (i === 1 ? 80 : 0));
        const p = maplibre.MercatorCoordinate.fromLngLat(origins[i], elevation);
        g.position.set(
          (p.x - origin.x) / scale,
          -(p.y - origin.y) / scale,
          (p.z - origin.z) / scale,
        );
      });
      const transform = new THREE.Matrix4()
        .makeTranslation(origin.x, origin.y, origin.z)
        .scale(new THREE.Vector3(scale, -scale, scale));
      this.camera.projectionMatrix = new THREE.Matrix4()
        .fromArray(matrix)
        .multiply(transform);
      this.renderer.resetState();
      this.renderer.render(this.scene, this.camera);
      this.renderer.resetState();
    },
    onRemove() {
      this.scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
      Object.values(materials).forEach((m) => m.dispose());
      this.renderer.dispose();
    },
  };
}
