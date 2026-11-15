import { describe, expect, it } from "vitest";
import {
  ascentScale,
  ascentState,
  ascentDrift,
} from "../features/playback/ascentProfile";
import {
  launchBasis,
  launchEarth,
  localToMission,
} from "../features/playback/launchGeometry";
import { goldenBuild } from "../data/missionConfig";
import { realVehicles } from "../data/realLaunches";
import { createRun, transition } from "../engine/simulation";
import {
  transferPosition,
  sampleMission,
} from "../features/playback/missionPlayback";
describe("surface launch geometry and flight sequence", () => {
  it("keeps a real-launch guidance-loss incident in the same km frame as the close camera", () => {
    let run = createRun({
      ...goldenBuild,
      modelVersion: 2,
      advancedFlight: true,
      launcherId: "soyuz2",
      launchSiteId: "baikonur-31",
      propellantKg: 300,
    });
    run.phase = "launched";
    run = transition(run, { type: "Advance" });
    expect(run.incident?.kind).toBe("trajectory");
    const t = 0.6,
      p = run.incident!.triggerProgress,
      local = ascentState(p).position,
      drift = ascentDrift(t);
    expect(sampleMission(run, t).position).toEqual(
      localToMission(
        run.build,
        local.map((n, i) => n + drift[i]) as [number, number, number],
        p,
      ),
    );
  });
  it("uses one physical scale for the real vehicle and Earth", () => {
    expect(7 * ascentScale.modelKm * 1000).toBe(70);
    expect(70 / (ascentScale.earthRadiusKm * 1000)).toBeCloseTo(
      1.0987286e-5,
      10,
    );
    const s = ascentState(0);
    expect(s.rocketPosition[1] - 3.75 * ascentScale.modelKm).toBeCloseTo(0, 12);
  });
  it("keeps ascent above the curved surface and never reverses altitude or range", () => {
    let previous = ascentState(0);
    for (let i = 1; i <= 2000; i++) {
      const s = ascentState(i / 2000);
      expect(s.altitudeKm).toBeGreaterThanOrEqual(previous.altitudeKm - 1e-9);
      expect(s.downrangeKm).toBeGreaterThanOrEqual(previous.downrangeKm - 1e-9);
      const base = s.rocketPosition.map(
        (n, j) => n - s.direction[j] * ascentScale.rootKm,
      );
      expect(
        Math.hypot(base[0], base[1] + ascentScale.earthRadiusKm, base[2]) -
          ascentScale.earthRadiusKm,
      ).toBeCloseTo(s.altitudeKm, 8);
      expect(Math.hypot(...s.direction)).toBeCloseTo(1, 12);
      previous = s;
    }
  });
  it("turns from vertical toward the horizontal without discontinuous motion", () => {
    expect(ascentState(0.11).pitchDeg).toBeCloseTo(90, 8);
    expect(ascentState(0.4).pitchDeg).toBeLessThan(60);
    expect(ascentState(0.7).pitchDeg).toBeCloseTo(0, 8);
    for (const p of [0.12, 0.2, 0.28, 0.42, 0.58, 0.66, 0.76, 0.86, 0.94]) {
      const a = ascentState(p - 1e-7),
        b = ascentState(p + 1e-7);
      expect(
        Math.hypot(...a.rocketPosition.map((n, i) => n - b.rocketPosition[i])),
      ).toBeLessThan(0.003);
      expect(Math.abs(a.pitchDeg - b.pitchDeg)).toBeLessThan(0.01);
    }
  });
  it("separates cutoff, fairing release, coast, restart and array deployment", () => {
    expect(ascentState(0.02).coreBurn).toBe(false);
    expect(ascentState(0.2).coreBurn).toBe(true);
    expect(ascentState(0.45).coreBurn).toBe(false);
    expect(ascentState(0.5).upperBurn).toBe(true);
    expect(ascentState(0.7).upperBurn).toBe(false);
    expect(ascentState(0.8).upperBurn).toBe(true);
    expect(ascentState(0.9).upperBurn).toBe(false);
    expect(ascentState(0.65).fairing).toBe(1);
    expect(ascentState(0.85).released).toBe(0);
    expect(ascentState(0.93).panels).toBe(0);
    expect(ascentState(0.99).panels).toBe(1);
  });
  it("maps each real pad's local horizon into the same mission Earth", () => {
    for (const v of realVehicles)
      for (const site of v.sites) {
        const build = { ...goldenBuild, launcherId: v.id, launchSiteId: site },
          b = launchBasis(build, 0.5)!;
        expect(b.east.reduce((s, n, i) => s + n * b.up[i], 0)).toBeCloseTo(
          0,
          12,
        );
        expect(Math.hypot(...b.south)).toBeCloseTo(1, 12);
        const ground = localToMission(build, [0, 0, 0], 0.5)!;
        expect(
          Math.hypot(...ground.map((n, i) => n - launchEarth.center[i])),
        ).toBeCloseTo(launchEarth.radius, 12);
      }
  });
  it("routes every pad's lunar departure around Earth instead of through it", () => {
    for (const v of realVehicles)
      for (const site of v.sites) {
        const run = createRun({
          ...goldenBuild,
          launcherId: v.id,
          launchSiteId: site,
        });
        for (let i = 0; i <= 300; i++) {
          const point = transferPosition(run, i / 300);
          expect(
            Math.hypot(...point.map((n, j) => n - launchEarth.center[j])),
            `${site}: ${i / 300}`,
          ).toBeGreaterThan(launchEarth.radius);
        }
      }
  });
});
