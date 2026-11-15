import { lazy, Suspense, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  BookOpen,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Globe2,
  LayoutDashboard,
  Orbit,
  Radio,
  Satellite,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { phaseNames, t } from "../i18n";
import { storageError, useMissionStore } from "../store/useMissionStore";
import type { Page } from "../types";
import Builder from "../pages/Builder";
import { Brief, Hub, Orbit as OrbitPage, Validation } from "../pages/Planning";
import { Control, Report } from "../pages/Flight";
import { Help, Settings } from "../pages/Utilities";
import { rememberAttempt } from "../features/reports";
const Science = lazy(() => import("../pages/Science"));
const SolarSystem = lazy(() => import("../pages/SolarSystem"));

const navigation: { page: Page; icon: LucideIcon; number?: string }[] = [
  { page: "hub", icon: LayoutDashboard },
  { page: "brief", icon: FileText, number: "01" },
  { page: "builder", icon: Satellite, number: "02" },
  { page: "orbit", icon: Orbit, number: "03" },
  { page: "validation", icon: ClipboardCheck, number: "04" },
  { page: "control", icon: Radio, number: "05" },
  { page: "report", icon: ShieldCheck, number: "06" },
  { page: "scienceLab", icon: Globe2, number: "07" },
  { page: "solarSystem", icon: Orbit, number: "08" },
];
const pages = {
  solarSystem: SolarSystem,
  scienceLab: Science,
  hub: Hub,
  brief: Brief,
  builder: Builder,
  orbit: OrbitPage,
  validation: Validation,
  control: Control,
  report: Report,
  help: Help,
  settings: Settings,
};
function playTone() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.035, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.07);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
    oscillator.onended = () => {
      void context.close();
    };
  } catch {
    /* Audio can be unavailable in browser policies. */
  }
}
export default function App() {
  const s = useMissionStore();
  const l = s.settings.language;
  const Content = pages[s.page];
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    rememberAttempt(s.run);
  }, [s.run]);
  useEffect(() => {
    document.documentElement.lang = l;
    document.title = `${t(l, s.page)} · Orbital Mission Lab`;
  }, [l, s.page]);
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [s.page]);
  return (
    <div
      className={`app-shell ${s.settings.reducedMotion ? "reduce-motion" : ""}`}
      onClickCapture={(event) => {
        const target = event.target;
        if (
          s.settings.sound &&
          s.page !== "control" &&
          target instanceof Element &&
          target.closest("button:not(:disabled)")
        )
          playTone();
      }}
    >
      <a className="skip-link" href="#main">
        {l === "ru" ? "К содержимому" : "Skip to content"}
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => s.navigate("hub")}
          aria-label="Space Mission Architect"
        >
          <span className="brand-mark">
            <Orbit size={31} strokeWidth={1.4} />
          </span>
          <span>
            ORBITAL MISSION
            <small>
              LAB<span className="accent"> /</span>
            </small>
          </span>
        </button>
        <div className="workspace-tag">
          <span className="signal-dot" />
          ENGINEERING LAB <span>v2.0</span>
        </div>
        <p className="nav-label">
          {l === "ru" ? "ПОЛЁТНАЯ ПРОГРАММА" : "FLIGHT PROGRAM"}
        </p>
        <nav aria-label={l === "ru" ? "Основная навигация" : "Main navigation"}>
          {navigation.map((item) => (
            <button
              key={item.page}
              className={`nav-item ${s.page === item.page ? "active" : ""}`}
              aria-current={s.page === item.page ? "page" : undefined}
              onClick={() => s.navigate(item.page)}
            >
              <item.icon size={17} />
              <span>{t(l, item.page)}</span>
              {item.number && <small aria-hidden="true">{item.number}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <Globe2 size={20} />
            <div>
              <strong>
                {l === "ru" ? "Наземная станция" : "Ground station"}
              </strong>
              <p>
                <span className="signal-dot" />
                {l === "ru" ? "Локальная симуляция" : "Local simulation"}
              </p>
            </div>
          </div>
          <nav
            aria-label={l === "ru" ? "Справка и настройки" : "Help & settings"}
          >
            {(
              [
                { page: "help", icon: BookOpen },
                { page: "settings", icon: Settings2 },
              ] as const
            ).map((item) => (
              <button
                key={item.page}
                className={`nav-item ${s.page === item.page ? "active" : ""}`}
                aria-current={s.page === item.page ? "page" : undefined}
                onClick={() => s.navigate(item.page)}
              >
                <item.icon size={17} />
                <span>{t(l, item.page)}</span>
                <ArrowUpRight size={13} />
              </button>
            ))}
          </nav>
          <div className="sidebar-signature mono">ENGINEER THE POSSIBLE.</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>MISSION 01</span>
            <ChevronRight size={13} />
            <strong>Lunar Ice Mapper</strong>
            <span className="destination">
              / {l === "ru" ? "Луна" : "Moon"}
            </span>
          </div>
          <div className="topbar-actions">
            <button
              className="mobile-utility icon-button"
              aria-label={t(l, "help")}
              onClick={() => s.navigate("help")}
            >
              <BookOpen size={16} />
            </button>
            <button
              className="mobile-utility icon-button"
              aria-label={t(l, "settings")}
              onClick={() => s.navigate("settings")}
            >
              <Settings2 size={16} />
            </button>
            <span className="save-status">
              <CheckCheck size={14} />
              {t(l, storageError ? "unsaved" : "saved")}
            </span>
            <button
              className="language-button"
              aria-label={t(l, "language")}
              onClick={() =>
                s.configure({ language: l === "ru" ? "en" : "ru" })
              }
            >
              <Globe2 size={14} />
              {l.toUpperCase()}
              <span>/ {l === "ru" ? "EN" : "RU"}</span>
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} ref={main} className="page-content">
          {s.build.modelVersion !== 2 && (
            <div className="notice">
              <p>
                {l === "ru"
                  ? "Архивные правила: этот проект сохранён до обновления. Повтор сохраняет прежний исход; пересмотр включает новую модель и сохраняет покупки."
                  : "Archived rules: this project predates the upgrade. Replay preserves its original outcome; revising enables the lunar model and retains purchases."}
              </p>
              <button className="button outlined" onClick={s.restart}>
                {l === "ru"
                  ? "Пересмотреть с новой моделью"
                  : "Revise with lunar model"}
              </button>
            </div>
          )}
          <Suspense fallback={<p className="muted">Loading science lab…</p>}>
            <Content key={s.page === "control" ? s.flightSession : s.page} />
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>{t(l, "assumption")}</span>
          <span className="mono">
            <span className="signal-dot" />
            {phaseNames[s.run.phase][l]} / LIM-01
          </span>
        </footer>
      </div>
    </div>
  );
}
