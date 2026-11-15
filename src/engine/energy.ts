import { calculate, selectedComponents, sum, clamp } from "./calculations";
import { elementsFor, inLunarShadow, orbitalParameters } from "./orbital";
import { physics } from "../data/missionConfig";
import type { MissionRun } from "../types";

const cache = new Map<string, ReturnType<typeof integrate>>();
function integrate(run: MissionRun) {
  const r = calculate(run.build),
    e = elementsFor(run.build),
    period = orbitalParameters(e).periodSeconds / 3600;
  const off = sum(
    selectedComponents(run.build).filter(
      (c) =>
        c.category === "instrument" &&
        (run.operations.disabledInstrumentIds.includes(c.id) ||
          (c.id === "radar" && run.radarDisabled)),
    ),
    (c) => c.powerW,
  );
  const generated = r.sunPowerW * (run.solarEfficiency ?? 1),
    steps = 512,
    dt = period / steps;
  let charge = run.chargeWh,
    min = charge,
    progress = 1,
    recharge = 0,
    shadow = 0;
  const charges = [charge];
  for (let i = 0; i < steps; i++) {
    const dark = inLunarShadow(e, (i + 0.5) / steps),
      load = dark
        ? Math.max(0, r.shadowLoadW - off * physics.shadowInstrumentDuty)
        : Math.max(0, r.peakLoadW - off);
    const net = (dark ? 0 : generated) - load,
      delta = net * dt * (net > 0 ? physics.batteryEfficiency : 1),
      before = charge;
    charge = Math.min(r.usableBatteryWh, charge + delta);
    if (delta > 0) recharge += charge - before;
    if (dark) shadow += load * dt;
    if (charge < 0 && min >= 0)
      progress = (i + Math.max(0, before) / Math.max(1e-9, -delta)) / steps;
    min = Math.min(min, charge);
    charges.push(charge);
  }
  return {
    charges,
    endCharge: min < 0 ? min : charge,
    recharge,
    shadow,
    progress: clamp(progress, 0.02, 0.98),
  };
}
export function advancedEnergy(run: MissionRun) {
  const key = JSON.stringify([
    run.build,
    run.operations.disabledInstrumentIds,
    run.radarDisabled,
    run.chargeWh,
    run.solarEfficiency ?? 1,
  ]);
  let trace = cache.get(key);
  if (!trace) {
    trace = integrate(run);
    if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(key, trace);
  }
  return trace;
}
export function chargeAt(run: MissionRun, progress: number) {
  const values = advancedEnergy(run).charges,
    index = clamp(progress) * 512,
    i = Math.min(511, Math.floor(index));
  return Math.max(0, values[i] + (values[i + 1] - values[i]) * (index - i));
}
