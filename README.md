# Orbital Mission Lab — Lunar Ice Mapper

A bilingual mission-design game built on the existing **Space Mission Architect** prototype. Start with an empty spacecraft and a fictional 110 M USD budget; buy equipment, assemble it, reserve a launcher, review engineering balances, fly the mission, respond to deterministic scenarios, revise the design, and compare reports. The dark mission-console identity and existing 3D launch/replay experience are preserved.

This is an educational simulator, not a flight-design or safety tool. Hardware, prices, science points, qualification tests and failure effects are game assumptions. Archived NASA observations are explicitly separated from simulated spacecraft observations.

## Run locally

Requires Node.js >=24 (tested with 24.14.0), npm, and a current desktop browser. Run these commands from the repository root:

```powershell
npm ci
npm run dev
```

Open the local URL printed by Vite, normally http://127.0.0.1:5173. `npm run build` generates `dist`; `npm run preview` serves that production build. Vite is the development server and production bundler, not the production hosting service.

```powershell
npm run check               # TypeScript, ESLint, Vitest, production build
npx playwright install chromium
npm run e2e                 # build + complete browser regression suite
npx playwright test e2e/lunar-upgrade.spec.ts
```

Browser tests own port **4186**, with server reuse disabled so an unrelated preview cannot be mistaken for this application. Stop any old test process occupying that port before running another test session. No accounts, backend, API keys or external network requests are required at runtime for bundled science assets.

## Organization repository and branch

The current project is imported into `GeneralsZH/Space-Mission-Design-Game`, branch `ehso`. To obtain that version:

```powershell
git clone --branch ehso https://github.com/GeneralsZH/Space-Mission-Design-Game.git
cd Space-Mission-Design-Game
npm ci
npm run dev
```

The existing GitHub Pages workflow remains in `.github/workflows/deploy.yml`; its automatic publication targets `main`. It supplies `VITE_BASE=/Space-Mission-Design-Game/`. Vite, service-worker scope/cache paths, NASA images and scientific source links respect that prefix. A normal local build uses `/`. Updating `ehso` stores the code for team review; merging or deploying the branch is a separate action.

## Mission journey

1. Open the brief: return at least 120 **game science points**, carry a composition instrument, survive downlink, and (new model) gain geometric access to at least one archival sample.
2. Purchase and install the bus, instruments, arrays, battery, antenna, engine and optional protection. Buy fuel and reserve a fictional launch vehicle. Equipment in the warehouse is paid for but does not affect installed mass or power.
3. Choose a preset orbit or apply your own periapsis, apoapsis, inclination and solar beta in Orbit & launcher. The orbital preview, engineering balances, NASA sample comparison and 3D path use those same inputs. Review the calculated limits in Launch preparation. Paid analysis benches remain available in the workshop. A technically bad design may still launch and demonstrate its consequences.
4. Run in Live or Step mode. Rotate/zoom, follow the spacecraft, show the full route, pause, change speed or reset the camera. Select a solar-flare strategy and an additional 40-minute eclipse strategy. Instrument switches, target, antenna orientation and contact allocation affect the result.
5. Inspect the debrief, geometric access and data return. Download a standalone **HTML report**; open it in a browser to read or print to PDF. JSON export remains the complete replayable save format.
6. Use Back to design to retain purchases and revise. The last eight distinct completed results are kept in this browser for comparison. Identical replays do not duplicate an attempt.
7. Open NASA science to select an actual LROC illumination sample and compare orbit configurations with identical hardware, including access to low-illumination samples and the unweighted mean of accessed archival illumination values. Preview coverage is potential geometric access, not proof that a design survives or delivers that data.

Flights now open in a full-viewport flight console by default. Pause/resume, speed, Auto/Step, camera controls, replay, essential telemetry, Actions, Systems, Log and the final result are available over the scene. Crisis choices open in an overlay and close after the decision. On phones, compact panels stay below the central spacecraft and scroll internally. **Back to dashboard** returns to the original panel layout; **Fullscreen flight** opens the immersive view again. The view choice is saved locally as `orbital-flight-view`.

