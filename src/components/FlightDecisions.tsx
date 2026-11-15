import { CircleAlert, Radio, Shield } from "lucide-react";
import { physics } from "../data/missionConfig";
import {
  calculate,
  clamp,
  selectedComponents,
  sum,
} from "../engine/calculations";
import type { Language, MissionCommand, MissionRun } from "../types";
import { Panel } from "./common";
import { fmt } from "./format";
export default function FlightDecisions({
  run,
  language: l,
  onCommand,
}: {
  run: MissionRun;
  language: Language;
  onCommand: (command: MissionCommand) => void;
}) {
  if (!run.crisis) return null;
  const r = calculate(run.build);
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
            ? "Учебный сценарий вспышки: защита определяет критерий сбоя электроники; safe mode сокращает наблюдения."
            : "Educational flare scenario: protection determines the electronics-upset criterion; safe mode shortens observations."
          : l === "ru"
            ? "Тень продлится ещё 40 минут. Сократите нагрузку или сохраните программу с риском просадки питания."
            : "Eclipse will last another 40 minutes. Reduce load or maintain the science program at the risk of a power sag."}
      </p>
      <div className="decision-options">
        <button
          className="decision safe"
          disabled={run.paused}
          onClick={() => onCommand({ type: "ChooseDecision", choice: "safe" })}
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
                ? "Радар отключён, −3% игрового индекса науки. Даже сниженной нагрузке нужен достаточный заряд."
                : "Radar disabled, −3% game science index. Lower load still needs sufficient stored energy."}
          </span>
        </button>
        <button
          className="decision risky"
          disabled={run.paused}
          onClick={() =>
            onCommand({
              type: "ChooseDecision",
              choice: "continue",
            })
          }
        >
          <Radio size={22} />
          <strong>
            {l === "ru" ? "Продолжить наблюдения" : "Continue observations"}
          </strong>
          <span>
            {run.build.modelVersion === 2 ? (
              run.crisis === "flare" ? (
                (l === "ru"
                  ? "Учебный порог защиты ≥0.35. Индекс проекта: "
                  : "Educational shielding threshold ≥0.35. Your index: ") +
                sum(parts, (c) =>
                  ["bus", "radiation"].includes(c.category)
                    ? (c.protection ?? 0)
                    : 0,
                ).toFixed(2) +
                (run.build.advancedFlight
                  ? l === "ru"
                    ? ". Ниже порога: повреждение ячеек, выработка 45%."
                    : ". Below threshold: cell damage; solar output 45%."
                  : "")
              ) : (
                (l === "ru"
                  ? "Ещё 40 min в тени. Текущий заряд: "
                  : "Additional 40 min in shadow. Current charge: ") +
                run.chargeWh.toFixed(1) +
                " Wh. " +
                (l === "ru"
                  ? "Расход зависит от включённых приборов."
                  : "Consumption follows enabled instruments.")
              )
            ) : (
              <>
                {l === "ru" ? "Риск повреждения" : "Damage risk"}:{" "}
                {fmt(
                  (run.crisis === "flare" ? flareRisk : eclipseRisk) * 100,
                  0,
                )}
                %.{" "}
                {l === "ru"
                  ? "Архивная версия правил."
                  : "Archived model rules."}
              </>
            )}
          </span>
        </button>
      </div>
    </Panel>
  );
}
