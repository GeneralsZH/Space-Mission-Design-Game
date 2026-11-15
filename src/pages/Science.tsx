import { useMemo, useState } from "react";
import { useMissionStore } from "../store/useMissionStore";
import { createRun } from "../engine/simulation";
import {
  coverageSummary,
  lroc,
  observationFootprintKm,
  observeOrbit,
} from "../engine/coverage";
import {
  eclipseSeconds,
  orbitalParameters,
  elementsFor,
} from "../engine/orbital";
import { calculate } from "../engine/calculations";
import { orbits } from "../data/missionConfig";
import { Heading, Panel, Row } from "../components/common";
import type { Build } from "../types";
import { publicAsset } from "../features/publicAsset";

function preview(build: Build) {
  const run = createRun({ ...build, modelVersion: 2 }),
    ids = new Set<number>();
  for (let i = 0; i < 4; i++) {
    run.orbit = i;
    observeOrbit(run).forEach((id) => ids.add(id));
  }
  return {
    coverage: coverageSummary([...ids]),
    ids: [...ids],
    swath: observationFootprintKm(run),
  };
}
export default function Science() {
  const s = useMissionStore(),
    ru = s.settings.language === "ru",
    draft = ["draft", "validated"].includes(s.run.phase);
  const [selected, setSelected] = useState(840),
    [overlay, setOverlay] = useState(true);
  const comparisons = useMemo(
    () =>
      [
        ...orbits,
        ...(s.build.customOrbit
          ? [
              {
                ...orbits.find((o) => o.id === s.build.orbitId)!,
                id: "custom",
                name: { ru: "Своя орбита", en: "Custom orbit" },
              },
            ]
          : []),
      ].map((o) => {
        const build = {
          ...s.build,
          orbitId: o.id === "custom" ? s.build.orbitId : o.id,
          customOrbit: o.id === "custom" ? s.build.customOrbit : undefined,
          modelVersion: 2 as const,
        };
        return {
          profile: o,
          elements: elementsFor(build),
          physics: orbitalParameters(elementsFor(build)),
          balance: calculate(build),
          ...preview(build),
        };
      }),
    [s.build],
  );
  const predicted = comparisons.find(
    (c) => c.profile.id === (s.build.customOrbit ? "custom" : s.build.orbitId),
  )!;
  const ids = new Set(draft ? predicted.ids : s.run.observedCellIds),
    summary = coverageSummary([...ids]);
  const cell = lroc.cells.find((c) => c.id === selected) ?? lroc.cells[0];
  return (
    <>
      <Heading
        eyebrow="OBSERVED DATA / SIMULATED ACCESS"
        title={ru ? "Научная лаборатория" : "Lunar science lab"}
        description={
          ru
            ? "Реальные данные LRO: историческая освещённость южного полюса. Покрытие аппарата рассчитывается отдельно."
            : "Real LRO data: historical south-pole illumination. Spacecraft coverage is calculated separately."
        }
      />
      <div className="notice">
        {ru
          ? "Это учебная модель. Освещённость не является измерением льда. Порог <5% не классифицирует постоянно затенённые области."
          : "Educational model. Illumination is not an ice measurement. A <5% threshold does not classify permanently shadowed regions."}
      </div>
      <div className="science-grid">
        <Panel>
          <div className="panel-title">
            <h2>LROC / 88–90° S</h2>
            <span className="tag">OBSERVED · %</span>
          </div>
          <p className="tiny muted">
            {ru
              ? "15.02.2010–05.02.2011 · Нажмите точку для исходного значения. Клавиатура: Tab, стрелки, Enter."
              : "2010-02-15–2011-02-05 · Select a sample for its source value. Keyboard: Tab, arrows, Enter."}
          </p>
          <svg
            className="science-map"
            viewBox="-3 -3 47 47"
            role="group"
            aria-label={
              ru
                ? "Архивная карта освещённости LROC"
                : "LROC archived illumination map"
            }
          >
            <rect x="-1" y="-1" width="43" height="43" fill="#08131f" />
            {lroc.cells.map((c) => (
              <rect
                key={c.id}
                id={`lroc-${c.id}`}
                x={c.i}
                y={c.j}
                width=".95"
                height=".95"
                fill={`hsl(200 55% ${8 + c.illuminationPct * 0.8}%)`}
                stroke={
                  cell.id === c.id
                    ? "#fff"
                    : overlay && ids.has(c.id)
                      ? "#29d1df"
                      : "none"
                }
                strokeWidth={cell.id === c.id ? 0.25 : 0.12}
                tabIndex={cell.id === c.id ? 0 : -1}
                role="button"
                aria-label={`Sample ${c.id}: ${c.illuminationPct.toFixed(2)}% illumination`}
                onClick={() => setSelected(c.id)}
                onKeyDown={(e) => {
                  if (
                    [
                      "ArrowRight",
                      "ArrowDown",
                      "ArrowLeft",
                      "ArrowUp",
                    ].includes(e.key)
                  ) {
                    e.preventDefault();
                    const index = lroc.cells.findIndex((v) => v.id === c.id),
                      delta =
                        e.key === "ArrowRight"
                          ? 1
                          : e.key === "ArrowLeft"
                            ? -1
                            : e.key === "ArrowDown"
                              ? 41
                              : -41;
                    const next =
                      lroc.cells[
                        (index + delta + lroc.cells.length) % lroc.cells.length
                      ];
                    setSelected(next.id);
                    requestAnimationFrame(() =>
                      document.getElementById(`lroc-${next.id}`)?.focus(),
                    );
                  } else if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(c.id);
                  }
                }}
              >
                <title>
                  {c.latitude.toFixed(4)}°, {c.longitude.toFixed(4)}°E:{" "}
                  {c.illuminationPct.toFixed(2)}%
                </title>
              </rect>
            ))}
            <text
              x="20.5"
              y="-1.6"
              textAnchor="middle"
              fill="#a9bbcc"
              fontSize="1"
            >
              0° E
            </text>
            <text
              x="20.5"
              y="43"
              textAnchor="middle"
              fill="#a9bbcc"
              fontSize="1"
            >
              180° E · polar stereographic
            </text>
          </svg>
          <div className="science-legend">
            <span>0%</span>
            <div />
            <span>100%</span>
          </div>
          <p className="tiny muted">
            {ru
              ? "Пустые клетки: нет выбранного отсчёта. Реальные нулевые значения показаны тёмным цветом."
              : "Empty cells have no selected sample. Actual zero illumination values are shown in dark blue."}
          </p>
          <label className="science-checkbox">
            <input
              type="checkbox"
              checked={overlay}
              onChange={(e) => setOverlay(e.target.checked)}
            />
            {ru
              ? "Голубой контур: моделируемая доступность"
              : "Cyan outline: simulated geometric access"}
          </label>
          <p>
            {draft
              ? ru
                ? "Предпросмотр 4 витков, все установленные приборы включены. Успех, освещение и ёмкость памяти не предполагаются проверенными."
                : "Four-orbit preview with all installed instruments enabled. This does not verify success, lighting or memory capacity."
              : ru
                ? "Фактическая история геометрической доступности при сборе данных в этом полёте."
                : "Geometric access accumulated while collecting data in this flight."}{" "}
            <strong>
              {summary.observed} / {summary.total} ({summary.percent.toFixed(1)}
              %)
            </strong>
          </p>
        </Panel>
        <div>
          <Panel>
            <p className="eyebrow">ORIGINAL PIXEL / ARCHIVAL OBSERVATION</p>
            <h2>
              {ru ? "Выбранный отсчёт" : "Selected sample"} #{cell.id}
            </h2>
            <Row
              label={ru ? "Годовая освещённость" : "Annual illumination"}
              value={`${cell.illuminationPct.toFixed(4)}%`}
            />
            <Row
              label={ru ? "Широта / долгота" : "Latitude / longitude"}
              value={`${cell.latitude.toFixed(5)}° / ${cell.longitude.toFixed(5)}° E`}
            />
            <Row
              label={
                ru
                  ? "Исходная строка / столбец (с 0)"
                  : "Source row / column (0-based)"
              }
              value={`${cell.sourceRow} / ${cell.sourceColumn}`}
            />
            <Row
              label={ru ? "Моделируемый доступ" : "Simulated access"}
              value={ids.has(cell.id) ? (ru ? "Да" : "Yes") : ru ? "Нет" : "No"}
            />
          </Panel>
          <Panel>
            <h2>{ru ? "Источник и единицы" : "Source & units"}</h2>
            <p className="mono tiny">{lroc.metadata.productId}</p>
            <p>
              {ru
                ? "NASA LRO / LROC WAC. Средневзвешенная по времени освещённость (%). 3807 наблюдений + 229 для заполнения пробелов."
                : "NASA LRO / LROC WAC. Time-weighted illumination (%). 3,807 observations + 229 gap-fill observations."}
            </p>
            <p>
              {ru
                ? "Исходный пиксель 100 м; здесь 1297 ближайших исходных отсчётов на редкой сетке ~2,96 км. Не интерполяция и не карта отдельных кратеров."
                : "Original 100 m pixels; here 1,297 nearest original samples on a sparse ~2.96 km grid. No interpolation or individual-crater mapping."}
            </p>
            <p className="tiny muted">
              Speyerer & Robinson (2013), Icarus 222, 122–136. Near-zero
              artifacts and temporal gap filling are documented by LROC.
            </p>
            <div className="button-row">
              <a
                className="button outlined"
                href={lroc.metadata.sourceDocumentation}
                target="_blank"
                rel="noreferrer"
              >
                LROC / PDS ↗
              </a>
              <a
                className="button subtle"
                href="https://doi.org/10.1016/j.icarus.2012.10.010"
                target="_blank"
                rel="noreferrer"
              >
                Paper ↗
              </a>
              <a
                className="button subtle"
                href={publicAsset("science/provenance.json")}
                download
              >
                Metadata JSON ↓
              </a>
              <a
                className="button subtle"
                href={publicAsset("science/lroc-source-label.txt")}
                download
              >
                PDS3 label ↓
              </a>
            </div>
          </Panel>
        </div>
      </div>
      <Panel>
        <p className="eyebrow">CONTROLLED COMPARISON / SAME SPACECRAFT</p>
        <h2>{ru ? "Цена выбора орбиты" : "The orbit trade-off"}</h2>
        <p className="muted">
          {ru
            ? "Одинаковые приборы, 4 витка, все системы включены. Полярная орбита 90°. Наклон Солнца β задан сценарием, не вычислен для даты запуска. Большая высота расширяет полосу обзора, но ухудшает линейное разрешение при одной и той же угловой чувствительности."
            : "Same instruments, four orbits, all enabled. Inclination 90°. Solar beta is a scenario assumption, not calculated for a launch date. Higher altitude widens the footprint but reduces ground resolution at the same angular sampling."}
        </p>
        <div className="science-table-wrap">
          <table className="science-table">
            <thead>
              <tr>
                <th>{ru ? "Орбита" : "Orbit"}</th>
                <th>Altitude km</th>
                <th>Period min</th>
                <th>Speed km/s</th>
                <th>β / eclipse min</th>
                <th>Swath km</th>
                <th>Access %</th>
                <th>Accessed &lt;5% samples</th>
                <th>Mean archival %</th>
                <th>Eclipse Wh</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr
                  key={c.profile.id}
                  className={
                    c.profile.id ===
                    (s.build.customOrbit ? "custom" : s.build.orbitId)
                      ? "selected-row"
                      : ""
                  }
                >
                  <th>{c.profile.name[s.settings.language]}</th>
                  <td>
                    {c.elements.periapsisKm}–{c.elements.apoapsisKm}
                  </td>
                  <td>{(c.physics.periodSeconds / 60).toFixed(2)}</td>
                  <td>
                    {(c.physics.apoapsisSpeedMs / 1000).toFixed(3)}–
                    {(c.physics.periapsisSpeedMs / 1000).toFixed(3)}
                  </td>
                  <td>
                    {c.elements.betaDeg}° /{" "}
                    {(eclipseSeconds(c.elements) / 60).toFixed(1)}
                  </td>
                  <td>
                    {c.swath.periapsisSwathKm.toFixed(1)}–
                    {c.swath.apoapsisSwathKm.toFixed(1)}
                  </td>
                  <td>{c.coverage.percent.toFixed(1)}</td>
                  <td>
                    {c.coverage.lowIlluminationObserved} /{" "}
                    {c.coverage.lowIlluminationTotal}
                  </td>
                  <td>
                    {c.coverage.meanArchivalIlluminationPct?.toFixed(2) ?? "—"}
                  </td>
                  <td>{c.balance.shadowEnergyNeedWh.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="tiny muted">
          {ru
            ? "Полоса: 2h·tan(FOV/2), касательная плоскость. FOV камеры 20°, спектрометра 10°, радара 30° — учебные приборы. Mean archival % — среднее исходных отсчётов освещённости, доступных проекту. <5% не классифицирует постоянную тень или лёд. Доступ рассчитан пересечением конуса со сферой; рельеф, сигнал, освещение и обнаружение льда не моделируются."
            : "Swath: 2h·tan(FOV/2), tangent-plane approximation. Camera 20°, spectrometer 10°, radar 30° are illustrative instruments. Mean archival % is the unweighted mean of original illumination samples accessed by each design. Low illumination (<5%) is not a PSR or ice classification. Access uses cone/sphere geometry; terrain, signal return, lighting and ice detection are not modeled."}
        </p>
        <button className="button outlined" onClick={() => s.navigate("orbit")}>
          {ru ? "Пересмотреть орбиту →" : "Revise orbit →"}
        </button>
      </Panel>
      <Panel>
        <h2>{ru ? "Текстура 3D Луны" : "3D Moon texture"}</h2>
        <p>
          {ru
            ? "NASA SVS CGI Moon Kit (2025), LRO LROC / LOLA; Ernie Wright. Карта оптимизирована для визуализации, имеет цветовую коррекцию и заполнение полюсов. Она не используется для численных измерений."
            : "NASA SVS CGI Moon Kit (2025), LRO LROC / LOLA; Ernie Wright. The map is optimized for rendering, with color adjustments and polar fill. It is not used for quantitative measurements."}
        </p>
        <a
          href="https://svs.gsfc.nasa.gov/4720/"
          target="_blank"
          rel="noreferrer"
        >
          NASA SVS source & credits ↗
        </a>
      </Panel>
    </>
  );
}
