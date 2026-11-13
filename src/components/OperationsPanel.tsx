import { catalog } from "../data/missionConfig";
import { useMissionStore } from "../store/useMissionStore";
import type { Operations } from "../types";
import { Panel } from "./common";

export default function OperationsPanel() {
  const s = useMissionStore(),
    run = s.run,
    ops = run.operations;
  const l = s.settings.language,
    ru = l === "ru";
  const locked = !!run.crisis || !!run.result || !!run.incident;
  const update = (change: Partial<Operations>) =>
    s.command({ type: "SetOperations", operations: { ...ops, ...change } });
  return (
    <Panel className="operations-panel">
      <p className="eyebrow">SPACECRAFT UPLINK / COMMAND AUTHORITY</p>
      <h2>{ru ? "Управление бортом" : "Spacecraft operations"}</h2>
      <p className="muted">
        {ru
          ? "Команды применяются к следующему расчётному витку или сеансу связи. Эфир показывает выбранные режимы. Для подготовки команд можно поставить полёт на паузу."
          : "Commands apply to the next simulated orbit or contact session. Live playback shows the selected modes. Pause the flight to prepare commands."}
      </p>
      <fieldset disabled={locked}>
        <legend>{ru ? "Научные приборы" : "Science instruments"}</legend>
        <div className="instrument-switches">
          {catalog
            .filter(
              (c) =>
                c.category === "instrument" &&
                run.build.moduleIds.includes(c.id),
            )
            .map((part) => (
              <label key={part.id}>
                <input
                  type="checkbox"
                  checked={
                    !ops.disabledInstrumentIds.includes(part.id) &&
                    !(run.radarDisabled && part.id === "radar")
                  }
                  disabled={
                    locked || (run.radarDisabled && part.id === "radar")
                  }
                  onChange={(e) =>
                    update({
                      disabledInstrumentIds: e.target.checked
                        ? ops.disabledInstrumentIds.filter(
                            (id) => id !== part.id,
                          )
                        : [...ops.disabledInstrumentIds, part.id],
                    })
                  }
                />
                <span>
                  {part.name[l]}
                  <small>
                    {part.powerW} W · {part.dataMbps} Mbps
                  </small>
                </span>
              </label>
            ))}
        </div>
      </fieldset>
      <div className="operations-selects">
        <label>
          {ru ? "Область наблюдений" : "Observation target"}
          <select
            disabled={locked}
            value={ops.target}
            onChange={(e) =>
              update({ target: e.target.value as Operations["target"] })
            }
          >
            <option value="pole">
              {ru
                ? "Полярные кратеры · ×1 науки"
                : "Polar craters · ×1 science"}
            </option>
            <option value="equator">
              {ru
                ? "Экваториальная съёмка · ×0.65"
                : "Equatorial survey · ×0.65"}
            </option>
          </select>
        </label>
        <label>
          {ru ? "Ориентация антенны" : "Antenna orientation"}
          <select
            disabled={locked}
            value={ops.antenna}
            onChange={(e) =>
              update({ antenna: e.target.value as Operations["antenna"] })
            }
          >
            <option value="earth">
              {ru ? "Направлена на Землю" : "Pointed at Earth"}
            </option>
            <option value="stowed">
              {ru ? "Транспортное положение" : "Stowed"}
            </option>
          </select>
        </label>
        <label>
          {ru ? "Доля окна передачи" : "Allocated contact window"}
          <select
            disabled={locked}
            value={ops.downlinkFraction}
            onChange={(e) =>
              update({
                downlinkFraction: Number(
                  e.target.value,
                ) as Operations["downlinkFraction"],
              })
            }
          >
            {[0.25, 0.5, 1].map((v) => (
              <option key={v} value={v}>
                {v * 100}%
              </option>
            ))}
          </select>
        </label>
      </div>
      {locked && run.crisis && (
        <p className="muted">
          {ru
            ? "Во время нештатного события доступны решения в аварийной панели."
            : "During a crisis, use the decisions in the emergency panel."}
        </p>
      )}
    </Panel>
  );
}
