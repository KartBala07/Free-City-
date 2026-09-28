import { mkdirSync, copyFileSync, cpSync, rmSync } from "node:fs";
mkdirSync("vendor", { recursive: true });
for (const f of ["maplibre-gl.js", "maplibre-gl.css"])
  copyFileSync(`node_modules/maplibre-gl/dist/${f}`, `vendor/${f}`);
for (const f of ["three.module.js", "three.core.js"])
  copyFileSync(`node_modules/three/build/${f}`, `vendor/${f}`);
copyFileSync("node_modules/three/LICENSE", "vendor/THREE-LICENSE.txt");
copyFileSync(
  "node_modules/maplibre-gl/LICENSE.txt",
  "vendor/MAPLIBRE-LICENSE.txt",
);
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const f of ["index.html", "style.css", "app.js"])
  copyFileSync(f, `dist/${f}`);
for (const f of ["src", "assets", "vendor"])
  cpSync(f, `dist/${f}`, { recursive: true });
