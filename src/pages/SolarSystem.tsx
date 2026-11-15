import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Plus,
  Minus,
  RotateCcw,
  Orbit,
} from "lucide-react";
import {
  solarBodies,
  solarBody,
  solarSources,
  solarPosition,
} from "../data/solarSystem";
import { useMissionStore } from "../store/useMissionStore";
import SceneBoundary from "../components/SceneBoundary";
import "../solar.css";
const Scene = lazy(() => import("../components/SolarSystemScene"));
export default function SolarSystem() {
  const s = useMissionStore(),
    l = s.settings.language,
    ru = l === "ru";
  const root = useRef<HTMLDivElement>(null),
    days = useRef(0);
  const [selected, setSelected] = useState("overview"),
    [speed, setSpeed] = useState(15),
    [reset, setReset] = useState(0),
    [orbits, setOrbits] = useState(true),
    [labels, setLabels] = useState(true);
  const [playing, setPlaying] = useState(
    () =>
      s.settings.motionPreference !== "off" &&
      !(
        s.settings.motionPreference === "system" &&
        (s.settings.reducedMotion ||
          window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
      ),
  );
  const [failed, setFailed] = useState(
      () =>
        !("WebGL2RenderingContext" in window) || s.settings.graphics !== "3d",
    ),
    [ready, setReady] = useState(false),
    [native, setNative] = useState(false);
  const [command, setCommand] = useState({ id: 0, zoom: 1 });
  const body = solarBody(selected),
    overview = selected === "overview";
  const onFailure = useCallback(() => setFailed(true), []),
    onReady = useCallback(() => setReady(true), []);
  const leave = () => {
    if (document.fullscreenElement === root.current)
      void document.exitFullscreen().catch(() => {});
    s.navigate(
      ["draft", "validated"].includes(s.run.phase) ? "hub" : "control",
    );
  };
  useEffect(() => {
    const overflow = document.body.style.overflow,
      app = document.querySelector<HTMLElement>(".app-shell"),
      inert = app?.inert ?? false;
    document.body.style.overflow = "hidden";
    if (app) app.inert = true;
    root.current?.focus({ preventScroll: true });
    const changed = () =>
      setNative(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", changed);
    return () => {
      document.body.style.overflow = overflow;
      if (app) app.inert = inert;
      document.removeEventListener("fullscreenchange", changed);
    };
  }, []);
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      leave();
      return;
    }
    if (event.key !== "Tab") return;
    const elements = Array.from(
        root.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled),select,a[href]",
        ) ?? [],
      ).filter((el) => el.getClientRects().length > 0),
      first = elements[0],
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
  return createPortal(
    <div
      className="solar-explorer"
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label={ru ? "Солнечная система" : "Solar system explorer"}
      tabIndex={-1}
      onKeyDown={keyboard}
    >
      <div
        className="solar-canvas"
        aria-label={ru ? "3D-обзор Солнечной системы" : "3D solar system"}
      >
        {failed ? (
          <div className="solar-fallback">
            <svg
              viewBox="-34 -28 68 56"
              role="img"
              aria-label={
                ru ? "Схематическая карта планет" : "Schematic planetary map"
              }
            >
              <circle r="1.7" fill="#ffd18a" />
              {solarBodies
                .filter((b) => b.kind === "planet")
                .map((b) => {
                  const p = solarPosition(b, 0);
                  return (
                    <g key={b.id}>
                      {orbits && (
                        <circle
                          r={Math.hypot(...p)}
                          fill="none"
                          stroke="#466079"
                          strokeWidth=".06"
                        />
                      )}
                      <circle
                        cx={p[0]}
                        cy={p[2]}
                        r={b.visualRadius}
                        fill={b.color}
                      />
                      {labels && (
                        <text
                          x={p[0]}
                          y={p[2] - b.visualRadius - 0.4}
                          textAnchor="middle"
                          fill="#c9d8e8"
                          fontSize=".9"
                        >
                          {b.name[l]}
                        </text>
                      )}
                    </g>
                  );
                })}
            </svg>
            <p>
              {ru
                ? "Схема 2D · выберите объект, чтобы прочитать сведения."
                : "2D diagram · select a world to read its details."}
            </p>
            <button
              className="scene-tool"
              onClick={() => {
                setFailed(false);
                setReady(false);
              }}
            >
              {ru ? "Попробовать 3D" : "Try 3D"}
            </button>
          </div>
        ) : (
          <SceneBoundary
            onError={onFailure}
            fallback={
              <p role="status">
                {ru ? "Переключение на схему…" : "Switching to diagram…"}
              </p>
            }
          >
            <Suspense
              fallback={
                <p className="solar-loading" role="status">
                  {ru
                    ? "Создаём Солнечную систему…"
                    : "Building the solar system…"}
                </p>
              }
            >
              <Scene
                selected={selected}
                onSelect={setSelected}
                playing={playing}
                speed={speed}
                reset={reset}
                orbits={orbits}
                labels={labels}
                language={l}
                days={days}
                command={command}
                onFailure={onFailure}
                onReady={onReady}
              />
            </Suspense>
          </SceneBoundary>
        )}
      </div>
      <header className="solar-header">
        <div>
          <p className="eyebrow">ORBITAL MISSION LAB / SOLAR ATLAS</p>
          <h1>{ru ? "Солнечная система" : "Solar system"}</h1>
          <p>
            {ru
              ? "Восемь планет · одна звезда · бескрайнее небо"
              : "Eight planets · one star · an open sky"}
          </p>
        </div>
        <div className="button-row">
          {document.fullscreenEnabled && (
            <button
              className="scene-tool"
              aria-label={
                native
                  ? ru
                    ? "Вернуть окно браузера"
                    : "Exit browser fullscreen"
                  : ru
                    ? "Развернуть браузер"
                    : "Enter browser fullscreen"
              }
              onClick={() => {
                if (native) void document.exitFullscreen().catch(() => {});
                else void root.current?.requestFullscreen().catch(() => {});
              }}
            >
              {native ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
          <button className="scene-tool" onClick={leave}>
            <ArrowLeft size={15} />
            {ru ? "К миссии" : "Back to mission"}
          </button>
        </div>
      </header>
      <nav
        className="solar-worlds"
        aria-label={ru ? "Объекты Солнечной системы" : "Solar system objects"}
      >
        <button aria-pressed={overview} onClick={() => setSelected("overview")}>
          <Orbit size={16} />
          {ru ? "Обзор" : "Overview"}
        </button>
        {solarBodies.map((b) => (
          <button
            key={b.id}
            aria-pressed={selected === b.id}
            onClick={() => setSelected(b.id)}
          >
            <span style={{ background: b.color }} />
            {b.name[l]}
          </button>
        ))}
      </nav>
      <aside className="solar-info" aria-live="polite">
        <p className="eyebrow">
          {overview
            ? "EXPLORE / 01"
            : body.kind === "star"
              ? ru
                ? "ЗВЕЗДА"
                : "STAR"
              : body.kind === "moon"
                ? ru
                  ? "СПУТНИК"
                  : "MOON"
                : ru
                  ? "ПЛАНЕТА"
                  : "PLANET"}
        </p>
        <h2>
          {overview
            ? ru
              ? "Выберите свой мир"
              : "Choose a world"
            : body.name[l]}
        </h2>
        <p>
          {overview
            ? ru
              ? "Нажмите на планету или её название. Вращайте камеру перетаскиванием, приближайте колёсиком или кнопками."
              : "Select a planet or its name. Drag to orbit the camera; scroll or use the buttons to zoom."
            : body.description[l]}
        </p>
        {!overview && (
          <dl>
            <div>
              <dt>{ru ? "Средний радиус" : "Mean radius"}</dt>
              <dd>
                {body.radiusKm.toLocaleString(l === "ru" ? "ru-RU" : "en-US", {
                  maximumFractionDigits: 1,
                })}{" "}
                km
              </dd>
            </div>
            {body.elements && (
              <div>
                <dt>{ru ? "Большая полуось" : "Semi-major axis"}</dt>
                <dd>{body.elements[0].toFixed(3)} au</dd>
              </div>
            )}
            {body.periodYears && (
              <div>
                <dt>{ru ? "Период обращения" : "Orbital period"}</dt>
                <dd>
                  {body.periodYears.toFixed(3)}{" "}
                  {ru ? "земных лет" : "Earth years"}
                </dd>
              </div>
            )}
          </dl>
        )}
        <div className="solar-source-links">
          <a
            href={overview ? solarSources.elements : body.source}
            target="_blank"
            rel="noreferrer"
          >
            NASA / JPL ↗
          </a>
          {!overview && body.elements && (
            <a href={solarSources.elements} target="_blank" rel="noreferrer">
              {ru ? "Орбита" : "Orbit"} ↗
            </a>
          )}
        </div>
      </aside>
      <footer className="solar-footer">
        <div className="solar-controls">
          <button
            className="scene-tool"
            disabled={failed || !ready}
            aria-label={
              playing
                ? ru
                  ? "Пауза планет"
                  : "Pause planets"
                : ru
                  ? "Продолжить движение планет"
                  : "Resume planets"
            }
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            className="scene-tool"
            aria-label={ru ? "Начать обзор заново" : "Reset solar system"}
            onClick={() => {
              days.current = 0;
              setSelected("overview");
              setReset((n) => n + 1);
            }}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="scene-tool"
            disabled={failed || !ready}
            aria-label={ru ? "Приблизить планету" : "Zoom in on planets"}
            onClick={() => setCommand((c) => ({ id: c.id + 1, zoom: 0.8 }))}
          >
            <Plus size={16} />
          </button>
          <button
            className="scene-tool"
            disabled={failed || !ready}
            aria-label={ru ? "Отдалить планету" : "Zoom out from planets"}
            onClick={() => setCommand((c) => ({ id: c.id + 1, zoom: 1.25 }))}
          >
            <Minus size={16} />
          </button>
          <label>
            {ru ? "Модель, дней/с" : "Model days/s"}
            <select
              aria-label={ru ? "Скорость планет" : "Planet speed"}
              disabled={failed}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            >
              {[1, 15, 120, 600].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <button
            className="scene-tool"
            aria-pressed={orbits}
            onClick={() => setOrbits((v) => !v)}
          >
            {ru ? "Орбиты" : "Orbits"}
          </button>
          <button
            className="scene-tool"
            aria-pressed={labels}
            onClick={() => setLabels((v) => !v)}
          >
            {ru ? "Названия" : "Labels"}
          </button>
        </div>
        <p className="solar-limit">
          {ru
            ? "Обзорная модель · расстояния сжаты, размеры увеличены · не положение планет сегодня · текстуры и звёзды иллюстративные"
            : "Overview model · compressed distances, enlarged bodies · not today's planetary positions · illustrative textures and stars"}
        </p>
      </footer>
    </div>,
    document.body,
  );
}
