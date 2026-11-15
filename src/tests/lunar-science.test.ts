import { describe, expect, it } from "vitest";
import { goldenBuild, resolveOrbit, orbits } from "../data/missionConfig";
import { createRun, transition } from "../engine/simulation";
import { calculate } from "../engine/calculations";
import {
  eclipseSeconds,
  keplerState,
  lunar,
  orbitalParameters,
  orbitElements,
} from "../engine/orbital";
import { coverageSummary, lroc, observeOrbit } from "../engine/coverage";
import { fingerprint } from "../engine/economy";
import type { Build } from "../types";
import {
  missionReport,
  readAttempts,
  rememberAttempt,
} from "../features/reports";
const modern = (patch: Partial<Build> = {}): Build => ({
  ...structuredClone(goldenBuild),
  modelVersion: 2,
  ...patch,
});
const fly = (build: Build, seed = 42, choice: "safe" | "continue" = "safe") => {
  let run = transition(
    transition(createRun(build, seed), { type: "Validate" }),
    { type: "Launch", seed },
  );
  for (let i = 0; i < 30 && !run.result; i++)
    run = transition(
      run,
      run.crisis ? { type: "ChooseDecision", choice } : { type: "Advance" },
    );
  return run;
};
describe("lunar two-body physics", () => {
  it("computes a 100 km circular orbit from GM and radius in SI", () => {
    const o = orbitalParameters(orbitElements["low-polar"]);
    expect(o.periapsisSpeedMs).toBeCloseTo(
      Math.sqrt(lunar.mu / (lunar.radiusM + 100000)),
      8,
    );
    expect(o.periodSeconds).toBeGreaterThan(7000);
    expect(o.periodSeconds).toBeLessThan(7200);
    expect(o.periapsisSpeedMs).toBeCloseTo(o.apoapsisSpeedMs, 8);
  });
  it("obeys vis-viva, periapsis/apoapsis and nonuniform angular speed", () => {
    const e = orbitElements.elliptical,
      p = keplerState(e, 0),
      a = keplerState(e, 0.5),
      o = orbitalParameters(e);
    expect(p.altitudeKm).toBeCloseTo(100);
    expect(a.altitudeKm).toBeCloseTo(1000);
    expect(p.speedMs).toBeGreaterThan(a.speedMs);
    for (const t of [0.1, 0.25, 0.6]) {
      const q = keplerState(e, t);
      expect(q.speedMs ** 2 / 2 - lunar.mu / q.r).toBeCloseTo(
        -lunar.mu / (2 * o.a),
        6,
      );
    }
    expect(keplerState(e, 0.25).trueAnomaly).not.toBeCloseTo(Math.PI / 2, 1);
  });
  it("computes bounded eclipse time and removes eclipses at high solar beta", () => {
    for (const e of Object.values(orbitElements)) {
      expect(eclipseSeconds(e)).toBeGreaterThanOrEqual(0);
      expect(eclipseSeconds(e)).toBeLessThan(
        orbitalParameters(e).periodSeconds / 2,
      );
    }
    expect(eclipseSeconds({ ...orbitElements["low-polar"], betaDeg: 90 })).toBe(
      0,
    );
    expect(() =>
      orbitalParameters({ ...orbitElements.elliptical, apoapsisKm: 1 }),
    ).toThrow();
  });
  it("connects period and eclipse to battery demand and data collection", () => {
    const b = modern(),
      profile = resolveOrbit(b),
      o = orbitalParameters(orbitElements[b.orbitId]),
      r = calculate(b);
    expect(profile.sunHours + profile.shadowHours).toBeCloseTo(
      o.periodSeconds / 3600,
      10,
    );
    expect(r.shadowEnergyNeedWh).toBeCloseTo(
      r.shadowLoadW * profile.shadowHours,
      8,
    );
    expect(profile.requiredDeltaV).toBeCloseTo(o.captureDeltaVMs, 8);
    expect(resolveOrbit(goldenBuild).sunHours).toBe(orbits[0].sunHours);
    expect(fingerprint(b)).not.toBe(fingerprint(goldenBuild));
  });
});
describe("observed LROC data and simulated coverage", () => {
  it("contains pinned, valid observed samples with explicit provenance and units", () => {
    expect(lroc.metadata.sourceSha256).toBe(
      "dfecc026012fe24f67ca70ed21a09a1723ca0750bf3ec120f1a4ed2c4604717b",
    );
    expect(lroc.metadata.sourceImageOffsetBytes).toBe(9712);
    expect(lroc.cells).toHaveLength(1297);
    expect(new Set(lroc.cells.map((c) => c.id)).size).toBe(1297);
    expect(
      lroc.cells.every(
        (c) =>
          c.latitude >= -90 &&
          c.latitude <= -88 &&
          c.illuminationPct >= 0 &&
          c.illuminationPct <= 100,
      ),
    ).toBe(true);
    expect(coverageSummary([]).meanArchivalIlluminationPct).toBeNull();
  });
  it("distinguishes high and low orbits, and respects disabled instruments and targets", () => {
    const low = createRun(modern()),
      high = createRun(modern({ orbitId: "high-polar" }));
    const a = observeOrbit(low),
      b = observeOrbit(high);
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(a.length);
    low.operations.target = "equator";
    expect(observeOrbit(low)).toEqual([]);
    low.operations.target = "pole";
    low.operations.disabledInstrumentIds = low.build.moduleIds;
    expect(observeOrbit(low)).toEqual([]);
  });
  it("connects actual mission commands, memory and coverage to the final result", () => {
    const run = fly(modern());
    expect(run.result?.success).toBe(true);
    expect(run.observedCellIds.length).toBeGreaterThan(0);
    expect(run.generatedGbit).toBeCloseTo(
      run.transmittedGbit + run.storedGbit + run.lostGbit,
      8,
    );
    expect(run.chargeWh).toBeGreaterThanOrEqual(0);
    expect(run.fuelKg).toBeGreaterThanOrEqual(0);
  });
  it("makes new-model outcomes independent of seed", () => {
    for (const choice of ["safe", "continue"] as const) {
      const a = fly(modern(), 1, choice),
        b = fly(modern(), 999, choice);
      expect(a.result).toEqual(b.result);
      expect(a.chargeWh).toBe(b.chargeWh);
      expect(a.observedCellIds).toEqual(b.observedCellIds);
    }
  });
});

