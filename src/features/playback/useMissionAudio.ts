import { useCallback, useEffect, useRef, useState } from "react";
import type { MissionRun } from "../../types";
import { useMissionStore } from "../../store/useMissionStore";
import { missionSoundFrame, MissionAudio } from "./missionAudio";

export function useMissionAudio(
  run: MissionRun,
  progress: number,
  playing: boolean,
) {
  const enabled = useMissionStore((s) => s.settings.sound);
  const configure = useMissionStore((s) => s.configure);
  const audio = useRef<MissionAudio | null>(null);
  const [state, setState] = useState("waiting");
  const [visible, setVisible] = useState(document.visibilityState !== "hidden");
  const [volume, setVolume] = useState(0.5);
  const unlock = useCallback(() => {
    void audio.current?.unlock();
  }, []);
  useEffect(() => {
    const instance = new MissionAudio();
    audio.current = instance;
    instance.onState = () => setState(instance.state);
    return () => {
      instance.dispose();
      audio.current = null;
    };
  }, []);
  useEffect(() => {
    const changed = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", changed);
    return () => document.removeEventListener("visibilitychange", changed);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    // Entering flight after Launch/Navigation already has user activation.
    if (navigator.userActivation?.hasBeenActive) unlock();
    // Resume must be invoked directly from a trusted gesture (including portal UI).
    window.addEventListener("pointerdown", unlock, { capture: true });
    window.addEventListener("keydown", unlock, { capture: true });
    return () => {
      window.removeEventListener("pointerdown", unlock, { capture: true });
      window.removeEventListener("keydown", unlock, { capture: true });
    };
  }, [enabled, unlock]);
  useEffect(() => {
    audio.current?.update(
      missionSoundFrame(run, progress),
      enabled && visible && playing && !run.paused,
      volume,
    );
  }, [run, progress, enabled, visible, playing, volume, state]);
  const toggle = () => {
    if (!enabled || state !== "running") {
      unlock();
      configure({ sound: true });
    } else configure({ sound: false });
  };
  return { enabled, state, volume, setVolume, toggle };
}
