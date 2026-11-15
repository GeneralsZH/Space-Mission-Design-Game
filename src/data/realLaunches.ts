import type { Build, LauncherProfile, Text } from "../types";
export type RealVehicleId = "falcon9" | "falcon-heavy" | "soyuz2" | "ariane64";
export interface RealVehicle {
  id: RealVehicleId;
  name: Text;
  heightM: number;
  boosters: number;
  coreDiameterM?: number;
  sites: string[];
  source: string;
  note: Text;
}
const falconGuide =
  "https://www.spacex.com/assets/media/falcon-users-guide-2025-05-09.pdf";
export const realVehicles: RealVehicle[] = [
  {
    id: "falcon9",
    name: { ru: "Falcon 9", en: "Falcon 9" },
    heightM: 70,
    coreDiameterM: 3.66,
    boosters: 0,
    sites: ["ksc-39a", "cape-40", "vandenberg-4e"],
    source: falconGuide,
    note: {
      ru: "Две ступени, девять двигателей на первой. Стандартный обтекатель.",
      en: "Two stages, nine first-stage engines. Standard fairing.",
    },
  },
  {
    id: "falcon-heavy",
    name: { ru: "Falcon Heavy", en: "Falcon Heavy" },
    heightM: 70,
    coreDiameterM: 3.66,
    boosters: 2,
    sites: ["ksc-39a"],
    source: falconGuide,
    note: {
      ru: "Центральный блок и два боковых: 27 двигателей на старте.",
      en: "Centre core and two side cores: 27 engines at liftoff.",
    },
  },
  {
    id: "soyuz2",
    name: { ru: "Союз-2", en: "Soyuz-2" },
    heightM: 46.2,
    boosters: 4,
    sites: ["baikonur-31", "vostochny-1s"],
    source: "https://samspace.ru/about/programs/67/12062/",
    note: {
      ru: "Четыре конических боковых блока. Ориентир высоты ~46 м; головная часть зависит от конфигурации.",
      en: "Four tapered side blocks. Approximate 46 m reference; payload-section height varies by configuration.",
    },
  },
  {
    id: "ariane64",
    name: { ru: "Ariane 6 · A64", en: "Ariane 6 · A64" },
    heightM: 62,
    coreDiameterM: 5.4,
    boosters: 4,
    sites: ["kourou-ela4"],
    source:
      "https://www.esa.int/missions/about-us/directorates/space-transportation/ariane/ariane-6",
    note: {
      ru: "Вариант с четырьмя твёрдотопливными ускорителями и длинным обтекателем.",
      en: "Four-solid-booster configuration with the long fairing.",
    },
  },
];
// Educational lunar rideshare allocations and prices; NOT published LEO/TLI
// capacities, real commercial quotes, launch windows or booking availability.
export const realLauncherProfiles: LauncherProfile[] = [
  { id: "falcon9", name: realVehicles[0].name, payloadKg: 700, costMUsd: 32 },
  {
    id: "falcon-heavy",
    name: realVehicles[1].name,
    payloadKg: 1600,
    costMUsd: 48,
  },
  { id: "soyuz2", name: realVehicles[2].name, payloadKg: 500, costMUsd: 25 },
  { id: "ariane64", name: realVehicles[3].name, payloadKg: 1200, costMUsd: 42 },
];
export interface LaunchSite {
  id: string;
  name: Text;
  country: Text;
  latitude: number;
  longitude: number;
  terrain: "coast" | "steppe" | "forest";
  source: string;
}
export const padCoordinatesSource = "https://ll.thespacedevs.com/2.3.0/pads/";
/** Rounded LL2 pad reference coordinates, retrieved 2026-11-15. */
export const launchSites: LaunchSite[] = [
  {
    id: "ksc-39a",
    name: { ru: "Кеннеди · LC-39A", en: "Kennedy · LC-39A" },
    country: { ru: "США · Флорида", en: "USA · Florida" },
    latitude: 28.61,
    longitude: -80.6,
    terrain: "coast",
    source: falconGuide,
  },
  {
    id: "cape-40",
    name: { ru: "Канаверал · SLC-40", en: "Canaveral · SLC-40" },
    country: { ru: "США · Флорида", en: "USA · Florida" },
    latitude: 28.56,
    longitude: -80.58,
    terrain: "coast",
    source: falconGuide,
  },
  {
    id: "vandenberg-4e",
    name: { ru: "Ванденберг · SLC-4E", en: "Vandenberg · SLC-4E" },
    country: { ru: "США · Калифорния", en: "USA · California" },
    latitude: 34.63,
    longitude: -120.61,
    terrain: "coast",
    source: falconGuide,
  },
  {
    id: "baikonur-31",
    name: { ru: "Байконур · 31/6", en: "Baikonur · 31/6" },
    country: { ru: "Казахстан", en: "Kazakhstan" },
    latitude: 46.0,
    longitude: 63.56,
    terrain: "steppe",
    source: "https://www.russian.space/",
  },
  {
    id: "vostochny-1s",
    name: { ru: "Восточный · 1С", en: "Vostochny · 1S" },
    country: { ru: "Россия", en: "Russia" },
    latitude: 51.88,
    longitude: 128.33,
    terrain: "forest",
    source: "https://samspace.ru/about/programs/67/12062/",
  },
  {
    id: "kourou-ela4",
    name: { ru: "Куру · ELA-4", en: "Kourou · ELA-4" },
    country: { ru: "Французская Гвиана", en: "French Guiana" },
    latitude: 5.26,
    longitude: -52.79,
    terrain: "coast",
    source: "https://cnes.fr/projets/ariane-6/assemblage-lancement",
  },
];
export const realVehicle = (id: string) =>
  realVehicles.find((v) => v.id === id);
export function launchSiteFor(
  build: Pick<Build, "launcherId" | "launchSiteId">,
) {
  const vehicle = realVehicle(build.launcherId);
  if (!vehicle) return undefined;
  return launchSites.find(
    (s) =>
      s.id ===
      (vehicle.sites.includes(build.launchSiteId ?? "")
        ? build.launchSiteId
        : vehicle.sites[0]),
  );
}
// Approximate inertial eastward surface speed, not a credited lunar delta-v.
export const siteRotationSpeed = (latitude: number) =>
  465.1 * Math.cos((latitude * Math.PI) / 180);
