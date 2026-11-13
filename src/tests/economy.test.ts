import { beforeEach, describe, expect, it } from "vitest";
import { catalog, goldenBuild } from "../data/missionConfig";
import { calculate, isReady, replaceModule } from "../engine/calculations";
import { cash, fingerprint, spending } from "../engine/economy";
import { createRun, transition } from "../engine/simulation";
import { parseSave } from "../store/schema";
import { defaultSettings, useMissionStore } from "../store/useMissionStore";
import { sampleMission } from "../features/playback/missionPlayback";
import type { MissionRun } from "../types";

const state = () => useMissionStore.getState();
function assemble() {
  for (const id of goldenBuild.moduleIds) {
    state().buy(id);
    state().edit(replaceModule(state().build, id));
  }
  state().fuel(120);
  state().reserveLauncher("medium");
}
beforeEach(() => state().reset());
describe("independent procurement", () => {
  it("preserves an over-budget legacy draft while allowing only recovery transactions", () => {
    const build = {
      ...goldenBuild,
      launcherId: "heavy",
      moduleIds: [...goldenBuild.moduleIds, "radar"],
    };
    state().importSave(
      JSON.stringify({
        schemaVersion: 1,
        build,
        settings: defaultSettings,
        seed: 42,
        commands: [],
      }),
    );
    expect(cash(state().economy)).toBeLessThan(0);
    expect(state().build.moduleIds).toContain("radar");
    state().buy("magnetometer");
    expect(state().economy.ownedIds).not.toContain("magnetometer");
    const save = state().exportSave();
    state().reset();
    state().importSave(save);
    state().edit(replaceModule(state().build, "radar"));
    state().sell("radar");
    expect(cash(state().economy)).toBeGreaterThan(0);
    expect(state().economy.ownedIds).not.toContain("radar");
  });
  it("starts with exactly 110 M$, no hardware, fuel or launch reservation", () => {
    expect(state().build.moduleIds).toEqual([]);
    expect(cash(state().economy)).toBe(110);
    expect(state().build.launcherId).toBe("none");
    expect(state().build.propellantKg).toBe(0);
    state().command({ type: "Validate" });
    state().command({ type: "Launch", seed: 42 });
    expect(state().run.phase).toBe("draft");
    expect(calculate(state().build).costMUsd).toBe(0);
  });
  it("cannot install unpaid hardware or give itself fuel, test credit or a launcher", () => {
    state().edit(goldenBuild);
    expect(state().build.moduleIds).toEqual([]);
    state().edit({ ...state().build, testingBudgetMUsd: 5 });
    expect(state().build.testingBudgetMUsd).toBe(0);
    state().edit({ ...state().build, propellantKg: 100 });
    expect(state().build.propellantKg).toBe(0);
    state().edit({ ...state().build, launcherId: "heavy" });
    expect(state().build.launcherId).toBe("none");
  });
  it("purchases into inventory once; replacement keeps the old part, uninstall does not refund", () => {
    state().buy("bus-lite");
    state().buy("bus-lite");
    expect(cash(state().economy)).toBe(103);
    expect(state().build.moduleIds).toEqual([]);
    state().edit(replaceModule(state().build, "bus-lite"));
    state().buy("bus-standard");
    state().edit(replaceModule(state().build, "bus-standard"));
    expect(state().economy.ownedIds).toEqual(["bus-lite", "bus-standard"]);
    expect(state().build.moduleIds).toEqual(["bus-standard"]);
    expect(calculate(state().build).costMUsd).toBe(18);
    state().sell("bus-standard");
    expect(state().economy.ownedIds).toContain("bus-standard");
    state().edit(replaceModule(state().build, "bus-standard"));
    expect(cash(state().economy)).toBe(92);
    state().sell("bus-standard");
    expect(cash(state().economy)).toBe(103);
    state().undo();
    expect(state().build.moduleIds).toEqual([]);
  });
  it("rejects overspending atomically for components, fuel and launcher exchange", () => {
    for (const c of catalog) state().buy(c.id);
    const before = state().exportSave();
    state().fuel(300);
    state().reserveLauncher("heavy");
    expect(state().exportSave()).toBe(before);
    expect(cash(state().economy)).toBeGreaterThanOrEqual(0);
  });
  it("refunds only the actual fuel and reservation and never creates money", () => {
    state().fuel(120);
    state().reserveLauncher("medium");
    expect(cash(state().economy)).toBeCloseTo(84.56);
    state().reserveLauncher("heavy");
    expect(cash(state().economy)).toBeCloseTo(66.56);
    state().reserveLauncher(null);
    state().reserveLauncher(null);
    state().fuel(0);
    state().fuel(-10);
    expect(cash(state().economy)).toBe(110);
  });
  it("charges tests once per configuration, retains sunk cost and invalidates credit", () => {
    assemble();
    state().test("power");
    const spent = spending(state().economy);
    state().test("power");
    expect(spending(state().economy)).toBe(spent);
    expect(state().build.testingBudgetMUsd).toBe(1.5);
    state().edit(replaceModule(state().build, "camera"));
    expect(state().build.testingBudgetMUsd).toBe(0);
    expect(spending(state().economy)).toBe(spent);
    expect(calculate(state().build).costMUsd).toBeCloseTo(spent);
    state().undo();
    expect(state().build.testingBudgetMUsd).toBe(1.5);
    expect(state().economy.tests[0].fingerprint).toBe(
      fingerprint(state().build),
    );
  });
  it("failed tests consume money without increasing reliability credit", () => {
    state().buy("bus-lite");
    state().edit(replaceModule(state().build, "bus-lite"));
    state().test("power");
    expect(state().economy.tests[0].passed).toBe(false);
    expect(state().build.testingBudgetMUsd).toBe(0);
    expect(spending(state().economy)).toBe(8.5);
  });
  it("can qualify and launch a self-purchased design and locks all procurement in flight", () => {
    assemble();
    for (const kind of [
      "power",
      "thermal",
      "communications",
      "vibration",
    ] as const)
      state().test(kind);
    expect(isReady(calculate(state().build))).toBe(true);
    expect(state().build.testingBudgetMUsd).toBe(5);
    expect(calculate(state().build).costMUsd).toBeCloseTo(87.44);
    state().command({ type: "Validate" });
    state().command({ type: "Launch", seed: 42 });
    const save = state().exportSave();
    state().buy("radar");
    state().sell("camera");
    state().fuel(0);
    state().reserveLauncher(null);
    state().test("power");
    state().undo();
    expect(state().exportSave()).toBe(save);
  });
  it("round-trips inventory, qualification archive and actual cost; rejects inconsistent imports", () => {
    assemble();
    state().test("power");
    state().fuel(121);
    state().buy("magnetometer");
    const save = state().exportSave();
    state().reset();
    state().importSave(save);
    expect(state().exportSave()).toBe(save);
    const bad = JSON.parse(save);
    bad.economy.ownedIds = [];
    expect(() => parseSave(JSON.stringify(bad))).toThrow();
    expect(state().exportSave()).toBe(save);
  });
});

