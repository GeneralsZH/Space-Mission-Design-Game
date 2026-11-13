import {
  catalog,
  categories,
  launchers,
  missionConfig as mission,
  orbits,
  physics as p,
} from "../data/missionConfig";
import type { BalanceReport, Build, ComponentDef, Issue } from "../types";

export const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));
export function deltaV(
  dryMassKg: number,
  fuelKg: number,
  ispSeconds: number,
): number {
  if (
    ![dryMassKg, fuelKg, ispSeconds].every(Number.isFinite) ||
    dryMassKg <= 0 ||
    fuelKg < 0 ||
    ispSeconds < 0
  )
    throw new Error("Invalid mass or specific impulse");
  return ispSeconds * p.g0 * Math.log((dryMassKg + fuelKg) / dryMassKg);
}
export function dataGbit(rateMbps: number, hours: number): number {
  if (![rateMbps, hours].every(Number.isFinite) || rateMbps < 0 || hours < 0)
    throw new Error("Invalid data rate or time");
  return (rateMbps * hours * 3600) / 1000;
}
export const deliveryRatio = (generated: number, transmittable: number) =>
  generated === 0 ? 1 : clamp(transmittable / generated);
export const selectedComponents = (build: Build) =>
  build.moduleIds.map((id) => {
    const item = catalog.find((c) => c.id === id);
    if (!item) throw new Error(`Unknown component ${id}`);
    return item;
  });
export const sum = (
  parts: ComponentDef[],
  get: (item: ComponentDef) => number,
) => parts.reduce((total, part) => total + get(part), 0);

