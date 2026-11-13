import { missionConfig, orbits, physics } from "../data/missionConfig";
import { calculate, clamp, selectedComponents, sum } from "./calculations";
import type { Build, Diagnostic, Incident, MissionRun } from "../types";

// Purchase requirements only. Engineering limits are evaluated in flight.
export const canLaunch = (b: Build) =>
  b.launcherId !== "none" &&
  b.moduleIds.length > 0 &&
  calculate(b).costMUsd <= missionConfig.budgetMUsd + 1e-6;
const fact = (
  code: string,
  ru: string,
  en: string,
  actual: string,
  expected: string,
  whyRu: string,
  whyEn: string,
): Diagnostic => ({
  code,
  title: { ru, en },
  actual,
  expected,
  explanation: { ru: whyRu, en: whyEn },
});
export function powerCycle(run: MissionRun) {
  const r = calculate(run.build),
    orbit = orbits.find((o) => o.id === run.build.orbitId)!;
  const off = sum(
    selectedComponents(run.build).filter(
      (c) =>
        c.category === "instrument" &&
        (run.operations.disabledInstrumentIds.includes(c.id) ||
          (c.id === "radar" && run.radarDisabled)),
    ),
    (c) => c.powerW,
  );
  const recharge =
    (r.sunMarginW + off) * orbit.sunHours * physics.batteryEfficiency;
  const sunCharge = Math.min(r.usableBatteryWh, run.chargeWh + recharge);
  const shadow =
    Math.max(0, r.shadowLoadW - off * physics.shadowInstrumentDuty) *
    orbit.shadowHours;
  const sunFraction = orbit.sunHours / (orbit.sunHours + orbit.shadowHours);
  const progress =
    sunCharge < 0
      ? (sunFraction * run.chargeWh) / Math.max(1e-6, -recharge)
      : sunFraction +
        ((1 - sunFraction) * Math.max(0, sunCharge)) / Math.max(1e-6, shadow);
  return {
    endCharge: sunCharge - shadow,
    shadow,
    recharge,
    progress: clamp(progress, 0.02, 0.98),
  };
}
export function cruiseEnergy(run: MissionRun) {
  const r = calculate(run.build),
    parts = selectedComponents(run.build);
  const hotel =
    sum(
      parts.filter((c) => c.category === "bus"),
      (c) => c.powerW,
    ) +
    (parts.some((c) => c.category === "thermal")
      ? physics.protectedHeaterW
      : physics.unprotectedHeaterW);
  const netW = r.sunPowerW - hotel;
  return {
    netW,
    endCharge: clamp(
      run.chargeWh + netW * physics.cruiseHours,
      0,
      r.usableBatteryWh,
    ),
  };
}
export function predictIncident(run: MissionRun): Incident | null {
  const r = calculate(run.build),
    parts = selectedComponents(run.build),
    orbit = orbits.find((o) => o.id === run.build.orbitId)!;
  const event = (
    kind: Incident["kind"],
    triggerProgress: number,
    ru: string,
    en: string,
    observationRu: string,
    observationEn: string,
    causes: Diagnostic[],
  ): Incident => ({
    kind,
    sourcePhase: run.phase,
    triggerProgress,
    title: { ru, en },
    observation: { ru: observationRu, en: observationEn },
    causes,
  });
  if (run.phase === "launched") {
    if (r.massMarginKg < 0)
      return event(
        r.wetMassKg / r.payloadKg > 1.2 ? "explosion" : "trajectory",
        0.48,
        "Срыв выведения носителя",
        "Launch vehicle ascent failure",
        "Нарастание отклонения по тангажу. Потеря устойчивости носителя.",
        "Increasing pitch deviation. Launch vehicle control lost.",
        [
          fact(
            "mass",
            "Превышена масса полезной нагрузки",
            "Payload envelope exceeded",
            `${r.wetMassKg.toFixed(1)} kg`,
            `≤ ${r.payloadKg.toFixed(1)} kg`,
            "Масса аппарата выходит за расчётный диапазон выбранного носителя. В учебном сценарии перегрузка вызывает потерю устойчивости; при превышении 20% срабатывает аварийное прекращение полёта.",
            "The spacecraft exceeds the selected launcher's modeled envelope. This scenario models loss of control; an excess above 20% triggers flight termination.",
          ),
        ],
      );
    if (!parts.some((c) => c.category === "bus"))
      return event(
        "trajectory",
        0.94,
        "Аппарат потерял ориентацию после отделения",
        "Attitude lost after separation",
        "Аппарат вращается. Команды стабилизации не подтверждаются.",
        "Spacecraft tumbling. Stabilization commands are not acknowledged.",
        [
          fact(
            "bus",
            "Отсутствует бортовая платформа",
            "No spacecraft bus",
            "0",
            "1",
            "После отделения нет установленной системы бортового управления.",
            "No onboard command and control bus is installed after separation.",
          ),
        ],
      );
  }
  if (run.phase === "cruise") {
    const deficit = -cruiseEnergy(run).netW;
    if (deficit > 0 && deficit * physics.cruiseHours >= run.chargeWh)
      return event(
        "power",
        clamp(run.chargeWh / (deficit * physics.cruiseHours), 0.05, 0.95),
        "Потеря питания в перелёте",
        "Cruise power loss",
        "Напряжение бортовой сети падает. Телеметрия прекращается.",
        "Bus voltage falling. Telemetry stops.",
        [
          fact(
            "power",
            "Энергия перелёта исчерпана",
            "Cruise energy exhausted",
            `${run.chargeWh.toFixed(1)} Wh`,
            `≥ ${(deficit * physics.cruiseHours).toFixed(1)} Wh`,
            "Постоянная нагрузка выше солнечной выработки; батарея разрядилась до прибытия.",
            "Hotel load exceeds solar generation; the battery depleted before arrival.",
          ),
        ],
      );
  }
  if (run.phase === "orbitInsertion") {
    const engine = parts.find((c) => c.category === "propulsion");
    const available =
      engine && r.dryMassKg > 0
        ? engine.ispSeconds! *
          physics.g0 *
          Math.log((r.dryMassKg + run.fuelKg) / r.dryMassKg)
        : 0;
    if (available + 1e-6 < orbit.requiredDeltaV)
      return event(
        "trajectory",
        clamp(available / orbit.requiredDeltaV, 0.08, 0.9),
        "Лунная орбита не достигнута",
        "Lunar capture missed",
        "Двигатель выключился до завершения торможения. Аппарат уходит с расчётной траектории.",
        "Engine cutoff before capture completed. Spacecraft departs the planned trajectory.",
        [
          fact(
            "fuel",
            "Тормозной импульс не выполнен",
            "Capture burn incomplete",
            `${available.toFixed(0)} m/s`,
            `≥ ${orbit.requiredDeltaV} m/s`,
            engine
              ? "Доступного топлива и удельного импульса не хватило для захвата Луной."
              : "Бортовой двигатель не установлен.",
            engine
              ? "Available propellant and specific impulse could not complete lunar capture."
              : "No onboard propulsion engine is installed.",
          ),
        ],
      );
  }
  if (run.phase === "scienceOperations" && run.orbit < missionConfig.orbits) {
    const cycle = powerCycle(run);
    if (cycle.endCharge < 0)
      return event(
        "power",
        cycle.progress,
        "Аппарат обесточен на орбите",
        "Orbital power loss",
        "Заряд исчерпан. Приборы и передатчик отключились, стабилизация потеряна.",
        "Battery depleted. Instruments and transmitter offline; attitude control lost.",
        [
          fact(
            "battery",
            "Энергетический запас исчерпан",
            "Energy reserve exhausted",
            `${Math.max(0, run.chargeWh + cycle.recharge).toFixed(1)} Wh`,
            `≥ ${cycle.shadow.toFixed(1)} Wh`,
            "Накопленной энергии не хватило на нагрузку витка. Солнечная выработка, батарея и включённые приборы учитываются вместе.",
            "Stored energy could not cover this orbit's load. Solar generation, battery and active instruments are evaluated together.",
          ),
        ],
      );
  }
  if (
    run.phase === "downlink" &&
    (!parts.some((c) => c.category === "communications") ||
      run.operations.antenna === "stowed")
  )
    return event(
      "communications",
      0.8,
      "Земля не получила сигнал",
      "No signal received on Earth",
      "Сеанс истёк. Наземная станция не захватила несущую.",
      "Contact expired. Ground station could not acquire the carrier.",
      [
        fact(
          "communications",
          "Канал передачи не установлен",
          "Downlink not established",
          run.operations.antenna === "stowed" ? "STOWED" : "0 Mbps",
          "EARTH / > 0 Mbps",
          run.operations.antenna === "stowed"
            ? "Антенна осталась в транспортном положении."
            : "На аппарате отсутствует модуль связи.",
          run.operations.antenna === "stowed"
            ? "The antenna remained stowed."
            : "No communications module is installed.",
        ),
      ],
    );
  return null;
}
export function crisisIncident(run: MissionRun): Incident {
  return {
    kind: run.phase === "cruise" ? "radiation" : "power",
    sourcePhase: run.phase,
    triggerProgress: 0,
    title: {
      ru: "Потеря аппарата после нештатного события",
      en: "Spacecraft lost after a crisis",
    },
    observation: {
      ru: "Телеметрия оборвалась. Система стабилизации не отвечает.",
      en: "Telemetry lost. Attitude control is unresponsive.",
    },
    causes: [
      fact(
        "crisis",
        "Повреждение бортовых систем",
        "Onboard systems damaged",
        `${Math.max(0, run.health)}%`,
        "> 0%",
        "Выбранный режим во время кризиса привёл к критическому повреждению. Подробности сохранены в журнале.",
        "The selected crisis response resulted in critical damage. Details are recorded in the flight log.",
      ),
    ],
  };
}