function scienceRun(): MissionRun {
  let run = transition(
    transition(createRun(goldenBuild), { type: "Validate" }),
    { type: "Launch", seed: 42 },
  );
  run = transition(run, { type: "Advance" });
  run = transition(run, { type: "ChooseDecision", choice: "safe" });
  run = transition(run, { type: "Advance" });
  return transition(run, { type: "Advance" });
}
describe("student flight commands", () => {
  it("instrument shutdown eliminates collection, conserves energy and removes visual scanning", () => {
    const before = scienceRun();
    const off = transition(before, {
      type: "SetOperations",
      operations: {
        ...before.operations,
        disabledInstrumentIds: ["camera", "spectrometer"],
      },
    });
    const onResult = transition(before, { type: "Advance" }),
      offResult = transition(off, { type: "Advance" });
    expect(offResult.generatedGbit).toBe(0);
    expect(offResult.storedScience).toBe(0);
    expect(offResult.chargeWh).toBeGreaterThan(onResult.chargeWh);
    expect(sampleMission(off, 0.5).scan).toBe(false);
    expect(sampleMission(before, 0.5).scan).toBe(true);
  });
  it("target choice changes science, and a stowed antenna cannot deliver data", () => {
    const initial = scienceRun();
    const equator = transition(initial, {
      type: "SetOperations",
      operations: { ...initial.operations, target: "equator" },
    });
    expect(transition(equator, { type: "Advance" }).storedScience).toBeCloseTo(
      transition(initial, { type: "Advance" }).storedScience * 0.65,
    );
    let run = scienceRun();
    for (let i = 0; i < 8 && run.phase !== "downlink"; i++)
      run = transition(
        run,
        run.crisis
          ? { type: "ChooseDecision", choice: "safe" }
          : { type: "Advance" },
      );
    const stowed = transition(run, {
      type: "SetOperations",
      operations: { ...run.operations, antenna: "stowed" },
    });
    expect(transition(stowed, { type: "Advance" }).deliveredScience).toBe(0);
    expect(sampleMission(stowed, 0.8).link).toBe(false);
    const limited = transition(run, {
      type: "SetOperations",
      operations: { ...run.operations, downlinkFraction: 0.25 },
    });
    expect(
      transition(limited, { type: "Advance" }).deliveredScience,
    ).toBeLessThan(transition(run, { type: "Advance" }).deliveredScience);
  });
  it("replays operations exactly even when commands are prepared during pause", () => {
    assemble();
    state().command({ type: "Validate" });
    state().command({ type: "Launch", seed: 42 });
    state().command({ type: "Pause" });
    state().command({
      type: "SetOperations",
      operations: {
        ...state().run.operations,
        target: "equator",
        disabledInstrumentIds: ["camera"],
        antenna: "stowed",
        downlinkFraction: 0.5,
      },
    });
    const run = state().run;
    const save = state().exportSave();
    state().reset();
    state().importSave(save);
    expect(state().run).toEqual(run);
  });
});
