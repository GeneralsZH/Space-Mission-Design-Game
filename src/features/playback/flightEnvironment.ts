import { physics, resolveOrbit, missionConfig } from "../../data/missionConfig";
import { elementsFor } from "../../engine/orbital";
import type { MissionRun } from "../../types";
import { visualStageProgress } from "./missionPlayback";

/** Scenario Sun direction, matching the advanced lunar shadow calculation. */
export function flightSunDirection(run: MissionRun): [number, number, number] {
  if (!run.build.advancedFlight) {
    const d = Math.hypot(-30, 8, 14);
    return [-30 / d, 8 / d, 14 / d];
  }
  const e = elementsFor(run.build),
    b = (e.betaDeg * Math.PI) / 180,
    i = (e.inclinationDeg * Math.PI) / 180;
  return [Math.cos(b), -Math.sin(b) * Math.cos(i), Math.sin(b) * Math.sin(i)];
}
/** Shared model time, not a second free-running planetarium clock. */
export function flightModelDays(run: MissionRun, progress: number) {
  const orbit = resolveOrbit(run.build);
  const duration =
    run.result || run.crisis
      ? 0
      : run.phase === "launched"
        ? 0.15
        : run.phase === "cruise"
          ? physics.cruiseHours
          : run.phase === "orbitInsertion"
            ? physics.insertionHours
            : run.phase === "scienceOperations" && run.orbit < 4
              ? orbit.sunHours + orbit.shadowHours
              : run.phase === "downlink"
                ? orbit.contactHours * missionConfig.orbits
                : 0;
  return (
    (run.elapsedHours + duration * visualStageProgress(run, progress)) / 24
  );
}
export const flightSystemScale = {
  sunDistance: 650,
  overviewDistance: 4000,
  far: 20000,
};
