import type { MissionRun, Text } from "../../types";
import { transition } from "../../engine/simulation";
import { calculate, clamp } from "../../engine/calculations";
import { componentById, orbits, physics } from "../../data/missionConfig";
import { predictIncident } from "../../engine/incidents";

export type Point3 = [number, number, number];
export type CameraMode = "follow" | "overview" | "free";
export interface PlaybackFrame {
  key: string;
  seconds: number;
  progress: number;
}
export const flightVisuals = {
  earth: [-12, 0, 0] as Point3,
  earthRadius: 3.1,
  moon: [12, 1, 0] as Point3,
  moonRadius: 1.35,
  launchAnchor: [-12, 3.52, 0] as Point3,
  launchScale: 0.1,
  launchRise: 25,
  durations: {
    launched: 18,
    cruise: 12,
    orbitInsertion: 9,
    scienceOperations: 10,
    downlink: 12,
  },
} as const;
export const playbackKey = (run: MissionRun) => `${run.phase}:${run.orbit}`;
export function stageDuration(run: MissionRun): number {
  if (run.phase === "incident") return 8;
  if (run.phase === "scienceOperations" && run.orbit >= 4) return 2;
  return (
    (predictIncident(run)?.triggerProgress ?? 1) *
    (flightVisuals.durations[
      run.phase as keyof typeof flightVisuals.durations
    ] ?? 0)
  );
}
export const visualStageProgress = (run: MissionRun, progress: number) =>
  clamp(progress) * (predictIncident(run)?.triggerProgress ?? 1);
