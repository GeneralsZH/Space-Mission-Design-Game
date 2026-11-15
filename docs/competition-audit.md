# Orbital Mission Lab — competition upgrade audit

## Surface-scale launch and complete ascent presentation — 15 November 2026

- [x] Replace the real-vehicle launch's enlarged globe/pad presentation with a local kilometre frame: physical Earth radius and reference rocket dimensions.
- [x] Add a shared geometric ascent profile, tangent-driven pitch, sequential engine cutoff/restart, parking coast, fairing release, payload separation and articulated array deployment.
- [x] Add ground-level terrain, daylight-to-space sky, clouds, smoke, shadows and an atmosphere rim while retaining the existing NASA Earth texture and credits.
- [x] Share the playback clock across all effects; retain pause/speed/replay, free camera, fullscreen actions and the solar panorama in one WebGL canvas.
- [x] Convert close-camera position/attitude and the actual visible payload into the mission coordinate frame. Route departure around Earth and retain delayed failure diagnostics.
- [x] Clearly identify the generic prescribed trajectory, common stage sequence and scenario heights; no claim of vehicle-specific ascent prediction.

The geometric profile and major stages are verified separately from the spacecraft engineering model. See `docs/verification.md` for the actual final checks and remaining platform limits.

## Real Earth launch selection — 15 November 2026

- [x] Add four recognisable reference vehicles and six actual pad markers, with compatible pad selection and primary-source links.
- [x] Connect reservations, refunds, budget limits, save/replay validation, geographic Earth launch poses, staging and exported reports without changing archived fictional launcher outcomes.
- [x] Use the shared playback clock, local surface-normal ascent and follow camera; blend illustrative ground into the NASA Earth display rather than leaving a floating launch disk.
- [x] Separate reference shapes/locations from fictional mission allocations, prices and cinematic ascent. Do not imply real launch-window or vehicle-performance prediction.
- [x] Add geometric/compatibility/save/economy checks and desktop/mobile WebGL scenarios. Verification details are recorded in `docs/verification.md`.

Reproduction: **Orbit & launcher → Real rocket & spaceport**, reserve Soyuz-2, choose Vostochny 1S or Baikonur 31/6, validate and launch. See `README.md` for the other vehicle/pad combinations and source references. Historical audit entries below retain the evidence from their original versions.

Audited 14 November 2026 against restored commit `615efc7`. The existing application is retained.

## Baseline

React/TypeScript, Vite, Zustand with validated JSON saves, React Three Fiber/Three.js, Vitest, and Playwright. Nine bilingual screens already support purchasing, assembly, launch reservations, paid analysis benches, flight operations, incident playback, reports, replay, offline caching, and local persistence. All 78 baseline unit/integration tests passed before editing. There is no backend or cloud synchronization.

## Prioritized implementation checklist

### P0 — scientific integrity and a connected mission

- [x] Introduce a documented lunar two-body model: GM/radius, periapsis/apoapsis, vis-viva speed, Kepler period, eclipse duration, and estimated capture impulse.
- [x] Use the computed timing for power, observation/data generation, mission duration, and orbit visualization.
- [x] Preserve historical saved flights with their existing rules; use the upgraded model for new designs and revised attempts.
- [x] Replace random crisis damage in the upgraded model with explicit, reproducible engineering criteria. Keep scenario assumptions distinct from measured NASA data.
- [x] Calculate simulated spatial coverage and data return; do not call abstract game points a physical measurement or a probability of success.

### P1 — real science and a demonstrable 3D experience

- [x] Package an attributed NASA SVS LRO-derived Moon texture locally, with its visualization-only limitations.
- [x] Ingest a genuine LROC south-pole illumination product and metadata, verify units/no-data handling, and retain a reproducible extraction script.
- [x] Provide an observed-data view and a scientifically meaningful comparison of lower/higher orbits (coverage, sampling footprint, period, eclipse, and communication/data constraints).
- [x] Tie the orbit path and spacecraft motion to computed orbital elements while retaining camera controls, tracking, fallback, and reduced-motion support.
- [x] Label transfer/launch animation and exaggerated spacecraft size as illustrative; label simulated observations separately from archived LRO observations.

### P2 — gameplay, evidence, and submission

