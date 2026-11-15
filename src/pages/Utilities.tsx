import { useRef, useState } from "react";
import {
  BookOpen,
  Check,
  CircleAlert,
  Download,
  FileUp,
  Settings2,
  Trash2,
} from "lucide-react";
import { useMissionStore } from "../store/useMissionStore";
import { Heading, Panel } from "../components/common";
import { exportDownload } from "../features/save/export";
import { t } from "../i18n";

export function Help() {
  const s = useMissionStore();
  const l = s.settings.language;
  const entries = [
    {
      name: { ru: "01 / Масса и Δv", en: "01 / Mass & delta-v" },
      formula: "Δv = Isp × 9.80665 × ln(m_wet / m_dry)",
      ru: "Сухая масса — сумма модулей; стартовая — сухая плюс топливо. Носитель ограничивает стартовую массу отдельно от манёвренности аппарата. Требуется Δv профиля и резерв 150 m/s.",
      en: "Dry mass is the sum of modules; wet mass adds propellant. Launcher payload is independent of onboard maneuver capability. The selected profile requires delta-v plus a 150 m/s reserve.",
    },
    {
      name: { ru: "02 / Мощность и энергия", en: "02 / Power & energy" },
      formula: "E_shadow [Wh] = P_shadow [W] × t_shadow [h]",
      ru: "Панели работают с коэффициентами 0.9 × 0.95. Батарея отдаёт 80% × 90% номинала. Выработка должна покрыть пик нагрузки и восполнить энергию тени за каждый виток. В тени приборы работают с duty cycle 40%; передатчик выключен.",
      en: "Solar output uses factors 0.9 × 0.95. Usable battery capacity is 80% × 90% of nominal. Arrays must cover peak load and recharge eclipse energy each orbit. Instruments use 40% duty cycle in eclipse; the transmitter is off.",
    },
    {
      name: { ru: "03 / Данные и память", en: "03 / Data & memory" },
      formula: "D [Gbit] = rate [Mbps] × time [h] × 3600 / 1000",
      ru: "Mbps — мегабиты в секунду, не мегабайты. Данные копятся четыре витка и затем передаются в одном объединённом сеансе. Переполнение памяти безвозвратно теряет данные. Передача ограничена эффективной скоростью и суммой окон связи.",
      en: "Mbps means megabits per second, not megabytes. Data accumulates for four orbits, followed by a combined contact session. Memory overflow permanently loses data. Downlink is limited by effective rate and total contact time.",
    },
    {
      name: { ru: "04 / Доставленная наука", en: "04 / Delivered science" },
      formula:
        "science = Σ(weight) × orbitFactor × programFactor × deliveredFraction",
      ru: "Научные единицы — игровой показатель. Потери памяти и неполная передача пропорционально уменьшают науку. Камера и магнитометр дополняют данные, но для контракта нужен спектрометр или радар.",
      en: "Science units are a game metric. Memory and transmission losses proportionally reduce science. Camera and magnetometer add context, but the contract needs a spectrometer or radar.",
    },
    {
      name: { ru: "05 / Риск и повтор", en: "05 / Risk & replay" },
      formula:
        "New model: shielding index ≥ 0.35; E_extra [Wh] = P [W] × 40/60 [h]",
      ru: "Новые миссии: порог индекса защиты 0.35 при вспышке, расход W × 40/60 h при дополнительной тени. Safe mode уменьшает игровой индекс науки на 8%; снижение нагрузки выключает радар и уменьшает индекс на 3%. Это учебные критерии, не вероятность отказа. Только архивные полёты сохраняют seeded xorshift32.",
      en: "New missions use a 0.35 protection-index threshold during the flare and W × 40/60 h energy consumption during extended eclipse. Safe mode costs 8% of the game science index; reduced load disables radar and costs 3%. These are educational criteria, not failure probabilities. Only archived flights retain seeded xorshift32.",
    },
    {
      name: { ru: "Лунная орбита / модель v2", en: "Lunar orbit / model v2" },
      formula: "T = 2π√(a³/μ); v = √(μ(2/r − 1/a))",
      ru: "μ = 4.90e12 m³/s², R = 1737.4 km. Двухтельная сферическая модель; высота определяет период, скорость и тень. β Солнца задан сценарием. Захват предполагает v∞ = 820 m/s; это не реальный расчёт перелёта. Орбитальное покрытие и архивная освещённость доступны в разделе Наука NASA.",
      en: "μ = 4.90e12 m³/s², R = 1737.4 km. Spherical two-body model: altitude determines period, speed and shadow. Solar beta is assumed by the scenario. Capture assumes v-infinity 820 m/s; this is not a real transfer solution. Explore simulated access and archived illumination in NASA science.",
    },
  ];
  return (
    <>
      <Heading
        eyebrow="ENGINEERING FIELD MANUAL"
        title={t(l, "help")}
        description={t(l, "assumption")}
        action={<BookOpen className="accent" size={30} />}
      />
      <div className="notice warning">
        <CircleAlert size={20} />
        <span>
          {l === "ru"
            ? "Характеристики аппарата и сценарии учебные. Новая модель использует двухтельную динамику Луны. Архивная освещённость NASA приведена в разделе «Наука NASA». Нет расчёта полного теплового режима или сертифицированной надёжности."
            : "Hardware specifications and scenarios are educational. The new model uses lunar two-body dynamics; archived NASA illumination is in NASA science. Full thermal behavior and certified reliability are not modeled."}
        </span>
      </div>
      <div className="help-grid">
        {entries.map((item) => (
          <Panel key={item.name.en}>
            <h2>{item.name[l]}</h2>
            <code className="formula">{item.formula}</code>
            <p className="muted">{item[l]}</p>
          </Panel>
        ))}
        <Panel>
          <h2>
            {l === "ru"
              ? "06 / Снабжение и испытания"
              : "06 / Procurement & qualification"}
          </h2>
          <ol className="demo-list">
            <li>
              {l === "ru"
                ? "Оборудование после покупки поступает на склад. Покупка не устанавливает модуль автоматически."
                : "Purchased equipment enters the warehouse. Buying a part does not install it automatically."}
            </li>
            <li>
              {l === "ru"
                ? "Деталь можно перетащить на узел своей категории или установить кнопкой. Снятая деталь остаётся вашей собственностью."
                : "Drag a part onto its category mount or use Install. Uninstalled equipment remains your property."}
            </li>
            <li>
              {l === "ru"
                ? "До запуска доступны полный возврат оборудования со склада, возврат топлива и замена бронирования носителя."
                : "Before launch, warehouse equipment and fuel are fully refundable; launch reservations can be changed."}
            </li>
            <li>
              {l === "ru"
                ? "Испытания оплачиваются без возврата. Их вклад в игровой индекс устойчивости учитывается только для испытанной конфигурации; изменение состава, топлива, орбиты или носителя делает результат устаревшим."
                : "Tests are non-refundable. Game robustness credit applies only to the tested configuration; changing modules, fuel, orbit or launcher makes results outdated."}
            </li>
            <li>
              {l === "ru"
                ? "В полёте можно отключать приборы, выбирать область измерений, ориентацию антенны и долю окна передачи. Разбор решений доступен после миссии."
                : "In flight, switch instruments, choose observation targets, antenna orientation and allocated contact time. Review decisions after the mission."}
            </li>
          </ol>
          <button
            className="button outlined"
            onClick={() => s.navigate("builder")}
          >
            {t(l, "builder")} →
          </button>
        </Panel>
      </div>
    </>
  );
}

