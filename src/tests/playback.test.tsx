import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { goldenBuild } from "../data/missionConfig";
import { createRun, transition } from "../engine/simulation";
import {
  displayTelemetry,
  flightVisuals,
  launchPosition,
  orbitPosition,
  sampleMission,
  stageDuration,
  transferPosition,
} from "../features/playback/missionPlayback";
import { useMissionPlayback } from "../features/playback/useMissionPlayback";
import { useMissionStore } from "../store/useMissionStore";
import type { MissionRun } from "../types";
import { loadLegacyFixture } from "./fixtures";

function launched() {
  return transition(transition(createRun(goldenBuild), { type: "Validate" }), {
    type: "Launch",
    seed: 42,
  });
}
function science(): MissionRun {
  let run = transition(launched(), { type: "Advance" });
  run = transition(run, { type: "ChooseDecision", choice: "safe" });
  run = transition(run, { type: "Advance" });
  return transition(run, { type: "Advance" });
}
describe("mission visual model", () => {
  it("shows the selected high orbit radius and the distinct elliptical profile", () => {
    const run = science();
    const high = { ...run, build: { ...run.build, orbitId: "high-polar" } };
    const elliptical = {
      ...run,
      build: { ...run.build, orbitId: "elliptical" },
    };
    expect(orbitPosition(high, 0)[0] - 12).toBeGreaterThan(
      orbitPosition(run, 0)[0] - 12,
    );
    expect(orbitPosition(elliptical, 0)[0] - 12).toBeGreaterThan(
      Math.hypot(
        orbitPosition(elliptical, 0.25)[1] - 1,
        orbitPosition(elliptical, 0.25)[2],
      ),
    );
  });
  it("shows solar recharge before the eclipse discharge within each science orbit", () => {
    const run = transition(science(), { type: "Advance" });
    expect(displayTelemetry(run, 0.4).chargeWh).toBeGreaterThan(run.chargeWh);
    expect(displayTelemetry(run, 1).chargeWh).toBeCloseTo(
      transition(run, { type: "Advance" }).chargeWh,
    );
  });
  it("shows meaningful ascent, separation, and a continuous transfer departure", () => {
    expect(launchPosition(1)[1] - launchPosition(0)[1]).toBeGreaterThan(2);
    expect(sampleMission(launched(), 0.9).action.en).toContain("separation");
    expect(
      Math.abs(launchPosition(1)[1] - transferPosition(launched(), 0)[1]),
    ).toBeLessThan(0.05);
  });
  it("moves toward the Moon along a finite path", () => {
    const run = { ...launched(), phase: "cruise" as const };
    const distance = (p: number) =>
      Math.hypot(
        ...transferPosition(run, p).map((n, i) => n - flightVisuals.moon[i]),
      );
    expect(distance(0.9)).toBeLessThan(distance(0));
    for (const p of [0, 0.1, 0.8, 1])
      expect(sampleMission(run, p).direction.some((n) => Math.abs(n) > 0)).toBe(
        true,
      );
  });
  it("makes complete, continuous science orbits and starts actual scanning", () => {
    const run = science();
    expect(sampleMission(run, 0.2).scan).toBe(true);
    expect(orbitPosition(run, 0)[0]).toBeCloseTo(orbitPosition(run, 1)[0]);
    expect(orbitPosition(run, 0.25)[1]).not.toBeCloseTo(
      orbitPosition(run, 0)[1],
    );
    expect(sampleMission(run, 1).position[0]).toBeCloseTo(
      sampleMission({ ...run, orbit: 1 }, 0).position[0],
    );
  });
  it("reflects installed and disabled radar and stops scanning for crises", () => {
    const run = science();
    const radar = {
      ...run,
      build: { ...run.build, moduleIds: [...run.build.moduleIds, "radar"] },
    };
    expect(sampleMission(radar, 0.5).radar).toBe(true);
    expect(sampleMission({ ...radar, radarDisabled: true }, 0.5).radar).toBe(
      false,
    );
    expect(sampleMission({ ...radar, crisis: "eclipse" }, 0.5).scan).toBe(
      false,
    );
  });
  it("interpolates actual engineering outcomes without mutating the run", () => {
    const run = science();
    const original = structuredClone(run);
    const next = transition(run, { type: "Advance" });
    expect(displayTelemetry(run, 0).storedGbit).toBe(run.storedGbit);
    expect(displayTelemetry(run, 0.5).storedGbit).toBeGreaterThan(
      run.storedGbit,
    );
    expect(displayTelemetry(run, 1).storedGbit).toBe(next.storedGbit);
    expect(run).toEqual(original);
    expect(displayTelemetry({ ...run, paused: true }, 0.5).storedGbit).toBe(
      displayTelemetry(run, 0.5).storedGbit,
    );
  });
  it("acquires Earth contact before showing transmission and reaches the exact delivered science", () => {
    let run = science();
    for (let i = 0; i < 8 && run.phase !== "downlink"; i++)
      run = transition(
        run,
        run.crisis
          ? { type: "ChooseDecision", choice: "safe" }
          : { type: "Advance" },
      );
    expect(run.phase).toBe("downlink");
    expect(sampleMission(run, 0.1).link).toBe(false);
    expect(sampleMission(run, 0.8).link).toBe(true);
    expect(displayTelemetry(run, 0.1).transmittedGbit).toBe(
      run.transmittedGbit,
    );
    expect(displayTelemetry(run, 1).deliveredScience).toBe(
      transition(run, { type: "Advance" }).deliveredScience,
    );
    expect(stageDuration(run)).toBeGreaterThan(0);
  });
});
describe("live playback commands", () => {
  let requests: Map<number, FrameRequestCallback>;
  let nextId = 0;
  let now = 0;
  beforeEach(() => {
    useMissionStore.getState().reset();
    loadLegacyFixture();
    const store = useMissionStore.getState();
    store.navigate("control");
    store.configure({ playback: "live", playbackSpeed: 8 });
    store.command({ type: "Validate" });
    store.command({ type: "Launch", seed: 42 });
    requests = new Map();
    nextId = 0;
    now = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      requests.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => requests.delete(id));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });
  function frames(count: number) {
    for (let i = 0; i < count; i++)
      act(() => {
        now += 100;
        const callbacks = [...requests.values()];
        requests.clear();
        callbacks.forEach((callback) => callback(now));
      });
  }
  it("finishes an incident recording automatically and only then creates the result", () => {
    const s = useMissionStore.getState();
    s.restart();
    s.reserveLauncher("light");
    s.command({ type: "Validate" });
    s.command({ type: "Launch", seed: 42 });
    s.command({ type: "Advance" });
    s.navigate("control");
    expect(useMissionStore.getState().run.phase).toBe("incident");
    expect(useMissionStore.getState().run.result).toBeUndefined();
    renderHook(() =>
      useMissionPlayback(
        useMissionStore((state) => state.run),
        true,
      ),
    );
    frames(12);
    expect(useMissionStore.getState().run.phase).toBe("failed");
    expect(useMissionStore.getState().run.result?.success).toBe(false);
  });
  it("advances once per stage and waits for crisis decisions", () => {
    renderHook(() =>
      useMissionPlayback(
        useMissionStore((s) => s.run),
        true,
      ),
    );
    frames(25);
    expect(useMissionStore.getState().run.phase).toBe("cruise");
    expect(useMissionStore.getState().run.crisis).toBe("flare");
    const length = useMissionStore.getState().commands.length;
    frames(80);
    expect(useMissionStore.getState().commands.length).toBe(length);
    act(() =>
      useMissionStore
        .getState()
        .command({ type: "ChooseDecision", choice: "safe" }),
    );
    frames(17);
    expect(useMissionStore.getState().run.phase).toBe("orbitInsertion");
  });
  it("freezes both visual time and commands during pause and resumes from the same point", () => {
    const { result } = renderHook(() =>
      useMissionPlayback(
        useMissionStore((s) => s.run),
        true,
      ),
    );
    frames(6);
    act(() => useMissionStore.getState().command({ type: "Pause" }));
    const seconds = result.current.clock.current.seconds;
    frames(100);
    expect(result.current.clock.current.seconds).toBe(seconds);
    expect(useMissionStore.getState().run.phase).toBe("launched");
    act(() => useMissionStore.getState().command({ type: "Resume" }));
    frames(5);
    expect(result.current.clock.current.seconds).toBeGreaterThan(seconds);
  });
  it("does not progress before the scene is ready or in a hidden tab", () => {
    const { rerender } = renderHook(
      ({ ready }) =>
        useMissionPlayback(
          useMissionStore((s) => s.run),
          ready,
        ),
      { initialProps: { ready: false } },
    );
    frames(100);
    expect(useMissionStore.getState().run.phase).toBe("launched");
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    rerender({ ready: true });
    frames(100);
    expect(useMissionStore.getState().run.phase).toBe("launched");
  });
  it("preserves manual mode even after the visual animation finishes", () => {
    useMissionStore.getState().configure({ playback: "step" });
    renderHook(() =>
      useMissionPlayback(
        useMissionStore((s) => s.run),
        true,
      ),
    );
    frames(100);
    expect(useMissionStore.getState().run.phase).toBe("launched");
  });
});
