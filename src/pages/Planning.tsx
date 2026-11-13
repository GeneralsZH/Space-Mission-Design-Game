import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crosshair,
  Globe2,
  Radar,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import {
  launchers,
  catalog,
  missionConfig as mission,
  orbits,
} from "../data/missionConfig";
import { calculate } from "../engine/calculations";
import { phaseNames, t } from "../i18n";
import { useMissionStore } from "../store/useMissionStore";
import {
  Bar,
  Heading,
  LaunchButton,
  Panel,
  Row,
  ReplayButton,
} from "../components/common";
import { fmt } from "../components/format";
import Moon from "../components/Moon";
import { cash } from "../engine/economy";

export function Hub() {
  const s = useMissionStore();
  const l = s.settings.language;
  return (
    <>
      {!["draft", "validated"].includes(s.run.phase) && (
        <Panel className="saved-flight-banner">
          <div>
            <p className="eyebrow">
              {l === "ru" ? "СОХРАНЁННЫЙ ПОЛЁТ" : "SAVED FLIGHT"}
            </p>
            <h2>
              {s.run.result
                ? l === "ru"
                  ? "Предыдущий полёт завершён"
                  : "Your previous flight has ended"
                : s.run.paused
                  ? l === "ru"
                    ? "Полёт сохранён на паузе"
                    : "Your flight is paused"
                  : l === "ru"
                    ? "Продолжить или посмотреть сначала"
                    : "Continue or watch from the beginning"}
            </h2>
            <p>
              {l === "ru"
                ? "Обновление страницы сохраняет прогресс в этом браузере. Повторный запуск начнёт полёт с нуля с той же сборкой и покупками."
                : "Refreshing restores this browser's progress. Restart the flight from liftoff using your existing spacecraft and purchases."}
            </p>
          </div>
          <div className="button-row">
            <ReplayButton />
            <button
              className="button outlined"
              onClick={() => {
                if (s.run.result) s.navigate("report");
                else {
                  s.configure({ playback: "live" });
                  if (s.run.paused) s.command({ type: "Resume" });
                  s.navigate("control");
                }
              }}
            >
              {s.run.result
                ? t(l, "report")
                : l === "ru"
                  ? "Продолжить в эфире"
                  : "Continue live"}
            </button>
            <button
              className="text-button"
              onClick={() => s.navigate("settings")}
            >
              {l === "ru" ? "Новый проект →" : "New project →"}
            </button>
          </div>
        </Panel>
      )}
      <div className="hub-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="signal-dot" />
            MISSION DESIGN LAB
          </p>
          <h1>
            {l === "ru" ? (
              <>
                Следующая
                <br />
                остановка — <em>Луна.</em>
              </>
            ) : (
              <>
                Next stop.
                <br />
                The <em>Moon.</em>
              </>
            )}
          </h1>
          <p>
            {l === "ru"
              ? "Постройте аппарат. Сбалансируйте системы. Доставьте науку на Землю. Ваши решения определяют исход миссии."
              : "Build a spacecraft. Balance its systems. Bring science home. Your decisions determine the mission outcome."}
          </p>
          <div className="button-row">
            <button
              className="button primary"
              onClick={() => s.navigate("brief")}
            >
              {t(l, "begin")}
              <ArrowRight size={18} />
            </button>
            <button
              className="button subtle"
              onClick={() => s.navigate("help")}
            >
              {t(l, "learn")} ↗
            </button>
          </div>
          <div className="hero-coordinate mono">
            TARGET 89.9° S / 00.0° E<br />
            <span>SOUTH POLAR REGION</span>
          </div>
        </div>
        <div className="hero-lunar">
          <Moon />
          <span className="lunar-label mono">
            MOON / LUNA
            <br />
            <strong>384,400 km</strong>
          </span>
          <span className="lunar-tag">01 — LUNAR ICE MAPPER</span>
        </div>
      </div>
      <div className="hub-lower">
        <Panel className="mission-card">
          <div>
            <p className="eyebrow">ACTIVE CONTRACT / 001</p>
            <h2>Lunar Ice Mapper</h2>
            <p className="muted">{mission.objectives[l]}</p>
          </div>
          <div className="contract-stats">
            <div>
              <small>{t(l, "budget")}</small>
              <strong>
                110 <span>M$</span>
              </strong>
            </div>
            <div>
              <small>{t(l, "science")}</small>
              <strong>
                120 <span>{l === "ru" ? "ед." : "units"}</span>
              </strong>
            </div>
            <div>
              <small>{l === "ru" ? "Научные витки" : "Science orbits"}</small>
              <strong>04</strong>
            </div>
          </div>
          <button
            className="button outlined full"
            onClick={() =>
              s.navigate(
                s.run.result
                  ? "report"
                  : s.run.phase === "draft" || s.run.phase === "validated"
                    ? "builder"
                    : "control",
              )
            }
          >
            {t(l, "continue")}
            <ArrowRight size={16} />
          </button>
          <span className="tiny muted">
            {phaseNames[s.run.phase][l]} · SEED {s.seed}
          </span>
        </Panel>
        <div className="principle-cards">
          {[
            {
              icon: Radar,
              n: "01",
              ru: "Наука начинается с выбора",
              en: "Science starts with a choice",
              ruText: "Больше приборов — больше данных, массы и потребления.",
              enText: "More instruments mean more data, mass and power.",
            },
            {
              icon: ShieldCheck,
              n: "02",
              ru: "Идеальных решений нет",
              en: "There is no perfect design",
              ruText:
                "Управляйте ограничениями и реагируйте на нештатные события.",
              enText: "Manage constraints and respond to unexpected events.",
            },
            {
              icon: Globe2,
              n: "03",
              ru: "Миссия — это результат",
              en: "Delivery is the mission",
              ruText: "Измерения имеют ценность, когда они достигли Земли.",
              enText: "Measurements have value when they reach Earth.",
            },
          ].map((item) => (
            <article key={item.n}>
              <item.icon size={24} />
              <span className="mono">{item.n}</span>
              <h3>{l === "ru" ? item.ru : item.en}</h3>
              <p>{l === "ru" ? item.ruText : item.enText}</p>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

export function Brief() {
  const s = useMissionStore();
  const l = s.settings.language;
  return (
    <>
      <Heading
        eyebrow="MISSION BRIEF / LIM-01"
        title="Lunar Ice Mapper"
        description={mission.destination[l]}
      />
      <div className="brief-grid">
        <Panel className="brief-objective">
          <Crosshair className="accent" size={34} />
          <p className="eyebrow mt-6">{t(l, "objective")}</p>
          <h2>{mission.objectives[l]}</h2>
          <p className="muted">
            {l === "ru"
              ? "Вы — главный системный инженер. Контракт оплачивает закупки, испытания и запуск. Выберите приборы для полярных кратеров, обеспечьте питание в тени и устойчивый канал связи."
              : "You are the chief systems engineer. The contract covers hardware, testing and launch. Choose polar crater instruments, ensure eclipse power and establish a reliable downlink."}
          </p>
          <div className="notice warning">
            <ShieldCheck size={19} />
            <span>{t(l, "assumption")}</span>
          </div>
        </Panel>
        <Panel>
          <p className="eyebrow">MISSION REQUIREMENTS</p>
          <h2>{t(l, "requirements")}</h2>
          <ol className="requirements-list">
            <li>
              <span>01</span>
              {l === "ru"
                ? "Спектрометр или радар для определения состава."
                : "Spectrometer or radar for composition measurements."}
            </li>
            <li>
              <span>02</span>
              {l === "ru"
                ? "Доставить на Землю ≥ 120 единиц науки."
                : "Deliver ≥ 120 science units to Earth."}
            </li>
            <li>
              <span>03</span>
              {l === "ru"
                ? "Сохранить аппарат до завершения передачи."
                : "Keep the spacecraft alive through downlink."}
            </li>
          </ol>
          <Row label={t(l, "budget")} value="≤ 110 M$" />
          <Row
            label={l === "ru" ? "Длительность" : "Duration"}
            value={l === "ru" ? "≤ 7 суток" : "≤ 7 days"}
          />
          <Row
            label={l === "ru" ? "Наблюдения" : "Observations"}
            value={l === "ru" ? "4 условных витка" : "4 simulated orbits"}
          />
          <p className="tiny muted mt-4">
            {l === "ru"
              ? "На старте: 110 M$, пустой склад и ангар. Покупки, испытания и запуск оплачиваются из одного бюджета. Готовой сборки нет."
              : "Start with 110 M$, an empty warehouse and hangar. Hardware, tests and launch share one budget. There is no prebuilt design."}
          </p>
          <button
            className="button primary full"
            onClick={() => s.navigate("builder")}
          >
            {t(l, "build")}
            <ArrowRight size={17} />
          </button>
        </Panel>
      </div>
    </>
  );
}

export function Orbit() {
  const s = useMissionStore();
  const l = s.settings.language;
  const r = calculate(s.build);
  const locked = !["draft", "validated"].includes(s.run.phase);
  return (
    <>
      <Heading
        eyebrow="TRAJECTORY DESIGN / 02"
        title={t(l, "orbit")}
        description={
          l === "ru"
            ? "Носитель доставляет массу. Бортовой двигатель обеспечивает манёвры. Это разные ограничения."
            : "The launcher carries mass. The onboard engine performs maneuvers. These are separate constraints."
        }
      />
      {locked && <div className="notice warning">{t(l, "locked")}</div>}
      <div className="orbit-layout">
        <div>
          <h2 className="section-title">
            01 / {l === "ru" ? "Профиль орбиты" : "Orbit profile"}
          </h2>
          <div className="option-stack">
            {orbits.map((o) => (
              <button
                key={o.id}
                disabled={locked}
                className={`option-card ${s.build.orbitId === o.id ? "active" : ""}`}
                onClick={() => s.edit({ ...s.build, orbitId: o.id })}
              >
                <div className="option-head">
                  <h3>{o.name[l]}</h3>
                  <span className="radio-dot">
                    {s.build.orbitId === o.id && <Check size={12} />}
                  </span>
                </div>
                <p>{o.description[l]}</p>
                <div className="option-specs">
                  <span>Δv {o.requiredDeltaV} m/s</span>
                  <span>
                    {l === "ru" ? "Тень" : "Eclipse"}{" "}
                    {fmt(o.shadowHours * 60, 0)} min
                  </span>
                  <span>
                    {l === "ru" ? "Связь" : "Contact"}{" "}
                    {fmt(o.contactHours * 60)} min
                  </span>
                  <span>
                    {t(l, "science")} ×{o.scienceFactor}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <h2 className="section-title mt-6">
            02 / {l === "ru" ? "Ракета-носитель" : "Launch vehicle"}
          </h2>
          <div className="launcher-options">
            {launchers.map((launcher) => (
              <button
                key={launcher.id}
                disabled={
                  locked ||
                  (s.economy.launcherId !== launcher.id &&
                    cash(s.economy) +
                      (launchers.find((v) => v.id === s.economy.launcherId)
                        ?.costMUsd ?? 0) <
                      launcher.costMUsd)
                }
                className={`option-card launcher-card ${s.build.launcherId === launcher.id ? "active" : ""}`}
                onClick={() =>
                  s.reserveLauncher(
                    s.economy.launcherId === launcher.id ? null : launcher.id,
                  )
                }
              >
                <Rocket size={25} />
                <h3>{launcher.name[l]}</h3>
                <strong>{launcher.payloadKg} kg</strong>
                <p>{launcher.costMUsd} M$</p>
                <span className="tag">
                  {s.economy.launcherId === launcher.id
                    ? l === "ru"
                      ? "Оплачено · вернуть"
                      : "Paid · refund"
                    : l === "ru"
                      ? "Купить запуск"
                      : "Purchase launch"}
                </span>
              </button>
            ))}
          </div>
          <p className="muted mt-4">
            {l === "ru"
              ? "При замене носителя возвращается стоимость предыдущего бронирования. После запуска конфигурация фиксируется."
              : "Changing launchers refunds the previous reservation. Configuration locks at launch."}
          </p>
        </div>
        <Panel className="trajectory-summary">
          <div className="panel-title">
            <h2>{l === "ru" ? "Профиль выведения" : "Delivery profile"}</h2>
            <span className="tag">LUNA</span>
          </div>
          <Moon />
          <Row label={t(l, "wetMass")} value={`${fmt(r.wetMassKg)} kg`} />
          <Row label={t(l, "payload")} value={`${fmt(r.payloadKg)} kg`} />
          <Bar
            value={r.payloadKg ? (r.wetMassKg / r.payloadKg) * 100 : 0}
            danger={r.massMarginKg < 0}
          />
          <Row
            label={t(l, "availableDv")}
            value={`${fmt(r.availableDeltaV, 0)} m/s`}
          />
          <Row label={t(l, "requiredDv")} value={`${r.requiredDeltaV} m/s`} />
          <button
            className="button primary full"
            onClick={() => s.navigate("validation")}
          >
            {t(l, "validate")}
            <ArrowRight size={16} />
          </button>
        </Panel>
      </div>
      <div className="button-row mt-6">
        <button className="button subtle" onClick={() => s.navigate("builder")}>
          <ArrowLeft size={16} />
          {t(l, "builder")}
        </button>
      </div>
    </>
  );
}

export function Validation() {
  const s = useMissionStore(),
    l = s.settings.language,
    ru = l === "ru";
  const r = calculate(s.build);
  const locked = !["draft", "validated"].includes(s.run.phase);
  return (
    <>
      <Heading
        eyebrow="LAUNCH AUTHORITY / YOUR DECISION"
        title={ru ? "Подготовка к запуску" : "Launch preparation"}
        description={
          ru
            ? "Вы принимаете решение о старте. После зажигания проект изменить нельзя."
            : "You authorize the launch. The configuration locks at ignition."
        }
      />
      <div className="validation-grid">
        <Panel>
          <p className="eyebrow">FLIGHT CONFIGURATION</p>
          <h2>{ru ? "Состав полётного проекта" : "Flight manifest"}</h2>
          <Row label={t(l, "wetMass")} value={`${fmt(r.wetMassKg)} kg`} />
          <Row label={t(l, "fuel")} value={`${fmt(s.build.propellantKg)} kg`} />
          <Row
            label={ru ? "Оплаченный носитель" : "Purchased launch vehicle"}
            value={
              launchers.find((v) => v.id === s.build.launcherId)?.name[l] ??
              (ru ? "Не куплен" : "Not purchased")
            }
          />
          <Row
            label={t(l, "orbit")}
            value={orbits.find((o) => o.id === s.build.orbitId)!.name[l]}
          />
          <Row label={t(l, "cost")} value={`${fmt(r.costMUsd, 2)} M$`} />
          <ul className="flight-manifest">
            {s.build.moduleIds.map((id) => (
              <li key={id}>{catalog.find((c) => c.id === id)!.name[l]}</li>
            ))}
          </ul>
          <button
            className="button subtle"
            onClick={() => s.navigate("builder")}
          >
            {t(l, "builder")} ↗
          </button>
        </Panel>
        <Panel>
          <p className="eyebrow">IGNITION SEQUENCE</p>
          <h2>{ru ? "Разрешение на старт" : "Launch authorization"}</h2>
          <p className="muted mt-4">
            {ru
              ? "Технические характеристики и протоколы оплаченных испытаний доступны в мастерской. Решение о готовности аппарата принимаете вы."
              : "Equipment specifications and paid test recordings are available in the workshop. You decide whether the spacecraft is ready."}
          </p>
          <label className="field-label" htmlFor="seed">
            {t(l, "seed")}
          </label>
          <input
            className="text-input"
            id="seed"
            type="number"
            min="0"
            max="4294967295"
            step="1"
            disabled={locked}
            value={s.seed}
            onChange={(e) => s.setSeed(Number(e.target.value))}
          />
          <p className="tiny muted mt-4">
            {ru
              ? "Одинаковый seed и одинаковые команды воспроизводят тот же исход. После полёта будут доступны запись событий и разбор причин."
              : "The same seed and commands reproduce the same outcome. Event recordings and cause analysis are available after the flight."}
          </p>
          {!s.build.moduleIds.length || s.build.launcherId === "none" ? (
            <p className="muted mt-4">
              {ru
                ? "Для старта нужен оплаченный носитель и хотя бы один установленный модуль."
                : "A purchased launch vehicle and at least one installed module are required to start."}
            </p>
          ) : null}
          <LaunchButton />
        </Panel>
      </div>
    </>
  );
}
