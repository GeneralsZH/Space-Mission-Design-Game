import { useMissionStore } from "../../store/useMissionStore";
export function exportDownload() {
  const blob = new Blob([useMissionStore.getState().exportSave()], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "lunar-ice-mapper.json";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
