import { describe, expect, it } from "vitest";
import {
  catalog,
  goldenBuild,
  missionConfig,
  physics,
} from "../data/missionConfig";
import {
  calculate,
  dataGbit,
  deltaV,
  deliveryRatio,
  isReady,
  replaceModule,
} from "../engine/calculations";
import {
  assessResult,
  createRun,
  random,
  transition,
} from "../engine/simulation";
import type { Build, MissionRun } from "../types";
import { defaultSettings } from "../store/useMissionStore";
import { parseSave } from "../store/schema";

const build = (patch: Partial<Build> = {}): Build => ({
  ...structuredClone(goldenBuild),
  ...patch,
});
function fly(config = build(), seed = 42, safe = true) {
  let run = transition(createRun(config, seed), { type: "Validate" });
  run = transition(run, { type: "Launch", seed });
  for (let i = 0; i < 30 && !run.result; i++)
    run = transition(
      run,
      run.crisis
        ? { type: "ChooseDecision", choice: safe ? "safe" : "continue" }
        : { type: "Advance" },
    );
  return run;
}
describe("engineering model", () => {
  it("validates catalog values and guarantees a viable golden build", () => {
    for (const c of catalog) {
      expect(c.massKg).toBeGreaterThan(0);
      expect(c.costMUsd).toBeGreaterThan(0);
      expect(c.powerW).toBeGreaterThanOrEqual(0);
    }
    expect(isReady(calculate(build()))).toBe(true);
  });
  it("T-01 radar increases mass, power, data and price and breaks cycle balance", () => {
    const base = calculate(build());
    const radar = calculate(replaceModule(build(), "radar"));
    expect(radar.dryMassKg - base.dryMassKg).toBe(58);
    expect(radar.peakLoadW - base.peakLoadW).toBe(200);
    expect(radar.generatedGbit).toBeGreaterThan(base.generatedGbit);
    expect(radar.costMUsd - base.costMUsd).toBeCloseTo(19);
    expect(radar.issues.some((i) => i.code === "cycle")).toBe(true);
  });
  it.each([
    ["budget", () => build({ launcherId: "heavy", testingBudgetMUsd: 25 })],
    ["mass", () => build({ launcherId: "light" })],
    ["fuel", () => build({ propellantKg: 1 })],
    ["sun", () => replaceModule(build(), "panel-s")],
    [
      "battery",
      () => replaceModule(replaceModule(build(), "battery-s"), "radar"),
    ],
    ["instrument", () => replaceModule(build(), "spectrometer")],
    ["slots", () => replaceModule(build(), "engine-medium")],
    ["data", () => replaceModule(build(), "lga")],
  ] as const)(
    "records %s for postflight analysis without blocking engineering mistakes",
    (code, make) => {
      const config = make();
      expect(calculate(config).issues.some((i) => i.code === code)).toBe(true);
      const run = createRun(config);
      const prepared = transition(run, { type: "Validate" });
      const launched = transition(prepared, { type: "Launch", seed: 42 });
      expect(launched.phase).toBe(code === "budget" ? "draft" : "launched");
    },
  );
  it("T-04 handles zero fuel and rejects invalid numbers", () => {
    expect(deltaV(100, 0, 300)).toBe(0);
    expect(() => deltaV(0, 10, 300)).toThrow();
    expect(() => deltaV(100, -1, 300)).toThrow();
    expect(() => deltaV(100, Infinity, 300)).toThrow();
    expect(() => calculate(build({ propellantKg: -1 }))).toThrow();
    expect(
      calculate(build({ propellantKg: 150 })).availableDeltaV,
    ).toBeGreaterThan(calculate(build()).availableDeltaV);
  });
  it("uses consistent units and zero-data conventions", () => {
    expect(dataGbit(1, 1)).toBe(3.6);
    expect(() => dataGbit(-1, 1)).toThrow();
    expect(deliveryRatio(0, 0)).toBe(1);
    expect(deliveryRatio(4, 2)).toBe(0.5);
    const stats = calculate(build());
    expect(stats.shadowEnergyNeedWh).toBeCloseTo(stats.shadowLoadW * 0.6);
    expect(stats.usableBatteryWh).toBeCloseTo(
      480 * physics.depthOfDischarge * physics.batteryEfficiency,
    );
    const empty = calculate(
      build({
        moduleIds: goldenBuild.moduleIds.filter(
          (id) => !["camera", "spectrometer"].includes(id),
        ),
      }),
    );
    expect(empty.potentialScience).toBe(0);
  });
  it("T-06 lower downlink reduces potential delivered science", () => {
    expect(
      calculate(replaceModule(build(), "lga")).potentialScience,
    ).toBeLessThan(calculate(build()).potentialScience);
  });
  it("warns when memory will overflow", () => {
    const config = replaceModule(replaceModule(build(), "bus-lite"), "radar");
    expect(calculate(config).issues.some((i) => i.code === "memory")).toBe(
      true,
    );
  });
});
describe("deterministic mission state machine", () => {
  it("T-10 completes the golden configuration including two crises and four orbits", () => {
    const run = fly();
    expect(run.phase).toBe("completed");
    expect(run.orbit).toBe(4);
    expect(run.result?.success).toBe(true);
    expect(run.deliveredScience).toBeGreaterThanOrEqual(
      missionConfig.scienceTarget,
    );
    expect(run.flareResolved && run.eclipseResolved).toBe(true);
    expect(run.fuelKg).toBeLessThan(run.build.propellantKg);
    expect(run.telemetry).toHaveLength(4);
    expect(run.chargeWh).toBeGreaterThan(0);
  });
  it("T-06 actual downlink losses reduce delivered science on launchable designs", () => {
    const base = build({ propellantKg: 121, testingBudgetMUsd: 0 });
    const radar = replaceModule(
      replaceModule(replaceModule(base, "camera"), "radar"),
      "panel-l",
    );
    const highRate = replaceModule(radar, "hga-high");
    expect(isReady(calculate(radar))).toBe(true);
    expect(isReady(calculate(highRate))).toBe(true);
    const compactRun = fly(radar, 10000, false);
    const highRateRun = fly(highRate, 10000, false);
    expect(compactRun.result?.success).toBe(true);
    expect(highRateRun.result?.success).toBe(true);
    expect(compactRun.deliveredScience).toBeLessThan(
      highRateRun.deliveredScience,
    );
    expect(compactRun.storedGbit).toBeGreaterThan(0);
  });
  it("rejects invalid PRNG seeds at the pure engine boundary", () => {
    for (const seed of [-1, 1.5, NaN, Infinity, 4294967296])
      expect(() => createRun(build(), seed)).toThrow();
  });
  it("T-07 identical seed and commands reproduce the exact report", () => {
    expect(fly(build(), 218, false)).toEqual(fly(build(), 218, false));
    expect(random(22)).toEqual(random(22));
  });
  it("supports seed zero without an absorbing random state", () => {
    expect(createRun(build(), 0).rng).not.toBe(0);
    expect(fly(build(), 0).result?.success).toBe(true);
  });
  it("risky commands on unprotected spacecraft can fail for an explained reason", () => {
    const config = build({
      moduleIds: goldenBuild.moduleIds.filter(
        (id) => !["radiation", "thermal"].includes(id),
      ),
    });
    expect(isReady(calculate(config))).toBe(true);
    const run = fly(config, 1, false);
    expect(run.result?.success).toBe(false);
    expect(run.logs.some((l) => l.kind === "error")).toBe(true);
  });
  it("pause, decisions and stage guards prevent unintended progress", () => {
    let run = transition(createRun(build()), { type: "Validate" });
    run = transition(run, { type: "Launch", seed: 42 });
    run = transition(run, { type: "Pause" });
    expect(transition(run, { type: "Advance" })).toBe(run);
    run = transition(run, { type: "Resume" });
    run = transition(run, { type: "Advance" });
    expect(run.crisis).toBe("flare");
    expect(transition(run, { type: "Advance" })).toBe(run);
    expect(transition(run, { type: "Launch", seed: 1 })).toBe(run);
  });
  it("does not mutate prior states, freezes build snapshot and restarts", () => {
    const config = build();
    const initial = createRun(config);
    config.propellantKg = 0;
    expect(initial.build.propellantKg).toBe(120);
    const original = structuredClone(initial);
    transition(initial, { type: "Validate" });
    expect(initial).toEqual(original);
    const done = fly();
    expect(transition(done, { type: "Restart" }).phase).toBe("draft");
  });
  it("separates main contract success from a bounded numeric rating", () => {
    const run: MissionRun = { ...fly(), deliveredScience: 0, health: 100 };
    const result = assessResult(run);
    expect(result.success).toBe(false);
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
  });
});
describe("save validation", () => {
  const save = () => ({
    schemaVersion: 1,
    build: build(),
    settings: defaultSettings,
    seed: 42,
    commands: [{ type: "Validate" }, { type: "Launch", seed: 42 }],
  });
  it("imports and replays a supported save", () => {
    expect(parseSave(JSON.stringify(save())).commands).toHaveLength(2);
  });
  it.each([
    "{bad",
    "{}",
    JSON.stringify({ ...save(), schemaVersion: 2 }),
    JSON.stringify({ ...save(), build: { ...build(), propellantKg: -5 } }),
    JSON.stringify({ ...save(), commands: [{ type: "Advance" }] }),
    JSON.stringify({
      ...save(),
      build: { ...build(), moduleIds: ["fake-part"] },
    }),
  ])("T-09 rejects corrupt or inconsistent saves", (input) => {
    expect(() => parseSave(input)).toThrow();
  });
});
