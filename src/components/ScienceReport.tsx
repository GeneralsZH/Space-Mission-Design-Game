import { useState } from "react";
import { useMissionStore } from "../store/useMissionStore";
import { coverageSummary } from "../engine/coverage";
import {
  attemptId,
  downloadFile,
  missionReport,
  readAttempts,
} from "../features/reports";
import { Panel, Row } from "./common";
export default function ScienceReport() {
  const s = useMissionStore(),
    ru = s.settings.language === "ru",
    run = s.run;
  const attempts = readAttempts().filter((a) => a.id !== attemptId(run));
  const [selected, setSelected] = useState(attempts[0]?.id ?? "");
  const previous = attempts.find((a) => a.id === selected),
    coverage = coverageSummary(run.observedCellIds);
  return (
    <Panel>
      <p className="eyebrow">DESIGN REVIEW / NASA LROC</p>
      <h2>
        {ru ? "Наука и сравнение проектов" : "Science & design comparison"}
      </h2>
      <p className="muted">
        {ru
          ? "Научные баллы — игровой индекс. Покрытие — геометрическая доступность архивных точек при сборе данных, а не обнаружение льда и не объём переданной карты."
          : "Science points are a game index. Coverage is geometric access to archival samples while collecting data, not ice detection or a downlinked map."}
      </p>
      <Row
        label={ru ? "Доступные архивные точки" : "Accessible archival samples"}
        value={
          run.build.modelVersion === 2
            ? `${coverage.observed} / ${coverage.total} (${coverage.percent.toFixed(1)}%)`
            : "Legacy model"
        }
      />
      <label className="field-label" htmlFor="compare-attempt">
        {ru
          ? "Предыдущие полёты в этом браузере (до 8)"
          : "Previous flights in this browser (up to 8)"}
      </label>
      {attempts.length ? (
        <>
          <select
            className="text-input"
            id="compare-attempt"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {attempts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.build.customOrbit
                  ? `${a.build.customOrbit.periapsisKm}–${a.build.customOrbit.apoapsisKm} km / ${a.build.customOrbit.inclinationDeg}°`
                  : a.build.orbitId}{" "}
                · {a.science.toFixed(1)} points · {a.id}
              </option>
            ))}
          </select>
          {previous && (
            <div className="science-table-wrap">
              <table className="science-table">
                <thead>
                  <tr>
                    <th>{ru ? "Показатель" : "Metric"}</th>
                    <th>{ru ? "Текущий" : "Current"}</th>
                    <th>{ru ? "Предыдущий" : "Previous"}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    [
                      "Science index",
                      run.deliveredScience.toFixed(1),
                      previous.science.toFixed(1),
                    ],
                    [
                      "Cost (fictional M USD)",
                      run.result?.costMUsd.toFixed(1),
                      previous.cost.toFixed(1),
                    ],
                    [
                      "Coverage (%)",
                      run.build.modelVersion === 2
                        ? coverage.percent.toFixed(1)
                        : "Legacy",
                      previous.build.modelVersion === 2
                        ? previous.coverage.toFixed(1)
                        : "Legacy",
                    ],
                    [
                      "Downlink (Gbit)",
                      run.transmittedGbit.toFixed(2),
                      previous.sentGbit.toFixed(2),
                    ],
                  ].map((row) => (
                    <tr key={row[0]}>
                      {row.map((v, i) =>
                        i ? <td key={i}>{v}</td> : <th key={i}>{v}</th>,
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <p className="muted">
          {ru
            ? "Завершите ещё один проект для сравнения. Повтор той же записи не создаёт новый результат."
            : "Complete another design to compare results. Replaying an identical record does not create a new result."}
        </p>
      )}
      <div className="button-row mt-4">
        <button
          className="button primary"
          onClick={() =>
            downloadFile(
              "orbital-mission-report.html",
              missionReport(run),
              "text/html;charset=utf-8",
            )
          }
        >
          {ru ? "Скачать полный отчёт (HTML)" : "Download full report (HTML)"}
        </button>
        <button
          className="button outlined"
          onClick={() => s.navigate("scienceLab")}
        >
          {ru ? "Открыть данные NASA" : "Explore NASA data"}
        </button>
      </div>
    </Panel>
  );
}
