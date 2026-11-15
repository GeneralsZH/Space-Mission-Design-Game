import { solarBodies, solarBody, solarPosition } from "../data/solarSystem";
import { useMemo } from "react";
import { flightModelDays } from "../features/playback/flightEnvironment";
import type { Language, MissionRun } from "../types";
/** Live navigation inset, intentionally schematic and driven by flight time. */
export default function FlightSystemMap({
  run,
  progress,
  language: l,
  panorama,
  onToggle,
}: {
  run: MissionRun;
  progress: number;
  language: Language;
  panorama: boolean;
  onToggle: () => void;
}) {
  const days = flightModelDays(run, progress),
    earth = solarPosition(solarBody("earth"), days);
  const curves = useMemo(
    () =>
      solarBodies
        .filter((b) => b.kind === "planet")
        .map((body) => ({
          body,
          points: Array.from({ length: 65 }, (_, i) => {
            const p = solarPosition(
              body,
              (i / 64) * body.periodYears! * 365.25,
            );
            return [130 + p[0] * 3.8, 68 + p[2] * 1.55 - p[1] * 1.55].join(",");
          }).join(" "),
        })),
    [],
  );
  const project = (p: number[]) => [
    130 + p[0] * 3.8,
    68 + p[2] * 1.55 - p[1] * 1.55,
  ];
  const ep = project(earth);
  return (
    <button
      className="flight-system-map"
      aria-label={
        l === "ru"
          ? panorama
            ? "Вернуться к ракете"
            : "Солнечная система в полёте"
          : panorama
            ? "Return to spacecraft"
            : "Solar system during flight"
      }
      onClick={onToggle}
    >
      <span className="flight-system-caption">
        <span className="signal-dot" />{" "}
        {l === "ru" ? "СИСТЕМА · ПРЯМОЙ ЭФИР" : "SOLAR SYSTEM · LIVE"}
        <span>↗</span>
      </span>
      <svg viewBox="0 0 260 134" aria-hidden="true">
        <circle cx="130" cy="68" r="5" fill="#ffdc94" />
        {curves.map(({ body, points }) => {
          const p = project(solarPosition(body, days));
          return (
            <g key={body.id}>
              <polyline
                points={points}
                fill="none"
                stroke={body.color}
                opacity=".22"
                strokeWidth=".5"
              />
              <circle
                cx={p[0]}
                cy={p[1]}
                r={body.id === "earth" ? 2.5 : body.visualRadius * 2.4}
                fill={body.color}
              />
            </g>
          );
        })}
        <circle
          cx={ep[0]}
          cy={ep[1]}
          r="6"
          fill="none"
          stroke="#67f2e4"
          strokeWidth=".9"
        />
        <text x={ep[0] + 8} y={ep[1] - 5} fill="#8ef4e9" fontSize="7">
          LIM-01
        </text>
      </svg>
      <span className="flight-system-foot">
        {panorama
          ? l === "ru"
            ? "Вернуть крупный план ракеты"
            : "Return to spacecraft close-up"
          : l === "ru"
            ? "Общий вид без остановки полёта"
            : "Wide view · flight keeps running"}
      </span>
    </button>
  );
}
