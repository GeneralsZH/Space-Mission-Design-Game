import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  CircleAlert,
  Flag,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Shield,
} from "lucide-react";
import { missionConfig as mission, physics } from "../data/missionConfig";
import {
  calculate,
  clamp,
  selectedComponents,
  sum,
} from "../engine/calculations";
import { phaseNames, t } from "../i18n";
import { useMissionStore } from "../store/useMissionStore";
import {
  Bar,
  ExportButton,
  Heading,
  LaunchButton,
  Panel,
  Row,
  Status,
  ReplayButton,
} from "../components/common";
import { fmt } from "../components/format";
import MissionViewer from "../components/MissionViewer";
import OperationsPanel from "../components/OperationsPanel";
import PostFlightDiagnostics from "../components/PostFlightDiagnostics";
import { fingerprint } from "../engine/economy";
import { catalog } from "../data/missionConfig";
import { useMissionPlayback } from "../features/playback/useMissionPlayback";
import {
  displayTelemetry,
  stageDuration,
} from "../features/playback/missionPlayback";
import type { MissionPhase } from "../types";
const TelemetryChart = lazy(() => import("../components/TelemetryChart"));
const flightPhases: MissionPhase[] = [
  "launched",
  "cruise",
  "orbitInsertion",
  "scienceOperations",
  "downlink",
  "completed",
];

