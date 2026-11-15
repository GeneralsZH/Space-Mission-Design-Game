import type { Build } from "../types";
import { elementsFor, keplerState, lunar, orbitalParameters } from "./orbital";
export function groundPoint(
  build: Build,
  orbit: number,
  phase: number,
  target: "pole" | "equator",
): [number, number, number] {
  const e = elementsFor(build),
    p = keplerState(e, phase),
    i = (e.inclinationDeg * Math.PI) / 180;
  let x = p.x,
    y = p.y * Math.sin(i),
    z = p.y * Math.cos(i);
  if (target === "equator") y = 0;
  const length = Math.hypot(x, y, z) || 1;
  x /= length;
  y /= length;
  z /= length;
  const rotation =
    (-2 * Math.PI * (orbit + phase) * orbitalParameters(e).periodSeconds) /
    (lunar.siderealHours * 3600);
  return [
    x * Math.cos(rotation) - z * Math.sin(rotation),
    y,
    x * Math.sin(rotation) + z * Math.cos(rotation),
  ];
}
export function footprintHalfAngle(
  build: Build,
  phase: number,
  fovDeg: number,
) {
  const r = keplerState(elementsFor(build), phase).r,
    half = (fovDeg * Math.PI) / 360;
  return (r / lunar.radiusM) * Math.sin(half) >= 1
    ? Math.acos(lunar.radiusM / r)
    : Math.asin((r / lunar.radiusM) * Math.sin(half)) - half;
}
