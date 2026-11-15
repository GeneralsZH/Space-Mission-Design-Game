import data from "../data/lroc-illumination.json" with { type: "json" };
import { keplerState, lunar, elementsFor, orbitalParameters } from "./orbital";
import { componentById, resolveOrbit } from "../data/missionConfig";
import type { MissionRun } from "../types";
import { calculate, selectedComponents, sum } from "./calculations";

export const lroc = data;
const radians = Math.PI / 180;
const grid = data.cells.map((c) => {
  const lat = c.latitude * radians,
    lon = c.longitude * radians;
  return {
    id: c.id,
    unit: [
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon),
    ],
  };
});
const cache = new Map<string, number[]>();
// These are illustrative game-instrument fields of view, not specifications of
// the real LROC camera or Mini-RF. Non-imaging instruments have no ground swath.
export const instrumentFov: Record<string, number> = {
  camera: 20,
  spectrometer: 10,
  radar: 30,
};
export function observationEndProgress(run: MissionRun) {
  const profile = resolveOrbit(run.build),
    duty = profile.operatingHours / (profile.sunHours + profile.shadowHours);
  const rate = sum(
    selectedComponents(run.build).filter(
      (c) =>
        !run.operations.disabledInstrumentIds.includes(c.id) &&
        !(c.id === "radar" && run.radarDisabled),
    ),
    (c) => c.dataMbps ?? 0,
  );
  const produced = rate * profile.operatingHours * 3.6 * run.scienceFactor,
    free = Math.max(0, calculate(run.build).memoryGbit - run.storedGbit);
  return 0.5 + duty * (produced > 0 ? Math.min(1, free / produced) : 0);
}
export function observationFootprintKm(
  run: Pick<MissionRun, "build" | "operations" | "radarDisabled">,
) {
  const fov = Math.max(
    0,
    ...run.build.moduleIds
      .filter(
        (id) =>
          !run.operations.disabledInstrumentIds.includes(id) &&
          !(id === "radar" && run.radarDisabled),
      )
      .map((id) => instrumentFov[id] ?? 0),
  );
  const elements = elementsFor(run.build);
  return {
    fovDeg: fov,
    periapsisSwathKm: 2 * elements.periapsisKm * Math.tan((fov * radians) / 2),
    apoapsisSwathKm: 2 * elements.apoapsisKm * Math.tan((fov * radians) / 2),
  };
}
export function observeOrbit(run: MissionRun, progress = 1): number[] {
  if (run.operations.target !== "pole") return [];
  const elements = elementsFor(run.build),
    o = orbitalParameters(elements),
    profile = resolveOrbit({ ...run.build, modelVersion: 2 });
  const fov = observationFootprintKm(run).fovDeg;
  if (!fov) return [];
  const key = JSON.stringify([
    elements,
    profile.operatingHours,
    run.orbit,
    fov,
    progress,
  ]);
  const cached = cache.get(key);
  if (cached) return cached;
  const hit = new Set<number>(),
    halfCos = Math.cos((fov * radians) / 2),
    inclination = elements.inclinationDeg * radians;
  const duty = profile.operatingHours / (o.periodSeconds / 3600);
  for (let step = 0; step < 1440 * progress; step++) {
    const phase = step / 1440;
    if (phase < 0.5 || phase > 0.5 + duty) continue;
    const p = keplerState(elements, phase),
      x = p.x,
      y = p.y * Math.sin(inclination),
      z = p.y * Math.cos(inclination);
    if (y / p.r > Math.sin(-70 * radians)) continue;
    const rotation =
      (-2 * Math.PI * (run.orbit + phase) * o.periodSeconds) /
      (lunar.siderealHours * 3600);
    const rx = x * Math.cos(rotation) - z * Math.sin(rotation),
      rz = x * Math.sin(rotation) + z * Math.cos(rotation);
    for (const c of grid) {
      const cosGamma = (rx * c.unit[0] + y * c.unit[1] + rz * c.unit[2]) / p.r;
      if (cosGamma <= lunar.radiusM / p.r) continue;
      const range = Math.sqrt(
        p.r * p.r +
          lunar.radiusM * lunar.radiusM -
          2 * p.r * lunar.radiusM * cosGamma,
      );
      if ((p.r - lunar.radiusM * cosGamma) / range >= halfCos) hit.add(c.id);
    }
  }
  const result = [...hit].sort((a, b) => a - b);
  if (cache.size >= 32) cache.delete(cache.keys().next().value!);
  cache.set(key, result);
  return result;
}
export function coverageSummary(ids: number[]) {
  const set = new Set(ids),
    observed = data.cells.filter((c) => set.has(c.id)),
    low = data.cells.filter((c) => c.illuminationPct < 5);
  return {
    observed: observed.length,
    total: data.cells.length,
    percent: (100 * observed.length) / data.cells.length,
    lowIlluminationObserved: low.filter((c) => set.has(c.id)).length,
    lowIlluminationTotal: low.length,
    meanArchivalIlluminationPct: observed.length
      ? observed.reduce((v, c) => v + c.illuminationPct, 0) / observed.length
      : null,
  };
}
export function activeImaging(run: MissionRun) {
  return run.build.moduleIds.some(
    (id) =>
      Boolean(instrumentFov[id]) &&
      componentById(id).category === "instrument" &&
      !run.operations.disabledInstrumentIds.includes(id) &&
      !(id === "radar" && run.radarDisabled),
  );
}
