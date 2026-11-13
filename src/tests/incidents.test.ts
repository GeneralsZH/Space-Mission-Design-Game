import { describe, expect, it } from "vitest";
import { goldenBuild } from "../data/missionConfig";
import { createRun, transition } from "../engine/simulation";
import { canLaunch, predictIncident } from "../engine/incidents";
import { replaceModule } from "../engine/calculations";
import {
  sampleMission,
  stageDuration,
  displayTelemetry,
} from "../features/playback/missionPlayback";
import { parseSave, replay } from "../store/schema";
import { defaultSettings } from "../store/useMissionStore";
import type { Build, MissionRun } from "../types";

const launch = (b: Build) =>
  transition(transition(createRun(b), { type: "Validate" }), {
    type: "Launch",
    seed: 42,
  });
function next(run: MissionRun) {
  return transition(
    run,
    run.crisis
      ? { type: "ChooseDecision", choice: "safe" }
      : { type: "Advance" },
  );
}
function toPhase(b: Build, phase: string) {
  let run = launch(b);
  for (let i = 0; i < 20 && run.phase !== phase && !run.result; i++)
    run = next(run);
  return run;
}
describe("in-flight failures instead of preflight rejection", () => {
  it("allows a paid overloaded launcher to lift off, then terminates it before separation", () => {
    const b = { ...goldenBuild, launcherId: "light" };
    expect(canLaunch(b)).toBe(true);
    const run = launch(b);
    expect(run.phase).toBe("launched");
    expect(run.incident).toBeNull();
    expect(run.result).toBeUndefined();
    const predicted = predictIncident(run)!;
    expect(predicted.kind).toBe("explosion");
    expect(stageDuration(run)).toBeLessThan(18);
    const flight = next(run);
    expect(flight.phase).toBe("incident");
    expect(flight.result).toBeUndefined();
    expect(flight.incident?.causes[0].actual).toBe("327.0 kg");
    expect(sampleMission(run, 1).position).toEqual(
      sampleMission(flight, 0).position,
    );
    expect(next(flight).result?.success).toBe(false);
  });
  it("a modest overload causes a trajectory departure without a generic explosion", () => {
    const b = { ...goldenBuild, launcherId: "light", propellantKg: 70 };
    expect(predictIncident(launch(b))?.kind).toBe("trajectory");
  });
  it("zero fuel starts normally and misses lunar capture with a continuous departure path", () => {
    const b = { ...goldenBuild, propellantKg: 0 };
    const run = toPhase(b, "orbitInsertion");
    expect(run.phase).toBe("orbitInsertion");
    expect(run.incident).toBeNull();
    const fault = next(run);
    expect(fault.incident?.kind).toBe("trajectory");
    expect(fault.incident?.causes[0].actual).toBe("0 m/s");
    expect(sampleMission(run, 1).position).toEqual(
      sampleMission(fault, 0).position,
    );
    expect(sampleMission(fault, 1).position).not.toEqual(
      sampleMission(fault, 0).position,
    );
  });
  it("a missing engine never throws a programming error", () => {
    const b = replaceModule(goldenBuild, "engine-medium");
    const run = toPhase(b, "incident");
    expect(run.incident?.kind).toBe("trajectory");
    expect(next(run).result?.success).toBe(false);
  });
  it("power loss occurs during the first actual eclipse and preserves only partial observations", () => {
    const b = replaceModule(goldenBuild, "battery-m");
    const run = toPhase(b, "scienceOperations");
    expect(run.phase).toBe("scienceOperations");
    const fault = next(run);
    expect(fault.phase).toBe("incident");
    expect(fault.incident?.kind).toBe("power");
    expect(fault.chargeWh).toBe(0);
    expect(fault.storedScience).toBeGreaterThan(0);
    expect(fault.storedScience).toBeLessThan(50);
    expect(displayTelemetry(run, 1).chargeWh).toBeCloseTo(0);
  });
  it("solar generation failure depletes energy in cruise instead of blocking launch", () => {
    const b = replaceModule(goldenBuild, "panel-m");
    const run = toPhase(b, "cruise");
    const ready = next(run);
    expect(ready.crisis).toBeNull();
    expect(predictIncident(ready)?.kind).toBe("power");
    expect(displayTelemetry(ready, 0.8).chargeWh).toBeLessThan(ready.chargeWh);
    expect(next(ready).incident?.kind).toBe("power");
  });
  it("operating fewer instruments can prevent an otherwise impending orbital power loss", () => {
    const b = replaceModule(goldenBuild, "panel-s");
    const run = { ...toPhase(b, "scienceOperations"), chargeWh: 40 };
    expect(predictIncident(run)?.kind).toBe("power");
    const saved = transition(run, {
      type: "SetOperations",
      operations: {
        ...run.operations,
        disabledInstrumentIds: ["camera", "spectrometer"],
      },
    });
    expect(predictIncident(saved)).toBeNull();
    expect(next(saved).phase).toBe("scienceOperations");
  });
  it("missing radio fails only at contact, with an intact spacecraft", () => {
    const b = replaceModule(goldenBuild, "hga-compact");
    const run = toPhase(b, "downlink");
    const incident = next(run);
    expect(incident.incident?.kind).toBe("communications");
    expect(incident.health).toBe(100);
    expect(next(incident).result?.success).toBe(false);
  });
  it("wrong scientific payload completes flight without invented destruction", () => {
    const b = replaceModule(goldenBuild, "spectrometer");
    const run = toPhase(b, "failed");
    expect(run.phase).toBe("failed");
    expect(run.incident).toBeNull();
    expect(run.health).toBe(100);
    expect(run.result?.success).toBe(false);
  });
  it("replays the exact incident and respects pause before releasing its analysis", () => {
    const b = { ...goldenBuild, launcherId: "light" };
    const commands = [
      { type: "Validate" },
      { type: "Launch", seed: 42 },
      { type: "Advance" },
      { type: "Pause" },
    ] as const;
    const parsed = parseSave(
      JSON.stringify({
        schemaVersion: 1,
        build: b,
        settings: defaultSettings,
        seed: 42,
        commands,
      }),
    );
    const run = replay(parsed.build, 42, parsed.commands);
    expect(run.incident?.kind).toBe("explosion");
    expect(run.result).toBeUndefined();
    expect(next(run)).toBe(run);
    const resumed = transition(run, { type: "Resume" });
    expect(next(resumed).result?.success).toBe(false);
  });
});
