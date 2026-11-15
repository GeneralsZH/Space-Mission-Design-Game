import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraMode } from "./missionPlayback";

export const trackingReturnMs = 4000;

/** Manual gestures temporarily release tracking; an explicit overview stays put. */
export function useAutoCamera() {
  const [mode, setMode] = useState<CameraMode>("follow");
  const [automatic, setAutomatic] = useState(true);
  const automaticRef = useRef(true);
  const [launchView, setLaunchView] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  useEffect(() => clear, [clear]);
  const returnLater = useCallback(() => {
    clear();
    if (automaticRef.current)
      timer.current = setTimeout(() => {
        setMode("follow");
        setLaunchView(true);
      }, trackingReturnMs);
  }, [clear]);
  const select = useCallback(
    (next: CameraMode) => {
      clear();
      setMode(next);
      automaticRef.current = next === "follow";
      setAutomatic(automaticRef.current);
      if (next !== "free") setLaunchView(next === "follow");
    },
    [clear],
  );
  const interact = useCallback(
    (active: boolean) => {
      clear();
      if (active) setMode("free");
      else returnLater();
    },
    [clear, returnLater],
  );
  const manualCommand = useCallback(() => {
    setMode("free");
    returnLater();
  }, [returnLater]);
  const toggle = useCallback(() => {
    clear();
    automaticRef.current = !automaticRef.current;
    setAutomatic(automaticRef.current);
    setMode(automaticRef.current ? "follow" : "free");
    if (automaticRef.current) setLaunchView(true);
  }, [clear]);
  return {
    mode,
    automatic,
    launchView,
    select,
    interact,
    manualCommand,
    toggle,
  };
}
