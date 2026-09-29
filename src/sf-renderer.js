import { peopleLayer } from "./people.js";
import { resident } from "./population.js";
import { COLORS, calendar } from "./simulation.js";
import { HOME, PLACES, citizenLngLat, validMapCamera } from "./geography.js";
import { landmarkLayer } from "./landmarks.js";
import { Renderer as ClassicRenderer } from "./renderer.js";
const empty = { type: "FeatureCollection", features: [] };
export class Renderer {
  constructor(canvas, view, onSelect) {
    this.view = view;
    this.onSelect = onSelect;
    this.canvas = canvas;
    this.ready = false;
    this.lastUpdate = 0;
    this.lastDay = null;
    this.labels = true;
    this.terrain = true;
    this.lastSelected = null;
    this.host = document.createElement("div");
    this.host.id = "sf-map";
    this.host.setAttribute(
      "aria-label",
      "Interactive 3D San Francisco. Drag to pan. Right-drag to tilt and rotate. Scroll to zoom.",
    );
    canvas.before(this.host);
    canvas.hidden = true;
    this.status = document.getElementById("map-status");
    document.getElementById("classic-view").onclick = () => this.useClassic();
    try {
      if (!window.maplibregl) throw new Error("Map engine unavailable");
      this.map = new maplibregl.Map({
        container: this.host,
        style: "./assets/san-francisco-style.json",
        ...HOME,
        maxBounds: [
          [-122.56, 37.69],
          [-122.33, 37.85],
        ],
        minZoom: 10,
        maxZoom: 20,
        maxPitch: 75,
        canvasContextAttributes: { antialias: true },
        attributionControl: true,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      });
      this.map.addControl(
        new maplibregl.NavigationControl({ visualizePitch: true }),
        "top-right",
      );
      this.map.addControl(
        new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }),
        "bottom-left",
      );
      this.map.on("moveend", () => {
        const c = this.map.getCenter();
        view.mapCamera = {
          center: [c.lng, c.lat],
          zoom: this.map.getZoom(),
          pitch: this.map.getPitch(),
          bearing: this.map.getBearing(),
        };
      });
      this.map.on("style.load", () => this.setup());
      this.map.on("idle", () => {
        if (this.ready && this.map.queryRenderedFeatures({layers:["building-3d"]}).length) {
          this.status.textContent = this.elevationFailed
            ? "Elevation unavailable · Streets and 3D buildings still work."
            : "San Francisco · Live geographic map";
          this.status.classList.toggle("error", !!this.elevationFailed);
        }
      });
      this.map.on("error", (e) => {
        if (e.sourceId === "sf-elevation" && this.terrain) {
          this.terrain = false;
          this.elevationFailed = true;
          this.map.setTerrain(null);
          const b = document.getElementById("terrain-toggle");
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
          this.status.textContent =
            "Elevation unavailable · Streets and 3D buildings still work.";
        } else if (!this.elevationFailed) {
          this.status.textContent =
            "Some map data could not load. Check your connection, or use Classic view.";
        }
        this.status.classList.add("error");
      });
      this.map.getCanvas().addEventListener("webglcontextlost", () => {
        this.status.textContent =
          "3D graphics interrupted. Use Classic view to keep playing.";
        this.status.classList.add("error");
      });
      this.resizeObserver = new ResizeObserver(() => this.map?.resize());
      this.resizeObserver.observe(this.host);
    } catch (e) {
      this.status.textContent =
        "3D graphics unavailable on this device. Classic view is active.";
      this.useClassic();
    }
  }
  setup() {
    const map = this.map;
    map.addSource("sf-elevation", {
      type: "raster-dem",
      tiles: [
        "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 15,
      encoding: "terrarium",
      attribution:
        'Elevation: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Mapzen / AWS Open Data</a>',
    });
    map.setTerrain({ source: "sf-elevation", exaggeration: 1 });
    map.setSky({
      "sky-color": "#b2d0e0",
      "horizon-color": "#e6e9dc",
      "fog-color": "#dce6e6",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.3,
    });
    // Avoid opaque mapped blocks covering the modeled Ferry Building and Coit Tower.
    const exclusions = {
      type: "MultiPolygon",
      coordinates: [
        [
          [
            [-122.406, 37.8022],
            [-122.4055, 37.8022],
            [-122.4055, 37.8026],
            [-122.406, 37.8026],
            [-122.406, 37.8022],
          ],
        ],
        [
          [
            [-122.3944, 37.7947],
            [-122.3922, 37.7947],
            [-122.3922, 37.7963],
            [-122.3944, 37.7963],
            [-122.3944, 37.7947],
          ],
        ],
      ],
    };
    if (map.getLayer("building-3d"))
      map.setFilter("building-3d", [
        "all",
        ["!=", ["get", "hide_3d"], true],
        ["!", ["within", exclusions]],
      ]);
    map.addLayer(landmarkLayer(maplibregl));
    map.addSource("citizens", { type: "geojson", data: empty });
    map.addLayer({
      id: "citizen-halo",
      type: "circle",
      source: "citizens",
      paint: {
        "circle-radius": ["case", ["get", "selected"], 12, 0],
        "circle-color": "#ffffff",
        "circle-opacity": 0.2,
        "circle-stroke-color": "#183c38",
        "circle-stroke-width": ["case", ["get", "selected"], 2, 0],
      },
    });
    map.addLayer(peopleLayer(maplibregl,()=>this.world,()=>this.view));
    map.addLayer({
      id: "citizens",
      type: "circle",
      source: "citizens",
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          12,
          2,
          16,
          5,
          19,
          8,
        ],
        "circle-opacity": 0,
        "circle-stroke-opacity": 0,
        "circle-color": ["get", "color"],
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#173534",
      },
    });
    map.addLayer({
      id: "citizen-names",
      type: "symbol",
      source: "citizens",
      filter: ["==", ["get", "selected"], true],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 13,
        "text-offset": [0, -1.7],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#102d28",
        "text-halo-color": "#ffffff",
        "text-halo-width": 2,
      },
    });
    map.on("click", "citizens", (e) => {
      if (e.features?.length)
        this.onSelect(Number(e.features[0].properties.id));
    });
    map.on(
      "mouseenter",
      "citizens",
      () => (map.getCanvas().style.cursor = "pointer"),
    );
    map.on("mouseleave", "citizens", () => (map.getCanvas().style.cursor = ""));
    this.ready = true;
    this.restoreView();
    this.status.textContent = "Loading San Francisco buildings and elevation…";
  }
  restoreView() {
    if (!this.map) return;
    const camera = validMapCamera(this.view.mapCamera)
      ? this.view.mapCamera
      : HOME;
    this.map.jumpTo(camera);
  }
  reset() {
    if (this.classic) {
      Object.assign(this.view, { angle: 0.65, zoom: 1, panX: 0, panY: 15 });
      return;
    }
    this.fly("downtown");
  }
  fly(key) {
    if (!this.map || !PLACES[key]) return;
    this.map.flyTo({ ...PLACES[key], duration: 1600, essential: false });
    document.getElementById("place-name").textContent = PLACES[key].label;
  }
  focusCitizen() {
    if (!this.world) return;
    const a = resident(this.world,this.view.selected).person;
    if(a&&this.classic){const p=this.classic.project(a.x,a.z);this.view.panX+=this.canvas.clientWidth/2-p.x;this.view.panY+=this.canvas.clientHeight/2-p.y;return;}
    if (a&&this.map)
      this.map.flyTo({
        center: citizenLngLat(a),
        zoom: 18.1,
        pitch: 58,
        duration: 1200,
      });
  }
  toggleTerrain() {
    if (!this.ready) return;
    this.terrain = !this.terrain;
    this.map.setTerrain(
      this.terrain ? { source: "sf-elevation", exaggeration: 1 } : null,
    );
    return this.terrain;
  }
  toggleLabels() {
    if (!this.ready) return;
    this.labels = !this.labels;
    for (const layer of this.map.getStyle().layers)
      if (
        layer.type === "symbol" &&
        layer.id !== "citizen-names" &&
        !layer.id.startsWith("poi_")
      )
        this.map.setLayoutProperty(
          layer.id,
          "visibility",
          this.labels ? "visible" : "none",
        );
    return this.labels;
  }
  useClassic() {
    if (this.classic) return;
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = null;
    this.host.hidden = true;
    this.canvas.hidden = false;
    this.ready = false;
    this.classic = new ClassicRenderer(this.canvas, this.view, this.onSelect);
    document.getElementById("place-name").textContent = "Classic simulation";
    this.status.textContent =
      "Classic view · Schematic city, not San Francisco";
    for (const b of document.querySelectorAll(
      "[data-place],#terrain-toggle,#labels-toggle",
    ))
      b.disabled = true;
  }
  draw(world) {
    this.world = world;
    if (this.classic) {
      this.classic.draw(world);
      return;
    }
    if (!this.ready) return;
    if (
      this.lastWorld === world &&
      this.lastTick === world.ticks &&
      this.lastWeather === world.weather &&
      this.lastSelected === this.view.selected
    )
      return;
    const now = performance.now();
    if (now - this.lastUpdate < 180 && this.lastSelected === this.view.selected)
      return;
    this.lastUpdate = now;
    this.lastSelected = this.view.selected;
    this.lastTick = world.ticks;
    this.lastWeather = world.weather;
    this.lastWorld = world;
    this.map.triggerRepaint();
    this.map
      .getSource("citizens")
      ?.setData({
        type: "FeatureCollection",
        features: world.citizens
          .filter((a) => a.health > 0)
          .map((a) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: citizenLngLat(a) },
            properties: {
              id: a.id,
              name: a.name,
              color: COLORS[a.faction],
              selected: a.id === this.view.selected,
            },
          })),
      });
    const h = calendar(world.minutes).hour,
      phase = h < 6 || h >= 19 ? "night" : h < 9 || h >= 17 ? "golden" : "day",
      lighting = phase + world.weather;
    if (this.lastDay !== lighting) {
      this.lastDay = lighting;
      const night = phase === "night",
        gold = phase === "golden";
      this.map.setLight({
        anchor: "viewport",
        color: night ? "#a3b7ed" : gold ? "#ffe2b0" : "#fff6e5",
        intensity: night ? 0.18 : 0.5,
        position: [1.5, 210, night ? 80 : 40],
      });
      this.map.setPaintProperty(
        "water",
        "fill-color",
        night ? "#193c55" : world.weather === "Rain" ? "#6b8c98" : "#68aabc",
      );
      this.map.setSky({
        "sky-color": night ? "#152b46" : "#b2d0e0",
        "horizon-color": night ? "#36516b" : "#e6e9dc",
        "fog-color": night ? "#283e58" : "#dce6e6",
        "sky-horizon-blend": 0.6,
        "horizon-fog-blend": 0.6,
        "fog-ground-blend": world.weather === "Rain" ? 0.7 : 0.25,
      });
    }
  }
}
