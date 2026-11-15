<p align="center">
  <img src="public/favicon.svg" alt="Space Mission Architect logo" width="72" />
</p>

<h1 align="center">Space Mission Architect: Trade-Off</h1>

<p align="center">
  An educational engineering simulation for designing, assembling, and launching a lunar satellite right in your browser.
  <br />
  <em>An educational spacecraft engineering simulation — design, build, launch, and operate.</em>
</p>

---

## 🎯 Project Goal

To create a visual, interactive environment that allows users to learn the fundamentals of spacecraft systems engineering in a gamified format and understand key mission design **trade-offs**—balancing scientific value, mass, power consumption, reliability, and budget.

---

## 🚀 About the Project

**Space Mission Architect** is a browser-based educational lab where the user goes through the complete lifecycle of creating a space mission:

1. 📋 **Contract Review** — Setting the objectives for the `Lunar Ice Mapper` mission to map water ice in the Moon's polar craters.
2. 🛒 **Spacecraft Design & Assembly** — Selecting components from a catalog (buses, instruments, antennas, solar panels, batteries, thrusters, shielding) and assembling them in 3D.
3. 🛸 **Orbit & Launch Vehicle Selection** — Calculating delta-V ($\Delta V$), power budget, and total spacecraft mass.
4. 🧪 **Pre-Launch Testing** — Verifying systems on test benches (power, thermal vacuum, communications, vibration) to increase overall mission reliability.
5. 📡 **Mission Control** — Monitoring the launch and orbital flight in 3D, tracking telemetry, and making decisions during anomalies (solar flares, eclipses).
6. 🏆 **Mission Evaluation** — Calculating the final mission score based on the volume of scientific data gathered, reliability, and budget efficiency.

> **Note:** All physical and economic parameters in the simulator are educational approximations and are not intended for calculating real-world space missions.

## Run locally

Requires Node.js 24 or later. From the repository root:

```sh
npm ci
npm run dev
```

English is the default interface language. The EN/RU switch preserves an explicit saved choice. Build with `npm run build`; run checks with `npm run check`.

## Flight camera and audio

The flight starts with automatic camera tracking. Drag or zoom to inspect the scene; tracking resumes four seconds after the interaction ends. Turn **Auto** off to keep a free camera, or select an overview to keep that view. **Follow** and **Reset camera** restore automatic tracking.

**Sound** controls synthesized engine, separation, telemetry and mission-event effects; the adjacent slider controls flight volume. Audio follows the visual burn/coast stages, becomes silent on pause or in a hidden tab, and releases its audio context when leaving the viewer. New installations enable sound by default; saved mute preferences are respected. Browsers may require a click on **Enable sound**. These effects are designed sonification, not recordings or acoustic propagation through vacuum. No external audio assets are downloaded.

## Submission materials

- [Project summary - Word, 161 words](docs/Orbital_Mission_Lab_Project_Summary.docx)
- [Project details - Word](docs/Orbital_Mission_Lab_Project_Details.docx)
- [NASA and other resources - Word](docs/Orbital_Mission_Lab_NASA_and_Other_Resources.docx)
- [NASA, partner, software and tool resources - full URLs](docs/submission-resources.md)
- [Scientific assumptions and limitations](docs/assumptions.md)
- [Verification record](docs/verification.md)

The observed scientific dataset is historical LRO/LROC illumination. It is distinct from simulated science return and does not contain measured ice abundance.

## Generated files

QA screenshots are generated in ignored `test-results/screenshots`, alongside browser reports. Historical screenshot binaries, the completed work plan and the superseded manual browser-QA script have been removed from the tracked source tree. NASA science data and their credits remain bundled.

The existing GitHub Pages workflow builds with `VITE_BASE=/Space-Mission-Design-Game/`; public images, source links and the service worker respect that prefix. The working branch is `ehso`.
