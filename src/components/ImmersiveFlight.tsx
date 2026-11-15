import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  X,
} from "lucide-react";
import type { MissionCommand, MissionRun } from "../types";
import { useMissionStore } from "../store/useMissionStore";
import { calculate } from "../engine/calculations";
import { displayTelemetry } from "../features/playback/missionPlayback";
import type { PlaybackFrame } from "../features/playback/missionPlayback";
import { phaseNames, t } from "../i18n";
import { fmt } from "./format";
import MissionViewer from "./MissionViewer";
import FlightDecisions from "./FlightDecisions";
import OperationsPanel from "./OperationsPanel";
import PostFlightDiagnostics from "./PostFlightDiagnostics";
import { Row } from "./common";
import EventTimeline from "./EventTimeline";

type Drawer = "actions" | "systems" | "log" | "result";
interface Props {
  run: MissionRun;
  clock: RefObject<PlaybackFrame>;
  frame: PlaybackFrame;
  telemetry: ReturnType<typeof displayTelemetry>;
  motionEnabled: boolean;
  onReady: (ready: boolean) => void;
  onPlay: () => void;
  onCommand: (command: MissionCommand) => void;
  onClose: () => void;
}
export default function ImmersiveFlight({
  run,
  clock,
  frame,
  telemetry,
  motionEnabled,
  onReady,
  onPlay,
  onCommand,
  onClose,
}: Props) {
  const s = useMissionStore(),
    l = s.settings.language,
    ru = l === "ru";
  const root = useRef<HTMLDivElement>(null);
  const balance = useMemo(() => calculate(run.build), [run.build]);
  const [drawer, setDrawer] = useState<Drawer | null>(null),
    [acknowledged, setAcknowledged] = useState("");
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const eventKey = run.crisis
    ? `${run.crisis}:${run.orbit}`
    : run.result
      ? "result"
      : "";
  const activeDrawer =
    eventKey && acknowledged !== eventKey
      ? run.crisis
        ? "actions"
        : "result"
      : drawer;
  const closeDrawer = () => {
    setDrawer(null);
    setAcknowledged(eventKey);
    root.current?.focus({ preventScroll: true });
  };
  const openDrawer = (next: Drawer) => {
    setAcknowledged(eventKey);
    setDrawer(activeDrawer === next ? null : next);
  };
  const act = (command: MissionCommand) => {
    onCommand(command);
    if (command.type !== "SetOperations") {
      closeDrawer();
      root.current?.focus({ preventScroll: true });
    }
  };
  const leave = () => {
    if (document.fullscreenElement === root.current)
      void document.exitFullscreen().catch(() => {});
    onClose();
  };
  useEffect(() => {
    const overflow = document.body.style.overflow,
      app = document.querySelector<HTMLElement>(".app-shell"),
      wasInert = app?.inert ?? false;
    document.body.style.overflow = "hidden";
    if (app) app.inert = true;
    root.current?.focus({ preventScroll: true });
    const fullscreenChanged = () =>
      setNativeFullscreen(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", fullscreenChanged);
    return () => {
      document.body.style.overflow = overflow;
      if (app) app.inert = wasInert;
      document.removeEventListener("fullscreenchange", fullscreenChanged);
    };
  }, []);
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (activeDrawer) closeDrawer();
      else leave();
    }
    if (event.key !== "Tab") return;
    const elements = Array.from(
      root.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),select:not(:disabled),input:not(:disabled),a[href],[tabindex="0"]',
      ) ?? [],
    ).filter((el) => el.getClientRects().length > 0);
    const first = elements[0],
      last = elements.at(-1);
    if (
      event.shiftKey &&
      (document.activeElement === first ||
        document.activeElement === root.current)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };
  const advanceLabel =
    run.phase === "scienceOperations" && run.orbit < 4
      ? t(l, "orbitStep")
      : run.phase === "launched"
        ? ru
          ? "Пропустить взлёт"
          : "Skip animation"
        : run.phase === "incident"
          ? ru
            ? "Показать причины"
            : "Show causes"
          : t(l, "advance");
  const togglePause = () => {
    if (run.paused) s.configure({ motionPreference: "on" });
    onCommand({ type: run.paused ? "Resume" : "Pause" });
  };
  const titles: Record<Drawer, string> = {
    actions: ru ? "Действия" : "Actions",
    systems: ru ? "Бортовые системы" : "Onboard systems",
    log: ru ? "Бортовой журнал" : "Flight log",
    result: ru ? "Результат полёта" : "Flight result",
  };
  return createPortal(
    <div
      ref={root}
      className="immersive-flight"
      role="dialog"
      aria-modal="true"
      aria-label={ru ? "Полноэкранный полёт" : "Fullscreen flight"}
      data-panel={activeDrawer ?? "none"}
      tabIndex={-1}
      onKeyDown={keyboard}
    >
      <MissionViewer
        run={run}
        language={l}
        clock={clock}
        frame={frame}
        motionEnabled={motionEnabled}
        onReady={onReady}
        onPlay={onPlay}
        immersive
        onChooseAction={() => {
          setAcknowledged(eventKey);
          setDrawer("actions");
        }}
      />
      <header className="immersive-header">
        <div>
          <p className="eyebrow">LIM-01 / LIVE FLIGHT</p>
          <h1>{phaseNames[run.phase][l]}</h1>
          <span className="mono tiny">
            T+ {fmt(run.elapsedHours)} h · {ru ? "Виток" : "Orbit"}{" "}
            {Math.min(run.orbit, 4)} / 4
          </span>
        </div>
        <div className="button-row">
          {document.fullscreenEnabled && (
            <button
              className="scene-tool"
              aria-label={
                nativeFullscreen
                  ? ru
                    ? "Вернуть окно браузера"
                    : "Exit browser fullscreen"
                  : ru
                    ? "Развернуть браузер"
                    : "Enter browser fullscreen"
              }
              onClick={() => {
                if (document.fullscreenElement)
                  void document.exitFullscreen().catch(() => {});
                else void root.current?.requestFullscreen?.().catch(() => {});
              }}
            >
              {nativeFullscreen ? (
                <Minimize2 size={18} />
              ) : (
                <Maximize2 size={18} />
              )}
            </button>
          )}
          <button className="button outlined" onClick={leave}>
            <ArrowLeft size={15} />
            {ru ? "К панели" : "Back to dashboard"}
          </button>
        </div>
      </header>
      <div
        className="immersive-metrics"
        aria-label={ru ? "Основные показатели" : "Flight essentials"}
      >
        {[
          [ru ? "Состояние" : "Health", `${run.health}%`],
          [ru ? "Заряд" : "Battery", `${fmt(telemetry.chargeWh, 0)} Wh`],
          [ru ? "Топливо" : "Fuel", `${fmt(telemetry.fuelKg, 1)} kg`],
          [
            ru ? "Передано" : "Downlink",
            `${fmt(telemetry.transmittedGbit, 1)} Gbit`,
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <small>{label}</small>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <EventTimeline
        run={run}
        seconds={frame.seconds}
        speed={s.settings.playbackSpeed}
        language={l}
      />
      {activeDrawer && (
        <aside
          className="immersive-drawer"
          role="region"
          aria-label={titles[activeDrawer]}
        >
          <div className="immersive-drawer-heading">
            <h2>{titles[activeDrawer]}</h2>
            <button
              className="scene-tool"
              aria-label={ru ? "Закрыть панель" : "Close flight panel"}
              onClick={closeDrawer}
            >
              <X size={18} />
            </button>
          </div>
          {activeDrawer === "actions" && (
            <>
              <FlightDecisions run={run} language={l} onCommand={act} />
              {!run.crisis && <OperationsPanel onCommand={act} />}
            </>
          )}
          {activeDrawer === "systems" && (
            <>
              <Row label={t(l, "health")} value={`${run.health}%`} />
              <Row
                label={t(l, "charge")}
                value={`${fmt(telemetry.chargeWh)} / ${fmt(balance.usableBatteryWh)} Wh`}
              />
              <Row
                label={t(l, "stored")}
                value={`${fmt(telemetry.storedGbit, 2)} / ${balance.memoryGbit} Gbit`}
              />
              <Row
                label={t(l, "transmitted")}
                value={`${fmt(telemetry.transmittedGbit, 2)} Gbit`}
              />
              <Row
                label={t(l, "delivered")}
                value={`${fmt(telemetry.deliveredScience)} / 120`}
              />
              <Row label={t(l, "fuel")} value={`${fmt(telemetry.fuelKg)} kg`} />
              <Row
                label={ru ? "Солнечная выработка" : "Solar generation"}
                value={`${fmt(balance.sunPowerW * (run.solarEfficiency ?? 1))} W (${Math.round((run.solarEfficiency ?? 1) * 100)}%)`}
              />
            </>
          )}
          {activeDrawer === "log" && (
            <ol className="immersive-log">
              {run.logs
                .slice()
                .reverse()
                .map((entry, i) => (
                  <li key={i} className={entry.kind}>
                    <small className="mono">T+ {fmt(entry.hours)} h</small>
                    <p>{entry.message[l]}</p>
                  </li>
                ))}
            </ol>
          )}
          {activeDrawer === "result" && (
            <>
              <h3>{t(l, run.result?.success ? "success" : "failed")}</h3>
              <Row
                label={t(l, "delivered")}
                value={`${fmt(run.deliveredScience)} / 120`}
              />
              <PostFlightDiagnostics run={run} language={l} />
              <button
                className="button primary full"
                aria-label={t(l, "report")}
                onClick={() => s.navigate("report")}
              >
                {t(l, "report")} →
              </button>
            </>
          )}
        </aside>
      )}
      <footer className="immersive-controls">
        <div className="immersive-transport">
          {!run.result && (
            <button
              className="scene-tool immersive-mode"
              aria-label={ru ? "Запустить заново" : "Restart flight"}
              title={ru ? "Запустить заново" : "Restart flight"}
              onClick={s.replayFlight}
            >
              <RotateCcw size={16} />
            </button>
          )}
          {!run.result && (
            <button
              className="button outlined"
              aria-label={t(l, run.paused ? "resume" : "pause")}
              onClick={togglePause}
            >
              {run.paused ? <Play size={16} /> : <Pause size={16} />}
              <span>{t(l, run.paused ? "resume" : "pause")}</span>
            </button>
          )}
          {run.result ? (
            <button className="button primary" onClick={s.replayFlight}>
              <RotateCcw size={16} />
              {ru ? "Смотреть заново" : "Watch again"}
            </button>
          ) : (
            <button
              className="button primary"
              disabled={run.paused || !!run.crisis}
              onClick={() => act({ type: "Advance" })}
            >
              <Play size={15} />
              {advanceLabel}
            </button>
          )}
          <label className="immersive-speed">
            <span>{ru ? "Скорость" : "Speed"}</span>
            <select
              aria-label={ru ? "Скорость эфира" : "Playback speed"}
              value={s.settings.playbackSpeed}
              onChange={(e) =>
                s.configure({
                  playbackSpeed: Number(e.target.value) as 1 | 2 | 4 | 8,
                })
              }
            >
              {[1, 2, 4, 8].map((n) => (
                <option key={n} value={n}>
                  ×{n}
                </option>
              ))}
            </select>
          </label>
          <button
            className="scene-tool immersive-mode"
            aria-pressed={s.settings.playback === "live"}
            onClick={() => {
              const live = s.settings.playback !== "live";
              s.configure({
                playback: live ? "live" : "step",
                ...(live ? { motionPreference: "on" as const } : {}),
              });
            }}
          >
            {s.settings.playback === "live"
              ? ru
                ? "Авто"
                : "Auto"
              : ru
                ? "Пошагово"
                : "Step"}
          </button>
        </div>
        <nav
          className="immersive-tabs"
          aria-label={ru ? "Панели полёта" : "Flight panels"}
        >
          {(
            [
              "actions",
              "systems",
              "log",
              ...(run.result ? ["result"] : []),
            ] as Drawer[]
          ).map((tab) => (
            <button
              key={tab}
              className={`button ${activeDrawer === tab ? "primary" : "outlined"}`}
              aria-pressed={activeDrawer === tab}
              onClick={() => openDrawer(tab)}
            >
              {tab === "systems"
                ? ru
                  ? "Системы"
                  : "Systems"
                : tab === "log"
                  ? ru
                    ? "Журнал"
                    : "Log"
                  : titles[tab]}
              {tab === "actions" && run.crisis && (
                <span className="signal-dot" />
              )}
            </button>
          ))}
        </nav>
      </footer>
    </div>,
    document.body,
  );
}
