import { goldenBuild } from "../data/missionConfig";
import { defaultSettings, useMissionStore } from "../store/useMissionStore";

// Regression fixture imported through the same migration path as a real v1 save.
export function loadLegacyFixture() {
  useMissionStore.getState().importSave(
    JSON.stringify({
      schemaVersion: 1,
      build: goldenBuild,
      settings: defaultSettings,
      seed: 42,
      commands: [],
    }),
  );
  useMissionStore.getState().navigate("hub");
}
