import {
  missionConfig as mission,
  resolveOrbit,
  physics as p,
} from "../data/missionConfig";
import type {
  Build,
  LogEntry,
  MissionCommand,
  MissionResult,
  MissionRun,
  Text,
  Incident,
} from "../types";
import { calculate, clamp, selectedComponents, sum } from "./calculations";
import {
  canLaunch,
  cruiseEnergy,
  crisisIncident,
  powerCycle,
  predictIncident,
} from "./incidents";
import {
  coverageSummary,
  observeOrbit,
  observationFootprintKm,
  observationEndProgress,
} from "./coverage";

export function random(seed: number): [number, number] {
  let state = seed | 0;
  state ^= state << 13;
  state ^= state >>> 17;
  state ^= state << 5;
  return [(state >>> 0) / 4294967296, state >>> 0];
}
export function createRun(build: Build, seed = 42): MissionRun {
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295)
    throw new Error("Invalid seed");
  const stats = calculate(build);
  return {
    observedCellIds: [],
    solarEfficiency: 1,
    scanPasses: [],
    incident: null,
    operations: {
      disabledInstrumentIds: [],
      target: "pole",
      antenna: "earth",
      downlinkFraction: 1,
    },
    seed,
    rng: seed || 0x6d2b79f5,
    phase: "draft",
    paused: false,
    build: structuredClone(build),
    elapsedHours: 0,
    orbit: 0,
    chargeWh: stats.usableBatteryWh,
    fuelKg: build.propellantKg,
    storedGbit: 0,
    transmittedGbit: 0,
    generatedGbit: 0,
    lostGbit: 0,
    storedScience: 0,
    deliveredScience: 0,
    lostScience: 0,
    scienceFactor: 1,
    health: 100,
    crisis: null,
    flareResolved: false,
    eclipseResolved: false,
    radarDisabled: false,
    logs: [],
    telemetry: [],
  };
}
function log(
  run: MissionRun,
  ru: string,
  en: string,
  kind: LogEntry["kind"] = "info",
) {
  run.logs.push({
    phase: run.phase,
    hours: run.elapsedHours,
    message: { ru, en },
    kind,
  });
}
export function assessResult(run: MissionRun): MissionResult {
  const stats = calculate(run.build);
  const scienceScore =
    clamp(run.deliveredScience / mission.scienceTarget) * 100;
  const success =
    !run.incident &&
    (run.build.modelVersion !== 2 ||
      coverageSummary(run.observedCellIds).observed > 0) &&
    selectedComponents(run.build).some((c) =>
      c.tags?.includes("composition"),
    ) &&
    run.health > 0 &&
    run.deliveredScience >=
      mission.scienceTarget * mission.missionSuccessThreshold &&
    run.elapsedHours <= mission.maxMissionDays * 24;
  const efficiency = clamp(stats.budgetMarginMUsd / mission.budgetMUsd);
  const finalScore = clamp(
    p.scienceWeight * scienceScore +
      p.reliabilityWeight * stats.reliability * run.health +
      p.costWeight * efficiency * 100,
    0,
    100,
  );
  const recommendations: Text[] = [];
  if (run.build.modelVersion === 2 && run.observedCellIds.length === 0)
    recommendations.push({
      ru: "Аппарат не получил геометрического доступа к архивным точкам южного полюса при записи данных. Проверьте наклонение, полосу обзора, цель и свободную память.",
      en: "No geometric access to south-pole archival samples was recorded while collecting data. Check inclination, footprint, target and available memory.",
    });
  if ((run.solarEfficiency ?? 1) < 1)
    recommendations.push({
      ru: "После сценарного повреждения панелей солнечная выработка составила 45% исходной. Снизьте нагрузку или пересмотрите защиту; это учебная модель деградации.",
      en: "Scenario solar-cell damage reduced generation to 45% of its original value. Reduce loads or revise protection; this is an educational degradation model.",
    });
  if (run.operations.antenna === "stowed")
    recommendations.push({
      ru: "Сеанс завершился со сложенной антенной: связь с Землёй не была установлена. В следующей попытке проверьте ориентацию перед передачей.",
      en: "The session ended with the antenna stowed: no Earth link was established. Check antenna orientation before the next downlink.",
    });
  if (run.operations.target === "equator")
    recommendations.push({
      ru: "Экваториальные измерения имеют коэффициент науки 0.65 для полярного контракта. Область наблюдений влияет на полезность данных.",
      en: "Equatorial measurements have a 0.65 science multiplier for this polar contract. Target selection affects the value of measurements.",
    });
  if (run.operations.disabledInstrumentIds.length)
    recommendations.push({
      ru: "Часть приборов была выключена: нагрузка снизилась, но соответствующие данные и наука не собирались. Сопоставьте команды в журнале с результатами витков.",
      en: "Some instruments were off: power demand decreased, but those data and science were not collected. Compare command logs with orbit outcomes.",
    });
  if (run.lostGbit > 0 || run.storedGbit > 0)
    recommendations.push({
      ru: "Установите более быструю HGA или выберите высокую полярную орбиту: часть измерений не дошла до Земли.",
      en: "Use a faster HGA or high polar orbit: some measurements did not reach Earth.",
    });
  if (run.scienceFactor < 1 || run.radarDisabled)
    recommendations.push({
      ru: "Safe mode сохранил аппарат ценой наблюдений. Добавьте научный резерв: камеру или магнитометр.",
      en: "Safe mode preserved the spacecraft at the cost of observations. Add science margin with a camera or magnetometer.",
    });
  if (run.health < 100)
    recommendations.push({
      ru: "Повышайте защиту, бюджет испытаний и запас батареи; во время аварий выбирайте безопасный режим.",
      en: "Increase shielding, testing and battery margin; choose safe mode during crises.",
    });
  if (stats.deltaVMargin < 200)
    recommendations.push({
      ru: "Запас Δv меньше 200 m/s: уменьшите сухую массу или добавьте топливо с проверкой носителя.",
      en: "Delta-v margin is below 200 m/s: reduce dry mass or add fuel and recheck the launcher.",
    });
  if (!recommendations.length)
    recommendations.push({
      ru: "Все ограничения соблюдены. Попробуйте облегчить шину и снизить стоимость, сохранив научный и энергетический резерв.",
      en: "All constraints met. Try a lighter bus and lower cost while retaining science and energy margin.",
    });
  return {
    success,
    scienceScore,
    finalScore,
    deliveredScience: run.deliveredScience,
    costMUsd: stats.costMUsd,
    recommendations,
  };
}
function finish(run: MissionRun) {
  run.health = clamp(run.health, 0, 100);
  run.result = assessResult(run);
  run.phase = run.result.success ? "completed" : "failed";
  log(
    run,
    run.result.success
      ? "Контракт выполнен. Научные измерения получены на Земле."
      : "Контракт не выполнен. Разберите потери и перепроектируйте аппарат.",
    run.result.success
      ? "Contract complete. Scientific measurements received on Earth."
      : "Contract not met. Review losses and redesign the spacecraft.",
    run.result.success ? "success" : "error",
  );
}
function enterIncident(run: MissionRun, incident: Incident) {
  run.incident = incident;
  run.phase = "incident";
  run.crisis = null;
  if (["explosion", "power", "radiation"].includes(incident.kind))
    run.health = 0;
  if (incident.kind === "power") run.chargeWh = 0;
  log(run, incident.observation.ru, incident.observation.en, "error");
  return run;
}