export function Settings() {
  const s = useMissionStore();
  const l = s.settings.language;
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<"error" | "ok" | null>(null);
  return (
    <>
      <Heading
        eyebrow="MISSION PREFERENCES"
        title={t(l, "settings")}
        action={<Settings2 className="accent" size={28} />}
      />
      <div className="settings-grid">
        <Panel>
          <h2>{l === "ru" ? "Интерфейс" : "Interface"}</h2>
          <label className="settings-row">
            {t(l, "language")}
            <select
              value={l}
              onChange={(e) =>
                s.configure({ language: e.target.value as "ru" | "en" })
              }
            >
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
          <label className="settings-row">
            {l === "ru" ? "Режим детализации" : "Detail mode"}
            <select
              value={s.settings.mode}
              onChange={(e) =>
                s.configure({ mode: e.target.value as "learning" | "engineer" })
              }
            >
              <option value="learning">{t(l, "learning")}</option>
              <option value="engineer">{t(l, "engineer")}</option>
            </select>
          </label>
          <label className="settings-row">
            {l === "ru" ? "Графика" : "Graphics"}
            <select
              value={s.settings.graphics}
              onChange={(e) =>
                s.configure({
                  graphics: e.target.value as "3d" | "schematic" | "minimal",
                })
              }
            >
              <option value="3d">
                {l === "ru"
                  ? "3D · интерактивная модель"
                  : "3D · interactive model"}
              </option>
              <option value="schematic">{t(l, "schematic")}</option>
              <option value="minimal">{t(l, "minimal")}</option>
            </select>
          </label>
          <label className="settings-row">
            {t(l, "motion")}
            <input
              type="checkbox"
              checked={s.settings.reducedMotion}
              onChange={(e) => s.configure({ reducedMotion: e.target.checked })}
            />
          </label>
          <label className="settings-row">
            {t(l, "sound")}
            <input
              type="checkbox"
              checked={s.settings.sound}
              onChange={(e) => s.configure({ sound: e.target.checked })}
            />
          </label>
          <p className="tiny muted mt-4">
            {l === "ru"
              ? "Режим «Инженер» раскрывает дополнительные показатели проверки. Оба режима используют одну физическую модель. SVG работает без WebGL."
              : "Engineer mode reveals detailed validation metrics. Both modes use the same physics model. SVG works without WebGL."}
          </p>
        </Panel>
        <Panel>
          <h2>{l === "ru" ? "Сохранения и перенос" : "Save & transfer"}</h2>
          <p className="muted mt-4">
            {l === "ru"
              ? "Прогресс сохраняется автоматически в этом браузере. Экспорт переносит проект, настройки, seed и всю последовательность команд."
              : "Progress is saved automatically in this browser. Export includes your design, settings, seed and the entire command sequence."}
          </p>
          <div className="button-row mt-6">
            <button className="button outlined" onClick={exportDownload}>
              <Download size={16} />
              {t(l, "export")}
            </button>
            <button
              className="button outlined"
              onClick={() => file.current?.click()}
            >
              <FileUp size={16} />
              {t(l, "import")}
            </button>
          </div>
          <input
            ref={file}
            className="sr-only"
            type="file"
            aria-label={t(l, "import")}
            accept="application/json,.json"
            onChange={async (event) => {
              const selected = event.target.files?.[0];
              if (!selected) return;
              try {
                if (selected.size > 200_000) throw new Error("Too large");
                s.importSave(await selected.text());
                setMessage("ok");
              } catch {
                setMessage("error");
              }
              event.target.value = "";
            }}
          />
          {message && (
            <div
              role={message === "error" ? "alert" : "status"}
              className={`notice mt-4 ${message === "error" ? "error" : "good"}`}
            >
              {message === "error" ? (
                <CircleAlert size={18} />
              ) : (
                <Check size={18} />
              )}
              <span>
                {t(l, message === "error" ? "importError" : "importOk")}
              </span>
            </div>
          )}
          <div className="reset-zone">
            <h3>{l === "ru" ? "Начать заново" : "Start over"}</h3>
            <p className="tiny muted">
              {l === "ru"
                ? "Пустой склад, пустой ангар и новый бюджет 110 M$. Для сохранения текущего проекта экспортируйте JSON."
                : "An empty warehouse, empty hangar and a fresh 110 M$ budget. Export JSON to keep the current project."}
            </p>
            <button
              className="button danger-button"
              onClick={() => dialog.current?.showModal()}
            >
              <Trash2 size={16} />
              {t(l, "reset")}
            </button>
          </div>
        </Panel>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="reset-title"
        className="confirm-dialog"
      >
        <h2 id="reset-title">{t(l, "resetTitle")}</h2>
        <p className="muted mt-4">{t(l, "resetText")}</p>
        <div className="button-row mt-6">
          <button
            autoFocus
            className="button outlined"
            onClick={() => dialog.current?.close()}
          >
            {t(l, "cancel")}
          </button>
          <button
            className="button danger-button"
            onClick={() => {
              dialog.current?.close();
              s.reset();
            }}
          >
            {t(l, "confirm")}
          </button>
        </div>
      </dialog>
    </>
  );
}
