import type { Text } from "../../types";
export type AscentVector = [number, number, number];
// Geometric illustration in km. These are not launch-provider performance data.
export const ascentScale = {
  earthRadiusKm: 6371,
  modelKm: 0.01,
  anchorKm: 0.042,
  rootKm: 0.0375,
  releaseKm: 0.048,
  duration: 60,
};
const knots = [
  [0, 0, 0],
  [0.08, 0, 0],
  [0.12, 0.04, 0],
  [0.2, 2, 0.1],
  [0.28, 18, 5],
  [0.42, 80, 70],
  [0.58, 160, 450],
  [0.66, 200, 1000],
  [0.76, 200, 1600],
  [0.86, 250, 2200],
  [0.94, 400, 2600],
  [1, 500, 2900],
];
const clamp = (p: number) => Math.max(0, Math.min(1, p));
export const smoothRange = (a: number, b: number, p: number) => {
  const t = clamp((p - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Illustrative guidance-loss drift in local km; shared by both scene scales. */
export const ascentDrift = (progress: number): AscentVector => {
  const p = clamp(progress);
  return [0.18 * p * p, 0.06 * p, 0.12 * p];
};
// Monotone Hermite interpolation: no altitude overshoot, continuous velocity.
function sample(p: number, column: number) {
  const d = knots
    .slice(1)
    .map((k, i) => (k[column] - knots[i][column]) / (k[0] - knots[i][0]));
  const slope = knots.map((_, i) => {
    if (i === 0) return d[0];
    if (i === knots.length - 1) return d[i - 1];
    if (d[i - 1] * d[i] <= 0) return 0;
    const h0 = knots[i][0] - knots[i - 1][0],
      h1 = knots[i + 1][0] - knots[i][0];
    const w0 = 2 * h1 + h0,
      w1 = h1 + 2 * h0;
    return (w0 + w1) / (w0 / d[i - 1] + w1 / d[i]);
  });
  const i = Math.min(
    knots.length - 2,
    knots.findIndex((_, j) => j < knots.length - 1 && p <= knots[j + 1][0]),
  );
  const a = knots[Math.max(0, i)],
    b = knots[Math.max(0, i) + 1],
    h = b[0] - a[0],
    t = (p - a[0]) / h;
  const m0 = slope[Math.max(0, i)],
    m1 = slope[Math.max(0, i) + 1];
  return {
    value:
      (2 * t ** 3 - 3 * t * t + 1) * a[column] +
      (t ** 3 - 2 * t * t + t) * h * m0 +
      (-2 * t ** 3 + 3 * t * t) * b[column] +
      (t ** 3 - t * t) * h * m1,
    derivative:
      ((6 * t * t - 6 * t) * a[column] +
        (3 * t * t - 4 * t + 1) * h * m0 +
        (-6 * t * t + 6 * t) * b[column] +
        (3 * t * t - 2 * t) * h * m1) /
      h,
  };
}
export const ascentStages: { until: number; id: string; text: Text }[] = [
  {
    until: 0.08,
    id: "countdown",
    text: { ru: "Обратный отсчёт", en: "Terminal countdown" },
  },
  {
    until: 0.12,
    id: "liftoff",
    text: {
      ru: "Зажигание · освобождение стартового стола",
      en: "Ignition · clearing the tower",
    },
  },
  {
    until: 0.28,
    id: "pitch",
    text: {
      ru: "Набор высоты · начало разворота",
      en: "Climb · pitch programme",
    },
  },
  {
    until: 0.42,
    id: "ascent",
    text: {
      ru: "Разворот на орбитальную траекторию",
      en: "Turning toward the orbital horizon",
    },
  },
  {
    until: 0.49,
    id: "staging",
    text: {
      ru: "Отключение двигателя · разделение ступеней",
      en: "Main engine cutoff · stage separation",
    },
  },
  {
    until: 0.58,
    id: "fairing",
    text: {
      ru: "Верхняя ступень · сброс обтекателя",
      en: "Upper-stage flight · fairing release",
    },
  },
  {
    until: 0.66,
    id: "injection",
    text: {
      ru: "Завершение выведения на орбиту",
      en: "Completing orbital insertion",
    },
  },
  {
    until: 0.76,
    id: "parking",
    text: {
      ru: "Опорная орбита · двигатель выключен",
      en: "Parking orbit · engine off",
    },
  },
  {
    until: 0.88,
    id: "tli",
    text: {
      ru: "Повторное включение · разгон к Луне",
      en: "Upper-stage restart · trans-lunar injection",
    },
  },
  {
    until: 0.94,
    id: "deployment",
    text: { ru: "Отделение спутника", en: "Spacecraft separation" },
  },
  {
    until: 0.98,
    id: "arrays",
    text: { ru: "Раскрытие солнечных панелей", en: "Solar-array deployment" },
  },
  {
    until: 1.01,
    id: "departure",
    text: {
      ru: "Переход к обзору маршрута",
      en: "Transition to the mission overview",
    },
  },
];
export function ascentState(progress: number) {
  const p = clamp(progress),
    altitude = sample(p, 1),
    range = sample(p, 2),
    R = ascentScale.earthRadiusKm;
  const angle = range.value / R,
    pitch =
      altitude.derivative === 0 && range.derivative === 0
        ? Math.PI / 2
        : Math.atan2(
            altitude.derivative,
            (range.derivative * (R + altitude.value)) / R,
          );
  const normal: AscentVector = [Math.sin(angle), Math.cos(angle), 0];
  const tangent: AscentVector = [Math.cos(angle), -Math.sin(angle), 0];
  const direction = normal.map(
    (n, i) => n * Math.sin(pitch) + tangent[i] * Math.cos(pitch),
  ) as AscentVector;
  const base: AscentVector = [
    (R + altitude.value) * Math.sin(angle),
    (R + altitude.value) * Math.cos(angle) - R,
    0,
  ];
  const rocketPosition = base.map(
    (n, i) => n + direction[i] * ascentScale.rootKm,
  ) as AscentVector;
  const released = smoothRange(0.88, 0.94, p);
  const position = rocketPosition.map(
    (n, i) => n + direction[i] * released * ascentScale.releaseKm,
  ) as AscentVector;
  return {
    progress: p,
    altitudeKm: altitude.value,
    downrangeKm: range.value,
    pitchDeg: (pitch * 180) / Math.PI,
    normal,
    direction,
    rocketPosition,
    position,
    released,
    panels: smoothRange(0.94, 0.98, p),
    fairing: smoothRange(0.53, 0.59, p),
    staging: smoothRange(0.43, 0.47, p),
    sideRelease: smoothRange(0.32, 0.38, p),
    coreBurn: p >= 0.075 && p < 0.425,
    upperBurn: (p >= 0.465 && p < 0.66) || (p >= 0.76 && p < 0.875),
    stage: ascentStages.find((s) => p < s.until)!,
  };
}