- [x] Add useful configuration validation and a return-to-design action without removing deliberate failure-and-debrief learning.
- [x] Generate a standalone mission report and compare completed attempts, including inputs, units, actual outcomes, and science provenance.
- [x] Audit visible controls, replay/pause/speed, import/export, first-load behavior, broken resources, and console errors.
- [x] Test new formulas and the complete upgraded mission journey, then run the existing regression checks.
- [x] Write an English README, scientific limitations, dataset citations, a concise competition description, and a 30-second demonstration script.

## Findings and boundaries

- `missionConfig.ts`: eclipse/sunlight times and capture impulses are fixed game profiles; the stated altitude does not determine their values.
- `missionPlayback.ts`: the orbit uses manually chosen world radii and a sinusoidal ellipse, not orbital elements or Keplerian time.
- `simulation.ts`: risky decisions use seeded random damage; replay is deterministic for a seed but outcomes are not determined by engineering alone.
- `Planet.tsx`: the Moon texture is procedural, not LRO data. No quantitative science data are currently bundled.
- `calculations.ts`: mass, rocket equation, costs, and W/Wh accounting work; science weights and the reliability score are educational indices, not measured quantities or calibrated probabilities.
- `Flight.tsx`: the current export is a save file rather than an explanatory science/engineering report. Attempts are not compared.
- Working controls and save recovery must be preserved. Changing the rules of an already saved flight can invalidate its command replay; compatibility is an explicit requirement.

This is a preliminary educational simulator. It will not claim mission-grade trajectories, real-time LRO telemetry, ice detection from a texture, or validated radiation/structural failure predictions. Competition materials will acknowledge the pre-existing prototype and identify the upgrade work; challenge eligibility and submission remain the team's responsibility.

## Implemented upgrade

The prototype was extended in place. New designs and explicitly revised saves use lunar model v2; historical flights remain replayable with their original rules. Mass, propellant, capture, power, storage, cost, mission result and visual orbit share the same build. New crisis outcomes use documented deterministic thresholds and energy demand. Launch/transfer/failure animations remain illustrative.

NASA science now includes a locally packaged SVS Moon display texture and 1,297 checksum-verified original LROC annual-illumination samples. The science screen provides source pixels and units, a sparse polar map, a simulated-access overlay, and same-hardware comparisons of orbital speed, period, shadow demand, footprint, low-illumination sample access and mean accessed archival illumination. No ice abundance or detection probability is generated.

Completed attempts are compared locally and exported in an HTML report with configuration, engineering units, outcomes, event log, data source and limitations. The optional engineering review opens on request; the original purchase/assembly and failure/debrief journey remains intact.

## Verification log — completion 15 November 2026

- Baseline: 78 unit/integration tests passed before changes.
- Updated TypeScript, ESLint, 89 unit/integration tests and production build passed. New tests cover orbital invariants, bounded shadow time, source metadata, coverage, data conservation, seed-independent modern outcomes, low-energy failure, attempt history and escaped portable reports.
- NASA extraction rerun reproduced 1,297 samples, the original IMG SHA-256 and the NASA display JPEG SHA-256. The attached PDS3 image pointer and raster length were checked; the conflicting migrated XML offset is explicitly documented.
- Targeted browser rerun: all 11 tests in the upgraded journey and original mission suites passed after fixes. It covered source assets, map selection, overlay toggle, mobile overflow, complete modern flight, reload, report download, comparison, visible textured Moon/orbiter, pause and camera switching, plus legacy engineering and offline behaviors.
- The first browser attempt reached an unrelated service on port 4173; it was excluded from evidence. Tests now own isolated port 4186 with server reuse disabled.
- The first full run found three issues: a paused camera transition could stop early, and two legacy tests found hidden diagnostic text before the optional review was opened. Camera interpolation now requests its own render frames; diagnostic content mounts only when requested. All three affected checks passed on rerun.
- First-load change verified in generated service worker: only shell JS/CSS and core assets are precached; 3D/chart chunks are lazy and science assets cache on use. Core JS is approximately 194 KB gzip. The large shared 3D chunk remains a build size warning. No cross-device timing benchmark or hardware-GPU certification was performed.

Final browser coverage: **all 27 distinct cases passed across the full regression and targeted reruns**. The last full run had 25 passes, one pause-sampling assertion failure and one serial-suite skip. After waiting for the canvas pause render before sampling time, all three live-playback cases passed (38.6 s), covering both the affected and skipped cases. The final upgraded journey/3D tests passed with no page errors; the journey also checks console errors and bundled science resources. No failing case remains unresolved.

