import type {
  Build,
  ComponentDef,
  LauncherProfile,
  OrbitProfile,
} from "../types";
import { z } from "zod";

export const physics = {
  g0: 9.80665,
  sunlightFactor: 0.9,
  degradationFactor: 0.95,
  depthOfDischarge: 0.8,
  batteryEfficiency: 0.9,
  shadowInstrumentDuty: 0.4,
  unprotectedHeaterW: 35,
  protectedHeaterW: 12,
  deltaVReserve: 150,
  propellantCostPerKg: 0.012,
  scienceWeight: 0.65,
  reliabilityWeight: 0.2,
  costWeight: 0.15,
  flareBaseRisk: 0.5,
  eclipseBaseRisk: 0.45,
  safeScienceFactor: 0.92,
  flareScienceLoss: 0.35,
  flareHealthLoss: 65,
  eclipseHealthLoss: 75,
  flareDelayHours: 6,
  cruiseHours: 72,
  insertionHours: 1,
  extendedShadowHours: 2 / 3,
  maxPropellantKg: 300,
  maxTestingMUsd: 25,
  baselineReliability: 0.72,
  testReliabilityPerM: 0.008,
  safeEclipseChargeFraction: 0.15,
  continuedEclipseChargeFraction: 0.65,
  radarShutdownScienceFactor: 0.97,
  insufficientBatteryHealthLoss: 30,
  shieldingReliabilityWeight: 0.25,
  maxReliability: 0.99,
  eclipseReserveRiskReduction: 0.2,
} as const;

export const missionConfig = {
  id: "lunar-ice-mapper",
  title: { ru: "Lunar Ice Mapper", en: "Lunar Ice Mapper" },
  destination: { ru: "Луна · Южный полюс", en: "Moon · South pole" },
  objectives: {
    ru: "Проверьте признаки водяного льда в полярных кратерах и передайте измерения на Землю.",
    en: "Investigate water ice signatures in polar craters and deliver measurements to Earth.",
  },
  scienceRequirements: {
    ru: "Не менее 120 единиц доставленной науки; прибор определения состава; аппарат должен пережить передачу.",
    en: "At least 120 delivered science units; a composition instrument; the spacecraft must survive downlink.",
  },
  requiredInstrumentTags: ["composition"],
  budgetMUsd: 110,
  scienceTarget: 120,
  missionSuccessThreshold: 1,
  orbits: 4,
  maxMissionDays: 7,
} as const;

