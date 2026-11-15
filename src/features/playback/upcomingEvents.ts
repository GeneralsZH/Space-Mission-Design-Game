import type { MissionRun, Text } from "../../types";
import {
  elementsFor,
  inLunarShadow,
  orbitalParameters,
} from "../../engine/orbital";
import { resolveOrbit } from "../../data/missionConfig";
import { flightVisuals } from "./missionPlayback";
export interface FlightEvent {
  id: string;
  title: Text;
  playbackSeconds: number;
  modelSeconds?: number;
}
export function upcomingEvents(
  run: MissionRun,
  seconds: number,
  speed: number,
): FlightEvent[] {
  if (run.crisis || run.result) return [];
  const title = (ru: string, en: string): Text => ({ ru, en });
  if (run.phase === "incident")
    return [
      {
        id: "debrief",
        title: title("Разбор после записи", "Debrief after recording"),
        playbackSeconds: Math.max(0, 8 - seconds) / speed,
      },
    ];
  const profile = resolveOrbit(run.build),
    elements = elementsFor(run.build),
    period = orbitalParameters(elements).periodSeconds;
  let duration: number =
    flightVisuals.durations[
      run.phase as keyof typeof flightVisuals.durations
    ] ?? 0;
  let events: { id: string; at: number; title: Text }[] = [];
  if (run.phase === "launched")
    events = [
      {
        id: "separation",
        at: 0.68,
        title: title("Отделение аппарата", "Spacecraft separation"),
      },
      {
        id: "transfer",
        at: 1,
        title: title("Перелёт к Луне", "Lunar transfer"),
      },
    ];
  if (run.phase === "cruise")
    events = [
      {
        id: "arrival",
        at: 1,
        title: title("Подлёт и захват", "Arrival & capture"),
      },
    ];
  if (run.phase === "orbitInsertion")
    events = [
      {
        id: "science",
        at: 1,
        title: title("Начало съёмки", "Science operations"),
      },
    ];
  if (run.phase === "downlink")
    events = [
      {
        id: "contact",
        at: 0.22,
        title: title("Захват сигнала", "Signal acquisition"),
      },
      {
        id: "return",
        at: 1,
        title: title("Завершение передачи", "Downlink complete"),
      },
    ];
  if (run.phase === "scienceOperations") {
    duration =
      run.orbit >= 4
        ? 2
        : 10 *
          (run.build.modelVersion === 2
            ? period /
              orbitalParameters(
                elementsFor({ orbitId: "low-polar", modelVersion: 2 }),
              ).periodSeconds
            : 1);
    if (run.orbit < 4) {
      const duty =
        profile.operatingHours / (profile.sunHours + profile.shadowHours);
      events.push({
        id: "scan-start",
        at: 0.5,
        title: title("Окно съёмки", "Observation window"),
      });
      if (run.build.advancedFlight) {
        let before = inLunarShadow(elements, 0);
        for (let i = 1; i <= 512; i++) {
          const dark = inLunarShadow(elements, i / 512);
          if (dark !== before)
            events.push({
              id: dark ? "shadow-in" : "shadow-out",
              at: i / 512,
              title: dark
                ? title("Вход в тень", "Eclipse entry")
                : title("Выход из тени", "Eclipse exit"),
            });
          before = dark;
        }
      } else if (profile.shadowHours > 0)
        events.push({
          id: "shadow-in",
          at: profile.sunHours / (profile.sunHours + profile.shadowHours),
          title: title("Вход в тень", "Eclipse entry"),
        });
      if (0.5 + duty < 1)
        events.push({
          id: "scan-end",
          at: 0.5 + duty,
          title: title("Конец съёмки", "Observation ends"),
        });
    }
    events.push({
      id: "orbit-end",
      at: 1,
      title:
        run.orbit < 3
          ? title("Следующий виток", "Next orbit")
          : title("Готовность к передаче", "Ready for downlink"),
    });
  }
  return events
    .filter((e) => e.at * duration >= seconds - 0.01)
    .sort((a, b) => a.at - b.at)
    .slice(0, 3)
    .map((e) => ({
      id: e.id,
      title: e.title,
      playbackSeconds: Math.max(0, e.at * duration - seconds) / speed,
      ...(run.phase === "scienceOperations" && run.orbit < 4
        ? { modelSeconds: Math.max(0, e.at - seconds / duration) * period }
        : {}),
    }));
}