The expand icon can also request the browser's native fullscreen mode when available. The application already fills the viewport without that API. Escape closes an open flight panel, then returns to the dashboard. Existing dashboard regression tests explicitly select panel view; the immersive test suite clears that preference to verify the new default and the complete mission loop.

Launch mission, Restart flight and Continue live automatically enable animation and live playback; no separate animation action is required. New projects also start with motion enabled. Step mode and the motion toggle remain available for deliberate manual control.

If a 3D model is stationary, use **Play 3D animation** beside the scene to enable motion, select 3D/live playback and resume a saved pause. Completed flights offer **Watch 3D again**, retaining the design and purchases. With motion disabled (including the operating system's reduced-motion preference), the playback clock now stays stopped rather than advancing an invisible flight. Turning motion off during playback freezes the spacecraft at its current position. Engineering crises still wait for the student's decision.

After a crisis decision, a manual stage command, or a spacecraft-operation change, the view automatically returns to the flight animation so the effect is visible. Automatic live transitions do not pull the page away while the student is reading.

Progress uses localStorage on the current browser/origin; links do not share a student's save. Export JSON before changing devices. Reload restores the mission; Replay starts the same flight again. Older saves retain their original rules and seeded outcomes. **Revise with lunar model** explicitly upgrades them without deleting purchases. New and revised designs use `build.modelVersion = 2`.

New and revised designs also use `advancedFlight: true`. Applying a custom orbit enables it explicitly. Saved designs without that flag keep their previous energy and flare rules. During science operations, cyan ribbons record accepted geometric survey passes on the rotating Moon; **Moon** switches to a southern-hemisphere survey camera. Ribbons survive reload through command replay and stop at the accepted-memory or power limit. They represent simulated geometric coverage, not detected ice or a delivered geolocated science map.

The event strip shows planned separation, arrival, observation, shadow and downlink events. Its main countdown is compressed playback seconds at the selected speed; orbital events also show model minutes. Pause freezes the countdown. Step mode waits for commands at stage boundaries. Unprotected continuation through the educational flare scenario can damage cells: one panel visibly darkens and tilts, generation falls to 45%, and later battery depletion can disable instruments and attitude control. Power loss, missed capture and communication loss have distinct playback effects; error causes appear after the incident recording or on explicit request.

## Solar system explorer

Open **Solar system** in navigation, or **Atlas** in the flight camera controls. A separate full-viewport atlas contains the Sun, eight planets, Earth's Moon, Saturn/Uranus ring illustrations, an asteroid belt and a decorative starfield. Select a world in the scene or object strip to track it, read its reference radius/period and follow its NASA/JPL source links. Drag to orbit, scroll or use zoom buttons; pause, reset, choose model days per second, and toggle orbit paths or labels. Escape or **Back to mission** restores the mission. Exploring does not advance mission commands or change the spacecraft design. Native browser fullscreen is optional. Without WebGL, a static 2D diagram retains selection and source information.

Planet reference radii (km) and sidereal orbital periods (Earth years) come from [NASA/JPL physical parameters](https://ssd.jpl.nasa.gov/planets/phys_par.html). Rounded, fixed J2000 elements come from [JPL approximate-position Table 1](https://ssd.jpl.nasa.gov/planets/approx_pos.html); Earth uses the Earth–Moon barycentre approximation. Kepler motion uses those fixed elements and published periods, without secular rates, perturbations or a current-date ephemeris. The atlas starts at the illustration's day zero each visit. The Sun's approximate 700,000 km radius follows [NASA Sun facts](https://science.nasa.gov/sun/facts/); the illustrative Moon uses the existing lunar radius and a rounded 27.3217-day sidereal period.

Overview distances use `3 + 6.5*ln(1 + r_au)`; body sizes are separately enlarged. These display distances must not be used for mission engineering. Lunar separation, axial spin, rings, surface/cloud/crater textures, belt particles and background star positions are illustrative, not measured maps or a star catalogue. The existing lunar engineering/observation model remains the mission simulator. The explorer and its Three.js renderer load only when visited; textures are generated locally, requiring no new external image requests.

## Technology and architecture

The **System** camera button and live navigation inset now show the solar system inside the mission animation, sharing the same model time, pause and actions. The inset is a schematic navigation chart; the wide 3D camera keeps a live spacecraft marker at the Earth–Moon region. **Follow** or the inset returns to the spacecraft. Close views use distant planet point markers and a small solar disk; the panorama enlarges bodies and compresses interplanetary distances. Positions use the atlas's fixed-element illustration, rotated to the scenario Sun direction, not a present-day ephemeris. New lunar beta/inclination settings orient the visible Sun consistently with the shadow scenario. There is no new autonomous planet clock, no implied interplanetary trajectory and no change to saved mission outcomes. Model-time Earth rotation and a visual atmosphere rim improve the local flight view.

Earth's flight texture is the original 1024 x 512, 444,710-byte [NASA SVS Blue Marble mosaic](https://svs.gsfc.nasa.gov/2915/), credited to NASA/GSFC SVS, Reto Stockli and NASA Earth Observatory. It is a historical multi-observation composite used only for display, not live weather or a new science measurement. Its source, unchanged-file SHA-256 and limits are bundled in `public/science/earth-provenance.json`. The procedural Earth remains the loading/error fallback. The image loads only with the flight renderer and is cached after use.

React 19, TypeScript 6, Vite 8, Zustand, Zod, Three.js / React Three Fiber, Recharts, Tailwind/CSS, Vitest, Testing Library and Playwright. Exact installed versions are pinned in `package-lock.json`.

- `src/engine/calculations.ts`: mass, rocket equation, W/Wh, costs and constraints.
- `src/engine/orbital.ts`: lunar elements, Kepler propagation, vis-viva, period, capture and shadow.
- `src/engine/coverage.ts`: cone/sphere access to real archival sample coordinates.
- `src/engine/energy.ts`, `groundTrack.ts`: sampled orbital battery state and persistent spherical survey ribbons.
- `src/engine/simulation.ts`, `incidents.ts`: command-driven flight and deterministic consequences.
- `src/features/playback`: shared playback clock, camera path and displayed telemetry.
- `src/components/MissionScene.tsx`: 3D flight, physical lunar orbit scale, visible solar-panel spacecraft and instrument cone. Spacecraft size is exaggerated.
- `src/pages/Science.tsx`: observed-data explorer and controlled comparison.
- `src/features/reports.ts`: validated local attempt history and standalone reports.
- `src/store`: validated save schema, purchases, restart and deterministic command replay.

WebGL and chart code are lazy loaded. The service worker precaches the shell and its static module dependencies instead of downloading every large 3D/chart chunk at first load; assets and science files cache on use. Offline use requires a prior visit to the relevant views. A local procedural Moon fallback and 2D/minimal modes keep controls usable if texture loading or WebGL fails. The NASA display texture is 447 KB, 2048 x 1024, rather than an 8K/16K download. Core JS plus its shared JSX runtime is approximately 213 KB gzip; the shared 3D library chunk is approximately 247 KB gzip and remains a Vite size warning, not a runtime error.

## Engineering model and limits

SI units are used internally. Moon radius **1,737,400 m**, GM **4.90e12 m3/s2**, sidereal rotation **655.72 h**, rounded from the [NASA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html).

- Dry mass is the sum of installed component masses. Wet mass = dry + propellant. Delta-v = Isp * 9.80665 * ln(wet/dry). Capture consumes fuel through the inverse rocket equation; the 150 m/s reserve is retained as an engineering constraint.
- Semi-major axis a = (rp + ra)/2; eccentricity = (ra-rp)/(ra+rp). Period = 2*pi*sqrt(a^3/GM); speed = sqrt(GM*(2/r-1/a)). The 3D path uses the same elements and solves Kepler's equation, so an elliptic spacecraft moves at nonuniform angular speed. Lunar orbit dimensions use the Moon's radius as their common scale.
- Capture estimates a single periapsis impulse from an **assumed 820 m/s arrival v-infinity**. This is not an Earth-Moon trajectory solution. Launch, separation, transfer, insertion transition and downlink staging are cinematic illustrations, with compressed times and interplanetary distances.
- Preset inclination is 90 degrees and solar beta is assumed 0 / 55 / 30 degrees. Custom inputs permit periapsis 20–3,000 km, apoapsis from periapsis through 10,000 km, inclination 0–180 degrees, beta -90–90 degrees. Circular eclipse duration uses spherical geometry; elliptic eclipse uses 4,096 uniform-time cylindrical-shadow samples. Beta is a scenario setting, not launch-date ephemeris data. No penumbra, mascons, J2, third-body perturbations, terrain occultation or long-term stability prediction.
- Array output includes fixed orientation/degradation factors. Battery capacity includes depth-of-discharge and efficiency factors. Advanced flights integrate 512 equal-time samples per orbit, geometric shadow, sunlight/shadow load envelopes, cell damage and charging efficiency, clamped to usable capacity. Battery depletion is evaluated before crediting later recharge. Older flights retain their original lumped energy calculation. Thermal control is a fixed heater load, not a temperature solver.
- Observation and contact windows retain the prototype's explicit duty fractions scaled to computed orbital period; they are **not ground-station visibility predictions**. Data are tracked as generated, stored, lost and downlinked Gbit. Memory saturation and antenna configuration affect returned data and points.
- Coverage samples 1,440 times per orbit, rotating a spherical Moon beneath a nadir-pointing sensor cone. Illustrative FOV: camera 20 degrees, spectrometer 10, radar 30. The widest enabled imaging sensor sets geometric access. Displayed swath is the tangent-plane approximation 2*h*tan(FOV/2). It is not a real LROC/Diviner/Mini-RF instrument specification or resolution estimate.
- Access overlays show archival locations geometrically reachable **while some data were accepted into memory**, not delivered geolocated observations. Sparse samples do not resolve craters; optical illumination, signal-to-noise, thermal emission, radar scattering, ice abundance and detection confidence are not calculated. Instruments do not create new NASA measurements.
- New-model crisis results use no random draws. The flare uses an explicit **educational protection-index threshold 0.35**, with fixed game penalties. Advanced unprotected continuation also sets remaining array generation to 45%; panel tilt/cracks illustrate that scenario, not predicted mechanical radiation damage. This is not a radiation-dose or failure-probability model. Extended eclipse subtracts selected load * 40/60 hours from current charge and causes a power-loss incident if insufficient. Even reduced load can exhaust a nearly empty battery. Explosion/trajectory effects are pedagogical consequences, not structural/ascent predictions.
- Component costs, launcher performance, paid tests, robustness index and science weights are fictional. The final score is a game rubric, not a mission-success probability. Archived saves intentionally keep their original rules.

## Real launch vehicles and spaceports

Open **Orbit & launcher → Real rocket & spaceport** (Russian: **Орбита и носитель → Реальная ракета и космодром**). Reserving a vehicle uses the existing purchase/refund and budget system. Choose a compatible pad, validate the spacecraft and launch. The selected rocket, side boosters, launch caption and geographic Earth location change together; the selection survives reload and appears in the exported mission report. Older fictional launcher profiles and archived saves remain supported.

| Reference vehicle | Compatible reference pads                           | Shape reference                                               |
| ----------------- | --------------------------------------------------- | ------------------------------------------------------------- |
| Falcon 9          | Kennedy LC-39A, Canaveral SLC-40, Vandenberg SLC-4E | 70 m, 3.66 m core, nine first-stage engines                   |
| Falcon Heavy      | Kennedy LC-39A                                      | 70 m, three cores, 27 first-stage engines                     |
| Soyuz-2           | Baikonur 31/6, Vostochny 1S                         | Approximately 46 m family reference, four tapered side blocks |
| Ariane 6 A64      | Kourou ELA-4                                        | 62 m long-fairing reference, four solid boosters              |

Sources, consulted 15 November 2026: [SpaceX Falcon User's Guide, May 2025](https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf), [ESA Ariane 6](https://www.esa.int/missions/about-us/directorates/space-transportation/ariane/ariane-6), [CNES Ariane 6 assembly and launch](https://cnes.fr/projets/ariane-6/assemblage-lancement), [Progress Soyuz-2 programme](https://samspace.ru/about/programs/67/12062/) and [FAA 2013 compendium, published 2014](https://www.faa.gov/about/office_org/headquarters_offices/ast/media/2014-02-04_FAA_2013_Compendium.pdf). Pad reference coordinates come from [Launch Library 2](https://ll.thespacedevs.com/2.3.0/pads/), rounded to 0.01 degree. NASA Blue Marble remains the attributed display map; these references are bundled locally and require no live API.

Models are original, simplified code geometry with recognizable proportions, not manufacturer CAD. Soyuz dimensions vary with upper stage and payload section. Terrain, buildings and towers are illustrative. The four real reference vehicles now use a surface launch scene with a common kilometre scale: a 70 m vehicle beside a 6,371 km-radius spherical Earth. The older fictional profiles retain their original presentation. Latitude's approximate eastward surface speed, `465.1*cos(latitude)` m/s, is shown only as a reference and is not credited to spacecraft delta-v.

**All launch prices and lunar payload allocations are game assumptions.** They are neither real commercial prices nor published LEO/TLI capacities; changing the reference rocket does not create a validated launch trajectory. Lunar spacecraft mass, delta-v, power and mission constraints continue to use the connected educational model described above.

## Surface launch and continuous mission view

For a real reference vehicle, **Follow** opens a ground-level camera instead of a giant rocket standing on a small globe. At 1x the launch illustration lasts 60 seconds; existing pause, speed, step, skip, replay and reduced-motion controls still apply. The sequence shows countdown, ignition and tower clearance, a progressive pitch toward the local horizon, side-block release where applicable, main-engine cutoff, stage separation, upper-stage ignition, fairing release, a coast on an illustrative 200 km parking orbit, upper-stage restart for lunar departure, payload separation and hinged solar-array deployment. The camera follows the remaining upper stage, then widens into the mission overview. The same clock drives smoke, engine effects, attitude, cameras and deployment.

`ascentProfile.ts` supplies a prescribed, monotone Hermite altitude/downrange profile; rocket direction follows its tangent on a spherical Earth. Heights and angles shown in the caption are **scenario geometry**, not measured telemetry or predictions for the selected launcher. This is a common teaching sequence, not a vehicle-specific mission timeline or certification that every listed vehicle can perform a particular lunar mission. No thrust, propellant flow, drag, aerodynamic load, guidance optimisation, pad azimuth, actual launch-window or real ephemeris solution is calculated. The existing spacecraft engineering model remains separate from this illustrative launcher ascent.

Earth's mean radius is from the [NASA Earth Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/earthfact.html). The general flight sequence follows [NASA Glenn: Flight To Orbit](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/flight-to-orbit/) and [NASA Basics of Space Flight: Launch](https://science.nasa.gov/learn/basics-of-space-flight/chapter14-1/), consulted 15 November 2026. They support the educational sequence, not the game's numerical profile or timing. Daylight, clouds, smoke and atmosphere glow are rendering approximations; local land/coast/roads are procedural illustrations, not satellite imagery of the selected pad. NASA Blue Marble remains the attributed global display texture.

One WebGL canvas switches between the local kilometre scene and the compressed Earth–Moon/solar scene. An orthonormal east/up/south basis maps the selected pad and actual visible payload into mission coordinates. Camera position and attitude are converted when leaving the close scene, including free-camera mode; explicit System/Full route/Follow changes keep time unchanged. Real vehicles are represented by a position marker in the distant overview, rather than enlarged rockets and pads. The departure path stays outside the Earth sphere. Lunar orbit, power, science, decisions, saves and reports retain their previous rules. Planetary distances and lunar spacecraft size in the wider mission view remain exaggerated as documented above.

## NASA science provenance

**Observed science layer:** [LRO / LROC south-pole time-weighted illumination product](https://data.lroc.im-ldi.com/lroc/view_rdr/WAC_POLE_ILL_TWI_SOUTH), product `WAC_POLE_ILL_TWI_SOUTH_100M`, version 1.3, archive `LRO-L-LROC-5-RDR-V1.0`. Annual time-weighted illumination **percent**, 15 February 2010 through 5 February 2011, 3,807 primary observations plus 229 gap-fill observations. Original 1,214 x 1,214 little-endian float pixels at 100 m in south polar stereographic projection. Credit: NASA/GSFC/Arizona State University, LRO/LROC team. Reference: [Speyerer & Robinson (2013), Icarus 222(1), 122-136](https://doi.org/10.1016/j.icarus.2012.10.010).

The app retains 1,297 nearest-original-pixel samples on a 41 x 41 grid (~2.96 km spacing) within 88-90 degrees S. Values are rounded to 0.0001 percentage point; PDS null/saturation constants are excluded, valid zeros retained. No interpolation or invented values. Historical illumination is **not current sunlight, temperature, PSR classification or water-ice abundance**. LROC documents near-zero artifacts and temporal interpolation/gap filling.

[Original IMG](https://pds.lroc.im-ldi.com/data/LRO-L-LROC-5-RDR-V1.0/LROLRC_2001/DATA/BDR/WAC_POLE/WAC_POLE_ILL_TWI_SOUTH/WAC_POLE_ILL_TWI_SOUTH_100M.IMG) SHA-256:
`dfecc026012fe24f67ca70ed21a09a1723ca0750bf3ec120f1a4ed2c4604717b`.

The attached PDS3 label's `^IMAGE=3`, `RECORD_BYTES=4856` gives the validated image offset **9712 bytes**; the migrated XML's 4856-byte offset conflicts with the attached label and file length. Extraction follows the embedded label. Zero-based row/column offsets correspond to the label's pixel-center convention. The original label, README, units, observation dates, projection and hashes ship in `public/science`.

**3D display layer:** [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), 2025 2K color map; credit NASA Scientific Visualization Studio, LRO LROC/LOLA teams and Ernie Wright. The rendering map has aesthetic color adjustments and polar fill and is **not used for quantitative science**. Its terrain is color-shaded; there is no terrain mesh or navigation-grade surface registration between 3D imagery and the separate polar data map.

Regenerate the bundled observations with Python 3 standard library only:

```powershell
python scripts/prepare-nasa-data.py
```

The script downloads the original product to an OS temporary cache, validates both source hashes, checks raster layout, and emits numerical samples, provenance and the display texture. A changed source hash requires deliberate review. The 5.9 MB source raster is not shipped to browsers.

## Competition materials and verification

- [Audit and prioritized checklist](docs/competition-audit.md)
- [English competition description](docs/competition-description.md)
- [30-second demo script](docs/demo-script.md)

The project extends a pre-existing prototype; these materials identify the new lunar model, real-data integration, comparison/reporting and verification work. It is not a claim of NASA endorsement or a submission receipt. The existing Word manual remains for historical reference; this README describes the upgraded model.