function FlightLog() {
  const {
    run,
    settings: { language: l },
  } = useMissionStore();
  return (
    <Panel className="flight-log">
      <div className="panel-title">
        <h2>{t(l, "log")}</h2>
        <span className="tag">{run.logs.length} EVENTS</span>
      </div>
      {run.logs.length ? (
        <ol>
          {[...run.logs].reverse().map((entry, index) => (
            <li className={entry.kind} key={run.logs.length - index}>
              <time className="mono">T+{fmt(entry.hours)}h</time>
              <p>{entry.message[l]}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">{t(l, "emptyLog")}</p>
      )}
    </Panel>
  );
}
export function Control() {
  const s = useMissionStore();
  const l = s.settings.language;
  const run = s.run;
  const r = calculate(s.build);
  const [ready, setReady] = useState(false);
  const onReady = useCallback((value: boolean) => setReady(value), []);
  const [systemReducedMotion] = useState(
    () =>
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const motionEnabled =
    s.settings.motionPreference === "system"
      ? !s.settings.reducedMotion && !systemReducedMotion
      : s.settings.motionPreference === "on";
  const { clock, frame } = useMissionPlayback(run, ready);
  const telemetry = displayTelemetry(
    run,
    s.settings.playback === "live" ? frame.progress : 0,
  );
  useEffect(() => {
    if (run.result && !run.result.success)
      document
        .getElementById("postflight-diagnostics")
        ?.scrollIntoView?.({ behavior: "instant", block: "start" });
  }, [run.result]);
  if (["draft", "validated"].includes(run.phase))
    return (
      <>
        <Heading
          title={t(l, "control")}
          description={
            l === "ru"
              ? "Перед стартом пройдите проверку проекта."
              : "Complete the design review before launch."
          }
        />
        <Panel>
          <button
            className="button primary"
            onClick={() => s.navigate("validation")}
          >
            {t(l, "validate")}
            <ArrowRight size={17} />
          </button>
        </Panel>
      </>
    );
  const phaseIndex =
    run.phase === "failed" || run.phase === "incident"
      ? Math.max(
          0,
          flightPhases.indexOf(run.incident?.sourcePhase ?? "completed"),
        )
      : flightPhases.indexOf(run.phase);
  const parts = selectedComponents(run.build);
  const flareRisk = clamp(
    physics.flareBaseRisk -
      sum(parts, (c) =>
        ["radiation", "bus"].includes(c.category) ? (c.protection ?? 0) : 0,
      ) -
      run.build.testingBudgetMUsd * physics.testReliabilityPerM,
  );
  const eclipseRisk = clamp(
    physics.eclipseBaseRisk -
      sum(parts, (c) => (c.category === "thermal" ? (c.protection ?? 0) : 0)) -
      clamp(
        (run.chargeWh - r.shadowLoadW * physics.extendedShadowHours) /
          Math.max(1, r.usableBatteryWh),
      ) *
        physics.eclipseReserveRiskReduction,
  );
  return (
    <>
      <Heading
        eyebrow={`LIVE FLIGHT / SEED ${run.seed}`}
        title={t(l, "control")}
        action={
          <div className="button-row">
            <ReplayButton />
            {!run.result && (
              <button
                className="button outlined"
                onClick={() =>
                  s.command({ type: run.paused ? "Resume" : "Pause" })
                }
              >
                {run.paused ? <Play size={15} /> : <Pause size={15} />}{" "}
                {t(l, run.paused ? "resume" : "pause")}
              </button>
            )}
          </div>
        }
      />
      <div className="playback-toolbar">
        <div
          className="playback-mode"
          role="group"
          aria-label={l === "ru" ? "Режим полёта" : "Flight playback mode"}
        >
          <button
            aria-pressed={s.settings.playback === "live"}
            onClick={() => {
              s.configure({ playback: "live" });
              if (run.paused) s.command({ type: "Resume" });
            }}
          >
            <span className="signal-dot" />
            {l === "ru" ? "Прямой эфир" : "Live playback"}
          </button>
          <button
            aria-pressed={s.settings.playback === "step"}
            onClick={() => s.configure({ playback: "step" })}
          >
            {l === "ru" ? "Пошагово" : "Step mode"}
          </button>
        </div>
        <label className="playback-speed">
          {l === "ru" ? "Скорость эфира" : "Playback speed"}
          <select
            value={s.settings.playbackSpeed}
            onChange={(event) =>
              s.configure({
                playbackSpeed: Number(event.target.value) as 1 | 2 | 4 | 8,
              })
            }
          >
            {[1, 2, 4, 8].map((speed) => (
              <option key={speed} value={speed}>
                ×{speed}
              </option>
            ))}
          </select>
        </label>
        <button
          className="scene-tool motion-toggle"
          aria-pressed={motionEnabled}
          onClick={() =>
            s.configure({ motionPreference: motionEnabled ? "off" : "on" })
          }
        >
          {l === "ru"
            ? `Движение: ${motionEnabled ? "вкл" : "выкл"}`
            : `Motion: ${motionEnabled ? "on" : "off"}`}
        </button>
      </div>
      {!motionEnabled && (
        <div className="notice warning playback-motion-note">
          {l === "ru"
            ? "Движение выключено настройкой уменьшения анимации. Нажмите «Движение: выкл», чтобы увидеть взлёт и движение по орбите."
            : "Motion is reduced. Press “Motion: off” to enable liftoff and orbital animation."}
        </div>
      )}
      <ol className="phase-stepper">
        {flightPhases.map((phase, index) => (
          <li
            key={phase}
            className={
              index === phaseIndex ? "active" : index < phaseIndex ? "done" : ""
            }
          >
            <span>
              {index < phaseIndex ? <Check size={13} /> : `0${index + 1}`}
            </span>
            <p>{phaseNames[phase][l]}</p>
          </li>
        ))}
      </ol>
      <div className="flight-grid">
        <div>
          <Panel
            className={`flight-stage ${run.phase === "launched" ? "launching" : ""}`}
          >
            <div className="panel-title">
              <span className="eyebrow">
                LIM-01 / {phaseNames[run.phase][l]}
              </span>
              <span className="mono tiny">T+ {fmt(run.elapsedHours)} h</span>
            </div>
            <MissionViewer
              run={run}
              language={l}
              clock={clock}
              frame={frame}
              motionEnabled={motionEnabled}
              onReady={onReady}
            />
            {!run.result && (
              <div className="stage-playback-progress">
                <div className="meter">
                  <span style={{ width: `${frame.progress * 100}%` }} />
                </div>
                <span>
                  {run.crisis
                    ? l === "ru"
                      ? "Эфир ждёт решения"
                      : "Awaiting decision"
                    : run.paused
                      ? t(l, "paused")
                      : s.settings.playback === "step"
                        ? l === "ru"
                          ? "Переход по вашей команде"
                          : "Advance on command"
                        : l === "ru"
                          ? `Следующий этап через ${Math.max(0, Math.ceil((stageDuration(run) - frame.seconds) / s.settings.playbackSpeed))} с`
                          : `Next stage in ${Math.max(0, Math.ceil((stageDuration(run) - frame.seconds) / s.settings.playbackSpeed))} s`}
                </span>
              </div>
            )}
            <div className="flight-stage-footer">
              <span>
                <span className="signal-dot" />
                {run.paused ? t(l, "paused") : phaseNames[run.phase][l]}
              </span>
              <strong>
                {l === "ru" ? "ВИТОК" : "ORBIT"}{" "}
                {String(run.orbit).padStart(2, "0")} / 04
              </strong>
            </div>
          </Panel>
          <PostFlightDiagnostics run={run} language={l} />
          <OperationsPanel />
          {run.crisis && (
            <Panel className="crisis-panel">
              <div id="mission-decision" />
              <p className="eyebrow">
                <CircleAlert size={15} />
                {l === "ru" ? "ТРЕБУЕТСЯ РЕШЕНИЕ" : "DECISION REQUIRED"}
              </p>
              <h2>
                {run.crisis === "flare"
                  ? l === "ru"
                    ? "Солнечная вспышка"
                    : "Solar flare"
                  : l === "ru"
                    ? "Продлённое затмение"
                    : "Extended eclipse"}
              </h2>
              <p className="muted">
                {run.crisis === "flare"
                  ? l === "ru"
                    ? "Поток частиц угрожает электронике. Защита и испытания снижают риск; safe mode сокращает программу наблюдений."
                    : "Particle flux threatens electronics. Shielding and testing reduce risk; safe mode shortens observations."
                  : l === "ru"
                    ? "Тень продлится ещё 40 минут. Сократите нагрузку или сохраните программу с риском просадки питания."
                    : "Eclipse will last another 40 minutes. Reduce load or maintain the science program at the risk of a power sag."}
              </p>
              <div className="decision-options">
                <button
                  className="decision safe"
                  disabled={run.paused}
                  onClick={() =>
                    s.command({ type: "ChooseDecision", choice: "safe" })
                  }
                >
                  <Shield size={22} />
                  <strong>
                    {run.crisis === "flare"
                      ? "Safe mode"
                      : l === "ru"
                        ? "Сократить нагрузку"
                        : "Reduce load"}
                  </strong>
                  <span>
                    {run.crisis === "flare"
                      ? l === "ru"
                        ? "−8% науки, +6 h. Электроника в безопасности."
                        : "−8% science, +6 h. Electronics are protected."
                      : l === "ru"
                        ? "Радар отключён до конца миссии, −3% науки. Сохраняет заряд."
                        : "Radar disabled for the mission, −3% science. Preserves charge."}
                  </span>
                </button>
                <button
                  className="decision risky"
                  disabled={run.paused}
                  onClick={() =>
                    s.command({ type: "ChooseDecision", choice: "continue" })
                  }
                >
                  <Radio size={22} />
                  <strong>
                    {l === "ru"
                      ? "Продолжить наблюдения"
                      : "Continue observations"}
                  </strong>
                  <span>
                    {l === "ru" ? "Риск повреждения" : "Damage risk"}:{" "}
                    {fmt(
                      (run.crisis === "flare" ? flareRisk : eclipseRisk) * 100,
                      0,
                    )}
                    %.{" "}
                    {l === "ru"
                      ? "Зависит от проекта и текущего заряда."
                      : "Based on the design and current charge."}
                  </span>
                </button>
              </div>
            </Panel>
          )}
          {run.telemetry.length > 0 && (
            <Panel>
              <h2>{t(l, "telemetry")}</h2>
              <Suspense fallback={<p className="muted">…</p>}>
                <TelemetryChart data={run.telemetry} language={l} />
              </Suspense>
            </Panel>
          )}
        </div>
        <div>
          <Panel className="live-telemetry">
            <div className="panel-title">
              <h2>{l === "ru" ? "Бортовые системы" : "Onboard systems"}</h2>
              <span className="signal-dot" />
            </div>
            <Row label={t(l, "health")} value={`${run.health}%`} />
            <Bar value={run.health} danger={run.health < 50} />
            <Row
              label={t(l, "charge")}
              value={`${fmt(telemetry.chargeWh)} Wh`}
            />
            <Bar
              value={
                (telemetry.chargeWh / Math.max(1, r.usableBatteryWh)) * 100
              }
              danger={telemetry.chargeWh < r.shadowEnergyNeedWh}
            />
            <Row
              label={t(l, "stored")}
              value={`${fmt(telemetry.storedGbit, 2)} / ${r.memoryGbit} Gbit`}
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
            {run.result ? (
              <button
                className="button primary full"
                onClick={() => s.navigate("report")}
              >
                <Flag size={16} />
                {t(l, "report")}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="button primary full"
                disabled={run.paused || !!run.crisis}
                onClick={() => s.command({ type: "Advance" })}
              >
                <Play size={15} />
                {run.phase === "scienceOperations" && run.orbit < mission.orbits
                  ? t(l, "orbitStep")
                  : run.phase === "launched"
                    ? l === "ru"
                      ? "Пропустить анимацию"
                      : "Skip animation"
                    : run.phase === "incident"
                      ? l === "ru"
                        ? "Завершить запись и показать причины"
                        : "Finish recording & show causes"
                      : t(l, "advance")}
              </button>
            )}
            <p className="tiny muted mt-4">
              {l === "ru"
                ? s.settings.playback === "live"
                  ? "Учебная симуляция в прямом эфире: этапы переключаются автоматически. Во время аварий требуется ваше решение."
                  : "Пошаговый режим: переходы выполняются по вашей команде."
                : s.settings.playback === "live"
                  ? "Live educational simulation: stages advance automatically. Crises require your decision."
                  : "Step mode: stages advance on your command."}
            </p>
          </Panel>
          <FlightLog />
        </div>
      </div>
    </>
  );
}

export function Report() {
  const s = useMissionStore();
  const l = s.settings.language;
  const run = s.run;
  const result = run.result;
  if (!result)
    return (
      <>
        <Heading title={t(l, "report")} description={t(l, "noReport")} />
        <LaunchButton />
      </>
    );
  return (
    <>
      <Heading
        eyebrow={`MISSION DEBRIEF / SEED ${run.seed}`}
        title={t(l, result.success ? "success" : "failed")}
        action={<ExportButton />}
      />
      <div
        className={`result-banner ${result.success ? "success" : "failure"}`}
      >
        <div className="result-symbol">
          {result.success ? <Check size={45} /> : <CircleAlert size={45} />}
        </div>
        <div>
          <p className="eyebrow">LUNAR ICE MAPPER</p>
          <h2>
            {l === "ru"
              ? "Доставленная наука определяет успех."
              : "Delivered science defines success."}
          </h2>
          <p>{mission.objectives[l]}</p>
        </div>
        <div className="final-score">
          <strong>
            {fmt(result.finalScore, 0)}
            <span>/100</span>
          </strong>
          <small>{t(l, "score")}</small>
        </div>
      </div>
      <PostFlightDiagnostics run={run} language={l} />
      <div className="report-grid">
        <Panel>
          <h2>{l === "ru" ? "Контракт и результат" : "Contract & outcome"}</h2>
          <Row
            label={t(l, "delivered")}
            value={`${fmt(run.deliveredScience)} / ${mission.scienceTarget}`}
          />
          <Bar
            value={(run.deliveredScience / mission.scienceTarget) * 100}
            danger={!result.success}
          />
          <Row label={t(l, "health")} value={`${run.health}%`} />
          <Row
            label={t(l, "cost")}
            value={`${fmt(result.costMUsd)} / 110 M$`}
          />
          <Row
            label={t(l, "transmitted")}
            value={`${fmt(run.transmittedGbit, 2)} Gbit`}
          />
          <Row
            label={
              l === "ru"
                ? "Потеряно / осталось в памяти"
                : "Lost / left in memory"
            }
            value={`${fmt(run.lostGbit + run.storedGbit, 2)} Gbit`}
          />
          <Row
            label={l === "ru" ? "Время миссии" : "Mission duration"}
            value={`${fmt(run.elapsedHours)} h`}
          />
          <Row label="Seed" value={run.seed} />
          <Row
            label={
              l === "ru"
                ? "Оборудование на складе"
                : "Unused warehouse equipment"
            }
            value={`${fmt(catalog.filter((c) => s.economy.ownedIds.includes(c.id) && !run.build.moduleIds.includes(c.id)).reduce((n, c) => n + c.costMUsd, 0))} M$`}
          />
          <Row
            label={
              l === "ru"
                ? "Все оплаченные испытания"
                : "All paid qualification tests"
            }
            value={`${fmt(s.economy.tests.reduce((n, t) => n + t.costMUsd, 0))} M$`}
          />
          <Row
            label={
              l === "ru"
                ? "Актуальных допусков / испытаний"
                : "Current passed / total tests"
            }
            value={`${s.economy.tests.filter((t) => t.passed && t.fingerprint === fingerprint(run.build)).length} / ${s.economy.tests.length}`}
          />
          <Row
            label={
              l === "ru"
                ? "Прогноз до полёта / доставлено"
                : "Preflight forecast / delivered"
            }
            value={`${fmt(calculate(run.build).potentialScience)} / ${fmt(run.deliveredScience)}`}
          />
          <Status good={result.success}>
            {l === "ru"
              ? `Наука ≥ 120: ${run.deliveredScience >= 120 ? "да" : "нет"} · Аппарат сохранён: ${run.health > 0 ? "да" : "нет"}`
              : `Science ≥ 120: ${run.deliveredScience >= 120 ? "yes" : "no"} · Survived: ${run.health > 0 ? "yes" : "no"}`}
          </Status>
        </Panel>
        <Panel>
          <p className="eyebrow">LESSONS LEARNED</p>
          <h2>{t(l, "recommendations")}</h2>
          <ol className="recommendations">
            {result.recommendations.map((item, i) => (
              <li key={i}>
                <span>0{i + 1}</span>
                <p>{item[l]}</p>
              </li>
            ))}
          </ol>
          <p className="tiny muted">
            {l === "ru"
              ? "Оценка: 65% наука + 20% надёжность с учётом состояния + 15% экономия. Оценка не заменяет выполнение контракта."
              : "Score: 65% science + 20% reliability adjusted for health + 15% cost savings. Score does not replace contract success."}
          </p>
        </Panel>
      </div>
      <div className="button-row mt-6">
        <button className="button primary" onClick={s.replayFlight}>
          <RotateCcw size={16} />
          {t(l, "replay")}
        </button>
        <button className="button outlined" onClick={s.restart}>
          {t(l, "restart")}
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="mt-6">
        <FlightLog />
      </div>
    </>
  );
}
