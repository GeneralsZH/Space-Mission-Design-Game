import { activeImaging } from "../../engine/coverage";
import type { MissionRun, Text } from "../../types";
import { transition } from "../../engine/simulation";
import { calculate, clamp } from "../../engine/calculations";
import { componentById, resolveOrbit, physics } from "../../data/missionConfig";
import {
  keplerState,
  lunar,
  orbitElements,
  elementsFor,
  orbitalParameters,
} from "../../engine/orbital";
import { predictIncident } from "../../engine/incidents";
import { chargeAt } from "../../engine/energy";
import {
  launchFrame,
  realLaunchPosition,
  localDirectionToMission,
  localToMission,
} from "./launchGeometry";
import { realVehicle } from "../../data/realLaunches";
import { ascentScale, ascentState, ascentDrift } from "./ascentProfile";

export type Point3 = [number, number, number];
export type CameraMode = "follow" | "overview" | "moon" | "solar" | "free";
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
  const periodFactor =
    run.build.modelVersion === 2 && run.phase === "scienceOperations"
      ? orbitalParameters(elementsFor(run.build)).periodSeconds /
        orbitalParameters(orbitElements["low-polar"]).periodSeconds
      : 1;
  return (
    periodFactor *
    ((predictIncident(run)?.triggerProgress ?? 1) *
      (flightVisuals.durations[
        run.phase as keyof typeof flightVisuals.durations
      ] ?? 0)) *
    (run.phase === "launched" && realVehicle(run.build.launcherId)
      ? ascentScale.duration / flightVisuals.durations.launched
      : 1)
  );
}
export const visualStageProgress = (run: MissionRun, progress: number) =>
  clamp(progress) * (predictIncident(run)?.triggerProgress ?? 1);
