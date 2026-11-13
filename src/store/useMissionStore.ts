import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { catalog, launchers, physics } from "../data/missionConfig";
import {
  cash,
  emptyBuild,
  emptyEconomy,
  fingerprint,
  makeTest,
  syncBuild,
  testCosts,
} from "../engine/economy";
import { buildSchema } from "./schema";
import { createRun, transition } from "../engine/simulation";
import { canLaunch } from "../engine/incidents";
import type {
  Build,
  MissionCommand,
  MissionRun,
  Page,
  Settings,
  Economy,
  TestKind,
} from "../types";
import { parseSave, replay } from "./schema";
import type { SaveData } from "./schema";

export const STORAGE_KEY = "space-mission-architect-v1";
export let storageError = false;
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      storageError = true;
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
      storageError = false;
    } catch {
      storageError = true;
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      storageError = true;
    }
  },
};
export const defaultSettings: Settings = {
  language: "ru",
  mode: "learning",
  reducedMotion: false,
  motionPreference: "system",
  sound: false,
  graphics: "3d",
  playback: "live",
  playbackSpeed: 1,
};
interface MissionStore extends SaveData {
  run: MissionRun;
  page: Page;
  flightSession: number;
  history: Build[];
  change: { before: Build; after: Build } | null;
  navigate: (page: Page) => void;
  edit: (build: Build) => void;
  buy: (id: string) => void;
  sell: (id: string) => void;
  fuel: (kg: number) => void;
  reserveLauncher: (id: string | null) => void;
  test: (kind: Exclude<TestKind, "legacy">) => void;
  transact: (economy: Economy) => void;
  undo: () => void;
  configure: (settings: Partial<Settings>) => void;
  setSeed: (seed: number) => void;
  command: (command: MissionCommand) => void;
  restart: () => void;
  replayFlight: () => void;
  reset: () => void;
  importSave: (content: string) => void;
  exportSave: () => string;
}
const pickSave = (state: SaveData): SaveData => ({
  schemaVersion: 2,
  economy: state.economy,
  build: state.build,
  settings: state.settings,
  seed: state.seed,
  commands: state.commands,
});
export const useMissionStore = create<MissionStore>()(
  persist<MissionStore, [], [], SaveData>(
    (set, get) => ({
      schemaVersion: 2,
      economy: emptyEconomy(),
      build: structuredClone(emptyBuild),
      settings: { ...defaultSettings },
      seed: 42,
      commands: [],
      run: createRun(emptyBuild),
      page: "hub",
      flightSession: 0,
      history: [],
      change: null,
      navigate: (page) => set({ page }),
      transact: (economy) => {
        const state = get();
        if (
          !["draft", "validated"].includes(state.run.phase) ||
          (cash(economy) < -0.000001 &&
            cash(economy) < cash(state.economy) - 0.000001)
        )
          return;
        const build = syncBuild(state.build, economy);
        set({
          economy,
          build,
          run: createRun(build, state.seed),
          commands: [],
          history: [],
          change: { before: state.build, after: build },
        });
      },
      buy: (id) => {
        const state = get();
        if (
          !catalog.some((c) => c.id === id) ||
          state.economy.ownedIds.includes(id)
        )
          return;
        state.transact({
          ...state.economy,
          ownedIds: [...state.economy.ownedIds, id],
        });
      },
      sell: (id) => {
        const state = get();
        if (
          !state.economy.ownedIds.includes(id) ||
          state.build.moduleIds.includes(id)
        )
          return;
        state.transact({
          ...state.economy,
          ownedIds: state.economy.ownedIds.filter((v) => v !== id),
        });
      },
      fuel: (kg) => {
        const state = get();
        if (!Number.isFinite(kg) || kg < 0 || kg > physics.maxPropellantKg)
          return;
        state.transact({ ...state.economy, fuelKg: kg });
      },
      reserveLauncher: (id) => {
        const state = get();
        if (id !== null && !launchers.some((l) => l.id === id)) return;
        state.transact({ ...state.economy, launcherId: id });
      },
      test: (kind) => {
        const state = get();
        if (
          !(kind in testCosts) ||
          !state.build.moduleIds.length ||
          state.economy.tests.length >= 100 ||
          state.economy.tests.some(
            (t) =>
              t.kind === kind && t.fingerprint === fingerprint(state.build),
          )
        )
          return;
        state.transact({
          ...state.economy,
          tests: [...state.economy.tests, makeTest(kind, state.build)],
        });
      },
      edit: (build) => {
        const state = get();
        if (!["draft", "validated"].includes(state.run.phase)) return;
        if (
          !buildSchema.safeParse(build).success ||
          build.moduleIds.some((id) => !state.economy.ownedIds.includes(id)) ||
          build.launcherId !== (state.economy.launcherId ?? "none") ||
          build.propellantKg !== state.economy.fuelKg ||
          build.testingBudgetMUsd !== state.build.testingBudgetMUsd ||
          (build.overheadMUsd ?? 0) !== (state.build.overheadMUsd ?? 0)
        )
          return;
        build = syncBuild(build, state.economy);
        set({
          build,
          history: [...state.history.slice(-19), state.build],
          run: createRun(build, state.seed),
          commands: [],
          change: { before: state.build, after: build },
        });
      },
      undo: () => {
        const state = get();
        const entry = state.history.at(-1);
        const previous = entry ? syncBuild(entry, state.economy) : undefined;
        if (!previous || !["draft", "validated"].includes(state.run.phase))
          return;
        set({
          build: previous,
          history: state.history.slice(0, -1),
          run: createRun(previous, state.seed),
          commands: [],
          change: { before: state.build, after: previous },
        });
      },
      configure: (settings) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...(settings.reducedMotion !== undefined
              ? { motionPreference: "system" as const }
              : {}),
            ...settings,
          },
        })),
      setSeed: (seed) => {
        const state = get();
        if (!["draft", "validated"].includes(state.run.phase)) return;
        if (Number.isInteger(seed) && seed >= 0 && seed <= 4294967295)
          set({ seed, run: createRun(state.build, seed), commands: [] });
      },
      command: (command) => {
        const state = get();
        if (command.type === "Restart") {
          state.restart();
          return;
        }
        if (
          state.commands.length >= 499 &&
          !["Pause", "Resume"].includes(command.type)
        )
          return;
        const run = transition(state.run, command);
        if (run === state.run) return;
        const previous = state.commands.at(-1)?.type;
        const commands =
          ["Pause", "Resume"].includes(command.type) &&
          previous &&
          ["Pause", "Resume"].includes(previous)
            ? [...state.commands.slice(0, -1), command]
            : [...state.commands, command];
        set({ run, commands });
      },
      replayFlight: () => {
        const state = get();
        if (!canLaunch(state.build)) return;
        const commands: MissionCommand[] = [
          { type: "Validate" },
          { type: "Launch", seed: state.seed },
        ];
        set({
          run: replay(state.build, state.seed, commands),
          commands,
          page: "control",
          flightSession: state.flightSession + 1,
          history: [],
          change: null,
          settings: { ...state.settings, playback: "live" },
        });
      },
      restart: () => {
        const state = get();
        set({
          run: createRun(state.build, state.seed),
          commands: [],
          page: "builder",
          history: [],
          change: null,
          flightSession: state.flightSession + 1,
        });
      },
      reset: () =>
        set((state) => ({
          build: structuredClone(emptyBuild),
          economy: emptyEconomy(),
          settings: { ...defaultSettings },
          seed: 42,
          commands: [],
          run: createRun(emptyBuild),
          history: [],
          change: null,
          page: "hub",
          flightSession: state.flightSession + 1,
        })),
      exportSave: () => JSON.stringify(pickSave(get()), null, 2),
      importSave: (content) => {
        const data = parseSave(content);
        const run = replay(data.build, data.seed, data.commands);
        set({
          ...data,
          run,
          flightSession: get().flightSession + 1,
          history: [],
          change: null,
          page: run.result
            ? "report"
            : ["draft", "validated"].includes(run.phase)
              ? "builder"
              : "control",
        });
      },
    }),
    {
      name: STORAGE_KEY,
      version: 3,
      migrate: (persisted, version) => {
        const data = parseSave(JSON.stringify(persisted));
        return {
          ...data,
          settings: {
            ...data.settings,
            graphics:
              version === 1 && data.settings.graphics === "schematic"
                ? "3d"
                : data.settings.graphics,
          },
        };
      },
      storage: createJSONStorage(() => safeStorage),
      partialize: pickSave,
      onRehydrateStorage: () => (_state, error) => {
        if (error) storageError = true;
      },
      merge: (persisted, current) => {
        if (persisted == null) return current;
        try {
          const data = parseSave(JSON.stringify(persisted));
          return {
            ...current,
            ...data,
            run: replay(data.build, data.seed, data.commands),
          };
        } catch {
          storageError = true;
          return current;
        }
      },
    },
  ),
);