export function transition(
  state: MissionRun,
  command: MissionCommand,
): MissionRun {
  if (command.type === "Restart") return createRun(state.build, state.seed);
  if (command.type === "Validate")
    return state.phase === "draft" && canLaunch(state.build)
      ? { ...state, phase: "validated" }
      : state;
  if (command.type === "Launch") {
    if (state.phase !== "validated" || !canLaunch(state.build)) return state;
    const run = createRun(state.build, command.seed);
    run.phase = "launched";
    log(
      run,
      "Зажигание. Ракета покидает стартовый стол. Проект зафиксирован.",
      "Ignition. The rocket is leaving the launch pad. Configuration is locked.",
      "success",
    );
    return run;
  }
  if (["draft", "validated", "completed", "failed"].includes(state.phase))
    return state;
  if (command.type === "SetOperations") {
    const ops = command.operations;
    if (
      state.crisis ||
      state.phase === "incident" ||
      ops.disabledInstrumentIds.some(
        (id) =>
          !selectedComponents(state.build).some(
            (c) => c.id === id && c.category === "instrument",
          ),
      )
    )
      return state;
    const run = structuredClone(state);
    run.operations = structuredClone(ops);
    log(
      run,
      `Команда борту: ${ops.target === "pole" ? "полюс" : "экватор"}; антенна ${ops.antenna === "earth" ? "Земля" : "сложена"}; приборов выключено ${ops.disabledInstrumentIds.length}; окно связи ${ops.downlinkFraction * 100}%.`,
      `Uplink: target ${ops.target}; antenna ${ops.antenna}; ${ops.disabledInstrumentIds.length} instruments off; contact ${ops.downlinkFraction * 100}%.`,
    );
    return run;
  }
  if (command.type === "Pause" || command.type === "Resume")
    return { ...state, paused: command.type === "Pause" };
  if (state.paused) return state;
  const run = structuredClone(state);
  const stats = calculate(run.build);
  const parts = selectedComponents(run.build);
  const orbit = resolveOrbit(run.build);
  if (command.type === "ChooseDecision") {
    if (!run.crisis) return state;
    if (run.build.modelVersion === 2) {
      const safe = command.choice === "safe";
      if (run.crisis === "flare") {
        const rating = sum(parts, (c) =>
          ["bus", "radiation"].includes(c.category) ? (c.protection ?? 0) : 0,
        );
        // An explicit educational hardness threshold, not a radiation dose or
        // calibrated failure probability. No random draw is used in this model.
        if (safe) {
          run.scienceFactor *= p.safeScienceFactor;
          run.elapsedHours += p.flareDelayHours;
          log(
            run,
            "Safe mode: пауза 6 h, игровой научный индекс ×0.92.",
            "Safe mode: 6 h pause; game science index ×0.92.",
            "warning",
          );
        } else if (rating < 0.35) {
          run.health -= p.flareHealthLoss;
          run.scienceFactor *= 1 - p.flareScienceLoss;
          if (run.build.advancedFlight) {
            run.solarEfficiency = 0.45;
            log(
              run,
              "Учебный сценарий: ячейки солнечных панелей повреждены. Выработка 45% исходной; последующие энергобалансы используют это значение.",
              "Educational scenario: solar cells damaged. Generation is 45% of rated usable output; subsequent power balances use this value.",
              "error",
            );
          }
          log(
            run,
            `Сценарный порог защиты не выполнен: ${rating.toFixed(2)} < 0.35. Смоделирован сбой электроники.`,
            `Scenario shielding criterion not met: ${rating.toFixed(2)} < 0.35. Simulated electronics upset.`,
            "error",
          );
        } else
          log(
            run,
            `Сценарный порог защиты выполнен: ${rating.toFixed(2)} ≥ 0.35.`,
            `Scenario shielding criterion met: ${rating.toFixed(2)} ≥ 0.35.`,
            "success",
          );
        run.flareResolved = true;
      } else {
        const off = sum(
          parts.filter(
            (c) =>
              c.category === "instrument" &&
              (run.operations.disabledInstrumentIds.includes(c.id) ||
                (c.id === "radar" && run.radarDisabled)),
          ),
          (c) => c.powerW,
        );
        const hotel =
          sum(
            parts.filter((c) => c.category === "bus"),
            (c) => c.powerW,
          ) +
          (parts.some((c) => c.category === "thermal")
            ? p.protectedHeaterW
            : p.unprotectedHeaterW);
        const load = safe
            ? hotel
            : Math.max(0, stats.shadowLoadW - off * p.shadowInstrumentDuty),
          need = load * p.extendedShadowHours,
          available = run.chargeWh;
        run.elapsedHours += p.extendedShadowHours;
        run.chargeWh = Math.max(0, available - need);
        run.eclipseResolved = true;
        if (safe) {
          run.radarDisabled = true;
          run.scienceFactor *= p.radarShutdownScienceFactor;
        }
        log(
          run,
          `Продлённая тень: ${load.toFixed(1)} W × 40 min = ${need.toFixed(1)} Wh; было ${available.toFixed(1)} Wh.`,
          `Extended eclipse: ${load.toFixed(1)} W × 40 min = ${need.toFixed(1)} Wh; available ${available.toFixed(1)} Wh.`,
          available >= need ? "info" : "error",
        );
        if (available < need) {
          run.crisis = null;
          run.health = 0;
          return enterIncident(run, {
            kind: "power",
            sourcePhase: "scienceOperations",
            triggerProgress: clamp(
              available / Math.max(need, 1e-9),
              0.02,
              0.98,
            ),
            title: {
              ru: "Энергия продлённой тени исчерпана",
              en: "Extended-eclipse energy exhausted",
            },
            observation: {
              ru: "Бортовая сеть обесточена.",
              en: "Spacecraft bus power lost.",
            },
            causes: [
              {
                code: "eclipse-energy",
                title: {
                  ru: "Недостаточный запас энергии",
                  en: "Insufficient stored energy",
                },
                actual: `${available.toFixed(1)} Wh`,
                expected: `≥ ${need.toFixed(1)} Wh`,
                explanation: {
                  ru: "Расход вычислен из выбранной нагрузки и длительности затмения; случайный исход не используется.",
                  en: "Consumption follows selected load and eclipse duration; no random failure draw is used.",
                },
              },
            ],
          });
        }
      }
      run.crisis = null;
      if (run.health <= 0) return enterIncident(run, crisisIncident(run));
      return run;
    }
    const [roll, next] = random(run.rng);
    run.rng = next;
    const safe = command.choice === "safe";
    if (run.crisis === "flare") {
      const protection =
        sum(parts, (c) =>
          ["radiation", "bus"].includes(c.category) ? (c.protection ?? 0) : 0,
        ) +
        run.build.testingBudgetMUsd * p.testReliabilityPerM;
      const risk = clamp(p.flareBaseRisk - protection);
      if (safe) {
        run.scienceFactor *= p.safeScienceFactor;
        run.elapsedHours += p.flareDelayHours;
        log(
          run,
          "Safe mode: электроника защищена; научная программа сокращена на 8%.",
          "Safe mode: electronics protected; science program reduced by 8%.",
          "warning",
        );
      } else if (roll < risk) {
        run.health -= p.flareHealthLoss;
        run.scienceFactor *= 1 - p.flareScienceLoss;
        log(
          run,
          `Вспышка повредила электронику (риск ${Math.round(risk * 100)}%). Потеря 35% эффективности науки.`,
          `Flare damaged electronics (${Math.round(risk * 100)}% risk). Science efficiency reduced by 35%.`,
          "error",
        );
      } else
        log(
          run,
          `Защита выдержала вспышку. Риск повреждения: ${Math.round(risk * 100)}%.`,
          `Shielding survived the flare. Damage risk: ${Math.round(risk * 100)}%.`,
          "success",
        );
      run.flareResolved = true;
    } else {
      run.elapsedHours += p.extendedShadowHours;
      const thermal = sum(parts, (c) =>
        c.category === "thermal" ? (c.protection ?? 0) : 0,
      );
      const extendedNeed = stats.shadowLoadW * p.extendedShadowHours;
      const reserve = clamp(
        (run.chargeWh - extendedNeed) / Math.max(1, stats.usableBatteryWh),
      );
      const risk = clamp(
        p.eclipseBaseRisk - thermal - reserve * p.eclipseReserveRiskReduction,
      );
      if (safe) {
        run.radarDisabled = true;
        run.scienceFactor *= p.radarShutdownScienceFactor;
        run.chargeWh = Math.max(
          0,
          run.chargeWh - extendedNeed * p.safeEclipseChargeFraction,
        );
        log(
          run,
          "Нагрузка сокращена. Радар отключён на оставшиеся витки, заряд сохранён.",
          "Load reduced. Radar disabled for remaining orbits; charge preserved.",
          "warning",
        );
      } else {
        run.chargeWh -= extendedNeed * p.continuedEclipseChargeFraction;
        if (roll < risk || run.chargeWh < 0) {
          run.health -= p.eclipseHealthLoss;
          run.chargeWh = Math.max(0, run.chargeWh);
          log(
            run,
            "Просадка питания в тени: повреждение бортовой системы.",
            "Eclipse power sag damaged the onboard system.",
            "error",
          );
        } else
          log(
            run,
            `Наблюдения в тени продолжены. Риск отключения: ${Math.round(risk * 100)}%.`,
            `Eclipse observations continued. Shutdown risk: ${Math.round(risk * 100)}%.`,
            "success",
          );
      }
      run.eclipseResolved = true;
    }
    run.crisis = null;
    if (run.health <= 0) return enterIncident(run, crisisIncident(run));
    return run;
  }
  if (command.type !== "Advance" || run.crisis) return state;
  if (run.phase === "incident") {
    finish(run);
    return run;
  }
  const fault = predictIncident(run);
  if (fault && run.phase !== "scienceOperations") {
    run.elapsedHours +=
      (run.phase === "launched"
        ? 0.15
        : run.phase === "cruise"
          ? p.cruiseHours
          : run.phase === "orbitInsertion"
            ? p.insertionHours
            : orbit.contactHours * mission.orbits) * fault.triggerProgress;
    if (run.phase === "orbitInsertion") run.fuelKg = 0;
    return enterIncident(run, fault);
  }
  if (run.phase === "launched") {
    run.phase = "cruise";
    run.elapsedHours += 0.15;
    run.crisis = "flare";
    log(
      run,
      "Перелёт к Луне. Обнаружена солнечная вспышка: требуется решение.",
      "Lunar cruise. Solar flare detected: a decision is required.",
      "warning",
    );
  } else if (run.phase === "cruise") {
    run.chargeWh = cruiseEnergy(run).endCharge;
    run.phase = "orbitInsertion";
    run.elapsedHours += p.cruiseHours;
    log(
      run,
      "Подлёт к Луне. Начинается тормозной манёвр.",
      "Arriving at the Moon. Capture burn begins.",
    );
  } else if (run.phase === "orbitInsertion") {
    run.elapsedHours += p.insertionHours;
    const isp = parts.find((c) => c.category === "propulsion")?.ispSeconds ?? 0;
    const consumed =
      stats.wetMassKg * (1 - Math.exp(-orbit.requiredDeltaV / (isp * p.g0)));
    run.fuelKg = Math.max(0, run.fuelKg - consumed);
    log(
      run,
      `Торможение ${run.build.modelVersion === 2 ? orbit.requiredDeltaV.toFixed(1) : orbit.requiredDeltaV} m/s. Остаток топлива ${run.fuelKg.toFixed(1)} kg.`,
      `Insertion burn ${run.build.modelVersion === 2 ? orbit.requiredDeltaV.toFixed(1) : orbit.requiredDeltaV} m/s. Propellant remaining ${run.fuelKg.toFixed(1)} kg.`,
      "success",
    );
    run.phase = "scienceOperations";
    log(
      run,
      run.build.customOrbit
        ? "Расчётная лунная орбита достигнута. Начало научной программы."
        : "Полярная орбита достигнута. Начало научной программы.",
      run.build.customOrbit
        ? "Designed lunar orbit acquired. Science program begins."
        : "Polar orbit acquired. Science program begins.",
      "success",
    );
  } else if (run.phase === "scienceOperations") {
    if (run.orbit >= mission.orbits) {
      run.phase = "downlink";
      log(
        run,
        "Научная программа завершена. Окна передачи объединены в сеанс связи.",
        "Science program complete. Contact windows combined into one downlink session.",
      );
      return run;
    }
    const active = parts.filter(
      (c) =>
        !(run.radarDisabled && c.id === "radar") &&
        !run.operations.disabledInstrumentIds.includes(c.id),
    );
    const duty = orbit.operatingHours / (orbit.sunHours + orbit.shadowHours);
    const acquisitionFraction = run.build.advancedFlight
      ? clamp((Math.min(fault?.triggerProgress ?? 1, 0.5 + duty) - 0.5) / duty)
      : (fault?.triggerProgress ?? 1);
    const produced =
      sum(active, (c) => c.dataMbps ?? 0) *
      orbit.operatingHours *
      3.6 *
      run.scienceFactor *
      acquisitionFraction;
    const science =
      sum(active, (c) => c.science ?? 0) *
      orbit.scienceFactor *
      run.scienceFactor *
      (run.operations.target === "pole" ? 1 : 0.65) *
      acquisitionFraction;
    const coveredUntil = run.build.advancedFlight
      ? Math.min(fault?.triggerProgress ?? 1, observationEndProgress(run))
      : (fault?.triggerProgress ?? 1);
    const accepted = Math.min(
      produced,
      Math.max(0, stats.memoryGbit - run.storedGbit),
    );
    const fraction = produced > 0 ? accepted / produced : 0;
    run.generatedGbit += produced;
    run.storedGbit += accepted;
    run.lostGbit += produced - accepted;
    run.storedScience += science * fraction;
    run.lostScience += science * (1 - fraction);
    if (run.build.modelVersion === 2 && accepted > 0)
      run.observedCellIds = [
        ...new Set([
          ...run.observedCellIds,
          ...observeOrbit(run, coveredUntil),
        ]),
      ];
    if (run.build.modelVersion === 2 && accepted > 0) {
      const fov = observationFootprintKm(run).fovDeg;
      if (fov > 0)
        (run.scanPasses ??= []).push({
          orbit: run.orbit,
          progress: coveredUntil,
          fovDeg: fov,
          target: run.operations.target,
        });
    }
    run.chargeWh = Math.max(0, powerCycle(run).endCharge);
    if (!fault) run.orbit++;
    run.elapsedHours +=
      (orbit.sunHours + orbit.shadowHours) * (fault?.triggerProgress ?? 1);
    run.telemetry.push({
      orbit: run.orbit + (fault ? 1 : 0),
      chargeWh: run.chargeWh,
      storedGbit: run.storedGbit,
      deliveredScience: run.deliveredScience,
    });
    if (fault) return enterIncident(run, fault);
    log(
      run,
      `Виток ${run.orbit}: ${accepted.toFixed(2)} Gbit в память, ${Math.round(run.chargeWh)} Wh заряда.`,
      `Orbit ${run.orbit}: ${accepted.toFixed(2)} Gbit stored, ${Math.round(run.chargeWh)} Wh charge.`,
      produced > accepted ? "warning" : "info",
    );
    if (run.orbit === 2 && !run.eclipseResolved) {
      run.crisis = "eclipse";
      log(
        run,
        "Продлённое затмение: выберите режим энергопотребления.",
        "Extended eclipse: choose a power strategy.",
        "warning",
      );
    }
    if (run.health <= 0) finish(run);
  } else if (run.phase === "downlink") {
    const sent = Math.min(
      run.storedGbit,
      stats.transmittableGbit *
        mission.orbits *
        run.operations.downlinkFraction *
        (run.operations.antenna === "earth" ? 1 : 0),
    );
    const fraction = run.storedGbit > 0 ? sent / run.storedGbit : 0;
    const science = run.storedScience * fraction;
    run.transmittedGbit += sent;
    run.storedGbit -= sent;
    run.deliveredScience += science;
    run.storedScience -= science;
    run.elapsedHours += orbit.contactHours * mission.orbits;
    log(
      run,
      `Земля приняла ${sent.toFixed(2)} Gbit; доставлено ${science.toFixed(1)} единиц науки.`,
      `Earth received ${sent.toFixed(2)} Gbit; ${science.toFixed(1)} science units delivered.`,
      "success",
    );
    finish(run);
  }
  return run;
}
