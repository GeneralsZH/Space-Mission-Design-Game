import { useState } from "react";
import type { Build, Language } from "../types";
import {
  elementsFor,
  eclipseSeconds,
  orbitalParameters,
} from "../engine/orbital";
import { Panel, Row } from "./common";
export default function OrbitDesigner({
  build,
  language,
  onChange,
  disabled,
}: {
  build: Build;
  language: Language;
  onChange: (build: Build) => void;
  disabled: boolean;
}) {
  const ru = language === "ru",
    initial = elementsFor(build);
  const [draft, setDraft] = useState(() =>
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, String(v)])),
  );
  const fields = [
    {
      id: "periapsisKm",
      ru: "Перицентр, km",
      en: "Periapsis, km",
      min: 20,
      max: 3000,
    },
    {
      id: "apoapsisKm",
      ru: "Апоцентр, km",
      en: "Apoapsis, km",
      min: 20,
      max: 10000,
    },
    {
      id: "inclinationDeg",
      ru: "Наклонение, °",
      en: "Inclination, °",
      min: 0,
      max: 180,
    },
    {
      id: "betaDeg",
      ru: "Солнечный угол β, °",
      en: "Solar beta, °",
      min: -90,
      max: 90,
    },
  ];
  const e = {
    periapsisKm: Number(draft.periapsisKm),
    apoapsisKm: Number(draft.apoapsisKm),
    inclinationDeg: Number(draft.inclinationDeg),
    betaDeg: Number(draft.betaDeg),
  };
  const valid =
    fields.every(
      (f) =>
        draft[f.id] !== "" &&
        Number.isFinite(Number(draft[f.id])) &&
        Number(draft[f.id]) >= f.min &&
        Number(draft[f.id]) <= f.max,
    ) && e.apoapsisKm >= e.periapsisKm;
  const params = valid ? orbitalParameters(e) : null;
  return (
    <Panel className="orbit-designer">
      <p className="eyebrow">CUSTOM LUNAR ORBIT / TWO-BODY MODEL</p>
      <h2>{ru ? "Спроектировать свою орбиту" : "Design a custom orbit"}</h2>
      <p className="muted">
        {ru
          ? "Высоты отсчитываются от средней поверхности Луны. β — заданный сценарный угол Солнца к плоскости орбиты; это не эфемериды даты запуска."
          : "Altitudes are above the mean lunar surface. Beta is an assumed Sun angle to the orbital plane, not launch-date ephemeris data."}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !disabled)
            onChange({
              ...build,
              modelVersion: 2,
              advancedFlight: true,
              customOrbit: e,
            });
        }}
      >
        <fieldset disabled={disabled} className="orbit-designer-fields">
          {fields.map((f) => (
            <label key={f.id}>
              {ru ? f.ru : f.en}
              <input
                className="text-input"
                type="number"
                min={f.min}
                max={f.max}
                step="0.1"
                value={draft[f.id]}
                onChange={(event) =>
                  setDraft({ ...draft, [f.id]: event.target.value })
                }
              />
              <small>
                {f.min}–{f.max}
              </small>
            </label>
          ))}
        </fieldset>
        {!valid && (
          <p role="alert">
            {ru
              ? "Проверьте диапазоны. Апоцентр должен быть не ниже перицентра."
              : "Check the ranges. Apoapsis must be at least periapsis."}
          </p>
        )}
        {params && (
          <div className="orbit-designer-preview">
            <Row
              label={ru ? "Период" : "Period"}
              value={`${(params.periodSeconds / 60).toFixed(2)} min`}
            />
            <Row
              label={ru ? "Скорость" : "Speed"}
              value={`${(params.apoapsisSpeedMs / 1000).toFixed(3)}–${(params.periapsisSpeedMs / 1000).toFixed(3)} km/s`}
            />
            <Row
              label={ru ? "Тень за виток" : "Eclipse / orbit"}
              value={`${(eclipseSeconds(e) / 60).toFixed(1)} min`}
            />
            <Row
              label={
                ru
                  ? "Максимальная широта под аппаратом"
                  : "Maximum sub-spacecraft latitude"
              }
              value={`${Math.min(e.inclinationDeg, 180 - e.inclinationDeg).toFixed(1)}°`}
            />
          </div>
        )}
        <div className="button-row">
          <button
            className="button primary"
            disabled={disabled || !valid}
            type="submit"
          >
            {ru ? "Применить орбиту" : "Apply orbit"}
          </button>
          {build.customOrbit && (
            <button
              className="button outlined"
              disabled={disabled}
              type="button"
              onClick={() => {
                const next = { ...build };
                delete next.customOrbit;
                onChange(next);
              }}
            >
              {ru ? "Вернуть профиль" : "Use preset orbit"}
            </button>
          )}
        </div>
        {build.customOrbit && (
          <p className="tiny accent">
            {ru
              ? "Своя орбита установлена. Расчёты и полёт используют эти параметры."
              : "Custom orbit applied. Calculations and flight use these parameters."}
          </p>
        )}
      </form>
    </Panel>
  );
}
