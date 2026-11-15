import { MapPin, Rocket, Check } from "lucide-react";
import { useMissionStore } from "../store/useMissionStore";
import { launchers } from "../data/missionConfig";
import {
  realVehicles,
  realVehicle,
  launchSites,
  launchSiteFor,
  siteRotationSpeed,
  padCoordinatesSource,
} from "../data/realLaunches";
import { cash } from "../engine/economy";
import { Panel, Row } from "./common";
import "../launch-sites.css";
import SpacecraftView from "./SpacecraftView";
import { publicAsset } from "../features/publicAsset";
export default function RealLaunchDesigner({ locked }: { locked: boolean }) {
  const s = useMissionStore(),
    l = s.settings.language,
    ru = l === "ru",
    vehicle = realVehicle(s.build.launcherId),
    site = launchSiteFor(s.build);
  const previous =
    launchers.find((v) => v.id === s.economy.launcherId)?.costMUsd ?? 0;
  return (
    <Panel className="real-launch-designer">
      <p className="eyebrow">EARTH LAUNCH / REAL VEHICLES</p>
      <h2>{ru ? "Реальная ракета и космодром" : "Real rocket & spaceport"}</h2>
      <p className="muted">
        {ru
          ? "Выберите носитель и совместимую площадку. В полёте изменятся форма ракеты, местность и точка старта на Земле."
          : "Choose a vehicle and a compatible pad. Flight uses its rocket shape, local terrain and geographic launch point."}
      </p>
      <div className="real-vehicle-grid">
        {realVehicles.map((v) => {
          const profile = launchers.find((p) => p.id === v.id)!;
          const selected = s.build.launcherId === v.id;
          return (
            <button
              key={v.id}
              className={`real-vehicle-card ${selected ? "active" : ""}`}
              disabled={
                locked ||
                (!selected && cash(s.economy) + previous < profile.costMUsd)
              }
              aria-label={`${ru ? "Выбрать носитель" : "Select vehicle"}: ${v.name[l]}`}
              aria-pressed={selected}
              onClick={() => s.reserveLauncher(v.id)}
            >
              <Rocket size={22} />
              <strong>{v.name[l]}</strong>
              {selected && <Check size={14} />}
              <span>
                {v.heightM} m · {v.boosters}{" "}
                {ru ? "боковых блоков" : "side boosters"}
              </span>
              <span>
                {ru ? "Учебный запуск" : "Game launch"}: {profile.costMUsd} M$
              </span>
              <small>
                {ru ? "Лунная квота игры" : "Game lunar allocation"}:{" "}
                {profile.payloadKg} kg
              </small>
            </button>
          );
        })}
      </div>
      {vehicle && site ? (
        <>
          <SpacecraftView
            key={vehicle.id}
            build={s.build}
            language={l}
            variant="launch"
          />
          <div className="launch-site-layout">
            <div className="launch-world-map">
              <img
                src={publicAsset("science/earth-blue-marble-1024.png")}
                alt={
                  ru
                    ? "Карта Земли NASA Blue Marble"
                    : "NASA Blue Marble Earth map"
                }
              />
              {launchSites.map((p) => (
                <span
                  key={p.id}
                  className={`launch-map-pin ${p.id === site.id ? "selected" : ""}`}
                  style={{
                    left: `${(p.longitude + 180) / 3.6}%`,
                    top: `${(90 - p.latitude) / 1.8}%`,
                  }}
                  aria-hidden="true"
                />
              ))}
              <span className="launch-map-credit">NASA/GSFC · Blue Marble</span>
            </div>
            <div>
              <p className="eyebrow">
                {ru ? "СТАРТОВЫЕ ПЛОЩАДКИ" : "LAUNCH PADS"}
              </p>
              <div
                className="launch-site-options"
                role="group"
                aria-label={ru ? "Выбор космодрома" : "Launch site selection"}
              >
                {vehicle.sites.map((id) => {
                  const p = launchSites.find((p) => p.id === id)!;
                  return (
                    <button
                      key={id}
                      disabled={locked}
                      aria-pressed={site.id === id}
                      onClick={() => s.edit({ ...s.build, launchSiteId: id })}
                    >
                      <MapPin size={15} />
                      <span>
                        <strong>{p.name[l]}</strong>
                        <small>{p.country[l]}</small>
                      </span>
                      {site.id === id && <Check size={14} />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="launch-site-summary">
            <h3>{site.name[l]}</h3>
            <p>{site.country[l]}</p>
            <Row
              label={ru ? "Координаты, примерно" : "Approximate coordinates"}
              value={`${site.latitude.toFixed(2)}°, ${site.longitude.toFixed(2)}°`}
            />
            <Row
              label={
                ru
                  ? "Вращение Земли на широте старта"
                  : "Earth rotation speed at site"
              }
              value={`≈ ${siteRotationSpeed(site.latitude).toFixed(0)} m/s`}
            />
            <p className="tiny muted">
              {ru
                ? "Скорость поверхности на восток — справочная величина. Она не вычитается из лунного Δv; стартовое окно и траектория выведения здесь не рассчитываются."
                : "Eastward surface speed is a reference value. It is not subtracted from lunar delta-v; launch windows and ascent feasibility are not calculated here."}
            </p>
            <p className="tiny">{vehicle.note[l]}</p>
            <div className="launch-source-links">
              <a href={vehicle.source} target="_blank" rel="noreferrer">
                {ru ? "Носитель: первоисточник ↗" : "Vehicle reference ↗"}
              </a>
              <a href={site.source} target="_blank" rel="noreferrer">
                {ru ? "Площадка: источник ↗" : "Pad reference ↗"}
              </a>
              <a href={padCoordinatesSource} target="_blank" rel="noreferrer">
                {ru ? "Координаты: LL2 ↗" : "Coordinates: LL2 ↗"}
              </a>
            </div>
          </div>
        </>
      ) : (
        <p className="launch-site-empty">
          <MapPin size={16} />
          {ru
            ? "Выберите реальный носитель, чтобы открыть его космодромы."
            : "Choose a real vehicle to view its compatible spaceports."}
        </p>
      )}
      <p className="tiny muted">
        {ru
          ? "Модели узнаваемые, но упрощённые. Цены и выделенная лунная масса — учебные допущения, не коммерческие предложения и не паспортная грузоподъёмность. Доступность пуска в реальную дату не проверяется."
          : "Models are recognisable simplified representations. Prices and lunar allocations are educational assumptions, not commercial offers or published launch performance. Real-date launch availability is not checked."}
      </p>
    </Panel>
  );
}
