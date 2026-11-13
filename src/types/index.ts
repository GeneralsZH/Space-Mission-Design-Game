export type Language = "ru" | "en";
export type Text = Record<Language, string>;
export type Category =
  | "bus"
  | "instrument"
  | "communications"
  | "panel"
  | "battery"
  | "propulsion"
  | "thermal"
  | "radiation";
export interface ComponentDef {
  id: string;
  category: Category;
  name: Text;
  description: Text;
  massKg: number;
  costMUsd: number;
  powerW: number;
  dataMbps?: number;
  science?: number;
  tags?: string[];
  downlinkMbps?: number;
  ratedW?: number;
  capacityWh?: number;
  memoryGbit?: number;
  ispSeconds?: number;
  protection?: number;
}
export interface Build {
  moduleIds: string[];
  orbitId: string;
  launcherId: string;
  propellantKg: number;
  testingBudgetMUsd: number;
  overheadMUsd?: number;
}
export type TestKind =
  "power" | "thermal" | "communications" | "vibration" | "legacy";
export interface TestRecord {
  kind: TestKind;
  fingerprint: string;
  costMUsd: number;
  passed: boolean;
  measurements: string[];
}
export interface Economy {
  legacyOverdraftMUsd?: number;
  ownedIds: string[];
  fuelKg: number;
  launcherId: string | null;
  tests: TestRecord[];
}
export interface Operations {
  disabledInstrumentIds: string[];
  target: "pole" | "equator";
  antenna: "earth" | "stowed";
  downlinkFraction: 0.25 | 0.5 | 1;
}
export interface OrbitProfile {
  id: string;
  name: Text;
  description: Text;
  sunHours: number;
  shadowHours: number;
  contactHours: number;
  operatingHours: number;
  scienceFactor: number;
  requiredDeltaV: number;
  payloadFactor: number;
}
export interface LauncherProfile {
  id: string;
  name: Text;
  payloadKg: number;
  costMUsd: number;
}
export type IssueCode =
  | "budget"
  | "mass"
  | "fuel"
  | "sun"
  | "cycle"
  | "battery"
  | "instrument"
  | "slots"
  | "data"
  | "memory"
  | "risk";
export interface Issue {
  code: IssueCode;
  severity: "error" | "warning";
  deficit: number;
}
export interface BalanceReport {
  dryMassKg: number;
  wetMassKg: number;
  payloadKg: number;
  massMarginKg: number;
  availableDeltaV: number;
  requiredDeltaV: number;
  deltaVMargin: number;
  sunPowerW: number;
  peakLoadW: number;
  sunMarginW: number;
  shadowLoadW: number;
  usableBatteryWh: number;
  shadowEnergyNeedWh: number;
  cycleMarginWh: number;
  generatedGbit: number;
  transmittableGbit: number;
  deliveryRatio: number;
  memoryGbit: number;
  sciencePerOrbit: number;
  potentialScience: number;
  costMUsd: number;
  budgetMarginMUsd: number;
  reliability: number;
  issues: Issue[];
}
export type MissionPhase =
  | "draft"
  | "validated"
  | "launched"
  | "cruise"
  | "orbitInsertion"
  | "scienceOperations"
  | "downlink"
  | "incident"
  | "completed"
  | "failed";
export type Crisis = "flare" | "eclipse";
export interface LogEntry {
  phase: MissionPhase;
  hours: number;
  message: Text;
  kind: "info" | "warning" | "success" | "error";
}
export interface Telemetry {
  orbit: number;
  chargeWh: number;
  storedGbit: number;
  deliveredScience: number;
}
export interface MissionResult {
  success: boolean;
  scienceScore: number;
  finalScore: number;
  deliveredScience: number;
  costMUsd: number;
  recommendations: Text[];
}
export interface Diagnostic {
  code: string;
  title: Text;
  actual: string;
  expected: string;
  explanation: Text;
}
export interface Incident {
  kind: "explosion" | "trajectory" | "power" | "communications" | "radiation";
  sourcePhase: MissionPhase;
  triggerProgress: number;
  title: Text;
  observation: Text;
  causes: Diagnostic[];
}
export interface MissionRun {
  incident: Incident | null;
  operations: Operations;
  seed: number;
  rng: number;
  phase: MissionPhase;
  paused: boolean;
  build: Build;
  elapsedHours: number;
  orbit: number;
  chargeWh: number;
  fuelKg: number;
  storedGbit: number;
  transmittedGbit: number;
  generatedGbit: number;
  lostGbit: number;
  storedScience: number;
  deliveredScience: number;
  lostScience: number;
  scienceFactor: number;
  health: number;
  crisis: Crisis | null;
  eclipseResolved: boolean;
  flareResolved: boolean;
  radarDisabled: boolean;
  logs: LogEntry[];
  telemetry: Telemetry[];
  result?: MissionResult;
}
export type MissionCommand =
  | { type: "SetOperations"; operations: Operations }
  | { type: "Launch"; seed: number }
  | { type: "Validate" }
  | { type: "Advance" }
  | { type: "ChooseDecision"; choice: "safe" | "continue" }
  | { type: "Pause" }
  | { type: "Resume" }
  | { type: "Restart" };
export type Page =
  | "hub"
  | "brief"
  | "builder"
  | "orbit"
  | "validation"
  | "control"
  | "report"
  | "help"
  | "settings";
export interface Settings {
  language: Language;
  mode: "learning" | "engineer";
  reducedMotion: boolean;
  motionPreference: "system" | "on" | "off";
  sound: boolean;
  graphics: "3d" | "schematic" | "minimal";
  playback: "live" | "step";
  playbackSpeed: 1 | 2 | 4 | 8;
}