describe("engineering consequences and portable reports", () => {
  it("shows a power-loss incident when even the reduced eclipse load exhausts energy", () => {
    let run = transition(createRun(modern()), { type: "Validate" });
    run = transition(run, { type: "Launch", seed: 42 });
    for (let i = 0; i < 15 && run.crisis !== "eclipse"; i++) {
      run = transition(
        run,
        run.crisis
          ? { type: "ChooseDecision", choice: "safe" }
          : { type: "Advance" },
      );
    }
    expect(run.crisis).toBe("eclipse");
    run.chargeWh = 1;
    run = transition(run, { type: "ChooseDecision", choice: "safe" });
    expect(run.phase).toBe("incident");
    expect(run.incident?.kind).toBe("power");
    expect(run.incident?.causes[0].actual).toBe("1.0 Wh");
    expect(run.chargeWh).toBe(0);
    expect(transition(run, { type: "Advance" }).result?.success).toBe(false);
  });
  it("stores distinct designs without duplicating replays and rejects corrupt history", () => {
    localStorage.removeItem("orbital-mission-lab-attempts-v1");
    const a = fly(modern()),
      b = fly(modern({ orbitId: "high-polar" }));
    rememberAttempt(a);
    rememberAttempt(a);
    rememberAttempt(b);
    expect(readAttempts()).toHaveLength(2);
    expect(readAttempts()[0].build.orbitId).toBe("high-polar");
    localStorage.setItem("orbital-mission-lab-attempts-v1", '{"invalid":true}');
    expect(readAttempts()).toEqual([]);
  });
  it("exports inputs, physical units, source identity, limitations and escaped logs", () => {
    const run = fly(modern());
    run.logs[0].message.en = '<script>alert("test")</script>';
    const html = missionReport(run);
    expect(html).toContain("WAC_POLE_ILL_TWI_SOUTH_100M");
    expect(html).toContain("Available / required delta-v (m/s)");
    expect(html).toContain("not detection");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
