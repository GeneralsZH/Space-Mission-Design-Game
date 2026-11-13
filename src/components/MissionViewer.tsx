import { lazy, Suspense, useCallback, useEffect, useId, useState } from "react";
import type { RefObject } from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Globe2,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import type { Language, MissionRun } from "../types";
import type { CameraCommand, CameraAction } from "./SpacecraftView";
import { useMissionStore } from "../store/useMissionStore";
import {
  sampleMission,
  transferPosition,
} from "../features/playback/missionPlayback";
import type {
  CameraMode,
  PlaybackFrame,
} from "../features/playback/missionPlayback";
import SceneBoundary from "./SceneBoundary";
const Scene = lazy(() => import("./MissionScene"));

function RouteMap({
  run,
  progress,
  compact = false,
  onReady,
}: {
  run: MissionRun;
  progress: number;
  compact?: boolean;
  onReady?: (ready: boolean) => void;
}) {
  const l = useMissionStore((s) => s.settings.language);
  const id = useId().replace(/:/g, "");
  const pose = sampleMission(run, progress);
  const x = (n: number) => 80 + ((n + 15.1) / 31.2) * 560;
  const y = (n: number) => 230 - n * 15;
  const route = Array.from({ length: 40 }, (_, i) => {
    const point = transferPosition(run, i / 39);
    return `${x(point[0])},${y(point[1])}`;
  }).join(" ");
  useEffect(() => {
    onReady?.(true);
  }, [onReady]);
  return (
    <div className={`mission-map ${compact ? "compact" : ""}`}>
      <svg
        viewBox="0 0 720 295"
        role="img"
        aria-label={
          l === "ru"
            ? "Маршрут миссии: Земля, Луна и положение аппарата"
            : "Mission route: Earth, Moon and spacecraft position"
        }
      >
        <defs>
          <radialGradient id={`${id}earth`}>
            <stop stopColor="#459bb6" />
            <stop offset="1" stopColor="#12496e" />
          </radialGradient>
          <radialGradient id={`${id}moon`}>
            <stop stopColor="#c7caca" />
            <stop offset="1" stopColor="#667786" />
          </radialGradient>
        </defs>
        <polyline
          points={route}
          fill="none"
          stroke="#3a889b"
          strokeWidth="2"
          strokeDasharray="5 7"
        />
        <ellipse
          cx={x(12)}
          cy={y(1)}
          rx="49"
          ry="38"
          fill="none"
          stroke="#687b9a"
          strokeDasharray="3 4"
        />
        <circle cx={x(-12)} cy={y(0)} r="45" fill={`url(#${id}earth)`} />
        <path
          d={`M${x(-12) - 24} ${y(0) - 18}l20 -10 16 16 -5 18 -22 11 -12 -20`}
          fill="#8ab190"
          opacity="0.7"
        />
        <circle cx={x(12)} cy={y(1)} r="21" fill={`url(#${id}moon)`} />
        {pose.link && (
          <line
            x1={x(pose.position[0])}
            y1={y(pose.position[1])}
            x2={x(-12) + 45}
            y2={y(0)}
            stroke="#75e8aa"
            strokeWidth="2"
          />
        )}
        {pose.scan && (
          <path
            d={`M${x(pose.position[0])} ${y(pose.position[1])}L${x(12) - 8} ${y(1)}L${x(12) + 8} ${y(1)}Z`}
            fill={pose.radar ? "#bb90f75c" : "#43d7e75c"}
          />
        )}
        <g
          transform={`translate(${x(pose.position[0])} ${y(pose.position[1])})`}
        >
          {run.incident?.kind === "explosion" ? (
            <g data-testid="explosion-2d">
              <circle
                r={10 + progress * 30}
                fill="#ff9b37"
                opacity={0.8 - progress * 0.5}
              />
              {Array.from({ length: 12 }, (_, i) => (
                <path
                  key={i}
                  d={`M${Math.cos(i) * progress * 45} ${Math.sin(i) * progress * 30}l6 3`}
                  stroke="#ffdd8c"
                  strokeWidth="3"
                />
              ))}
            </g>
          ) : (
            <>
              <circle r="12" fill={run.incident ? "#ff704033" : "#31d6e51a"} />
              <rect x="-5" y="-5" width="10" height="10" fill="#f3e6a1" />
              <path
                d="M-17 -5h9v10h-9zM8 -5h9v10H8z"
                fill="#51b6d9"
                stroke="#9ceef1"
                strokeWidth="0.7"
              />
            </>
          )}
          <text
            x="0"
            y="-18"
            textAnchor="middle"
            fill="#8deaf0"
            fontSize="12"
            fontFamily="monospace"
          >
            LIM-01
          </text>
        </g>
        <g fill="#8faebf" fontSize="12" fontFamily="monospace">
          <text x={x(-12)} y="292" textAnchor="middle">
            {l === "ru" ? "ЗЕМЛЯ" : "EARTH"}
          </text>
          <text x={x(12)} y="267" textAnchor="middle">
            {l === "ru" ? "ЛУНА" : "MOON"}
          </text>
          <text x="280" y="275">
            {l === "ru"
              ? "ЗЕМЛЯ → ЛУНА → ДАННЫЕ НА ЗЕМЛЮ"
              : "EARTH → MOON → DATA TO EARTH"}
          </text>
        </g>
      </svg>
    </div>
  );
}