const rawCatalog: ComponentDef[] = [
  {
    id: "bus-lite",
    category: "bus",
    name: { ru: "Шина Lite", en: "Lite bus" },
    description: {
      ru: "Лёгкая платформа. Только 16 Gbit памяти.",
      en: "Light platform. Only 16 Gbit of memory.",
    },
    massKg: 40,
    costMUsd: 7,
    powerW: 30,
    memoryGbit: 16,
    protection: 0,
  },
  {
    id: "bus-standard",
    category: "bus",
    name: { ru: "Шина Standard", en: "Standard bus" },
    description: {
      ru: "96 Gbit памяти и резервирование питания.",
      en: "96 Gbit memory and redundant power.",
    },
    massKg: 65,
    costMUsd: 11,
    powerW: 45,
    memoryGbit: 96,
    protection: 0.06,
  },
  {
    id: "bus-shielded",
    category: "bus",
    name: { ru: "Шина Shielded", en: "Shielded bus" },
    description: {
      ru: "160 Gbit, дополнительная защита электроники.",
      en: "160 Gbit, hardened electronics.",
    },
    massKg: 85,
    costMUsd: 16,
    powerW: 50,
    memoryGbit: 160,
    protection: 0.14,
  },
  {
    id: "camera",
    category: "instrument",
    name: { ru: "Камера Terrain", en: "Terrain camera" },
    description: {
      ru: "Контекст рельефа; не определяет состав льда.",
      en: "Surface context; cannot identify ice composition.",
    },
    massKg: 12,
    costMUsd: 5,
    powerW: 35,
    dataMbps: 0.3,
    science: 12,
    tags: ["imaging"],
  },
  {
    id: "spectrometer",
    category: "instrument",
    name: { ru: "Спектрометр IR", en: "IR spectrometer" },
    description: {
      ru: "Спектральные признаки воды. Определяет состав.",
      en: "Water spectral signatures. Measures composition.",
    },
    massKg: 24,
    costMUsd: 12,
    powerW: 70,
    dataMbps: 0.7,
    science: 32,
    tags: ["composition"],
  },
  {
    id: "radar",
    category: "instrument",
    name: { ru: "Радар IceSAR", en: "IceSAR radar" },
    description: {
      ru: "Лёд под поверхностью. +200 W и большой поток данных.",
      en: "Subsurface ice. +200 W and a large data stream.",
    },
    massKg: 58,
    costMUsd: 19,
    powerW: 200,
    dataMbps: 3,
    science: 45,
    tags: ["composition", "subsurface"],
  },
  {
    id: "magnetometer",
    category: "instrument",
    name: { ru: "Магнитометр", en: "Magnetometer" },
    description: {
      ru: "Дешёвый дополнительный научный контекст.",
      en: "Low-cost additional scientific context.",
    },
    massKg: 6,
    costMUsd: 3,
    powerW: 12,
    dataMbps: 0.05,
    science: 5,
    tags: ["magnetic"],
  },
  {
    id: "lga",
    category: "communications",
    name: { ru: "LGA Basic", en: "LGA Basic" },
    description: {
      ru: "0.25 Mbps. Экономит массу, но теряет науку.",
      en: "0.25 Mbps. Saves mass but limits science delivery.",
    },
    massKg: 7,
    costMUsd: 3,
    powerW: 25,
    downlinkMbps: 0.25,
  },
  {
    id: "hga-compact",
    category: "communications",
    name: { ru: "HGA Compact", en: "HGA Compact" },
    description: {
      ru: "8 Mbps эффективного канала. Сбалансированный выбор.",
      en: "8 Mbps effective link. A balanced choice.",
    },
    massKg: 16,
    costMUsd: 7,
    powerW: 65,
    downlinkMbps: 8,
  },
  {
    id: "hga-high",
    category: "communications",
    name: { ru: "HGA High Rate", en: "HGA High Rate" },
    description: {
      ru: "20 Mbps. Высокая мощность и стоимость.",
      en: "20 Mbps. Higher power and cost.",
    },
    massKg: 30,
    costMUsd: 12,
    powerW: 115,
    downlinkMbps: 20,
  },
  ...(["s", "m", "l"] as const).map((size, i): ComponentDef => ({
    id: `panel-${size}`,
    category: "panel",
    name: {
      ru: `Панели ${size.toUpperCase()}`,
      en: `Solar array ${size.toUpperCase()}`,
    },
    description: {
      ru: "Выработка снижается с учётом освещения и деградации.",
      en: "Output includes illumination and degradation losses.",
    },
    massKg: [18, 32, 52][i],
    costMUsd: [3, 6, 10][i],
    powerW: 0,
    ratedW: [220, 620, 1150][i],
  })),
  ...(["s", "m", "l"] as const).map((size, i): ComponentDef => ({
    id: `battery-${size}`,
    category: "battery",
    name: {
      ru: `Аккумулятор ${size.toUpperCase()}`,
      en: `Battery ${size.toUpperCase()}`,
    },
    description: {
      ru: "Полезная ёмкость: 72% номинала с учётом потерь.",
      en: "Usable capacity is 72% of nominal after losses.",
    },
    massKg: [8, 20, 38][i],
    costMUsd: [2, 4, 7][i],
    powerW: 0,
    capacityWh: [120, 480, 1000][i],
  })),
  {
    id: "engine-small",
    category: "propulsion",
    name: { ru: "Двигатель S · 300 s", en: "Engine S · 300 s" },
    description: {
      ru: "Лёгкий двигатель, меньший удельный импульс.",
      en: "Light engine with a lower specific impulse.",
    },
    massKg: 9,
    costMUsd: 3,
    powerW: 0,
    ispSeconds: 300,
  },
  {
    id: "engine-medium",
    category: "propulsion",
    name: { ru: "Двигатель M · 335 s", en: "Engine M · 335 s" },
    description: {
      ru: "Больший запас Δv при той же массе топлива.",
      en: "More delta-v for the same propellant mass.",
    },
    massKg: 18,
    costMUsd: 5,
    powerW: 0,
    ispSeconds: 335,
  },
  {
    id: "thermal",
    category: "thermal",
    name: { ru: "Термопакет MLI", en: "MLI thermal pack" },
    description: {
      ru: "Снижает нагреватели до 12 W и риск затмения.",
      en: "Reduces heaters to 12 W and eclipse risk.",
    },
    massKg: 8,
    costMUsd: 3,
    powerW: 0,
    protection: 0.28,
  },
  {
    id: "radiation",
    category: "radiation",
    name: { ru: "Радиационный экран", en: "Radiation shield" },
    description: {
      ru: "Снижает риск потери электроники при вспышке.",
      en: "Reduces electronics loss risk during a solar flare.",
    },
    massKg: 12,
    costMUsd: 4,
    powerW: 0,
    protection: 0.3,
  },
];

