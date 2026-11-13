import { lazy, Suspense, useState } from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Layers3,
  Maximize2,
  Minus,
  Pause,
  Plus,
  RotateCcw,
  RotateCw,
  Rocket,
} from "lucide-react";
import type { Build, Language } from "../types";
import { catalog, launchers } from "../data/missionConfig";
import { useMissionStore } from "../store/useMissionStore";
import Satellite from "./Satellite";
import SceneBoundary from "./SceneBoundary";

const Scene = lazy(() => import("./SpacecraftScene"));
export type CameraAction =
  "left" | "right" | "up" | "down" | "zoomIn" | "zoomOut" | "reset";
export interface CameraCommand {
  id: number;
  action: CameraAction;
}

function supportsWebGL2(): boolean {
  // A temporary GPU probe can stall software drivers even in SVG mode.
  // Renderer creation failures are handled by SceneBoundary instead.
  return typeof window !== "undefined" && "WebGL2RenderingContext" in window;
}

export default function SpacecraftView({
  build,
  language: l,
  paused = false,
  variant = "spacecraft",
}: {
  build: Build;
  language: Language;
  paused?: boolean;
  variant?: "spacecraft" | "launch";
}) {
  const settings = useMissionStore((s) => s.settings);
  const configure = useMissionStore((s) => s.configure);
  const [supported] = useState(supportsWebGL2);
  const [failed, setFailed] = useState(false);
  const [exploded, setExploded] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [command, setCommand] = useState<CameraCommand>({
    id: 0,
    action: "reset",
  });
  const [systemReducedMotion] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const reducedMotion =
    settings.motionPreference === "system"
      ? settings.reducedMotion || systemReducedMotion
      : settings.motionPreference === "off";
  const show3d = settings.graphics === "3d" && supported && !failed;
  const launching = variant === "launch";
  const launcher =
    launchers.find((item) => item.id === build.launcherId) ?? launchers[0];
  const selected =
    selectedId && build.moduleIds.includes(selectedId)
      ? catalog.find((c) => c.id === selectedId)
      : null;
  const camera = (action: CameraAction) =>
    setCommand((previous) => ({ id: previous.id + 1, action }));
  const fallback = launching ? (
    <div className="launch-scene launch-fallback" data-paused={paused}>
      <div className="launch-track" />
      <Rocket size={100} strokeWidth={1} />
      <span className="launch-plume" />
    </div>
  ) : (
    <Satellite
      build={build}
      language={l}
      minimal={settings.graphics === "minimal"}
    />
  );
  return (
    <div
      className={`spacecraft-view ${launching ? "launch-view" : ""}`}
      data-view={show3d ? "3d" : "2d"}
    >
      <div className="scene-toolbar">
        <div
          className="scene-mode"
          role="group"
          aria-label={l === "ru" ? "Вид аппарата" : "Spacecraft view"}
        >
          <button
            aria-pressed={show3d}
            disabled={!supported}
            title={
              !supported
                ? l === "ru"
                  ? "WebGL 2 недоступен"
                  : "WebGL 2 unavailable"
                : undefined
            }
            onClick={() => {
              setFailed(false);
              configure({ graphics: "3d" });
            }}
          >
            <Box size={13} />
            3D
          </button>
          <button
            aria-pressed={!show3d}
            onClick={() =>
              configure({
                graphics:
                  settings.graphics === "minimal" ? "minimal" : "schematic",
              })
            }
          >
            2D
          </button>
        </div>
        {show3d && (
          <div className="scene-tools">
            {!launching && (
              <button
                className="scene-tool"
                aria-pressed={exploded}
                onClick={() => setExploded(!exploded)}
              >
                <Layers3 size={13} />
                {l === "ru" ? "Детали" : "Explode"}
              </button>
            )}
            <button
              className="scene-tool icon-only"
              aria-label={l === "ru" ? "Автовращение" : "Auto rotate"}
              aria-pressed={rotating && !reducedMotion && !paused}
              disabled={reducedMotion || paused}
              onClick={() => setRotating(!rotating)}
            >
              {rotating && !reducedMotion && !paused ? (
                <Pause size={13} />
              ) : (
                <RotateCw size={13} />
              )}
            </button>
          </div>
        )}
      </div>
      {settings.graphics === "3d" && (!supported || failed) && (
        <p className="scene-fallback" role="status">
          {l === "ru"
            ? "3D недоступен. Показана рабочая 2D-схема."
            : "3D unavailable. Showing the working 2D schematic."}
        </p>
      )}
      {show3d ? (
        <>
          <div
            className={`scene-stage ${launching ? "launch-stage" : ""}`}
            role="region"
            aria-label={
              launching
                ? l === "ru"
                  ? "3D-запуск ракеты"
                  : "3D rocket launch"
                : l === "ru"
                  ? "Интерактивная 3D-модель аппарата"
                  : "Interactive 3D spacecraft"
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
                camera(action);
              }
            }}
          >
            <SceneBoundary onError={() => setFailed(true)} fallback={fallback}>
              <Suspense
                fallback={
                  <div className="scene-loading">
                    <Box size={28} />
                    <span>
                      {l === "ru"
                        ? "Подготовка 3D-сцены…"
                        : "Preparing 3D scene…"}
                    </span>
                  </div>
                }
              >
                <Scene
                  build={build}
                  exploded={exploded}
                  autoRotate={rotating && !reducedMotion && !paused}
                  command={command}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onContextLost={() => setFailed(true)}
                  variant={variant}
                  animateLaunch={launching && !paused && !reducedMotion}
                />
              </Suspense>
            </SceneBoundary>
          </div>
          <div
            className="camera-controls"
            role="group"
            aria-label={l === "ru" ? "Управление камерой" : "Camera controls"}
          >
            {(
              [
                {
                  action: "left",
                  ru: "Повернуть влево",
                  en: "Rotate left",
                  icon: ChevronLeft,
                },
                {
                  action: "right",
                  ru: "Повернуть вправо",
                  en: "Rotate right",
                  icon: ChevronRight,
                },
                {
                  action: "zoomIn",
                  ru: "Приблизить",
                  en: "Zoom in",
                  icon: Plus,
                },
                {
                  action: "zoomOut",
                  ru: "Отдалить",
                  en: "Zoom out",
                  icon: Minus,
                },
                {
                  action: "reset",
                  ru: "Сбросить камеру",
                  en: "Reset camera",
                  icon: Maximize2,
                },
              ] as const
            ).map((item) => (
              <button
                className="scene-tool"
                key={item.action}
                aria-label={l === "ru" ? item.ru : item.en}
                title={l === "ru" ? item.ru : item.en}
                onClick={() => camera(item.action)}
              >
                <item.icon size={14} />
              </button>
            ))}
            <span>
              {l === "ru"
                ? "Тяните для вращения · колесо для масштаба"
                : "Drag to orbit · scroll to zoom"}
            </span>
          </div>
          {!launching && (
            <div className="scene-selection" aria-live="polite">
              {selected ? (
                <>
                  <span className="signal-dot" />
                  <strong>{selected.name[l]}</strong>
                  <span>
                    {selected.massKg} kg · {selected.powerW} W ·{" "}
                    {selected.costMUsd} M$
                  </span>
                  <button
                    className="scene-tool"
                    aria-label={
                      l === "ru" ? "Снять выделение" : "Clear selection"
                    }
                    onClick={() => setSelectedId(null)}
                  >
                    <RotateCcw size={11} />
                  </button>
                </>
              ) : (
                <span>
                  {l === "ru"
                    ? "Нажмите на модуль, чтобы посмотреть его характеристики"
                    : "Select a module to inspect its specifications"}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        fallback
      )}
      {launching && (
        <div className="launch-caption">
          <span className="mono">LIFTOFF — LIM-01</span>
          <span>{launcher.name[l]}</span>
        </div>
      )}
    </div>
  );
}
