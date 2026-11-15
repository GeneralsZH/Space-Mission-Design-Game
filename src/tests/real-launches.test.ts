import { describe, expect, it } from "vitest";
import {
  realVehicles,
  launchSites,
  launchSiteFor,
  siteRotationSpeed,
} from "../data/realLaunches";
import { goldenBuild } from "../data/missionConfig";
import { createRun, transition } from "../engine/simulation";
import { calculate } from "../engine/calculations";
import { emptyEconomy, syncBuild, fingerprint } from "../engine/economy";
import { buildSchema } from "../store/schema";
import {
  launchFrame,
  realLaunchPosition,
  siteNormal,
  orientFromUp,
  launchEarth,
} from "../features/playback/launchGeometry";
import {
  sampleMission,
  transferPosition,
} from "../features/playback/missionPlayback";
import { useMissionStore, defaultSettings } from "../store/useMissionStore";
const realBuild = (id = "falcon9", site = "ksc-39a") => ({
  ...goldenBuild,
  modelVersion: 2 as const,
  advancedFlight: true as const,
  launcherId: id,
  launchSiteId: site,
});
describe("real launch vehicles and geographic pads", () => {
  it("validates vehicle/pad compatibility and keeps archived build schemas", () => {
    expect(buildSchema.safeParse(goldenBuild).success).toBe(true);
    expect(buildSchema.safeParse(realBuild()).success).toBe(true);
    expect(buildSchema.safeParse(realBuild("falcon9", "")).success).toBe(false);
    expect(
      buildSchema.safeParse(realBuild("falcon9", "baikonur-31")).success,
    ).toBe(false);
    expect(
      buildSchema.safeParse({ ...goldenBuild, launchSiteId: "ksc-39a" })
        .success,
    ).toBe(false);
    for (const v of realVehicles)
      for (const id of v.sites)
        expect(launchSites.some((s) => s.id === id)).toBe(true);
  });
  it("selects a compatible default when the purchased vehicle changes", () => {
    const old = realBuild("soyuz2", "vostochny-1s"),
      economy = {
        ...emptyEconomy(),
        ownedIds: [...goldenBuild.moduleIds],
        fuelKg: 120,
        launcherId: "falcon9",
      };
    const synced = syncBuild(old, economy);
    expect(synced.launchSiteId).toBe("ksc-39a");
    expect(
      syncBuild(synced, { ...economy, launcherId: "medium" }).launchSiteId,
    ).toBeUndefined();
    expect(fingerprint(realBuild("falcon9", "cape-40"))).not.toBe(
      fingerprint(realBuild()),
    );
  });
  it("uses geographic unit normals and puts the pad ground on the spherical Earth", () => {
    expect(siteNormal(0, 0, 0)).toEqual([1, 0, -0]);
    for (const v of realVehicles)
      for (const id of v.sites) {
        const build = realBuild(v.id, id),
          frame = launchFrame(build, 0.4)!;
        expect(Math.hypot(...frame.normal)).toBeCloseTo(1, 12);
        orientFromUp([0, 1, 0], frame.normal).forEach((n, i) =>
          expect(n).toBeCloseTo(frame.normal[i], 10),
        );
        const ground = frame.anchor.map(
          (n, i) =>
            n - launchEarth.center[i] - frame.normal[i] * launchEarth.padOffset,
        );
        expect(Math.hypot(...ground)).toBeCloseTo(launchEarth.radius, 10);
        const start = realLaunchPosition(build, 0)!,
          end = realLaunchPosition(build, 1)!;
        expect(
          Math.hypot(...end.map((n, i) => n - launchEarth.center[i])),
        ).toBeGreaterThan(
          Math.hypot(...start.map((n, i) => n - launchEarth.center[i])),
        );
      }
  });
  it("connects the chosen site's ascent endpoint to transfer without a teleport", () => {
    for (const v of realVehicles)
      for (const site of v.sites) {
        const run = createRun(realBuild(v.id, site));
        run.phase = "launched";
        const ascent = sampleMission(run, 1),
          transfer = transferPosition(run, 0);
        expect(
          Math.hypot(...ascent.position.map((n, i) => n - transfer[i])),
        ).toBeLessThan(1e-10);
        expect(Math.hypot(...ascent.direction)).toBeCloseTo(1, 10);
      }
  });
  it("round-trips a selected vehicle and site through real purchase state and replay", () => {
    const store = useMissionStore.getState();
    store.importSave(
      JSON.stringify({
        schemaVersion: 1,
        build: realBuild("soyuz2", "vostochny-1s"),
        settings: defaultSettings,
        seed: 42,
        commands: [],
      }),
    );
    const saved = store.exportSave();
    store.importSave(saved);
    expect(store.exportSave()).toBe(saved);
    expect(useMissionStore.getState().build.launchSiteId).toBe("vostochny-1s");
    expect(launchSiteFor(useMissionStore.getState().run.build)!.id).toBe(
      "vostochny-1s",
    );
  });
  it("preserves mission economics and completes a real-vehicle educational flight", () => {
    const build = realBuild("soyuz2", "baikonur-31");
    expect(calculate(build).costMUsd).toBeLessThanOrEqual(110);
    let run = transition(transition(createRun(build), { type: "Validate" }), {
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
    expect(run.result?.success).toBe(true);
    expect(run.build.launchSiteId).toBe("baikonur-31");
    expect(siteRotationSpeed(5.26)).toBeGreaterThan(siteRotationSpeed(51.88));
  });
});
