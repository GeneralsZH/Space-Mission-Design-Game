import type { Text } from "../types";

export interface SolarBody {
  id: string;
  name: Text;
  kind: "star" | "planet" | "moon";
  color: string;
  radiusKm: number;
  periodYears?: number;
  // Rounded, fixed J2000 elements from JPL Table 1. Earth uses EM barycentre.
  elements?: readonly [number, number, number, number, number, number];
  visualRadius: number;
  description: Text;
  source: string;
}
export const solarSources = {
  physical: "https://ssd.jpl.nasa.gov/planets/phys_par.html",
  elements: "https://ssd.jpl.nasa.gov/planets/approx_pos.html",
  sun: "https://science.nasa.gov/sun/facts/",
  moon: "https://science.nasa.gov/moon/facts/",
};
export const solarBodies: SolarBody[] = [
  {
    id: "sun",
    name: { ru: "Солнце", en: "Sun" },
    kind: "star",
    color: "#ffcd70",
    radiusKm: 700000,
    visualRadius: 1.7,
    source: solarSources.sun,
    description: {
      ru: "Наша звезда и источник света для всех планет этой системы.",
      en: "Our star, the source of light for the planets in this system.",
    },
  },
  {
    id: "mercury",
    name: { ru: "Меркурий", en: "Mercury" },
    kind: "planet",
    color: "#a89a88",
    radiusKm: 2439.4,
    periodYears: 0.2408467,
    elements: [
      0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593,
    ],
    visualRadius: 0.24,
    source: solarSources.physical,
    description: {
      ru: "Небольшой каменистый мир с поверхностью, покрытой кратерами.",
      en: "A small rocky world with a cratered surface.",
    },
  },
  {
    id: "venus",
    name: { ru: "Венера", en: "Venus" },
    kind: "planet",
    color: "#dfba79",
    radiusKm: 6051.8,
    periodYears: 0.61519726,
    elements: [
      0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718,
      76.67984255,
    ],
    visualRadius: 0.45,
    source: solarSources.physical,
    description: {
      ru: "Плотные облака скрывают поверхность этой каменистой планеты.",
      en: "Thick clouds hide this rocky planet's surface.",
    },
  },
  {
    id: "earth",
    name: { ru: "Земля", en: "Earth" },
    kind: "planet",
    color: "#5aaee9",
    radiusKm: 6371.0084,
    periodYears: 1.0000174,
    elements: [
      1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0,
    ],
    visualRadius: 0.47,
    source: solarSources.physical,
    description: {
      ru: "Наш дом. Вокруг Земли движется Луна — цель текущей миссии.",
      en: "Our home. The Moon orbits Earth and is the destination of your mission.",
    },
  },
  {
    id: "mars",
    name: { ru: "Марс", en: "Mars" },
    kind: "planet",
    color: "#cd7452",
    radiusKm: 3389.5,
    periodYears: 1.8808476,
    elements: [
      1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891,
    ],
    visualRadius: 0.32,
    source: solarSources.physical,
    description: {
      ru: "Красная каменистая планета с тонкой атмосферой.",
      en: "A red rocky planet with a thin atmosphere.",
    },
  },
  {
    id: "jupiter",
    name: { ru: "Юпитер", en: "Jupiter" },
    kind: "planet",
    color: "#d9b18b",
    radiusKm: 69911,
    periodYears: 11.862615,
    elements: [
      5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909,
    ],
    visualRadius: 1.12,
    source: solarSources.physical,
    description: {
      ru: "Газовый гигант с облачными полосами и Большим красным пятном.",
      en: "A gas giant with cloud bands and the Great Red Spot.",
    },
  },
  {
    id: "saturn",
    name: { ru: "Сатурн", en: "Saturn" },
    kind: "planet",
    color: "#e5cb96",
    radiusKm: 58232,
    periodYears: 29.447498,
    elements: [
      9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831,
      113.66242448,
    ],
    visualRadius: 0.94,
    source: solarSources.physical,
    description: {
      ru: "Газовый гигант, окружённый яркими кольцами из множества частиц.",
      en: "A gas giant surrounded by bright rings made of countless particles.",
    },
  },
  {
    id: "uranus",
    name: { ru: "Уран", en: "Uranus" },
    kind: "planet",
    color: "#8ed5db",
    radiusKm: 25362,
    periodYears: 84.016846,
    elements: [
      19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763,
      74.01692503,
    ],
    visualRadius: 0.66,
    source: solarSources.physical,
    description: {
      ru: "Бледно-голубой ледяной гигант с сильно наклонённой осью вращения.",
      en: "A pale blue ice giant with a strongly tilted rotation axis.",
    },
  },
  {
    id: "neptune",
    name: { ru: "Нептун", en: "Neptune" },
    kind: "planet",
    color: "#5a83d8",
    radiusKm: 24622,
    periodYears: 164.79132,
    elements: [
      30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227,
      131.78422574,
    ],
    visualRadius: 0.65,
    source: solarSources.physical,
    description: {
      ru: "Далёкий ледяной гигант, восьмая планета от Солнца.",
      en: "A distant ice giant, the eighth planet from the Sun.",
    },
  },
  {
    id: "moon",
    name: { ru: "Луна", en: "Moon" },
    kind: "moon",
    color: "#bcbfca",
    radiusKm: 1737.4,
    visualRadius: 0.15,
    source: solarSources.moon,
    description: {
      ru: "Естественный спутник Земли. Здесь выполняется миссия Lunar Ice Mapper.",
      en: "Earth's natural satellite and the target of the Lunar Ice Mapper mission.",
    },
  },
];
export const solarBody = (id: string) =>
  solarBodies.find((b) => b.id === id) ?? solarBodies[0];
