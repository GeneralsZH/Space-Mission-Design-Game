import { describe, expect, it } from "vitest";
import { goldenBuild, resolveOrbit } from "../data/missionConfig";
import { buildSchema } from "../store/schema";
import { useMissionStore, defaultSettings } from "../store/useMissionStore";
import { fingerprint } from "../engine/economy";
import { elementsFor, orbitalParameters } from "../engine/orbital";
import { createRun, transition } from "../engine/simulation";
import { calculate } from "../engine/calculations";
import { advancedEnergy, chargeAt } from "../engine/energy";
import { observeOrbit, observationEndProgress } from "../engine/coverage";
import { groundPoint, footprintHalfAngle } from "../engine/groundTrack";
import { upcomingEvents } from "../features/playback/upcomingEvents";
import { orbitPosition } from "../features/playback/missionPlayback";
import { predictIncident } from "../engine/incidents";
import { attemptId } from "../features/reports";
import type { Build } from "../types";
const build = (patch: Partial<Build> = {}): Build => ({
  ...structuredClone(goldenBuild),
  modelVersion: 2,
  advancedFlight: true,
  ...patch,
});
const custom = {
  periapsisKm: 100,
  apoapsisKm: 600,
  inclinationDeg: 90,
  betaDeg: 20,
};
function fly(b: Build) {
  let run = transition(transition(createRun(b), { type: "Validate" }), {
    type: "Launch",
    seed: 42,
  });
  for (let i = 0; i < 30 && !run.result; i++)
    run = transition(
      run,
      run.crisis
        ? { type: "ChooseDecision", choice: "safe" }
        : { type: "Advance" },
    );
  return run;
}
describe("free orbital design", () => {
  it("validates bounded physical inputs and preserves archived builds", () => {
    expect(buildSchema.safeParse(goldenBuild).success).toBe(true);
    expect(buildSchema.safeParse(build({ customOrbit: custom })).success).toBe(
      true,
    );
    for (const e of [
      { ...custom, apoapsisKm: 30 },
      { ...custom, inclinationDeg: 190 },
      { ...custom, betaDeg: 100 },
      { ...custom, periapsisKm: NaN },
    ])
      expect(buildSchema.safeParse(build({ customOrbit: e })).success).toBe(
        false,
      );
    expect(
      buildSchema.safeParse({ ...goldenBuild, customOrbit: custom }).success,
    ).toBe(false);
  });
  it("uses the edited elements consistently in timing, capture, shadow and 3D", () => {
    const low = build(),
      high = build({
        customOrbit: {
          ...custom,
          periapsisKm: 300,
          apoapsisKm: 300,
          inclinationDeg: 45,
        },
      });
    const o = orbitalParameters(elementsFor(high)),
      profile = resolveOrbit(high);
    expect(profile.sunHours + profile.shadowHours).toBeCloseTo(
      o.periodSeconds / 3600,
      8,
    );
    expect(profile.requiredDeltaV).toBeCloseTo(o.captureDeltaVMs, 8);
    expect(o.periodSeconds).toBeGreaterThan(
      orbitalParameters(elementsFor(low)).periodSeconds,
    );
    expect(Math.abs(orbitPosition(createRun(high), 0.25)[2])).toBeGreaterThan(
      0.5,
    );
    expect(fingerprint(high)).not.toBe(fingerprint(low));
  });
  it("does not reuse a polar coverage cache for an equatorial custom orbit", () => {
    const polar = createRun(build({ customOrbit: custom })),
      equatorial = createRun(
        build({ customOrbit: { ...custom, inclinationDeg: 0 } }),
      );
    expect(observeOrbit(polar).length).toBeGreaterThan(0);
    expect(observeOrbit(equatorial)).toEqual([]);
  });
  it("round-trips custom inputs canonically with their replay", () => {
    const s = useMissionStore.getState();
    s.importSave(
      JSON.stringify({
        schemaVersion: 1,
        build: build({ customOrbit: custom }),
        settings: defaultSettings,
        seed: 42,
        commands: [],
      }),
    );
    const save = s.exportSave();
    s.importSave(save);
    expect(s.exportSave()).toBe(save);
    expect(useMissionStore.getState().build.customOrbit).toEqual(custom);
  });
  it("keeps the same attempt identity when save validation reorders build keys", () => {
    const original = fly(build({ customOrbit: custom }));
    const ordered = Object.fromEntries(
      Object.entries(original.build).reverse(),
    ) as unknown as Build;
    expect(attemptId({ ...original, build: ordered })).toBe(
      attemptId(original),
    );
    expect(attemptId({ ...original, build: buildSchema.parse(ordered) })).toBe(
      attemptId(original),
    );
  });
});
describe("connected coverage and damage", () => {
  it("completes the custom mission, retains four passes and conserves data", () => {
    const run = fly(build({ customOrbit: custom }));
    expect(run.result?.success).toBe(true);
    expect(run.scanPasses).toHaveLength(4);
    expect(run.generatedGbit).toBeCloseTo(
      run.transmittedGbit + run.storedGbit + run.lostGbit,
      8,
    );
    expect(run.observedCellIds.length).toBeGreaterThan(0);
    expect(
      run.scanPasses?.every((pass) => pass.fovDeg > 0 && pass.progress === 1),
    ).toBe(true);
  });
  it("creates spherical ground points and a wider footprint with altitude", () => {
    for (const phase of [0.5, 0.7, 0.9])
      expect(Math.hypot(...groundPoint(build(), 0, phase, "pole"))).toBeCloseTo(
        1,
        10,
      );
    expect(groundPoint(build(), 0, 0.6, "equator")[1]).toBe(0);
    expect(
      footprintHalfAngle(
        build({
          customOrbit: { ...custom, periapsisKm: 300, apoapsisKm: 300 },
        }),
        0,
        20,
      ),
    ).toBeGreaterThan(footprintHalfAngle(build(), 0, 20));
  });
  it("stops recorded access when onboard memory fills, without crediting future polar samples", () => {
    const run = createRun(build());
    run.phase = "scienceOperations";
    const capacity = calculate(run.build).memoryGbit;
    run.storedGbit = capacity - 0.01;
    const stop = observationEndProgress(run);
    expect(stop).toBeGreaterThan(0.5);
    expect(stop).toBeLessThan(0.51);
    const next = transition(run, { type: "Advance" });
    expect(next.storedGbit).toBeCloseTo(capacity);
    expect(next.scanPasses).toHaveLength(1);
    expect(next.scanPasses![0].progress).toBeCloseTo(stop);
    expect(next.observedCellIds).toEqual([]);
    expect(transition(next, { type: "Advance" }).scanPasses).toHaveLength(1);
  });
  it("links an unprotected risky flare to actual solar output loss while keeping old rules", () => {
    const b = build({
      moduleIds: goldenBuild.moduleIds.filter((id) => id !== "radiation"),
    });
    const flare = (design: Build) =>
      transition(
        transition(
          transition(transition(createRun(design), { type: "Validate" }), {
            type: "Launch",
            seed: 42,
          }),
          { type: "Advance" },
        ),
        { type: "ChooseDecision", choice: "continue" },
      );
    const damaged = flare(b),
      archive = flare({ ...b, advancedFlight: undefined });
    expect(damaged.solarEfficiency).toBe(0.45);
    expect(archive.solarEfficiency).toBe(1);
    expect(damaged.health).toBeLessThan(100);
    damaged.phase = "scienceOperations";
    const healthy = { ...structuredClone(damaged), solarEfficiency: 1 };
    expect(advancedEnergy(damaged).endCharge).toBeLessThan(
      advancedEnergy(healthy).endCharge,
    );
  });
  it("never collects a future observation window after an early power failure", () => {
    const run = createRun(
      build({
        moduleIds: goldenBuild.moduleIds.map((id) =>
          id === "panel-m" ? "panel-s" : id,
        ),
      }),
    );
    run.phase = "scienceOperations";
    run.chargeWh = 1;
    expect(predictIncident(run)?.kind).toBe("power");
    expect(predictIncident(run)!.triggerProgress).toBeLessThan(0.5);
    const failed = transition(run, { type: "Advance" });
    expect(failed.generatedGbit).toBe(0);
    expect(failed.scanPasses).toHaveLength(0);
  });
  it("bounds sampled battery state by physical capacity", () => {
    const run = createRun(build());
    const capacity = calculate(run.build).usableBatteryWh;
    for (let i = 0; i <= 20; i++) {
      expect(chargeAt(run, i / 20)).toBeGreaterThanOrEqual(0);
      expect(chargeAt(run, i / 20)).toBeLessThanOrEqual(capacity);
    }
  });
});
describe("event countdown", () => {
  it("scales playback time and omits nonexistent high-beta eclipses", () => {
    const run = createRun(build());
    run.phase = "scienceOperations";
    const one = upcomingEvents(run, 0, 1),
      two = upcomingEvents(run, 0, 2);
    expect(one[0].id).toBe("shadow-in");
    expect(two[0].playbackSeconds).toBeCloseTo(one[0].playbackSeconds / 2);
    const sunny = {
      ...run,
      build: build({ customOrbit: { ...custom, betaDeg: 90 } }),
    };
    expect(
      upcomingEvents(sunny, 0, 1).some((e) => e.id.startsWith("shadow")),
    ).toBe(false);
    run.crisis = "eclipse";
    expect(upcomingEvents(run, 0, 1)).toEqual([]);
  });
});
