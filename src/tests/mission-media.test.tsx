import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { goldenBuild } from "../data/missionConfig";
import { createRun } from "../engine/simulation";
import {
  useAutoCamera,
  trackingReturnMs,
} from "../features/playback/useAutoCamera";
import {
  MissionAudio,
  missionSoundFrame,
} from "../features/playback/missionAudio";
import { useMissionAudio } from "../features/playback/useMissionAudio";
import { useMissionStore } from "../store/useMissionStore";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("automatic camera", () => {
  it("waits until a gesture ends, then returns to tracking after four seconds", () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAutoCamera);
    const stableInteraction = result.current.interact;
    expect(result.current.mode).toBe("follow");
    act(() => result.current.interact(true));
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.mode).toBe("free");
    act(() => result.current.interact(false));
    act(() => vi.advanceTimersByTime(trackingReturnMs - 1));
    expect(result.current.mode).toBe("free");
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.mode).toBe("follow");
    expect(result.current.interact).toBe(stableInteraction);
  });
  it("respects an explicit overview and cancelling automatic tracking", () => {
    vi.useFakeTimers();
    const { result } = renderHook(useAutoCamera);
    act(() => result.current.manualCommand());
    act(() => result.current.select("solar"));
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.mode).toBe("solar");
    expect(result.current.automatic).toBe(false);
    act(() => result.current.select("follow"));
    act(() => result.current.interact(true));
    act(() => result.current.interact(false));
    act(() => result.current.toggle());
    act(() => vi.advanceTimersByTime(10000));
    expect(result.current.mode).toBe("free");
    act(() => result.current.toggle());
    expect(result.current.mode).toBe("follow");
    expect(result.current.launchView).toBe(true);
  });
  it("restarts the return timer for another manual command and clears it on exit", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(useAutoCamera);
    act(() => result.current.manualCommand());
    act(() => vi.advanceTimersByTime(3000));
    act(() => result.current.manualCommand());
    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.mode).toBe("free");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

const launch = {
  ...createRun({
    ...goldenBuild,
    launcherId: "falcon9",
    launchSiteId: "cape-40",
  }),
  phase: "launched" as const,
};
describe("mission sonification", () => {
  it("matches ignition, cutoff, second-stage burns and separation to the visual profile", () => {
    expect(missionSoundFrame(launch, 0).engine).toBe(0);
    expect(missionSoundFrame(launch, 0.2).engine).toBe(1);
    expect(missionSoundFrame(launch, 0.45).engine).toBe(0);
    expect(missionSoundFrame(launch, 0.5).engine).toBe(0.5);
    expect(missionSoundFrame(launch, 0.7).engine).toBe(0);
    expect(missionSoundFrame(launch, 0.8).engine).toBe(0.5);
    expect(missionSoundFrame(launch, 0.95).cue).toBe("separation");
  });
  it("keeps cruise silent, starts radio during contact, and ends loops at stage completion", () => {
    expect(missionSoundFrame({ ...launch, phase: "cruise" }, 0.5).engine).toBe(
      0,
    );
    const downlink = { ...launch, phase: "downlink" as const };
    expect(missionSoundFrame(downlink, 0.1).radio).toBe(0);
    expect(missionSoundFrame(downlink, 0.5).radio).toBeGreaterThan(0);
    expect(missionSoundFrame(downlink, 1).radio).toBe(0);
    expect(
      missionSoundFrame({ ...launch, phase: "orbitInsertion" }, 1).engine,
    ).toBe(0);
    expect(missionSoundFrame({ ...launch, crisis: "eclipse" }, 0.2).cue).toBe(
      "alert",
    );
    expect(
      missionSoundFrame({ ...launch, crisis: "eclipse" }, 0.2).engine,
    ).toBe(0);
  });
});

function audioMock() {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const node = () => {
    const n = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: param(),
      gain: param(),
      onended: null,
    };
    n.connect.mockReturnValue(n);
    return n;
  };
  const gains: ReturnType<typeof node>[] = [];
  const sources: ReturnType<typeof node>[] = [];
  const context = {
    state: "suspended",
    currentTime: 0,
    sampleRate: 100,
    destination: {},
    onstatechange: null,
    createGain: vi.fn(() => {
      const n = node();
      gains.push(n);
      return n;
    }),
    createBuffer: vi.fn(() => ({
      getChannelData: () => new Float32Array(200),
    })),
    createBufferSource: vi.fn(() => {
      const n = node();
      sources.push(n);
      return n;
    }),
    createBiquadFilter: vi.fn(node),
    createOscillator: vi.fn(() => {
      const n = node();
      sources.push(n);
      return n;
    }),
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    close: vi.fn(async () => {
      context.state = "closed";
    }),
  };
  const ctor = vi.fn(function () {
    return context;
  });
  vi.stubGlobal("AudioContext", ctor);
  return { context, ctor, gains, sources };
}
describe("browser audio lifecycle", () => {
  it("creates one context on interaction, deduplicates cues and silences all voices on pause or mute", async () => {
    const { ctor, context, gains, sources } = audioMock();
    const audio = new MissionAudio();
    expect(ctor).not.toHaveBeenCalled();
    await audio.unlock();
    await audio.unlock();
    expect(ctor).toHaveBeenCalledTimes(1);
    expect(context.resume).toHaveBeenCalledTimes(1);
    const frame = missionSoundFrame(launch, 0.2);
    audio.update(frame, true, 0.5);
    const voices = context.createOscillator.mock.calls.length;
    audio.update(frame, true, 0.5);
    expect(context.createOscillator.mock.calls.length).toBe(voices);
    expect(gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(
      0.2,
      0,
      0.04,
    );
    audio.update(frame, false, 0.5);
    for (const gain of gains.slice(0, 3))
      expect(gain.gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
    expect(sources.at(-1)?.stop).toHaveBeenCalled();
    audio.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
    expect(sources[0].stop).toHaveBeenCalled();
    await audio.unlock();
    expect(ctor).toHaveBeenCalledTimes(1);
  });
  it("silences hidden tabs and cleans up the audio context when leaving flight", async () => {
    const { ctor, gains, context } = audioMock();
    useMissionStore.setState((s) => ({
      settings: { ...s.settings, sound: true },
    }));
    const { rerender, unmount } = renderHook(
      ({ run }) => useMissionAudio(run, 0.2, true),
      { initialProps: { run: launch } },
    );
    expect(ctor).not.toHaveBeenCalled();
    await act(async () => {
      window.dispatchEvent(new Event("pointerdown"));
    });
    expect(gains[0].gain.setTargetAtTime.mock.lastCall?.[0]).toBeGreaterThan(0);
    rerender({ run: { ...launch, paused: true } });
    expect(gains[0].gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
    rerender({ run: launch });
    const visibility = vi
      .spyOn(document, "visibilityState", "get")
      .mockReturnValue("hidden");
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(gains[0].gain.setTargetAtTime.mock.lastCall?.[0]).toBe(0);
    visibility.mockRestore();
    unmount();
    expect(context.close).toHaveBeenCalled();
  });
  it("tolerates unavailable audio without affecting mission playback", async () => {
    vi.stubGlobal("AudioContext", undefined);
    const audio = new MissionAudio();
    await expect(audio.unlock()).resolves.toBeUndefined();
    expect(() =>
      audio.update(missionSoundFrame(launch, 0.2), true, 1),
    ).not.toThrow();
    audio.dispose();
  });
});