Screenshots: `docs/screenshots/lroc-science.png` and `docs/screenshots/lunar-two-body-3d.png`. The standalone HTML report is generated from each actual run; JSON save export remains available. Publication uses the existing public Site and its source repository, preserving the project identity and audience.

## Practical limits

Automated browser verification uses Chromium with software WebGL, plus responsive viewport and fallback checks. It does not establish Safari/Firefox/mobile GPU compatibility or mission-grade scientific validity. Historical illumination cannot establish ice abundance, and <5% illumination does not classify permanent shadow. Coverage is geometric access to sparse archival samples, not downlinked geolocated science. Game equipment, prices, scenario beta, radiation threshold, crisis penalties and science weights remain educational assumptions. No competition entry was submitted automatically.

## Follow-up: stationary 3D playback — 15 November 2026

A fresh 3D launch on the deployed version 9 was reproduced with software WebGL: rocket progress increased and no page errors or failed resource requests were observed. The reported user's browser state was unavailable, so that user's exact trigger was not asserted.

An identified defect affected reduced-motion mode: visual motion was disabled while the playback clock continued advancing. The clock now honors motion enablement; rendering preserves the frozen clock position instead of resetting the rocket or orbiter to the start. The scene provides an explicit Play 3D animation recovery action, enabling 3D/live motion and resuming saved pause. Completed flights can restart visibly through Watch 3D again without losing their purchased design. Scenario decisions remain explicit.

A new timer regression verifies that disabled motion cannot silently advance liftoff, and that toggling motion freezes and resumes the same clock position. New browser cases cover a reduced-motion paused 2D save recovering to moving 3D, an explicitly enabled launch under operating-system reduced motion, and a completed saved mission replay retaining hardware and fuel. Follow-up verification: TypeScript, ESLint, all 90 unit/integration tests and production build passed. All 11 focused Chromium cases passed in one run (1.3 min), including the three new recovery scenarios, 3D liftoff and pause/resume, context-loss fallback, the complete live mission, saved replay, reduced-motion override and offline cache recovery.

## Automatic animation start — 15 November 2026

At the user's request, new projects default to motion on. Launch mission, Restart flight, Continue live and the Live playback control enable motion automatically. Starting or replaying a flight also selects live playback, so students do not need a separate animation-enable click. Explicit pause, step mode, motion-off controls and crisis choices remain functional.

Verification: TypeScript, ESLint, all 90 unit/integration tests and production build passed. All 18 focused browser cases passed across the animation/replay and mission/science suites. The new case starts with motion off, step mode and OS reduced motion, then proves that Launch mission and Restart flight visibly animate without the recovery button. Existing manual journeys explicitly select Step mode after launching; their mission reports and NASA data comparisons still pass.

## Return to the animation after actions — 15 November 2026

Student-triggered crisis decisions, manual stage commands and spacecraft-operation changes now return the viewport and keyboard focus to the flight animation after the new state has rendered. Scrolling is smooth when motion is enabled and immediate when motion is disabled. Automatic live transitions do not steal the viewport. The explicit command to finish an incident recording and show its causes still opens the diagnostic report.

Verification: TypeScript, ESLint, all 90 unit/integration tests and production build passed. All 11 focused Chromium cases passed (26.3 s), including two new actual-3D cases at 1366 px and 390 px that check viewport position and focus after a crisis decision, stage advancement and target change, plus the existing mission/report/offline regressions.

## Fullscreen mission console — 15 November 2026

Active flights now open in a full-viewport console by default. A single mission clock and a single renderer remain active; the existing decision component is shared with the optional dashboard layout. Essential telemetry, pause/resume, playback speed, Auto/Step mode, camera controls, replay, spacecraft operations, crisis choices, flight log and mission result are available over the scene. Decisions automatically open the Actions overlay and close it when selected. On phones the bottom sheet leaves the central spacecraft visible; Russian control labels fit the viewport. Back to dashboard restores the original layout, and the view preference is saved locally. Native browser fullscreen is available through the expand control when supported.

The fullscreen console traps keyboard focus, supports Escape, locks page scrolling and makes the covered application inert until exit. The SVG fallback uses the same full-viewport layout. Failure diagnostics remain hidden until incident playback finishes and then appear in the result overlay. The report action restores normal application navigation.