export default function MissionViewer({
  run,
  language: l,
  clock,
  frame,
  motionEnabled,
  onReady,
}: {
  run: MissionRun;
  language: Language;
  clock: RefObject<PlaybackFrame>;
  frame: PlaybackFrame;
  motionEnabled: boolean;
  onReady: (ready: boolean) => void;
}) {
  const graphics = useMissionStore((s) => s.settings.graphics);
  const speed = useMissionStore((s) => s.settings.playbackSpeed);
  const configure = useMissionStore((s) => s.configure);
  const [failed, setFailed] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>("follow");
  const [command, setCommand] = useState<CameraCommand>({
    id: 0,
    action: "reset",
  });
  const supported = "WebGL2RenderingContext" in window;
  const show3d = supported && !failed && graphics === "3d";
  const visualProgress = motionEnabled ? frame.progress : 0;
  const pose = sampleMission(run, frame.progress);
  const fail = useCallback(() => {
    setFailed(true);
    onReady(false);
  }, [onReady]);
  const move = (action: CameraAction) => {
    setCameraMode(action === "reset" ? "follow" : "free");
    setCommand((value) => ({ id: value.id + 1, action }));
  };
  const fallback = (
    <RouteMap run={run} progress={visualProgress} onReady={onReady} />
  );
  return (
    <div
      className="live-mission-view"
      data-phase={run.phase}
      data-orbit={run.orbit}
    >
      <div className="scene-toolbar">
        <div
          className="scene-mode"
          role="group"
          aria-label={l === "ru" ? "Режим изображения" : "View mode"}
        >
          <button
            disabled={!supported}
            aria-pressed={show3d}
            onClick={() => {
              if (show3d) return;
              onReady(false);
              setFailed(false);
              configure({ graphics: "3d" });
            }}
          >
            <Box size={13} />
            3D
          </button>
          <button
            aria-pressed={!show3d}
            onClick={() => {
              onReady(true);
              configure({ graphics: "schematic" });
            }}
          >
            2D
          </button>
        </div>
        <div className="mission-camera-modes">
          <button
            className="scene-tool"
            aria-pressed={cameraMode === "follow"}
            onClick={() => setCameraMode("follow")}
          >
            <Crosshair size={13} />
            {l === "ru" ? "Сопровождение" : "Follow"}
          </button>
          <button
            className="scene-tool"
            aria-pressed={cameraMode === "overview"}
            onClick={() => setCameraMode("overview")}
          >
            <Globe2 size={13} />
            {l === "ru" ? "Весь маршрут" : "Full route"}
          </button>
        </div>
      </div>
      {graphics === "3d" && !show3d && (
        <p className="scene-fallback" role="status">
          {l === "ru"
            ? "3D недоступен. Маршрут и полёт показаны в 2D."
            : "3D unavailable. Route and flight are shown in 2D."}
        </p>
      )}
      {show3d ? (
        <div
          className="scene-stage mission-stage"
          role="region"
          aria-label={
            run.phase === "launched"
              ? l === "ru"
                ? "3D-запуск ракеты"
                : "3D rocket launch"
              : l === "ru"
                ? "3D-полёт миссии"
                : "3D mission flight"
          }
          tabIndex={0}
          onKeyDown={(event) => {
            const action = (
              {
                ArrowLeft: "left",
                ArrowRight: "right",
                ArrowUp: "up",
                ArrowDown: "down",
                "+": "zoomIn",
                "=": "zoomIn",
                "-": "zoomOut",
                Home: "reset",
              } as Record<string, CameraAction>
            )[event.key];
            if (action) {
              event.preventDefault();
              move(action);
            }
          }}
        >
          <SceneBoundary fallback={fallback} onError={fail}>
            <Suspense
              fallback={
                <div className="scene-loading">
                  <Box size={25} />
                  {l === "ru"
                    ? "Подготовка прямого эфира…"
                    : "Preparing live playback…"}
                </div>
              }
            >
              <Scene
                run={run}
                clock={clock}
                motionEnabled={motionEnabled}
                cameraMode={cameraMode}
                onCameraMode={setCameraMode}
                command={command}
                onReady={onReady}
                onContextLost={fail}
                speed={speed}
              />
            </Suspense>
          </SceneBoundary>
          <div className="mission-world-legend">
            <span>● {l === "ru" ? "Земля" : "Earth"}</span>
            <span>● {l === "ru" ? "Луна" : "Moon"}</span>
            <span className="mono">LIM-01</span>
          </div>
          {run.crisis && (
            <div className="mission-crisis-overlay" aria-live="polite">
              <span>
                {l === "ru"
                  ? "Эфир остановлен: требуется ваше решение"
                  : "Playback is waiting for your decision"}
              </span>
              <button
                className="scene-tool"
                onClick={() =>
                  document.getElementById("mission-decision")?.scrollIntoView({
                    behavior: motionEnabled ? "smooth" : "instant",
                    block: "center",
                  })
                }
              >
                {l === "ru" ? "Выбрать действие ↓" : "Choose an action ↓"}
              </button>
            </div>
          )}
        </div>
      ) : (
        fallback
      )}
      {show3d && (
        <div
          className="camera-controls"
          role="group"
          aria-label={l === "ru" ? "Управление камерой" : "Camera controls"}
        >
          {(
            [
              {
                action: "left",
                icon: ChevronLeft,
                ru: "Повернуть влево",
                en: "Rotate left",
              },
              {
                action: "right",
                icon: ChevronRight,
                ru: "Повернуть вправо",
                en: "Rotate right",
              },
              { action: "zoomIn", icon: Plus, ru: "Приблизить", en: "Zoom in" },
              {
                action: "zoomOut",
                icon: Minus,
                ru: "Отдалить",
                en: "Zoom out",
              },
              {
                action: "reset",
                icon: Maximize2,
                ru: "Сбросить камеру",
                en: "Reset camera",
              },
            ] as const
          ).map((item) => (
            <button
              key={item.action}
              className="scene-tool"
              aria-label={l === "ru" ? item.ru : item.en}
              onClick={() => move(item.action)}
            >
              <item.icon size={14} />
            </button>
          ))}
          <span>
            {l === "ru"
              ? "Перетаскивание — свободная камера · колесо — масштаб"
              : "Drag for free camera · scroll to zoom"}
          </span>
        </div>
      )}
      <div className="mission-action">
        <span className="signal-dot" />
        <div>
          <strong>{pose.action[l]}</strong>
          <p>{pose.detail[l]}</p>
        </div>
      </div>
      {run.phase === "launched" && (
        <p className="launch-caption mono">LIFTOFF — LIM-01</p>
      )}
      {show3d && <RouteMap run={run} progress={visualProgress} compact />}
      <p className="mission-scale-note">
        {l === "ru"
          ? "Учебная визуализация · масштаб и время сжаты"
          : "Educational visualization · compressed scale and time"}
      </p>
    </div>
  );
}