// Readable overview, deliberately not a physical distance or body-size scale.
export const solarDisplayDistance = (au: number) => 3 + Math.log1p(au) * 6.5;
const rad = Math.PI / 180;
export function solarPosition(
  body: SolarBody,
  days: number,
  compressed = true,
): [number, number, number] {
  if (body.kind === "star") return [0, 0, 0];
  if (body.kind === "moon") {
    const earth = solarPosition(solarBody("earth"), days, compressed),
      phase = (2 * Math.PI * days) / 27.3217;
    const distance = compressed ? 1.05 : 0.00257;
    return [
      earth[0] + distance * Math.cos(phase),
      earth[1] + distance * 0.09 * Math.sin(phase),
      earth[2] + distance * Math.sin(phase),
    ];
  }
  const [a, e, i, longitude, perihelion, node] = body.elements!;
  const mean =
    (longitude - perihelion) * rad +
    2 * Math.PI * ((days / (body.periodYears! * 365.25)) % 1);
  let anomaly = mean;
  for (let j = 0; j < 12; j++)
    anomaly -=
      (anomaly - e * Math.sin(anomaly) - mean) / (1 - e * Math.cos(anomaly));
  const x = a * (Math.cos(anomaly) - e),
    z = a * Math.sqrt(1 - e * e) * Math.sin(anomaly);
  const w = (perihelion - node) * rad,
    n = node * rad,
    inc = i * rad;
  const px =
    (Math.cos(w) * Math.cos(n) - Math.sin(w) * Math.sin(n) * Math.cos(inc)) *
      x +
    (-Math.sin(w) * Math.cos(n) - Math.cos(w) * Math.sin(n) * Math.cos(inc)) *
      z;
  const pz =
    (Math.cos(w) * Math.sin(n) + Math.sin(w) * Math.cos(n) * Math.cos(inc)) *
      x +
    (-Math.sin(w) * Math.sin(n) + Math.cos(w) * Math.cos(n) * Math.cos(inc)) *
      z;
  const py = Math.sin(w) * Math.sin(inc) * x + Math.cos(w) * Math.sin(inc) * z;
  const r = Math.hypot(px, py, pz),
    scale = compressed ? solarDisplayDistance(r) / r : 1;
  return [px * scale, py * scale, pz * scale];
}
