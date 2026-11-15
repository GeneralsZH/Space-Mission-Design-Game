import { z } from "zod";
import { buildSchema } from "../store/schema";
import { calculate } from "../engine/calculations";
import { launchers } from "../data/missionConfig";
import { launchSiteFor, realVehicle } from "../data/realLaunches";
import { coverageSummary, lroc } from "../engine/coverage";
import { orbitalParameters, elementsFor } from "../engine/orbital";
import type { MissionRun } from "../types";

const attemptSchema = z.object({
  id: z.string().max(40),
  date: z.string(),
  build: buildSchema,
  success: z.boolean(),
  science: z.number().finite(),
  cost: z.number().finite(),
  coverage: z.number().min(0).max(100),
  sentGbit: z.number().finite(),
});
export type Attempt = z.infer<typeof attemptSchema>;
const storageKey = "orbital-mission-lab-attempts-v1";
export function attemptId(run: MissionRun) {
  const source = JSON.stringify([
    buildSchema.parse(run.build),
    run.logs,
    run.result,
  ]);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `run-${(hash >>> 0).toString(16)}`;
}
export function readAttempts(): Attempt[] {
  try {
    const parsed = z
      .array(attemptSchema)
      .max(8)
      .safeParse(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
export function rememberAttempt(run: MissionRun) {
  if (!run.result) return;
  const id = attemptId(run),
    previous = readAttempts();
  if (previous.some((a) => a.id === id)) return;
  const attempt: Attempt = {
    id,
    date: new Date().toISOString(),
    build: structuredClone(run.build),
    success: run.result.success,
    science: run.deliveredScience,
    cost: run.result.costMUsd,
    coverage:
      run.build.modelVersion === 2
        ? coverageSummary(run.observedCellIds).percent
        : 0,
    sentGbit: run.transmittedGbit,
  };
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify([attempt, ...previous].slice(0, 8)),
    );
  } catch {
    /* The current report remains downloadable without browser storage. */
  }
}
export function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function missionReport(run: MissionRun) {
  const balance = calculate(run.build),
    orbital = orbitalParameters(elementsFor(run.build)),
    coverage = coverageSummary(run.observedCellIds);
  const rows = (items: Record<string, unknown>) =>
    Object.entries({
      "Launch vehicle":
        launchers.find((v) => v.id === run.build.launcherId)?.name.en ??
        run.build.launcherId,
      ...(launchSiteFor(run.build)
        ? {
            "Launch pad": launchSiteFor(run.build)!.name.en,
            "Pad reference coordinates (deg)": `${launchSiteFor(run.build)!.latitude} / ${launchSiteFor(run.build)!.longitude}`,
            "Launch assumptions":
              "Recognisable simplified vehicle; rounded geographic marker; fictional lunar mass allocation and game price; no ascent/launch-window solution",
            "Vehicle reference": realVehicle(run.build.launcherId)!.source,
          }
        : {}),
      ...items,
    })
      .map(
        ([key, value]) =>
          `<tr><th>${escape(key)}</th><td>${escape(value)}</td></tr>`,
      )
      .join("");
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Orbital Mission Lab report</title><style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:20px;color:#152536}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #ccd}pre{white-space:pre-wrap}a{color:#067}</style><h1>Orbital Mission Lab — Lunar Ice Mapper</h1><p>Educational simulation report. ${run.result?.success ? "Contract completed" : "Contract not completed"}. Model: ${run.build.modelVersion === 2 ? "Lunar two-body v2" : "Archived prototype rules"}.</p><h2>Design and result</h2><table>${rows({ Orbit: run.build.customOrbit ? "custom" : run.build.orbitId, "Periapsis / apoapsis (km)": `${elementsFor(run.build).periapsisKm} / ${elementsFor(run.build).apoapsisKm}`, "Inclination / assumed beta (deg)": `${elementsFor(run.build).inclinationDeg} / ${elementsFor(run.build).betaDeg}`, "Solar output after damage (W)": (balance.sunPowerW * (run.solarEfficiency ?? 1)).toFixed(1), "Installed modules": run.build.moduleIds.join(", "), "Dry / wet mass (kg)": `${balance.dryMassKg} / ${balance.wetMassKg}`, "Initial / remaining propellant (kg)": `${run.build.propellantKg} / ${run.fuelKg.toFixed(3)}`, "Available / required delta-v (m/s)": `${balance.availableDeltaV.toFixed(1)} / ${balance.requiredDeltaV.toFixed(1)}`, "Period (min, v2 only)": run.build.modelVersion === 2 ? (orbital.periodSeconds / 60).toFixed(2) : "Archived profile timing", "Power generation / peak load (W)": `${balance.sunPowerW.toFixed(1)} / ${balance.peakLoadW.toFixed(1)}`, "Usable / final battery (Wh)": `${balance.usableBatteryWh.toFixed(1)} / ${run.chargeWh.toFixed(1)}`, "Cost (fictional M USD)": balance.costMUsd.toFixed(2), "Delivered science (game index; target 120)": run.deliveredScience.toFixed(2), "Generated / downlinked / lost / stored (Gbit)": `${run.generatedGbit.toFixed(3)} / ${run.transmittedGbit.toFixed(3)} / ${run.lostGbit.toFixed(3)} / ${run.storedGbit.toFixed(3)}`, "Geometrically accessible samples while collecting data (v2)": `${coverage.observed} / ${coverage.total} (${coverage.percent.toFixed(2)}%)` })}</table><h2>Previous designs on this browser</h2><table><tr><th>Orbit</th><th>Science index</th><th>Cost M USD</th><th>Coverage %</th></tr>${readAttempts()
    .map(
      (a) =>
        `<tr><td>${escape(a.build.orbitId)}</td><td>${a.science.toFixed(1)}</td><td>${a.cost.toFixed(1)}</td><td>${a.build.modelVersion === 2 ? a.coverage.toFixed(1) : "Legacy"}</td></tr>`,
    )
    .join(
      "",
    )}</table><h2>Observed science data</h2><p>NASA LRO / LROC ${escape(lroc.metadata.productId)}. Annual time-weighted illumination (%), ${escape(lroc.metadata.period)}. Original pixels 100 m; this app uses ${coverage.total} sparse samples at about 2.96 km spacing. This is historical illumination, not water-ice abundance, current sunlight, or temperature.</p><p><a href="${lroc.metadata.sourceDocumentation}">Product documentation</a> · <a href="${lroc.metadata.sourceUrl}">Original PDS IMG</a> · <a href="https://doi.org/10.1016/j.icarus.2012.10.010">Speyerer & Robinson (2013)</a></p><p>Source SHA-256: ${lroc.metadata.sourceSha256}</p><h2>Scientific limitations</h2><p>Spherical two-body Moon; GM 4.90e12 m³/s², radius 1737.4 km. Capture assumes arrival v-infinity 820 m/s plus 150 m/s reserve. Fixed beta and cylindrical shadow; no ephemerides, terrain occultation, mascons, launch ascent or attitude dynamics. Instrument fields of view, costs, launchers, radiation threshold, science points and crisis effects are educational assumptions. Coverage indicates geometric access, not detection, instrument resolution or downlinked geolocated observations. No ice measurements are invented. 3D spacecraft and interplanetary distances are exaggerated. Archived flights retain their original rules.</p><h2>Event log</h2><ol>${run.logs.map((e) => `<li>T+${e.hours.toFixed(2)} h — ${escape(e.message.en)}</li>`).join("")}</ol><h2>Reproducible configuration</h2><pre>${escape(JSON.stringify(run.build, null, 2))}</pre></html>`;
}