export function calculate(build: Build): BalanceReport {
  if (
    !Number.isFinite(build.propellantKg) ||
    build.propellantKg < 0 ||
    build.propellantKg > p.maxPropellantKg ||
    !Number.isFinite(build.testingBudgetMUsd) ||
    !Number.isFinite(build.overheadMUsd ?? 0) ||
    (build.overheadMUsd ?? 0) < 0 ||
    (build.overheadMUsd ?? 0) > 500 ||
    build.testingBudgetMUsd < 0 ||
    build.testingBudgetMUsd > p.maxTestingMUsd
  )
    throw new Error("Invalid build inputs");
  const parts = selectedComponents(build);
  const orbit = orbits.find((o) => o.id === build.orbitId);
  const launcher = launchers.find((l) => l.id === build.launcherId);
  if (!orbit || (!launcher && build.launcherId !== "none"))
    throw new Error("Invalid mission profile");
  const dryMassKg = sum(parts, (c) => c.massKg);
  const wetMassKg = dryMassKg + build.propellantKg;
  const payloadKg = (launcher?.payloadKg ?? 0) * orbit.payloadFactor;
  const engine = parts.find((c) => c.category === "propulsion");
  const availableDeltaV =
    dryMassKg > 0
      ? deltaV(dryMassKg, build.propellantKg, engine?.ispSeconds ?? 0)
      : 0;
  const requiredDeltaV = orbit.requiredDeltaV + p.deltaVReserve;
  const sunPowerW =
    sum(parts, (c) => c.ratedW ?? 0) * p.sunlightFactor * p.degradationFactor;
  const heaterW = parts.some((c) => c.category === "thermal")
    ? p.protectedHeaterW
    : p.unprotectedHeaterW;
  const peakLoadW = sum(parts, (c) => c.powerW) + heaterW;
  const shadowLoadW =
    sum(parts, (c) =>
      c.category === "bus"
        ? c.powerW
        : c.category === "instrument"
          ? c.powerW * p.shadowInstrumentDuty
          : 0,
    ) + heaterW;
  const shadowEnergyNeedWh = shadowLoadW * orbit.shadowHours;
  const usableBatteryWh =
    sum(parts, (c) => c.capacityWh ?? 0) *
    p.depthOfDischarge *
    p.batteryEfficiency;
  const cycleMarginWh =
    (sunPowerW - peakLoadW) * orbit.sunHours * p.batteryEfficiency -
    shadowEnergyNeedWh;
  const generatedGbit = dataGbit(
    sum(parts, (c) => c.dataMbps ?? 0),
    orbit.operatingHours,
  );
  const transmittableGbit = dataGbit(
    sum(parts, (c) => c.downlinkMbps ?? 0),
    orbit.contactHours,
  );
  const sciencePerOrbit =
    sum(parts, (c) => c.science ?? 0) * orbit.scienceFactor;
  const ratio = deliveryRatio(generatedGbit, transmittableGbit);
  const memoryGbit = sum(parts, (c) => c.memoryGbit ?? 0);
  const storageRatio =
    generatedGbit === 0
      ? 1
      : clamp(memoryGbit / (generatedGbit * mission.orbits));
  const potentialScience =
    sciencePerOrbit * mission.orbits * Math.min(ratio, storageRatio);
  const costMUsd =
    (launcher?.costMUsd ?? 0) +
    (build.overheadMUsd ?? 0) +
    sum(parts, (c) => c.costMUsd) +
    build.testingBudgetMUsd +
    build.propellantKg * p.propellantCostPerKg;
  const reliability = clamp(
    p.baselineReliability +
      sum(parts, (c) => c.protection ?? 0) * p.shieldingReliabilityWeight +
      build.testingBudgetMUsd * p.testReliabilityPerM,
    0,
    p.maxReliability,
  );
  const issues: Issue[] = [];
  const error = (code: Issue["code"], deficit: number) =>
    issues.push({ code, severity: "error", deficit: Math.max(0, deficit) });
  if (costMUsd > mission.budgetMUsd)
    error("budget", costMUsd - mission.budgetMUsd);
  if (wetMassKg > payloadKg) error("mass", wetMassKg - payloadKg);
  if (availableDeltaV < requiredDeltaV)
    error("fuel", requiredDeltaV - availableDeltaV);
  if (sunPowerW < peakLoadW) error("sun", peakLoadW - sunPowerW);
  if (cycleMarginWh < 0) error("cycle", -cycleMarginWh);
  if (usableBatteryWh < shadowEnergyNeedWh)
    error("battery", shadowEnergyNeedWh - usableBatteryWh);
  if (
    !mission.requiredInstrumentTags.every((tag) =>
      parts.some((c) => c.category === "instrument" && c.tags?.includes(tag)),
    )
  )
    error("instrument", 0);
  const required = ["bus", "communications", "panel", "battery", "propulsion"];
  if (
    new Set(build.moduleIds).size !== parts.length ||
    categories.some(
      (category) =>
        category !== "instrument" &&
        parts.filter((c) => c.category === category).length > 1,
    ) ||
    !launcher ||
    required.some(
      (category) => parts.filter((c) => c.category === category).length !== 1,
    )
  )
    error("slots", 0);
  if (potentialScience < mission.scienceTarget)
    error("data", mission.scienceTarget - potentialScience);
  if (memoryGbit < generatedGbit * mission.orbits)
    issues.push({
      code: "memory",
      severity: "warning",
      deficit: generatedGbit * mission.orbits - memoryGbit,
    });
  if (reliability < 0.85)
    issues.push({
      code: "risk",
      severity: "warning",
      deficit: (0.85 - reliability) * 100,
    });
  return {
    dryMassKg,
    wetMassKg,
    payloadKg,
    massMarginKg: payloadKg - wetMassKg,
    availableDeltaV,
    requiredDeltaV,
    deltaVMargin: availableDeltaV - requiredDeltaV,
    sunPowerW,
    peakLoadW,
    sunMarginW: sunPowerW - peakLoadW,
    shadowLoadW,
    usableBatteryWh,
    shadowEnergyNeedWh,
    cycleMarginWh,
    generatedGbit,
    transmittableGbit,
    deliveryRatio: ratio,
    memoryGbit,
    sciencePerOrbit,
    potentialScience,
    costMUsd,
    budgetMarginMUsd: mission.budgetMUsd - costMUsd,
    reliability,
    issues,
  };
}
export const isReady = (report: BalanceReport) =>
  !report.issues.some((issue) => issue.severity === "error");

export function replaceModule(build: Build, id: string): Build {
  const item = catalog.find((c) => c.id === id);
  if (!item) return build;
  if (build.moduleIds.includes(id))
    return { ...build, moduleIds: build.moduleIds.filter((v) => v !== id) };
  return {
    ...build,
    moduleIds: [
      ...build.moduleIds.filter(
        (v) =>
          item.category === "instrument" ||
          catalog.find((c) => c.id === v)?.category !== item.category,
      ),
      id,
    ],
  };
}
