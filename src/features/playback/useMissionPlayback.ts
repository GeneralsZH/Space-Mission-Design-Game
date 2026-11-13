import { useEffect, useRef, useState } from "react";
import type { MissionRun } from "../../types";
import { useMissionStore } from "../../store/useMissionStore";
import { playbackKey, stageDuration } from "./missionPlayback";
import type { PlaybackFrame } from "./missionPlayback";

export function useMissionPlayback(run: MissionRun, ready: boolean) {
  const playback = useMissionStore((s) => s.settings.playback);
  const speed = useMissionStore((s) => s.settings.playbackSpeed);
  const key = playbackKey(run);
  const clock = useRef<PlaybackFrame>({ key, seconds: 0, progress: 0 });
  const [frame, setFrame] = useState<PlaybackFrame>({
    key,
    seconds: 0,
    progress: 0,
  });
  useEffect(() => {
    if (clock.current.key !== key)
      clock.current = { key, seconds: 0, progress: 0 };
    const duration = stageDuration(run);
    if (!ready || run.paused || run.crisis || run.result || duration === 0)
      return;
    let request = 0;
    let previous: number | null = null;
    let lastPaint = -Infinity;
    let disposed = false;
    const tick = (timestamp: number) => {
      if (disposed) return;
      if (document.visibilityState === "hidden") {
        previous = null;
        request = requestAnimationFrame(tick);
        return;
      }
      const delta =
        previous === null
          ? 0
          : Math.min(0.2, Math.max(0, (timestamp - previous) / 1000));
      previous = timestamp;
      const seconds = clock.current.seconds + delta * speed;
      clock.current = {
        key,
        seconds,
        progress: Math.min(1, seconds / duration),
      };
      if (timestamp - lastPaint >= 90) {
        setFrame({ ...clock.current });
        lastPaint = timestamp;
      }
      if (playback === "live" && seconds >= duration) {
        const current = useMissionStore.getState();
        if (
          current.page === "control" &&
          playbackKey(current.run) === key &&
          !current.run.paused &&
          !current.run.crisis &&
          !current.run.result &&
          current.settings.playback === "live"
        )
          current.command({ type: "Advance" });
        return;
      }
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => {
      disposed = true;
      cancelAnimationFrame(request);
    };
  }, [key, run, ready, playback, speed]);
  return {
    clock,
    frame: frame.key === key ? frame : { key, seconds: 0, progress: 0 },
  };
}