export function orbitRadius(run: MissionRun): number {
  return run.build.orbitId === "high-polar"
    ? 2.95
    : run.build.orbitId === "elliptical"
      ? 3.5
      : 2.4;
}
export function orbitPosition(run: MissionRun, turns: number): Point3 {
  const angle = turns * Math.PI * 2;
  const r = orbitRadius(run);
  return [
    12 + Math.cos(angle) * r,
    1 + Math.sin(angle) * r * (run.build.orbitId === "elliptical" ? 0.6 : 0.96),
    Math.sin(angle) * r * 0.28,
  ];
}
export function transferPosition(run: MissionRun, progress: number): Point3 {
  const t = clamp(progress);
  const a = 1 - t;
  const end: Point3 = [12 + orbitRadius(run) + 0.8, 2.5, 0];
  const start: Point3 = [-12, 6.45, 0];
  const c1: Point3 = [-7, 10, 4];
  const c2: Point3 = [7, 8, -3];
  return [0, 1, 2].map(
    (i) =>
      a ** 3 * start[i] +
      3 * a * a * t * c1[i] +
      3 * a * t * t * c2[i] +
      t ** 3 * end[i],
  ) as Point3;
}
export function separationProgress(progress: number) {
  return clamp((progress - 0.68) / 0.26);
}
export function launchPosition(progress: number): Point3 {
  const p = clamp(progress);
  const separated = separationProgress(p);
  return [
    -12,
    3.475 + flightVisuals.launchRise * p * p * 0.1 + separated * 0.48,
    0,
  ];
}
export interface MissionPose {
  position: Point3;
  direction: Point3;
  action: Text;
  detail: Text;
  scan: boolean;
  radar: boolean;
  link: boolean;
  burn: boolean;
  routeProgress: number;
}
export function sampleMission(
  run: MissionRun,
  progress: number,
  physicalProgress = false,
): MissionPose {
  const p = physicalProgress
    ? clamp(progress)
    : visualStageProgress(run, progress);
  const radar =
    run.build.moduleIds.includes("radar") &&
    !run.radarDisabled &&
    !run.operations.disabledInstrumentIds.includes("radar");
  let position: Point3 = launchPosition(0);
  let direction: Point3 = [0, 1, 0];
  let action: Text = { ru: "Подготовка к взлёту", en: "Preparing for liftoff" };
  let detail: Text = { ru: "Земля → Луна", en: "Earth → Moon" };
  let routeProgress = 0;
  let scan = false;
  let link = false;
  let burn = false;
  if (run.phase === "launched") {
    position = launchPosition(p);
    routeProgress = p * 0.08;
    action =
      p < 0.16
        ? {
            ru: "Зажигание · отрыв от площадки",
            en: "Ignition · clearing the pad",
          }
        : p < 0.5
          ? {
              ru: "Набор высоты · ракета покидает Землю",
              en: "Climbing · departing Earth",
            }
          : p < 0.68
            ? {
                ru: "Разгон на траекторию к Луне",
                en: "Accelerating onto the lunar transfer",
              }
            : {
                ru: "Раскрытие обтекателя · отделение аппарата",
                en: "Fairing release · spacecraft separation",
              };
    detail = {
      ru:
        p < 0.68
          ? "Камера сопровождает ракету; стартовая площадка остаётся внизу."
          : "LIM-01 отделяется от носителя и раскрывает солнечные панели.",
      en:
        p < 0.68
          ? "The camera follows the rocket as the launch pad falls away."
          : "LIM-01 separates from the launcher and deploys its solar arrays.",
    };
  } else if (run.phase === "cruise") {
    position = transferPosition(run, p);
    const next = transferPosition(run, Math.min(1, p + 0.015));
    const previous = transferPosition(run, Math.max(0, p - 0.015));
    direction = next.map((n, i) => n - previous[i]) as Point3;
    routeProgress = 0.08 + p * 0.72;
    action = {
      ru: "Перелёт от Земли к Луне",
      en: "Flying from Earth to the Moon",
    };
    detail = {
      ru: "Аппарат движется по подсвеченной трассе к лунной орбите.",
      en: "The spacecraft follows the illuminated path toward lunar orbit.",
    };
  } else if (run.phase === "orbitInsertion") {
    const incoming = transferPosition(run, 1);
    const target = orbitPosition(run, 0);
    position = incoming.map((n, i) => n + (target[i] - n) * p) as Point3;
    routeProgress = 0.8 + p * 0.1;
    burn = p < 0.85;
    action = {
      ru: "Тормозной импульс · выход на лунную орбиту",
      en: "Braking burn · lunar orbit insertion",
    };
    detail = {
      ru: "Двигатель снижает скорость; аппарат захватывается полярной орбитой.",
      en: "The engine slows the spacecraft into a polar lunar orbit.",
    };
  } else if (run.phase === "scienceOperations") {
    position = orbitPosition(run, run.orbit + (run.orbit < 4 ? p : 0));
    routeProgress = 0.9;
    scan =
      run.orbit < 4 &&
      !run.crisis &&
      run.build.moduleIds.some(
        (id) =>
          componentById(id).category === "instrument" &&
          !run.operations.disabledInstrumentIds.includes(id) &&
          !(id === "radar" && run.radarDisabled),
      );
    direction = flightVisuals.moon.map((n, i) => n - position[i]) as Point3;
    action =
      run.orbit < 4
        ? {
            ru: `Научный виток ${run.orbit + 1} из 4 · ${radar ? "радар ищет лёд" : "съёмка и спектральные измерения"}`,
            en: `Science orbit ${run.orbit + 1} of 4 · ${radar ? "radar ice mapping" : "imaging and spectral measurements"}`,
          }
        : {
            ru: "Научная программа выполнена · подготовка связи",
            en: "Science program complete · preparing downlink",
          };
    detail = {
      ru: `Область: ${run.operations.target === "pole" ? "полярные кратеры" : "экватор"}. ${scan ? "Приборы ведут измерения." : "Научные приборы выключены."}`,
      en: `Target: ${run.operations.target === "pole" ? "polar craters" : "equator"}. ${scan ? "Instruments are collecting measurements." : "Science instruments are off."}`,
    };
    if (!scan && run.orbit < 4)
      action = {
        ru: "Полёт по орбите · приборы выключены",
        en: "Orbiting · science instruments off",
      };
  } else if (run.phase === "downlink" || run.phase === "completed") {
    const contact = run.phase === "completed" ? 1 : clamp(p / 0.22);
    position = orbitPosition(run, contact * 0.5);
    direction = flightVisuals.earth.map((n, i) => n - position[i]) as Point3;
    routeProgress = run.phase === "completed" ? 1 : 0.9 + p * 0.1;
    link =
      contact >= 1 &&
      run.operations.antenna === "earth" &&
      run.phase !== "completed";
    action =
      run.phase === "completed"
        ? {
            ru: "Данные приняты на Земле · миссия завершена",
            en: "Data received on Earth · mission complete",
          }
        : contact < 1
          ? {
              ru: "Выход из тени Луны · наведение антенны",
              en: "Clearing lunar occultation · pointing the antenna",
            }
          : {
              ru: "Передача научных данных на Землю",
              en: "Downlinking scientific data to Earth",
            };
    detail = {
      ru: `Антенна: ${run.operations.antenna === "earth" ? "Земля" : "транспортное положение"}. Доля окна: ${run.operations.downlinkFraction * 100}%.`,
      en: `Antenna: ${run.operations.antenna}. Contact window allocation: ${run.operations.downlinkFraction * 100}%.`,
    };
    if (run.phase === "downlink" && run.operations.antenna === "stowed")
      action = {
        ru: "Сеанс связи · антенна не направлена на Землю",
        en: "Contact session · antenna not pointed at Earth",
      };
  } else if (
    (run.phase === "incident" || run.phase === "failed") &&
    run.incident
  ) {
    const event = run.incident,
      t = run.phase === "failed" ? 1 : clamp(progress);
    const base = sampleMission(
      { ...run, phase: event.sourcePhase, incident: null, crisis: null },
      event.triggerProgress,
      true,
    );
    position = base.position;
    routeProgress = base.routeProgress;
    if (event.kind === "trajectory")
      position = [
        position[0] + t * t * 3,
        position[1] + t * 0.9,
        position[2] + t * 2,
      ];
    direction = [Math.sin(t * 13), Math.cos(t * 9), Math.sin(t * 7)];
    action =
      event.kind === "explosion"
        ? {
            ru: "Аварийное прекращение полёта · разрушение носителя",
            en: "Flight termination · launch vehicle breakup",
          }
        : event.title;
    detail =
      run.phase === "incident"
        ? {
            ru: "Запись телеметрии сохранена. Анализ причин появится после завершения события.",
            en: "Telemetry recording retained. Cause analysis follows the event.",
          }
        : event.observation;
  } else if (run.phase === "failed") {
    position = orbitPosition(run, run.orbit);
    action = {
      ru:
        run.health > 0
          ? "Полёт завершён · научный контракт не выполнен"
          : "Миссия остановлена · аппарат повреждён",
      en:
        run.health > 0
          ? "Flight complete · science contract not met"
          : "Mission stopped · spacecraft damaged",
    };
  }
  if (run.crisis) {
    action =
      run.crisis === "flare"
        ? {
            ru: "Солнечная вспышка · ожидаем ваше решение",
            en: "Solar flare · awaiting your decision",
          }
        : {
            ru: "Аппарат в тени Луны · ожидаем ваше решение",
            en: "Spacecraft in lunar eclipse · awaiting your decision",
          };
    detail = {
      ru: "Эфир и автоматический переход остановлены до выбора действия.",
      en: "Playback and automatic progression wait for your decision.",
    };
    scan = false;
    burn = false;
  }
  return {
    position,
    direction,
    action,
    detail,
    scan,
    radar,
    link,
    burn,
    routeProgress,
  };
}
export function displayTelemetry(run: MissionRun, progress: number) {
  const active =
    !run.crisis &&
    (run.phase === "downlink" ||
      run.phase === "cruise" ||
      run.phase === "orbitInsertion" ||
      (run.phase === "scienceOperations" && run.orbit < 4));
  const target = active
    ? transition({ ...run, paused: false }, { type: "Advance" })
    : run;
  const p =
    run.phase === "downlink"
      ? clamp((progress - 0.22) / 0.78)
      : clamp(progress);
  const mix = (
    key:
      | "chargeWh"
      | "storedGbit"
      | "transmittedGbit"
      | "deliveredScience"
      | "generatedGbit"
      | "fuelKg",
  ) => run[key] + (target[key] - run[key]) * p;
  let chargeWh = mix("chargeWh");
  if (active && run.phase === "scienceOperations") {
    const orbit = orbits.find((profile) => profile.id === run.build.orbitId)!;
    const report = calculate(run.build);
    const disabledPower = run.build.moduleIds
      .map(componentById)
      .filter(
        (c) =>
          c.category === "instrument" &&
          (run.operations.disabledInstrumentIds.includes(c.id) ||
            (c.id === "radar" && run.radarDisabled)),
      )
      .reduce((n, c) => n + c.powerW, 0);
    const sunFraction = orbit.sunHours / (orbit.sunHours + orbit.shadowHours);
    const endFraction = predictIncident(run)?.triggerProgress ?? 1;
    const actualP = p * endFraction;
    const charged = Math.min(
      report.usableBatteryWh,
      run.chargeWh +
        (report.sunMarginW + disabledPower) *
          orbit.sunHours *
          physics.batteryEfficiency,
    );
    chargeWh =
      actualP <= sunFraction
        ? Math.max(
            0,
            run.chargeWh + ((charged - run.chargeWh) * actualP) / sunFraction,
          )
        : charged +
          ((target.chargeWh - charged) * (actualP - sunFraction)) /
            (endFraction - sunFraction);
  }
  return {
    fuelKg: mix("fuelKg"),
    chargeWh,
    storedGbit: mix("storedGbit"),
    transmittedGbit: mix("transmittedGbit"),
    deliveredScience: mix("deliveredScience"),
    generatedGbit: mix("generatedGbit"),
  };
}
