import type { MissionRun, Language } from "../types";
import { upcomingEvents } from "../features/playback/upcomingEvents";
import { calculate } from "../engine/calculations";
export default function EventTimeline({
  run,
  seconds,
  speed,
  language: l,
}: {
  run: MissionRun;
  seconds: number;
  speed: number;
  language: Language;
}) {
  const events = upcomingEvents(run, seconds, speed),
    ru = l === "ru";
  if (!events.length && (run.solarEfficiency ?? 1) >= 1) return null;
  return (
    <section
      className={`event-timeline ${run.incident ? "fault" : ""}`}
      aria-label={ru ? "Лента событий" : "Upcoming events"}
    >
      <div className="event-timeline-caption">
        {ru
          ? "ПЛАН ПОЛЁТА · ОБРАТНЫЙ ОТСЧЁТ ЭФИРА"
          : "FLIGHT PLAN · PLAYBACK COUNTDOWN"}
        {run.paused ? " · Ⅱ" : ""}
      </div>
      <ol>
        {events.map((event) => (
          <li key={event.id} data-event={event.id}>
            <span>{event.title[l]}</span>
            <strong>
              {Math.ceil(event.playbackSeconds)} {ru ? "с" : "s"}
            </strong>
            {event.modelSeconds !== undefined && (
              <small>
                {ru ? "модель" : "model"}:{" "}
                {(event.modelSeconds / 60).toFixed(1)} min
              </small>
            )}
          </li>
        ))}
      </ol>
      {(run.solarEfficiency ?? 1) < 1 && (
        <p className="flight-damage-status">
          {ru ? "Панели повреждены" : "Solar cells damaged"}:{" "}
          {Math.round((run.solarEfficiency ?? 1) * 100)}% ·{" "}
          {Math.round(
            calculate(run.build).sunPowerW * (run.solarEfficiency ?? 1),
          )}{" "}
          W
        </p>
      )}
    </section>
  );
}
