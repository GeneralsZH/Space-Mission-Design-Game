import {
  catalog,
  launchers,
  missionConfig,
  physics,
} from "../data/missionConfig";
import type { Build, Economy, TestKind, TestRecord } from "../types";
import { calculate } from "./calculations";

export const emptyBuild: Build = {
  moduleIds: [],
  orbitId: "low-polar",
  launcherId: "none",
  propellantKg: 0,
  testingBudgetMUsd: 0,
  overheadMUsd: 0,
};
export const emptyEconomy = (): Economy => ({
  ownedIds: [],
  fuelKg: 0,
  launcherId: null,
  tests: [],
});
export const testCosts: Record<Exclude<TestKind, "legacy">, number> = {
  power: 1.5,
  thermal: 1.5,
  communications: 1,
  vibration: 1,
};
export const fingerprint = (b: Build) =>
  JSON.stringify([
    b.moduleIds.slice().sort(),
    b.orbitId,
    b.launcherId,
    b.propellantKg,
  ]);
export function spending(e: Economy): number {
  return (
    catalog
      .filter((c) => e.ownedIds.includes(c.id))
      .reduce((n, c) => n + c.costMUsd, 0) +
    e.fuelKg * physics.propellantCostPerKg +
    (launchers.find((l) => l.id === e.launcherId)?.costMUsd ?? 0) +
    e.tests.reduce((n, t) => n + t.costMUsd, 0)
  );
}
export const cash = (e: Economy) => missionConfig.budgetMUsd - spending(e);
export function syncBuild(b: Build, e: Economy): Build {
  const next = {
    ...b,
    moduleIds: b.moduleIds.filter((id) => e.ownedIds.includes(id)),
    launcherId: e.launcherId ?? "none",
    propellantKg: e.fuelKg,
  };
  const current = e.tests.filter(
    (t) => t.passed && t.fingerprint === fingerprint(next),
  );
  next.testingBudgetMUsd = Math.min(
    physics.maxTestingMUsd,
    current.reduce((n, t) => n + t.costMUsd, 0),
  );
  const installedCost = catalog
    .filter((c) => next.moduleIds.includes(c.id))
    .reduce((n, c) => n + c.costMUsd, 0);
  next.overheadMUsd = Math.max(
    0,
    spending(e) -
      installedCost -
      e.fuelKg * physics.propellantCostPerKg -
      (launchers.find((l) => l.id === e.launcherId)?.costMUsd ?? 0) -
      next.testingBudgetMUsd,
  );
  return next;
}
export function makeTest(
  kind: Exclude<TestKind, "legacy">,
  b: Build,
): TestRecord {
  const r = calculate(b);
  const measurements: Record<typeof kind, string[]> = {
    power: [
      `Solar ${r.sunPowerW.toFixed(1)} W / load ${r.peakLoadW.toFixed(1)} W`,
      `Cycle ${r.cycleMarginWh.toFixed(1)} Wh`,
    ],
    thermal: [
      `Eclipse ${r.shadowEnergyNeedWh.toFixed(1)} Wh / battery ${r.usableBatteryWh.toFixed(1)} Wh`,
    ],
    communications: [
      `Generated ${(r.generatedGbit * 4).toFixed(2)} Gbit / memory ${r.memoryGbit} Gbit`,
      `Contact ${(r.transmittableGbit * 4).toFixed(2)} Gbit`,
    ],
    vibration: [
      `Payload ${r.wetMassKg.toFixed(1)} kg / limit ${r.payloadKg.toFixed(1)} kg`,
      `Dry mass ${r.dryMassKg.toFixed(1)} kg`,
    ],
  };
  const passed = {
    power: r.sunMarginW >= 0 && r.cycleMarginWh >= 0,
    thermal: r.usableBatteryWh >= r.shadowEnergyNeedWh,
    communications:
      r.memoryGbit >= r.generatedGbit * 4 &&
      r.transmittableGbit >= r.generatedGbit,
    vibration:
      r.massMarginKg >= 0 && r.dryMassKg > 0 && b.launcherId !== "none",
  }[kind];
  return {
    kind,
    fingerprint: fingerprint(b),
    costMUsd: testCosts[kind],
    passed,
    measurements: measurements[kind],
  };
}
export function legacyEconomy(b: Build): Economy {
  const economy: Economy = {
    ownedIds: [...b.moduleIds],
    fuelKg: b.propellantKg,
    launcherId: b.launcherId === "none" ? null : b.launcherId,
    tests:
      b.testingBudgetMUsd > 0
        ? [
            {
              kind: "legacy",
              fingerprint: fingerprint(b),
              costMUsd: b.testingBudgetMUsd,
              passed: true,
              measurements: ["Imported qualification / Перенесённые испытания"],
            },
          ]
        : [],
  };
  const excess = spending(economy) - missionConfig.budgetMUsd;
  if (excess > 0) economy.legacyOverdraftMUsd = excess;
  return economy;
}
