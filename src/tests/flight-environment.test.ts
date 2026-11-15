import { describe, expect, it } from "vitest";
import { goldenBuild, resolveOrbit } from "../data/missionConfig";
import { createRun, transition } from "../engine/simulation";
import {
  flightModelDays,
  flightSunDirection,
} from "../features/playback/flightEnvironment";
describe("shared flight environment", () => {
  const build = {
    ...goldenBuild,
    modelVersion: 2 as const,
    advancedFlight: true as const,
  };
  it("keeps environment time continuous through launch and cruise boundaries", () => {
    const run = transition(transition(createRun(build), { type: "Validate" }), {
      type: "Launch",
      seed: 42,
    });
    const next = transition(run, { type: "Advance" });
    expect(flightModelDays(run, 1)).toBeCloseTo(flightModelDays(next, 0), 10);
    const cruising = transition(next, {
        type: "ChooseDecision",
        choice: "safe",
      }),
      arrival = transition(cruising, { type: "Advance" });
    expect(flightModelDays(cruising, 1)).toBeCloseTo(
      flightModelDays(arrival, 0),
      10,
    );
    expect(
      flightModelDays(cruising, 0.5) - flightModelDays(cruising, 0),
    ).toBeCloseTo(1.5);
  });
  it("uses the selected orbit's model period and stops at a decision", () => {
    const run = createRun(build);
    run.phase = "scienceOperations";
    run.elapsedHours = 80;
    const orbit = resolveOrbit(run.build);
    expect(flightModelDays(run, 1) - flightModelDays(run, 0)).toBeCloseTo(
      (orbit.sunHours + orbit.shadowHours) / 24,
      10,
    );
    run.crisis = "eclipse";
    expect(flightModelDays(run, 1)).toBe(flightModelDays(run, 0));
  });
  it("aligns the visible Sun with the beta/inclination shadow scenario", () => {
    for (const betaDeg of [-90, -30, 0, 60, 90]) {
      const run = createRun({
          ...build,
          customOrbit: {
            periapsisKm: 100,
            apoapsisKm: 300,
            inclinationDeg: 45,
            betaDeg,
          },
        }),
        d = flightSunDirection(run);
      expect(Math.hypot(...d)).toBeCloseTo(1, 10);
      expect(d[0]).toBeCloseTo(Math.cos((betaDeg * Math.PI) / 180), 10);
      expect(
        d[1] * Math.sin(Math.PI / 4) + d[2] * Math.cos(Math.PI / 4),
      ).toBeCloseTo(0, 10);
    }
  });
});
