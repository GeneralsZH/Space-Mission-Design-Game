import {
  ArrowRight,
  Check,
  CircleAlert,
  Download,
  Rocket,
  RotateCcw,
} from "lucide-react";
import type { ReactNode } from "react";
import { clamp } from "../engine/calculations";
import { canLaunch } from "../engine/incidents";
import { missionConfig } from "../data/missionConfig";
import { issueText, t } from "../i18n";
import { useMissionStore } from "../store/useMissionStore";
import type { BalanceReport, Language } from "../types";
import { fmt } from "./format";
import { exportDownload } from "../features/save/export";

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`panel ${className}`}>{children}</section>;
}
export function Status({
  good,
  children,
}: {
  good: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`status ${good ? "good" : "warn"}`}>
      {good ? <Check size={13} /> : <CircleAlert size={13} />}
      {children}
    </span>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && (
          <p className="muted heading-description">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
export function Row({
  label,
  value,
  className = "",
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={`metric-row ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
export function Bar({
  value,
  danger = false,
}: {
  value: number;
  danger?: boolean;
}) {
  return (
    <div className={`meter ${danger ? "danger" : ""}`}>
      <span style={{ width: `${clamp(value, 0, 100)}%` }} />
    </div>
  );
}
export function FourBalances({
  report,
  compact = false,
}: {
  report: BalanceReport;
  compact?: boolean;
}) {
  const l = useMissionStore((s) => s.settings.language);
  const diagnostic = useMissionStore((s) => !!s.run.result);
  const cards = [
    {
      key: "mass" as const,
      value: report.wetMassKg,
      max: report.payloadKg,
      unit: "kg",
      good: report.massMarginKg >= 0,
      detail: `${t(l, "payload")}: ${fmt(report.payloadKg)} kg`,
    },
    {
      key: "energy" as const,
      value: report.peakLoadW,
      max: report.sunPowerW,
      unit: "W",
      good:
        report.sunMarginW >= 0 &&
        report.cycleMarginWh >= 0 &&
        report.usableBatteryWh >= report.shadowEnergyNeedWh,
      detail: `${t(l, "cycle")}: ${fmt(report.cycleMarginWh)} Wh`,
    },
    {
      key: "data" as const,
      value: report.generatedGbit,
      max: report.transmittableGbit,
      unit: "Gbit",
      good: report.potentialScience >= missionConfig.scienceTarget,
      detail: `${t(l, "memory")}: ${fmt(report.memoryGbit)} Gbit`,
    },
    {
      key: "budget" as const,
      value: report.costMUsd,
      max: missionConfig.budgetMUsd,
      unit: "M$",
      good: report.budgetMarginMUsd >= 0,
      detail: `${t(l, "reserve")}: ${fmt(report.budgetMarginMUsd)} M$`,
    },
  ];
  return (
    <div className={`balances ${compact ? "compact" : ""}`}>
      {cards.map((card, index) => (
        <article
          className="balance-card"
          key={card.key}
          data-testid={`balance-${card.key}`}
        >
          <div className="balance-label">
            <span>
              <small>0{index + 1}</small>
              {t(l, card.key)}
            </span>
            {diagnostic && (
              <Status good={card.good}>
                {t(l, card.good ? "ok" : "blocked")}
              </Status>
            )}
          </div>
          <p className="balance-value">
            {fmt(card.value)}{" "}
            <span>
              {card.unit} <i>/ {fmt(card.max)}</i>
            </span>
          </p>
          <Bar
            value={card.max ? (card.value / card.max) * 100 : 100}
            danger={diagnostic && !card.good}
          />
          <p className="muted tiny">{card.detail}</p>
        </article>
      ))}
    </div>
  );
}
export function Issues({
  report,
  limit,
}: {
  report: BalanceReport;
  limit?: number;
}) {
  const l = useMissionStore((s) => s.settings.language);
  const issues = limit ? report.issues.slice(0, limit) : report.issues;
  if (!issues.length)
    return (
      <div className="notice good">
        <Check size={18} />
        <span>{t(l, "noIssues")}</span>
      </div>
    );
  return (
    <div className="issue-list">
      {issues.map((issue) => (
        <div
          key={issue.code}
          className={`notice ${issue.severity === "error" ? "error" : "warning"}`}
        >
          <CircleAlert size={18} />
          <div>
            <strong>
              {t(l, issue.severity === "error" ? "blocked" : "warning")}
              {issue.deficit > 0 &&
                ` · ${fmt(issue.deficit)} ${issueUnit(issue.code, l)}`}
            </strong>
            <p>{issueText[issue.code][l]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
function issueUnit(code: string, l: Language) {
  return (
    (
      {
        mass: "kg",
        fuel: "m/s",
        sun: "W",
        cycle: "Wh",
        battery: "Wh",
        budget: "M$",
        memory: "Gbit",
        risk: "%",
        data: l === "ru" ? "ед. науки" : "science units",
      } as Record<string, string>
    )[code] ?? ""
  );
}
export function LaunchButton() {
  const s = useMissionStore();
  const l = s.settings.language;
  const ready = canLaunch(s.build);
  const editing = ["draft", "validated"].includes(s.run.phase);
  return (
    <button
      className="button primary launch-button"
      disabled={!ready && editing}
      onClick={() => {
        if (editing) {
          if (s.run.phase === "draft") s.command({ type: "Validate" });
          s.command({ type: "Launch", seed: s.seed });
        }
        s.navigate(s.run.result ? "report" : "control");
      }}
    >
      <Rocket size={17} />
      {t(l, editing ? "launch" : "continue")}
      <ArrowRight size={16} />
    </button>
  );
}
export function ExportButton() {
  const l = useMissionStore((s) => s.settings.language);
  return (
    <button className="button subtle" onClick={exportDownload}>
      <Download size={16} />
      {t(l, "export")}
    </button>
  );
}
export function ReplayButton() {
  const s = useMissionStore(),
    ru = s.settings.language === "ru";
  return (
    <button
      className="button primary"
      onClick={s.replayFlight}
      disabled={!canLaunch(s.build)}
    >
      <RotateCcw size={16} />
      {ru ? "Запустить заново" : "Restart flight"}
    </button>
  );
}
