import { useState } from "react";
import {
  ArrowRight,
  Box,
  Check,
  GripVertical,
  Minus,
  Search,
  ShoppingBag,
  Undo2,
  Warehouse,
  Wrench,
  X,
} from "lucide-react";
import { catalog, categories, physics } from "../data/missionConfig";
import { calculate, replaceModule } from "../engine/calculations";
import { cash, fingerprint, spending, testCosts } from "../engine/economy";
import { categoryNames, t } from "../i18n";
import { useMissionStore } from "../store/useMissionStore";
import {
  ExportButton,
  FourBalances,
  Heading,
  Panel,
  Row,
} from "../components/common";
import { fmt } from "../components/format";
import SpacecraftView from "../components/SpacecraftView";
import type { Category, TestKind } from "../types";

export default function Builder() {
  const s = useMissionStore();
  const l = s.settings.language,
    ru = l === "ru";
  const r = calculate(s.build);
  const [tab, setTab] = useState<"shop" | "warehouse">("shop");
  const [category, setCategory] = useState<Category | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [dragged, setDragged] = useState<string | null>(null);
  const [fuelAmount, setFuelAmount] = useState(10);
  const [message, setMessage] = useState("");
  const locked = !["draft", "validated"].includes(s.run.phase);
  const remaining = cash(s.economy);
  const parts = catalog.filter(
    (p) =>
      (category === "all" || p.category === category) &&
      `${p.name[l]} ${p.description[l]}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (tab === "shop" || s.economy.ownedIds.includes(p.id)),
  );
  const install = (id: string, slot?: Category) => {
    const part = catalog.find((c) => c.id === id);
    if (
      locked ||
      !part ||
      !s.economy.ownedIds.includes(id) ||
      (slot && part.category !== slot) ||
      s.build.moduleIds.includes(id)
    )
      return;
    s.edit(replaceModule(s.build, id));
    setMessage(`${ru ? "Установлено" : "Installed"}: ${part.name[l]}`);
    setSelected(null);
  };
  const testNames: Record<TestKind, string> = {
    power: ru ? "Электропитание" : "Power bench",
    thermal: ru ? "Тепловакуум" : "Thermal vacuum",
    communications: ru ? "Канал связи" : "Radio link",
    vibration: ru ? "Вибростенд" : "Vibration bench",
    legacy: ru ? "Перенесённые испытания" : "Imported qualification",
  };
  return (
    <div className="engineering-lab">
      <Heading
        eyebrow="MISSION DESIGN LAB / INDEPENDENT MODE"
        title={ru ? "Ваш космический проект" : "Your space project"}
        description={
          ru
            ? "Контракт, собственный бюджет и пустой ангар. Каждое решение — ваше."
            : "A contract, your own budget and an empty hangar. Every decision is yours."
        }
        action={<ExportButton />}
      />
      <div
        className="lab-finances"
        aria-label={ru ? "Бюджет проекта" : "Project budget"}
      >
        <div>
          <span>{ru ? "На счету" : "Available funds"}</span>
          <strong data-testid="cash">
            {fmt(remaining, 2)} <small>M$</small>
          </strong>
        </div>
        <div>
          <span>{ru ? "Закупки и испытания" : "Procurement & tests"}</span>
          <strong>
            {fmt(spending(s.economy), 2)} <small>/ 110 M$</small>
          </strong>
        </div>
        <div>
          <span>{ru ? "На борту / в собственности" : "Installed / owned"}</span>
          <strong>
            {s.build.moduleIds.length}{" "}
            <small>/ {s.economy.ownedIds.length}</small>
          </strong>
        </div>
        <div className="lab-contract">
          <span>LIM-01 / {ru ? "КОНТРАКТ" : "CONTRACT"}</span>
          <strong>
            120{" "}
            <small>
              {ru ? "ед. науки на Земле" : "science units to Earth"}
            </small>
          </strong>
        </div>
      </div>
      {locked && (
        <div className="notice warning">
          <span>{t(l, "locked")}</span>
          <button className="text-button" onClick={s.restart}>
            {t(l, "restart")}
          </button>
        </div>
      )}
      <div className="lab-layout">
        <Panel className="procurement-panel">
          <div
            className="procurement-tabs"
            role="tablist"
            aria-label={ru ? "Снабжение" : "Procurement"}
          >
            <button
              role="tab"
              aria-selected={tab === "shop"}
              onClick={() => setTab("shop")}
            >
              <ShoppingBag size={17} />
              {ru ? "Магазин" : "Store"}
            </button>
            <button
              role="tab"
              aria-selected={tab === "warehouse"}
              onClick={() => setTab("warehouse")}
            >
              <Warehouse size={17} />
              {ru ? "Склад" : "Warehouse"}
              <span>{s.economy.ownedIds.length}</span>
            </button>
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label={t(l, "search")}
              placeholder={t(l, "search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            className="text-input"
            aria-label={ru ? "Категория" : "Category"}
            value={category}
            onChange={(e) => setCategory(e.target.value as Category | "all")}
          >
            <option value="all">{t(l, "all")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryNames[c][l]}
              </option>
            ))}
          </select>
          <div className="procurement-list">
            {!parts.length && (
              <div className="empty-inventory">
                <Box size={36} />
                <h3>{ru ? "Здесь пока пусто" : "Nothing here yet"}</h3>
                <p>
                  {tab === "warehouse"
                    ? ru
                      ? "Купленное оборудование появится на складе."
                      : "Purchased equipment appears here."
                    : t(l, "noMatches")}
                </p>
              </div>
            )}
            {parts.map((part) => {
              const owned = s.economy.ownedIds.includes(part.id),
                installed = s.build.moduleIds.includes(part.id);
              return (
                <article
                  key={part.id}
                  data-testid={`module-${part.id}`}
                  className={`procurement-card ${selected === part.id ? "selected" : ""}`}
                  draggable={!locked && owned && !installed}
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", part.id);
                    e.dataTransfer.effectAllowed = "move";
                    setDragged(part.id);
                  }}
                  onDragEnd={() => setDragged(null)}
                >
                  <div className="procurement-card-head">
                    <span className="module-icon">
                      {owned && !installed ? (
                        <GripVertical size={18} />
                      ) : installed ? (
                        <Check size={18} />
                      ) : (
                        <Box size={18} />
                      )}
                    </span>
                    <div>
                      <small>{categoryNames[part.category][l]}</small>
                      <h3>{part.name[l]}</h3>
                    </div>
                    <strong>
                      {part.costMUsd}
                      <small> M$</small>
                    </strong>
                  </div>
                  <p>{part.description[l]}</p>
                  <dl className="part-facts">
                    <div>
                      <dt>{ru ? "Масса" : "Mass"}</dt>
                      <dd>{part.massKg} kg</dd>
                    </div>
                    <div>
                      <dt>
                        {part.ratedW
                          ? ru
                            ? "Выработка"
                            : "Output"
                          : part.capacityWh
                            ? ru
                              ? "Ёмкость"
                              : "Capacity"
                            : ru
                              ? "Нагрузка"
                              : "Load"}
                      </dt>
                      <dd>
                        {part.ratedW ?? part.capacityWh ?? part.powerW}{" "}
                        {part.capacityWh ? "Wh" : "W"}
                      </dd>
                    </div>
                    {part.memoryGbit !== undefined && (
                      <div>
                        <dt>{ru ? "Память" : "Memory"}</dt>
                        <dd>{part.memoryGbit} Gbit</dd>
                      </div>
                    )}
                    {part.dataMbps !== undefined && (
                      <div>
                        <dt>{ru ? "Поток" : "Data"}</dt>
                        <dd>{part.dataMbps} Mbps</dd>
                      </div>
                    )}
                    {part.science !== undefined && (
                      <div>
                        <dt>{t(l, "science")}</dt>
                        <dd>
                          {part.science} / {ru ? "виток" : "orbit"}
                        </dd>
                      </div>
                    )}
                    {part.downlinkMbps !== undefined && (
                      <div>
                        <dt>{ru ? "Передача" : "Downlink"}</dt>
                        <dd>{part.downlinkMbps} Mbps</dd>
                      </div>
                    )}
                    {part.ispSeconds !== undefined && (
                      <div>
                        <dt>Isp</dt>
                        <dd>{part.ispSeconds} s</dd>
                      </div>
                    )}
                    {part.protection !== undefined && (
                      <div>
                        <dt>{ru ? "Защита" : "Protection"}</dt>
                        <dd>{part.protection}</dd>
                      </div>
                    )}
                  </dl>
                  {!owned ? (
                    <button
                      className="button primary full"
                      disabled={locked || remaining < part.costMUsd}
                      onClick={() => {
                        s.buy(part.id);
                        setMessage(
                          `${ru ? "Куплено" : "Purchased"}: ${part.name[l]}`,
                        );
                      }}
                      aria-label={`${ru ? "Купить" : "Buy"}: ${part.name[l]}`}
                    >
                      <ShoppingBag size={15} />
                      {remaining < part.costMUsd
                        ? ru
                          ? "Недостаточно средств"
                          : "Insufficient funds"
                        : ru
                          ? "Купить на склад"
                          : "Buy for warehouse"}
                    </button>
                  ) : (
                    <div className="part-actions">
                      {installed ? (
                        <button
                          className="button subtle"
                          disabled={locked}
                          aria-label={`${t(l, "remove")}: ${part.name[l]}`}
                          onClick={() =>
                            s.edit(replaceModule(s.build, part.id))
                          }
                        >
                          <Minus size={14} />
                          {ru ? "Снять на склад" : "Uninstall"}
                        </button>
                      ) : (
                        <>
                          <button
                            className="button outlined"
                            disabled={locked}
                            aria-label={`${t(l, "add")}: ${part.name[l]}`}
                            onClick={() => install(part.id)}
                          >
                            <Wrench size={14} />
                            {ru ? "Установить" : "Install"}
                          </button>
                          <button
                            className="icon-button"
                            disabled={locked}
                            aria-label={`${ru ? "Выбрать" : "Select"}: ${part.name[l]}`}
                            onClick={() => setSelected(part.id)}
                          >
                            <ArrowRight size={16} />
                          </button>
                        </>
                      )}
                      {!installed && (
                        <button
                          className="text-button"
                          disabled={locked}
                          onClick={() => {
                            s.sell(part.id);
                            setSelected(null);
                          }}
                          aria-label={`${ru ? "Вернуть" : "Return"}: ${part.name[l]}`}
                        >
                          {ru ? "Вернуть" : "Return"} +{part.costMUsd} M$
                        </button>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          <p className="tiny muted">
            {ru
              ? "Учебные деньги. До запуска оборудование и топливо возвращаются за полную стоимость. Испытания не возвращаются."
              : "Simulated currency. Hardware and fuel are fully refundable before launch. Tests are non-refundable."}
          </p>
        </Panel>
        <div className="hangar-column">
          <Panel className="hangar-panel">
            <div className="panel-title">
              <div>
                <p className="eyebrow">ASSEMBLY BAY / 01</p>
                <h2>{ru ? "Орбитальная мастерская" : "Orbital workshop"}</h2>
              </div>
              <span className="tag">
                {s.build.moduleIds.length ? "LIM-01" : "EMPTY BAY"}
              </span>
            </div>
            <div className={`hangar-stage ${dragged ? "dragging-part" : ""}`}>
              <SpacecraftView build={s.build} language={l} />
              {!s.build.moduleIds.length && (
                <div className="empty-hangar">
                  <Box size={40} />
                  <strong>
                    {ru ? "Проект ещё не собран" : "Your project is empty"}
                  </strong>
                  <span>
                    {ru
                      ? "Купите оборудование и установите его из склада"
                      : "Buy equipment and install it from the warehouse"}
                  </span>
                </div>
              )}
            </div>
            <div className="attachment-header">
              <span>
                {selected
                  ? `${ru ? "Выбрано" : "Selected"}: ${catalog.find((c) => c.id === selected)?.name[l]}`
                  : ru
                    ? "Узлы крепления · перетащите деталь со склада"
                    : "Attachment points · drag a part from the warehouse"}
              </span>
              {selected && (
                <button
                  className="icon-button"
                  aria-label={ru ? "Отменить выбор" : "Clear selection"}
                  onClick={() => setSelected(null)}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="attachment-grid">
              {categories.map((c) => {
                const mounted = s.build.moduleIds.filter(
                    (id) => catalog.find((p) => p.id === id)?.category === c,
                  ),
                  candidate = catalog.find(
                    (p) => p.id === (dragged ?? selected),
                  );
                return (
                  <button
                    key={c}
                    className={`attachment-slot ${mounted.length ? "occupied" : ""} ${candidate?.category === c ? "compatible" : ""}`}
                    data-testid={`slot-${c}`}
                    disabled={locked}
                    onClick={() => {
                      if (selected) install(selected, c);
                      else {
                        setCategory(c);
                        setTab("warehouse");
                      }
                    }}
                    onDragOver={(e) => {
                      if (candidate?.category === c) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      install(e.dataTransfer.getData("text/plain"), c);
                      setDragged(null);
                    }}
                  >
                    <span>{categoryNames[c][l]}</span>
                    <strong>
                      {mounted.length
                        ? mounted
                            .map(
                              (id) => catalog.find((p) => p.id === id)!.name[l],
                            )
                            .join(" · ")
                        : ru
                          ? "Свободный узел"
                          : "Empty mount"}
                    </strong>
                  </button>
                );
              })}
            </div>
            <div className="installed-chips">
              {s.build.moduleIds.map((id) => (
                <button
                  key={id}
                  className="chip"
                  disabled={locked}
                  onClick={() => s.edit(replaceModule(s.build, id))}
                  aria-label={`${ru ? "Снять со сборки" : "Detach"}: ${catalog.find((p) => p.id === id)!.name[l]}`}
                >
                  {catalog.find((p) => p.id === id)!.name[l]}
                  <X size={12} />
                </button>
              ))}
            </div>
            <button
              className="text-button"
              disabled={locked || !s.history.length}
              onClick={s.undo}
            >
              <Undo2 size={14} />
              {t(l, "undo")}
            </button>
          </Panel>
          <Panel className="fuel-purchase">
            <div>
              <p className="eyebrow">PROPELLANT DEPOT</p>
              <h2>{ru ? "Заправка аппарата" : "Propellant depot"}</h2>
              <p className="muted">
                {physics.propellantCostPerKg} M$ / kg ·{" "}
                {ru ? "максимум" : "maximum"} {physics.maxPropellantKg} kg
              </p>
            </div>
            <strong>
              {fmt(s.economy.fuelKg, 0)} <small>kg</small>
            </strong>
            <label>
              {ru ? "Количество, kg" : "Amount, kg"}
              <input
                className="text-input"
                type="number"
                min={1}
                max={physics.maxPropellantKg}
                step={1}
                value={fuelAmount}
                onChange={(e) => setFuelAmount(Number(e.target.value))}
              />
            </label>
            <div className="button-row">
              <button
                className="button primary"
                disabled={
                  locked ||
                  !Number.isInteger(fuelAmount) ||
                  fuelAmount <= 0 ||
                  s.economy.fuelKg + fuelAmount > physics.maxPropellantKg ||
                  fuelAmount * physics.propellantCostPerKg > remaining
                }
                onClick={() => s.fuel(s.economy.fuelKg + fuelAmount)}
              >
                {ru ? "Купить" : "Buy"} ·{" "}
                {fmt(fuelAmount * physics.propellantCostPerKg, 2)} M$
              </button>
              <button
                className="button subtle"
                disabled={
                  locked ||
                  fuelAmount <= 0 ||
                  !Number.isInteger(fuelAmount) ||
                  fuelAmount > s.economy.fuelKg
                }
                onClick={() => s.fuel(s.economy.fuelKg - fuelAmount)}
              >
                {ru ? "Слить и вернуть" : "Drain & refund"}
              </button>
            </div>
          </Panel>
        </div>
      </div>
      <div className="lab-status" role="status">
        {message ||
          (ru
            ? "Все изменения сохраняются автоматически"
            : "All changes are saved automatically")}
      </div>
      <FourBalances report={r} />
      <div className="lab-lower-grid">
        <Panel>
          <p className="eyebrow">QUALIFICATION LAB</p>
          <h2>{ru ? "Наземные испытания" : "Ground qualification"}</h2>
          <p className="muted">
            {ru
              ? "Каждый запуск стенда оплачивается отдельно. Результат относится к конкретной конфигурации. Можно лететь без испытаний; их вклад в надёжность будет равен нулю."
              : "Each bench run is paid separately and applies to its tested configuration. Testing is optional; untested designs receive no testing reliability credit."}
          </p>
          <p className="tiny muted">
            {ru
              ? "Вибростенд — учебная проверка массы и носителя, тепловакуум — проверка энергии тени. Это упрощённые модели."
              : "Vibration uses a mass/envelope model; thermal vacuum checks eclipse energy. These are simplified models."}
          </p>
          <div className="test-benches">
            {(Object.keys(testCosts) as Exclude<TestKind, "legacy">[]).map(
              (kind) => {
                const done = s.economy.tests.find(
                  (t) =>
                    t.kind === kind && t.fingerprint === fingerprint(s.build),
                );
                return (
                  <article className="test-bench" key={kind}>
                    <div>
                      <h3>{testNames[kind]}</h3>
                      <span>{testCosts[kind]} M$</span>
                    </div>
                    {done ? (
                      <>
                        <span className="tag">
                          {ru ? "Протокол получен" : "Test recording available"}
                        </span>
                        {done.measurements.map((m) => (
                          <code key={m}>{m}</code>
                        ))}
                      </>
                    ) : (
                      <button
                        className="button outlined"
                        disabled={
                          locked ||
                          !s.build.moduleIds.length ||
                          remaining < testCosts[kind]
                        }
                        onClick={() => s.test(kind)}
                      >
                        {ru ? "Провести испытание" : "Run test"}
                      </button>
                    )}
                  </article>
                );
              },
            )}
          </div>
          {s.economy.tests.some(
            (t) => t.fingerprint !== fingerprint(s.build),
          ) && (
            <details className="test-history">
              <summary>
                {ru
                  ? "Архив испытаний предыдущих конфигураций"
                  : "Previous configuration test archive"}
              </summary>
              {s.economy.tests
                .filter((t) => t.fingerprint !== fingerprint(s.build))
                .map((test, i) => (
                  <div key={i}>
                    <strong>
                      {testNames[test.kind]} · {test.costMUsd} M$ ·{" "}
                      {ru ? "Устарело" : "Outdated"}
                    </strong>
                    {test.measurements.map((m) => (
                      <code key={m}>{m}</code>
                    ))}
                  </div>
                ))}
            </details>
          )}
        </Panel>
        <Panel>
          <p className="eyebrow">PROJECT TELEMETRY</p>
          <h2>{ru ? "Параметры конструкции" : "Design measurements"}</h2>
          <Row
            label={t(l, "availableDv")}
            value={`${fmt(r.availableDeltaV, 0)} m/s`}
          />
          <Row label={t(l, "requiredDv")} value={`${r.requiredDeltaV} m/s`} />
          <Row
            label={ru ? "Энергия тени / запас" : "Eclipse / usable battery"}
            value={`${fmt(r.shadowEnergyNeedWh)} / ${fmt(r.usableBatteryWh)} Wh`}
          />
          <p className="muted">
            {ru
              ? "Склад и все проведённые испытания включены в стоимость проекта. Решение о запуске принимаете вы."
              : "Warehouse inventory and all paid tests count toward project cost. You authorize the launch."}
          </p>
          <button
            className="button primary full"
            onClick={() => s.navigate("orbit")}
          >
            {ru ? "Орбита и покупка запуска" : "Orbit & launch procurement"}
            <ArrowRight size={16} />
          </button>
          <button
            className="text-button full"
            onClick={() => s.navigate("validation")}
          >
            {t(l, "validate")} →
          </button>
        </Panel>
      </div>
    </div>
  );
}