const positive = z.number().finite().positive();
const nonnegative = z.number().finite().nonnegative();
const localized = z.object({ ru: z.string().min(1), en: z.string().min(1) });
export const componentSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum([
      "bus",
      "instrument",
      "communications",
      "panel",
      "battery",
      "propulsion",
      "thermal",
      "radiation",
    ]),
    name: localized,
    description: localized,
    massKg: positive,
    costMUsd: positive,
    powerW: nonnegative,
    dataMbps: nonnegative.optional(),
    science: nonnegative.optional(),
    tags: z.array(z.string()).optional(),
    downlinkMbps: nonnegative.optional(),
    ratedW: positive.optional(),
    capacityWh: positive.optional(),
    memoryGbit: positive.optional(),
    ispSeconds: positive.optional(),
    protection: z.number().min(0).max(1).optional(),
  })
  .strict();
export const catalog: ComponentDef[] = z
  .array(componentSchema)
  .refine(
    (items) => new Set(items.map((c) => c.id)).size === items.length,
    "Duplicate component ID",
  )
  .parse(rawCatalog);

export const orbits: OrbitProfile[] = [
  {
    id: "low-polar",
    name: { ru: "Низкая полярная", en: "Low polar" },
    description: {
      ru: "100 км · детальная съёмка, более длинная тень",
      en: "100 km · detailed imaging, longer eclipses",
    },
    sunHours: 0.9,
    shadowHours: 0.6,
    contactHours: 0.22,
    operatingHours: 0.75,
    scienceFactor: 1.1,
    requiredDeltaV: 1000,
    payloadFactor: 1,
  },
  {
    id: "high-polar",
    name: { ru: "Высокая полярная", en: "High polar" },
    description: {
      ru: "300 км · больше связи, ниже разрешение",
      en: "300 km · more contact, lower resolution",
    },
    sunHours: 1.4,
    shadowHours: 0.4,
    contactHours: 0.4,
    operatingHours: 0.8,
    scienceFactor: 0.85,
    requiredDeltaV: 850,
    payloadFactor: 1.05,
  },
  {
    id: "elliptical",
    name: { ru: "Эллиптическая", en: "Elliptical" },
    description: {
      ru: "100 × 1000 км · экономит топливо, сложнее связь",
      en: "100 × 1000 km · saves fuel, harder downlink",
    },
    sunHours: 1.8,
    shadowHours: 0.25,
    contactHours: 0.12,
    operatingHours: 0.65,
    scienceFactor: 0.75,
    requiredDeltaV: 650,
    payloadFactor: 1.1,
  },
];
export const launchers: LauncherProfile[] = [
  {
    id: "light",
    name: { ru: "Лёгкий · Swift", en: "Light · Swift" },
    payloadKg: 250,
    costMUsd: 15,
  },
  {
    id: "medium",
    name: { ru: "Средний · Atlas", en: "Medium · Atlas" },
    payloadKg: 500,
    costMUsd: 24,
  },
  {
    id: "heavy",
    name: { ru: "Тяжёлый · Titan", en: "Heavy · Titan" },
    payloadKg: 1000,
    costMUsd: 42,
  },
];
export const goldenBuild: Build = {
  moduleIds: [
    "bus-standard",
    "spectrometer",
    "camera",
    "hga-compact",
    "panel-m",
    "battery-m",
    "engine-medium",
    "thermal",
    "radiation",
  ],
  orbitId: "low-polar",
  launcherId: "medium",
  propellantKg: 120,
  testingBudgetMUsd: 5,
};
export const categories: CategoryList = [
  "bus",
  "instrument",
  "communications",
  "panel",
  "battery",
  "propulsion",
  "thermal",
  "radiation",
];
type CategoryList = ComponentDef["category"][];
export const componentById = (id: string): ComponentDef => {
  const component = catalog.find((item) => item.id === id);
  if (!component) throw new Error(`Unknown component: ${id}`);
  return component;
};
