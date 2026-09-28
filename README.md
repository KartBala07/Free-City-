# Free City — San Francisco

A browser prototype of an autonomous city observer game, set on a geographic 3D map of San Francisco. Start with 50 citizens named after machine-learning frameworks, watch them pursue needs and work, and inspect their changing priorities.

## Run

Install Node.js 20+ and Python 3, clone this repository, and run:

```sh
npm ci
npm run build
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Keep the same host and port to access the same browser save. Serve the files over HTTP; opening index.html directly is not supported by ES modules. Any static web host can serve the generated `dist/` folder.

## Controls

- Drag to pan; right-drag (or Control + drag) to orbit/tilt; scroll to zoom. Touch: drag to pan, pinch to zoom, two-finger rotate/tilt. Use **↺ View** to return downtown.
- Viewpoint buttons visit downtown, Golden Gate Bridge, Ferry Building, Coit Tower, Painted Ladies, Golden Gate Park, Twin Peaks, and the whole city.
- **Locate selected citizen** returns to the active downtown simulation district.
- Click a citizen or choose one from the searchable directory.
- Pause or select **1×**, **5×**, or **20×**. At 1×, one real second equals ten city minutes. The calendar has 24-hour days and 360-day years.
- Use environmental catalysts to add a harvest, rain, clear weather, or drought.

## Save and resume

- **Save city** writes the entire simulation to this browser's local storage.
- The city autosaves every 30 real seconds, on tab hiding, and on page exit where browser lifecycle events are available. Explicitly save before closing for reliability.
- **Continue saved city** on the welcome screen or **Resume** in the toolbar restores the saved city.
- **••• → Download save** exports a portable JSON backup; **Import save** restores it in another browser or device.
- Saves preserve city time, deterministic random-generator state, population, resources, citizen attributes, memories, family relationships, camera settings, selection and simulation speed.
- Time stops while the tab is hidden or a game dialog is open. Closing the game does not simulate offline years. Reloading resumes at the saved minute.
- Browser saves are local, not cloud-synced. Clearing site data removes them. Download backups before clearing data or switching hosts/devices.
- Invalid or unsupported saves are rejected before replacing the current city. Storage failures are surfaced in the save status. A new city replaces the single local save after confirmation.

## What this prototype implements

A San Francisco geographic map with 3D building extrusions, terrain, simplified landmark models, an orbit camera, autonomous weighted decisions, hunger/energy/health, work and food purchase, scarcity pricing, a communal treasury and daily aid, social affinity, partnerships, inherited drive traits with mutation, births, aging, death, a daily council selection, event history, a live decision graph and a memory inspector. Citizen narration is generated from the simulated state. Seeded randomness makes future outcomes reproducible after loading a save.

## Scope and remaining design work

This is an early playable prototype, not the complete Unity/Unreal design. The default renderer uses MapLibre GL JS and Three.js. The original schematic Canvas renderer remains available through Classic view. Citizen navigation is simple point-to-point movement, not obstacle-aware pathfinding. Decisions use adaptive rules; there is no local LLM or self-modifying neural network. Only caution currently adapts through experience; offspring inherit mutated drives. Factions and council selection are simplified. Full elections, laws, territorial warfare, treaties, construction, multi-stage industrial production, cultural evolution, sophisticated childcare, vector memory and long-term planning remain future work. City growth is capped at 150 living citizens; retained histories are bounded. The one-slot save schema is versioned for future migrations.

## Validation

Node.js 20+:

```sh
npm test
```

Tests cover calendar rollover, distinct founders, deterministic save/resume, malformed data and dangling references, browser-storage errors, and a multi-day simulation roundtrip. MapLibre GL JS and Three.js are pinned npm dependencies, copied into the deployment by `npm run build`.

## Files

- `src/simulation.js`: deterministic world model, calendar, decisions, economics, relationships and lifecycle.
- `src/persistence.js`: versioned serialization, validation and local storage.
- `src/renderer.js`: projection, city rendering, camera and picking.
- `app.js`: observer UI, time loop, save/resume/import/export.

## San Francisco geographic reconstruction

- Vector streets, coastline and building footprints: OpenStreetMap contributors via OpenFreeMap (OpenMapTiles schema). The locally stored Liberty style is adapted from https://tiles.openfreemap.org/styles/liberty; style origin: https://github.com/maputnik/osm-liberty (BSD 3-Clause).
- Vector tiles and fonts stream from https://tiles.openfreemap.org. OSM attribution remains visible; data is available under ODbL: https://www.openstreetmap.org/copyright.
- Elevation: Mapzen terrain tiles from AWS Open Data, Terrarium encoding, terrain exaggeration 1×. See https://registry.opendata.aws/terrain-tiles/ for source and attribution details.
- Three.js geometry adds simplified geographically anchored Golden Gate Bridge, Coit Tower and Ferry Building silhouettes.
- Building heights use mapped `render_height` values; source defaults and missing-data fallbacks are estimates. Building façades, survey-grade heights, interiors, traffic and photographic textures are not replicated. This is not a photogrammetric digital twin.
- Citizens retain original simulation coordinates, displayed in a downtown district. They do not yet navigate the real street network. The wider city is explorable scenery, not millions of individually simulated residents.
- Map camera is stored in the existing version-1 save envelope as an optional validated field. Older saves remain compatible.
- Map tiles require internet access. Map loading failures show a status message; Classic view uses the original local renderer. No API key or paid map account is required by this implementation.

### Build and host

```sh
npm ci
npm test
npm run build
python3 -m http.server 8000 --directory dist
```

`dist/` is the static deployment. `scripts/build.mjs` refreshes local vendor libraries and copies current source; do not edit `dist/` by hand. Third-party library licenses are shipped in `vendor/`. No Chromium or test-browser binary is shipped with the site.