Verification: TypeScript, ESLint, all 90 unit/integration tests and the production build passed. The final complete browser regression run passed all 37 discovered cases (4.9 min). A subsequently added fullscreen failure/debrief case also passed (5.9 s), bringing verified coverage to 38 distinct browser cases. New checks cover full-canvas viewport bounds at 1366 and 390 px, native browser fullscreen entry/exit, pause and speed, in-scene decisions and telemetry/log panels, keyboard exit, complete mission and report navigation, Russian mobile controls, and delayed failure diagnostics. Existing dashboard regressions explicitly select panel mode; fullscreen cases clear that preference to exercise the new default.

Screenshots: `docs/screenshots/fullscreen-flight-1366.png`, `docs/screenshots/fullscreen-flight-390.png`, `docs/screenshots/fullscreen-flight-ru.png`.

## Custom orbit, survey trail, event plan and damage — 15 November 2026

- [x] Validated custom periapsis/apoapsis, inclination and assumed solar beta; shared elements drive period, speed, capture, shadow, engineering, comparison, reports and 3D motion.
- [x] Recorded geometric survey ribbons on the rotating Moon, including accepted-memory and power limits. The Moon camera exposes southern passes. Previously accepted passes rebuild from the saved command stream; this is simulated access, not ice detection or proof of delivered geolocated observations.
- [x] Planned event countdown for separation, arrival, observation, shadow and downlink; compressed playback seconds are distinguished from model minutes. Pause and speed affect the same clock.
- [x] Advanced power integrates 512 time samples and actual geometric shadow. Unprotected risky flare continuation uses an explicit educational 45% remaining-generation rule, visible dark/tilted/cracked cells and persistent telemetry. Subsequent depletion disables systems and produces visible attitude loss; missed capture and communications remain distinct.
- [x] Archived builds retain their previous rules. New/revised designs and explicit custom-orbit application enable `advancedFlight`; custom fields survive validated canonical JSON export/import and browser reload.

Automated additions cover custom bounds and computed invariants, polar/equatorial access, saved replay, full custom mission/data conservation, ground geometry, damage versus healthy/archived power, early failure before observation, battery bounds and speed-aware event times. Four new Chromium cases exercise actual 3D survey persistence, causal damage/power loss and delayed diagnostics, orbital input/telemetry integration, and fullscreen controls at 390 px. Screenshots: `custom-orbit-trail.png`, `solar-cell-damage.png`, `advanced-flight-mobile.png` in `docs/screenshots`.

Verification: TypeScript, ESLint, **102 unit/integration tests** and the production build passed. The complete Chromium regression passed **all 42 cases** (5.9 min). After the final diagnostic wording and canonical attempt-identity fixes, all six advanced-flight and NASA journey/3D cases passed again (1.3 min). The added memory-saturation test proves that accepted trails stop before future polar samples; attempt IDs now survive build-key reordering during save validation. Feature cases capture page errors; none were recorded. Browser checks use software WebGL and responsive viewports, not physical mobile GPU certification. Core JS is ~201 KB gzip; the lazy shared 3D chunk remains ~251 KB gzip and emits the existing build-size warning.

## Solar system explorer — 15 November 2026

Added a separate full-viewport solar atlas with the Sun, all eight planets, Earth's Moon, ring illustrations for Saturn/Uranus, a schematic asteroid belt and a 2,400-point decorative sky. The mission and hangar also use the improved 1,600-point sky. Navigation and the flight camera toolbar open the atlas without altering mission commands. Users can select actual meshes or the object strip, track a world, rotate/pan/zoom, pause/resume, change model days per second, reset, toggle labels/orbits, enter native fullscreen and return by button or Escape. Transparent information cards link the radius/period and orbital-element references.

Planetary radii and sidereal periods are attributed to JPL; the fixed J2000 Kepler illustration is explicitly separate from a current-date ephemeris and from lunar mission engineering. Distances are logarithmically compressed; radii, lunar separation, textures, axial spin, rings, belt particles and stars are illustrative. Focus views hide other worlds while overview displays the full system. The camera fits narrow screens; labels use a consistent screen size. Reduced-motion preferences stop the atlas clock; a context-loss fallback preserves object information and exit. The page traps focus, makes the covered app inert and restores it on exit.