export function orbitRadius(run: MissionRun): number {
  if (run.build.modelVersion === 2)
    return (
      (flightVisuals.moonRadius * orbitalParameters(elementsFor(run.build)).a) /
      lunar.radiusM
    );
  return run.build.orbitId === "high-polar"
    ? 2.95
    : run.build.orbitId === "elliptical"
      ? 3.5
      : 2.4;
}
export function orbitPosition(run: MissionRun, turns: number): Point3 {
  if (run.build.modelVersion === 2) {
    const elements = elementsFor(run.build),
      p = keplerState(elements, turns),
      scale = flightVisuals.moonRadius / lunar.radiusM,
      i = (elements.inclinationDeg * Math.PI) / 180;
    return [
      12 + p.x * scale,
      1 + p.y * Math.sin(i) * scale,
      p.y * Math.cos(i) * scale,
    ];
  }
  const angle = turns * Math.PI * 2;
  const r = orbitRadius(run);
  return [
    12 + Math.cos(angle) * r,
    1 + Math.sin(angle) * r * (run.build.orbitId === "elliptical" ? 0.6 : 0.96),
    Math.sin(angle) * r * 0.28,
  ];
}
export function transferPosition(run: MissionRun, progress: number): Point3 {
  let t = clamp(progress);
  const realStart = realLaunchPosition(run.build, 1);
  const departure: Point3 = [0.86, 0.5, 0.1];
  const departureLength = Math.hypot(...departure);
  const outward = departure.map((n) => n / departureLength) as Point3;
  if (realStart && t <= 0.28) {
    const relative = realStart.map((n, i) => n - flightVisuals.earth[i]),
      r = Math.hypot(...relative);
    const from = relative.map((n) => n / r),
      dot = Math.max(
        -1,
        Math.min(
          1,
          from.reduce((v, n, i) => v + n * outward[i], 0),
        ),
      ),
      theta = Math.acos(dot),
      u = t / 0.28;
    const unit =
      theta < 1e-6
        ? from
        : from.map(
            (n, i) =>
              (Math.sin((1 - u) * theta) * n +
                Math.sin(u * theta) * outward[i]) /
              Math.sin(theta),
          );
    return unit.map(
      (n, i) => flightVisuals.earth[i] + n * (r + (5.5 - r) * u),
    ) as Point3;
  }
  if (realStart) t = (t - 0.28) / 0.72;
  const a = 1 - t;
  const end: Point3 = [12 + orbitRadius(run) + 0.8, 2.5, 0];
  const start: Point3 = realStart
    ? (outward.map((n, i) => flightVisuals.earth[i] + n * 5.5) as Point3)
    : [-12, 6.45, 0];
  const site = launchFrame(run.build, 1);
  const c1: Point3 = site
    ? (start.map(
        (n, i) => n + site.normal[i] * 3 + (i === 0 ? 2 : 0),
      ) as Point3)
    : [-7, 10, 4];
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
  let position: Point3 = realLaunchPosition(run.build, 0) ?? launchPosition(0);
  let direction: Point3 = [0, 1, 0];
  let action: Text = { ru: "Подготовка к взлёту", en: "Preparing for liftoff" };
  let detail: Text = { ru: "Земля → Луна", en: "Earth → Moon" };
  let routeProgress = 0;
  let scan = false;
  let link = false;
  let burn = false;
  if (run.phase === "launched") {
    position = realLaunchPosition(run.build, p) ?? launchPosition(p);
    const launch = launchFrame(run.build, p);
    if (launch)
      direction = localDirectionToMission(
        run.build,
        ascentState(p).direction,
        p,
      )!;
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
    if (launch) {
      const ascent = ascentState(p);
      action = ascent.stage.text;
      detail = {
        ru: `${ascent.altitudeKm.toFixed(1)} км · разворот ${ascent.pitchDeg.toFixed(0)}° к горизонту · ${ascent.upperBurn || ascent.coreBurn ? "двигатель работает" : "полёт без тяги"}. Сценарная траектория.`,
        en: `${ascent.altitudeKm.toFixed(1)} km · pitch ${ascent.pitchDeg.toFixed(0)}° above horizon · ${ascent.upperBurn || ascent.coreBurn ? "engine firing" : "unpowered flight"}. Illustrative trajectory.`,
      };
    }
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
      ru: "Двигатель снижает скорость; аппарат выходит на выбранную лунную орбиту.",
      en: "The engine slows the spacecraft into the selected lunar orbit.",
    };
  } else if (run.phase === "scienceOperations") {
    position = orbitPosition(run, run.orbit + (run.orbit < 4 ? p : 0));
    routeProgress = 0.9;
    scan =
      run.orbit < 4 &&
      (run.build.modelVersion !== 2 ||
        (p >= 0.5 &&
          p <=
            0.5 +
              resolveOrbit(run.build).operatingHours /
                (resolveOrbit(run.build).sunHours +
                  resolveOrbit(run.build).shadowHours))) &&
      !run.crisis &&
      (run.build.modelVersion !== 2 || activeImaging(run)) &&
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
            ru: `Научный виток ${run.orbit + 1} из 4 · ${radar ? "моделируемая радиолокационная съёмка" : "съёмка и спектральные измерения"}`,
            en: `Science orbit ${run.orbit + 1} of 4 · ${radar ? "simulated radar survey" : "imaging and spectral measurements"}`,
          }
        : {
            ru: "Научная программа выполнена · подготовка связи",
            en: "Science program complete · preparing downlink",
          };
    detail = {
      ru: `Область: ${run.operations.target === "pole" ? "полярные кратеры" : "экватор"}. ${scan ? "Приборы ведут измерения." : "Научное окно неактивно."}`,
      en: `Target: ${run.operations.target === "pole" ? "polar craters" : "equator"}. ${scan ? "Instruments are collecting measurements." : "Observation window inactive."}`,
    };
    if (!scan && run.orbit < 4)
      action = {
        ru:
          run.build.modelVersion === 2
            ? "Полёт по орбите · ожидание научного окна"
            : "Полёт по орбите · приборы выключены",
        en:
          run.build.modelVersion === 2
            ? "Orbiting · observation standby"
            : "Orbiting · science instruments off",
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
    if (event.kind === "trajectory") {
      if (
        event.sourcePhase === "launched" &&
        realVehicle(run.build.launcherId)
      ) {
        const local = ascentState(event.triggerProgress).position,
          drift = ascentDrift(t);
        position = localToMission(
          run.build,
          local.map((n, i) => n + drift[i]) as Point3,
          event.triggerProgress,
        )!;
      } else
        position = [
          position[0] + t * t * 3,
          position[1] + t * 0.9,
          position[2] + t * 2,
        ];
    }
    direction =
      event.kind === "communications"
        ? base.direction
        : [Math.sin(t * 13), Math.cos(t * 9), Math.sin(t * 7)];
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
    const orbit = resolveOrbit(run.build);
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
    chargeWh = run.build.advancedFlight
      ? chargeAt(run, actualP)
      : actualP <= sunFraction
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
