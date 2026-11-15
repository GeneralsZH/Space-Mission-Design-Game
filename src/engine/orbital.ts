// SI constants rounded to NASA NSSDC Moon Fact Sheet values. This model is
// two-body, with a spherical Moon and a static, distant Sun; not an ephemeris.
import type { Build } from "../types";
export const lunar = {
  radiusM: 1737400,
  mu: 4.9e12,
  siderealHours: 655.72,
  arrivalVInfinityMs: 820,
} as const;
export interface Elements {
  periapsisKm: number;
  apoapsisKm: number;
  inclinationDeg: number;
  betaDeg: number;
}
export const orbitElements: Record<string, Elements> = {
  "low-polar": {
    periapsisKm: 100,
    apoapsisKm: 100,
    inclinationDeg: 90,
    betaDeg: 0,
  },
  "high-polar": {
    periapsisKm: 300,
    apoapsisKm: 300,
    inclinationDeg: 90,
    betaDeg: 55,
  },
  elliptical: {
    periapsisKm: 100,
    apoapsisKm: 1000,
    inclinationDeg: 90,
    betaDeg: 30,
  },
};
export function elementsFor(
  build: Pick<Build, "modelVersion" | "orbitId" | "customOrbit">,
): Elements {
  const elements =
    build.modelVersion === 2 && build.customOrbit
      ? build.customOrbit
      : orbitElements[build.orbitId];
  if (!elements) throw new Error("Unknown orbit");
  return elements;
}
export function inLunarShadow(e: Elements, phase: number) {
  const p = keplerState(e, phase),
    along = p.x * Math.cos((e.betaDeg * Math.PI) / 180);
  return along < 0 && p.r * p.r - along * along < lunar.radiusM ** 2;
}
export function orbitalParameters(e: Elements) {
  if (
    ![e.periapsisKm, e.apoapsisKm, e.inclinationDeg, e.betaDeg].every(
      Number.isFinite,
    ) ||
    e.periapsisKm <= 0 ||
    e.apoapsisKm < e.periapsisKm ||
    e.inclinationDeg < 0 ||
    e.inclinationDeg > 180 ||
    Math.abs(e.betaDeg) > 90
  )
    throw new Error("Invalid lunar orbital elements");
  const rp = lunar.radiusM + e.periapsisKm * 1000,
    ra = lunar.radiusM + e.apoapsisKm * 1000,
    a = (rp + ra) / 2,
    eccentricity = (ra - rp) / (ra + rp);
  const periodSeconds = 2 * Math.PI * Math.sqrt(a ** 3 / lunar.mu);
  const periapsisSpeedMs = Math.sqrt(lunar.mu * (2 / rp - 1 / a)),
    apoapsisSpeedMs = Math.sqrt(lunar.mu * (2 / ra - 1 / a));
  const captureDeltaVMs =
    Math.sqrt(lunar.arrivalVInfinityMs ** 2 + (2 * lunar.mu) / rp) -
    periapsisSpeedMs;
  return {
    rp,
    ra,
    a,
    eccentricity,
    periodSeconds,
    periapsisSpeedMs,
    apoapsisSpeedMs,
    captureDeltaVMs,
  };
}
export function keplerState(e: Elements, turns: number) {
  if (!Number.isFinite(turns)) throw new Error("Invalid orbital time");
  const o = orbitalParameters(e),
    mean = (((turns % 1) + 1) % 1) * 2 * Math.PI;
  let anomaly = mean;
  for (let i = 0; i < 12; i++)
    anomaly -=
      (anomaly - o.eccentricity * Math.sin(anomaly) - mean) /
      (1 - o.eccentricity * Math.cos(anomaly));
  const x = o.a * (Math.cos(anomaly) - o.eccentricity),
    y = o.a * Math.sqrt(1 - o.eccentricity ** 2) * Math.sin(anomaly),
    r = Math.hypot(x, y);
  return {
    x,
    y,
    r,
    altitudeKm: (r - lunar.radiusM) / 1000,
    speedMs: Math.sqrt(lunar.mu * (2 / r - 1 / o.a)),
    trueAnomaly: Math.atan2(y, x),
  };
}
export function eclipseSeconds(e: Elements) {
  const o = orbitalParameters(e),
    beta = (e.betaDeg * Math.PI) / 180;
  if (o.eccentricity < 1e-12) {
    if (Math.abs(beta) >= Math.asin(lunar.radiusM / o.a)) return 0;
    return (
      (o.periodSeconds *
        Math.acos(Math.sqrt(1 - (lunar.radiusM / o.a) ** 2) / Math.cos(beta))) /
      Math.PI
    );
  }
  // Time-weighted cylindrical-shadow integration. At 4096 samples the timing
  // discretisation is bounded by approximately two sample intervals.
  let dark = 0;
  for (let i = 0; i < 4096; i++) {
    const p = keplerState(e, (i + 0.5) / 4096),
      alongSun = p.x * Math.cos(beta);
    if (alongSun < 0 && p.r * p.r - alongSun * alongSun < lunar.radiusM ** 2)
      dark++;
  }
  return (o.periodSeconds * dark) / 4096;
}