The atlas is lazy loaded and generates textures locally. Its shared JSX runtime exposed an offline-cache edge case: precaching now follows static shell imports while excluding dynamic 3D/chart imports, so splitting the shell cannot omit a required runtime dependency. Four new formula tests cover orbit closure, focal distance bounds, compressed direction and the attached Moon; three Chromium scenarios cover actual eight-planet meshes/rings, mesh picking, all selections, paused clock/positions, zoom/speed/reset, native fullscreen, Russian mobile return without command changes, reduced motion and WebGL loss.

The first complete browser regression found six failures: five settings-dependent journeys could not reach a utility button pushed below the fixed desktop sidebar by the extra navigation row; first-visit offline reload also exposed the missing static JSX runtime. Desktop navigation now scrolls, and shell precaching follows static dependency imports. These failures were retained as evidence and the affected journeys rerun after rebuilding; tests were not weakened or given forced clicks.

Final verification: TypeScript, ESLint, **106 unit/integration tests** and the production build passed. The full 45-case Chromium run initially passed 39 cases; after the two fixes all 17 mission/student/replay/solar cases passed (57.9 s), followed by the remaining affected 3D context-loss/settings case (8.6 s). Thus **all 45 distinct browser cases are verified across the regression and focused reruns**. No unresolved failure remains. New solar desktop/mobile cases recorded no page errors; actual mesh selection, native fullscreen, orbital motion and frozen positions were exercised. Screenshots: `solar-overview.png`, `solar-saturn.png`, `solar-mobile.png`. Combined main/JSX runtime is ~202 KB gzip; the shared lazy 3D library is ~247 KB gzip. Physical mobile GPUs and other browser engines were not certified.

## Solar context inside the flight animation — 15 November 2026

The flight renderer now contains the Sun and distant planetary point markers, a continuous solar panorama, a live spacecraft marker and a compact navigation inset. **System** switches the existing camera while the mission clock and all actions remain active; **Follow** or the inset restores the close view. **Atlas** retains the separate reference explorer. There is one flight WebGL canvas and one mission clock. The environment derives model days from the actual run plus current stage progress, including mission pauses and decision waits. Its scenario Sun direction matches the selected lunar beta/inclination assumptions. A camera-centred decorative sky avoids near-field star parallax. An enlarged-body panorama and compressed distances are labelled; it is not an interplanetary mission solution or a current-date ephemeris.

Earth uses the unchanged 1024 x 512 NASA SVS Blue Marble PNG (444,710 bytes; SHA-256 `d1d3cb36ae6ae452c43cdf7ae0ffc13a959e8a5a2358f58b05e5f623c15119f9`) with source/credit metadata in `public/science/earth-provenance.json`. A view-dependent atmosphere rim, model-time Earth rotation, visible Sun/corona and lighting-consistent solar direction improve the local view. Logarithmic depth supports the close rocket and distant context in a single renderer. Planet label textures and static inset orbital paths are reused rather than regenerated on every playback update. Recorded physics, purchases, mission results and saved command rules are unchanged.

New formula checks cover model-time continuity through launch/cruise, the computed orbital period, decision waits and unit Sun directions. New desktop/mobile Chromium cases prove shared moving/paused clocks, a single canvas, switching the live camera without leaving flight, retained Actions controls, NASA Earth texture loading and zero page/console errors in the desktop journey. Regression verification passed 29 browser cases (4.1 min), covering launch, live full mission, incidents, fullscreen, custom-orbit/power consequences, reports, saves, offline reload and the atlas. After the NASA texture and final framing changes, all seven focused flight/NASA/atlas cases passed (1.8 min). Screenshots: `live-solar-panorama.png`, `live-solar-launch.png`, `live-solar-mobile.png`.

Final TypeScript, ESLint, **109 unit/integration tests** and production build passed. After caching static map paths and label textures, both new in-flight desktop/mobile cases passed again (36.7 s). This follow-up verified **33 distinct browser cases across regression and focused runs**; it did not rerun the entire 47-case repository suite. No checked case remains failing. Static shell dependencies total ~207 KB gzip; the shared 3D library remains ~247 KB gzip. The source Earth PNG was checked for PNG signature, 1024 x 512 dimensions and SHA-256 before bundling. Neither real-device GPU performance nor flight-grade predictions are claimed.
