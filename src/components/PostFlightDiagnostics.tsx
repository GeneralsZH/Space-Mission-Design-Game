import { calculate } from "../engine/calculations";
import { issueText } from "../i18n";
import type { Diagnostic, Language, MissionRun } from "../types";
import { Panel } from "./common";

export default function PostFlightDiagnostics({
  run,
  language: l,
}: {
  run: MissionRun;
  language: Language;
}) {
  if (!run.result || run.result.success) return null;
  const ru = l === "ru",
    stats = calculate(run.build);
  const causes: Diagnostic[] = run.incident?.causes ?? [
    {
      code: "science-result",
      title: {
        ru: "Научный контракт не выполнен",
        en: "Science contract not met",
      },
      actual: `${run.deliveredScience.toFixed(1)}`,
      expected: "≥ 120",
      explanation: {
        ru: "Аппарат не доставил требуемый объём научных измерений. Потери и команды доступны в журнале.",
        en: "The required science was not delivered. Losses and commands are recorded in the flight log.",
      },
    },
  ];
  return (
    <Panel className="postflight-diagnostics">
      <div id="postflight-diagnostics" />
      <p className="eyebrow">FLIGHT RECORDING / CAUSE ANALYSIS</p>
      <h2>
        {ru
          ? "Разбор происшествия и список ошибок"
          : "Incident review & error list"}
      </h2>
      <p className="diagnosis-summary">
        {run.incident?.title[l] ??
          (ru
            ? "Результат не соответствует контракту"
            : "Outcome does not meet the contract")}
      </p>
      <ol className="diagnosis-causes">
        {causes.map((c, i) => (
          <li key={c.code}>
            <span className="diagnosis-number">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3>{c.title[l]}</h3>
              <div className="diagnosis-facts">
                <span>
                  {ru ? "Зафиксировано" : "Recorded"}
                  <strong>{c.actual}</strong>
                </span>
                <span>
                  {ru ? "Расчётное условие" : "Design condition"}
                  <strong>{c.expected}</strong>
                </span>
              </div>
              <p>{c.explanation[l]}</p>
            </div>
          </li>
        ))}
      </ol>
      <details>
        <summary>
          {ru
            ? "Другие выявленные ограничения проекта"
            : "Other project constraints found"}
        </summary>
        <ul className="secondary-findings">
          {stats.issues
            .filter((i) => !causes.some((c) => c.code === i.code))
            .map((i) => (
              <li key={i.code}>{issueText[i.code][l]}</li>
            ))}
          {!stats.issues.length && (
            <li>
              {ru
                ? "Статические ограничения соблюдены. Причину определяют события и команды полёта."
                : "Static limits were met. Flight events and commands determine the cause."}
            </li>
          )}
        </ul>
      </details>
      <p className="tiny muted">
        {ru
          ? "Разбор основан на учебной модели и записи событий. Сопутствующее ограничение само по себе не означает причину разрушения."
          : "Analysis uses the educational model and event recording. A secondary constraint does not by itself establish a breakup cause."}
      </p>
    </Panel>
  );
}
