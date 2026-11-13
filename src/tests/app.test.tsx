import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../app/App";
import { useMissionStore } from "../store/useMissionStore";
import { goldenBuild } from "../data/missionConfig";
import { replaceModule } from "../engine/calculations";
import { loadLegacyFixture } from "./fixtures";

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  localStorage.clear();
  useMissionStore.getState().reset();
  loadLegacyFixture();
});
describe("application integration", () => {
  it("restarts a finished saved flight atomically without charging or deleting purchases", () => {
    const s = useMissionStore.getState();
    s.command({ type: "Validate" });
    s.command({ type: "Launch", seed: 42 });
    for (let i = 0; i < 25 && !useMissionStore.getState().run.result; i++) {
      const run = useMissionStore.getState().run;
      s.command(
        run.crisis
          ? { type: "ChooseDecision", choice: "safe" }
          : { type: "Advance" },
      );
    }
    const before = useMissionStore.getState();
    expect(before.run.result).toBeDefined();
    s.configure({ playback: "step" });
    s.replayFlight();
    const after = useMissionStore.getState();
    expect(after.build).toEqual(before.build);
    expect(after.economy).toEqual(before.economy);
    expect(after.run.phase).toBe("launched");
    expect(after.run.result).toBeUndefined();
    expect(after.run.paused).toBe(false);
    expect(after.settings.playback).toBe("live");
    expect(after.commands).toEqual([
      { type: "Validate" },
      { type: "Launch", seed: 42 },
    ]);
    expect(after.flightSession).toBeGreaterThan(before.flightSession);
  });
  it("gives consecutive same-phase replays a fresh viewer session and excludes it from the save", () => {
    const s = useMissionStore.getState();
    s.replayFlight();
    const first = useMissionStore.getState();
    s.command({ type: "Pause" });
    s.replayFlight();
    const second = useMissionStore.getState();
    expect(second.run.phase).toBe("launched");
    expect(second.run.paused).toBe(false);
    expect(second.flightSession).toBe(first.flightSession + 1);
    expect(JSON.parse(s.exportSave())).not.toHaveProperty("flightSession");
  });
  it("retains an explicit animation preference after import and honors a later Reduce Motion setting", () => {
    const s = useMissionStore.getState();
    s.configure({ motionPreference: "on" });
    const save = s.exportSave();
    s.reset();
    s.importSave(save);
    expect(useMissionStore.getState().settings.motionPreference).toBe("on");
    s.configure({ reducedMotion: true });
    expect(useMissionStore.getState().settings.motionPreference).toBe("system");
  });
  it.each([
    ["schematic", "3d"],
    ["minimal", "minimal"],
  ] as const)(
    "migrates old %s graphics to %s without changing the mission",
    async (previous, expected) => {
      const store = useMissionStore.getState();
      store.command({ type: "Validate" });
      store.command({ type: "Launch", seed: 42 });
      const legacy = JSON.parse(store.exportSave());
      legacy.settings.graphics = previous;
      const migrate = useMissionStore.persist.getOptions().migrate!;
      const migrated = (await migrate(legacy, 1)) as typeof legacy;
      expect(migrated.settings.graphics).toBe(expected);
      expect(migrated.build).toEqual(legacy.build);
      expect(migrated.commands).toEqual(legacy.commands);
      expect(migrated.seed).toBe(legacy.seed);
    },
  );
  it("T-01 the catalog exposes the radar effect and undo restores launch readiness", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Основная навигация" }),
      ).getByRole("button", { name: "Конструктор" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Купить: Радар IceSAR" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Установить: Радар IceSAR" }),
    );
    expect(screen.getByTestId("balance-energy")).toHaveTextContent("427");
    expect(screen.getByTestId("balance-energy")).not.toHaveTextContent(
      "Нарушение",
    );
    await user.click(screen.getByRole("button", { name: "Отменить" }));
    expect(screen.getByTestId("balance-energy")).toHaveTextContent("227");
  });
  it("T-12 switches the key UI and html language to English", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Язык" }));
    expect(
      screen.getByRole("button", { name: "Open mission brief" }),
    ).toBeVisible();
    expect(document.documentElement.lang).toBe("en");
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  });
  it("T-08 reconstructs the exact in-flight state from exported commands", () => {
    const store = useMissionStore.getState();
    store.command({ type: "Validate" });
    store.command({ type: "Launch", seed: 42 });
    store.command({ type: "Advance" });
    store.command({ type: "ChooseDecision", choice: "safe" });
    const run = useMissionStore.getState().run;
    const save = store.exportSave();
    store.reset();
    store.importSave(save);
    expect(useMissionStore.getState().run).toEqual(run);
  });
  it("locks configuration, seed and undo after launch", () => {
    const store = useMissionStore.getState();
    store.command({ type: "Validate" });
    store.command({ type: "Launch", seed: 42 });
    store.edit(replaceModule(goldenBuild, "camera"));
    store.setSeed(11);
    store.undo();
    expect(useMissionStore.getState().build).toEqual(goldenBuild);
    expect(useMissionStore.getState().seed).toBe(42);
  });
  it("rejects imports atomically and preserves the current game", () => {
    const store = useMissionStore.getState();
    const before = store.exportSave();
    expect(() => store.importSave("{invalid")).toThrow();
    expect(store.exportSave()).toBe(before);
  });
  it("compresses repeated pause/resume commands while preserving replay", () => {
    const store = useMissionStore.getState();
    store.command({ type: "Validate" });
    store.command({ type: "Launch", seed: 42 });
    for (let i = 0; i < 1000; i++) {
      store.command({ type: "Pause" });
      store.command({ type: "Resume" });
    }
    const before = useMissionStore.getState().run;
    expect(useMissionStore.getState().commands.length).toBeLessThan(5);
    store.importSave(store.exportSave());
    expect(useMissionStore.getState().run).toEqual(before);
  });
  it("editing invalidates an earlier validation", () => {
    const store = useMissionStore.getState();
    store.command({ type: "Validate" });
    expect(useMissionStore.getState().run.phase).toBe("validated");
    store.edit(replaceModule(goldenBuild, "camera"));
    expect(useMissionStore.getState().run.phase).toBe("draft");
    expect(useMissionStore.getState().commands).toEqual([]);
  });
});
