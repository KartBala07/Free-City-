# Free City — San Francisco

A browser prototype of an autonomous city observer game, set on a geographic 3D map of San Francisco. Explore a deterministic census of 50 million fictional named residents with families, jobs and private apartment records. 240 residents initially run live; inspect any census ID and activate households up to a 400-record limit.

## Run

Install Node.js 20+ and Python 3, clone this repository, and run:

```sh
npm ci
npm run build
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Keep the same host and port to access the same browser save. Serve the files over HTTP; opening index.html directly is not supported by ES modules. Any static web host can serve the generated `dist/` folder.

## Live as yourself

Choose **Live as yourself** in the sidebar, enter a name, adult age, job and appearance, and enter the city. Hold W/A/S/D or the direction buttons to walk north/west/south/east within the active district. The simulation must be running. Choose meals, sleep, work, social visits, recreation, learning, exploration or clinic visits; the character travels and then carries out the activity. **Stop** cancels the current plan. **Return to observer** gives the character autonomous decisions; **Take control** returns manual control. **Find me** locates the character and **My mind** opens the inspector. Your character shares the needs, money, relationships, disease risks and mortality of NPCs. This is local single-player control, not multiplayer.

## Uploaded GENESIS integration and richer life

The uploaded prototype's neural forward/reward-learning implementation has been adapted to the main engine with deterministic randomness, JSON-saveable weights, bounded learning and inherited mutation. Its additional needs, disease/contact concepts, thought history, brain/instinct rankings, walking direction and illness appearance are integrated into the existing San Francisco game. Original supplied source modules are preserved in `reference/genesis-upload/`; the old global world, old Three.js bundle, accelerated ages and caveman terrain are not loaded into the city.

NPCs commit to destinations and activities, respond to loneliness/boredom/stress as well as physical needs, learn from completed actions, and give recently completed actions lower priority. Urgent hunger, exhaustion or illness can interrupt NPC plans. Decisions combine needs, learned preferences, novelty and seeded exploration; this is simulated autonomy, not consciousness or unrestricted human-level reasoning. A finite activity repertoire still exists, but it is not a fixed action cycle.

Two fictional game illnesses have incubation, proximity transmission, symptoms, clinic care, recovery and temporary immunity. Occasional daily introductions seed infections among live residents. Values are gameplay balance parameters, not a medical model. Virtual census residents do not independently transmit disease or learn until activated. The learned network, social needs, action plans, health states and player record persist in saves; held movement keys are cleared on resume.

## Population and citizen dashboard

- Enter a resident ID from 1 to 50,000,000, browse census pages, or choose a random resident. Name search covers the current page and active residents, not a full census index.
- Open a citizen to inspect the weighted decision network, simulated inner voice, body, traits, skills, work, family links and memories. The graph shows the actual learned weights. The ranked table separates instinctive need and learned contributions. Committed plans can remain active even when another score becomes higher.
- Apartment building/floor/door controls resolve a stable household. Each initial household has two adults and two children. Names are fictional and may repeat; IDs are unique.
- Activate a census household to run its members live. Off-screen census profiles use a daily schedule and gain episodic memories only after activation.
- Three.js renders animated head, torso, arm and leg meshes with varied skin/clothing colors. People are enlarged and drawn over buildings at city scale for selection. These are stylized figures, not photorealistic characters.
- Existing v1 saves migrate their residents to human names while preserving their simulation and family state.

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

This is an early playable prototype, not the complete Unity/Unreal design. The default renderer uses MapLibre GL JS and Three.js. The original schematic Canvas renderer remains available through Classic view. Citizen navigation is simple point-to-point movement, not obstacle-aware pathfinding. Decisions combine adaptive needs with a small reward-trained neural preference network; there is no local LLM. Network weights and caution adapt through experience; offspring inherit mutated drives and learned weights. Factions and council selection are simplified. Full elections, laws, territorial warfare, treaties, construction, multi-stage industrial production, cultural evolution, sophisticated childcare, vector memory and long-term planning remain future work. The live simulation is capped at 400 resident records; retained histories are bounded. The other census records are generated on demand, not independently simulated. The 25,000 virtual buildings and 12.5 million apartments are a fictional allocation, not actual San Francisco housing. The one-slot save schema is versioned for future migrations.

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
