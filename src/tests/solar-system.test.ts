import { describe, expect, it } from "vitest";
import {
  solarBodies,
  solarBody,
  solarDisplayDistance,
  solarPosition,
} from "../data/solarSystem";
describe("educational solar overview", () => {
  it("contains eight planets, the Sun and the Moon with documented units", () => {
    expect(solarBodies.filter((b) => b.kind === "planet")).toHaveLength(8);
    expect(solarBody("sun").kind).toBe("star");
    expect(solarBody("moon").kind).toBe("moon");
    for (const body of solarBodies) {
      expect(body.radiusKm).toBeGreaterThan(0);
      expect(body.source).toMatch(
        /^https:\/\/(ssd.jpl.nasa.gov|science.nasa.gov)\//,
      );
    }
  });
  it("closes each fixed-element orbit after its own period", () => {
    for (const body of solarBodies.filter((b) => b.kind === "planet")) {
      const a = solarPosition(body, 0, false),
        b = solarPosition(body, body.periodYears! * 365.25, false);
      expect(Math.hypot(...a.map((v, i) => v - b[i]))).toBeLessThan(1e-10);
    }
  });
  it("keeps the Sun at the focus and radial distance between perihelion and aphelion", () => {
    expect(solarPosition(solarBody("sun"), 500)).toEqual([0, 0, 0]);
    for (const body of solarBodies.filter((b) => b.elements)) {
      const [a, e] = body.elements!;
      for (let i = 0; i < 40; i++) {
        const time = (i / 40) * body.periodYears! * 365.25,
          physical = solarPosition(body, time, false),
          r = Math.hypot(...physical),
          display = solarPosition(body, time);
        expect(r).toBeGreaterThanOrEqual(a * (1 - e) - 1e-10);
        expect(r).toBeLessThanOrEqual(a * (1 + e) + 1e-10);
        expect(Math.hypot(...display)).toBeCloseTo(solarDisplayDistance(r), 10);
        physical.forEach((value, j) =>
          expect(display[j] / Math.hypot(...display)).toBeCloseTo(
            value / r,
            10,
          ),
        );
      }
    }
  });
  it("keeps the illustrative Moon attached to Earth while Earth moves", () => {
    for (const days of [0, 10, 1000]) {
      const earth = solarPosition(solarBody("earth"), days),
        moon = solarPosition(solarBody("moon"), days),
        distance = Math.hypot(...moon.map((v, i) => v - earth[i]));
      expect(distance).toBeGreaterThanOrEqual(1.05 - 1e-10);
      expect(distance).toBeLessThan(1.06);
    }
  });
});
