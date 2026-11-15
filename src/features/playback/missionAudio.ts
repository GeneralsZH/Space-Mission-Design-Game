import type { MissionRun } from "../../types";
import { realVehicle } from "../../data/realLaunches";
import { ascentState } from "./ascentProfile";
import { visualStageProgress } from "./missionPlayback";

export type AudioCue = "stage" | "separation" | "alert" | "success" | "failure";
export interface SoundFrame {
  engine: number;
  radio: number;
  cue: AudioCue | null;
  key: string;
}

/** Designed sonification, not recordings or propagation of sound through vacuum. */
export function missionSoundFrame(
  run: MissionRun,
  progress: number,
): SoundFrame {
  const p = visualStageProgress(run, progress);
  let engine = 0,
    radio = 0,
    cue: AudioCue | null = "stage";
  let detail = "";
  if (run.phase === "launched") {
    if (realVehicle(run.build.launcherId)) {
      const ascent = ascentState(p);
      engine = ascent.coreBurn ? 1 : ascent.upperBurn ? 0.5 : 0;
      detail =
        ascent.released > 0
          ? "separation"
          : ascent.staging > 0
            ? "staging"
            : "launch";
      if (detail === "separation") cue = "separation";
    } else {
      engine = p < 0.78 ? 1 : 0;
      detail = p >= 0.78 ? "separation" : "launch";
      if (detail === "separation") cue = "separation";
    }
  } else if (run.phase === "orbitInsertion") engine = 0.4;
  else if (run.phase === "downlink") radio = progress >= 0.22 ? 0.025 : 0;
  if (progress >= 1 || run.incident || run.crisis || run.result) {
    engine = 0;
    radio = 0;
  }
  if (run.incident || run.crisis) cue = "alert";
  if (run.result) cue = run.result.success ? "success" : "failure";
  return {
    engine,
    radio,
    cue,
    key: `${run.phase}:${run.orbit}:${run.crisis ?? ""}:${run.incident?.kind ?? ""}:${run.result?.success ?? ""}:${detail}`,
  };
}

export class MissionAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engine: GainNode | null = null;
  private radio: GainNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private voices = new Set<OscillatorNode>();
  private lastCue = "";
  private disposed = false;
  onState: () => void = () => {};
  get state() {
    return this.context?.state === "running" ? "running" : "waiting";
  }
  async unlock() {
    if (this.disposed) return;
    try {
      if (!this.context) {
        const Constructor =
          window.AudioContext ??
          (window as Window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!Constructor) return;
        const ctx = new Constructor();
        this.context = ctx;
        ctx.onstatechange = () => this.onState();
        this.master = ctx.createGain();
        this.master.gain.value = 0;
        this.master.connect(ctx.destination);
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        const filter = ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 240;
        this.engine = ctx.createGain();
        this.engine.gain.value = 0;
        noise.connect(filter).connect(this.engine).connect(this.master);
        const radio = ctx.createOscillator();
        radio.frequency.value = 1350;
        this.radio = ctx.createGain();
        this.radio.gain.value = 0;
        radio.connect(this.radio).connect(this.master);
        this.sources = [noise, radio];
        noise.start();
        radio.start();
      }
      if (this.context.state === "suspended") await this.context.resume();
      if (!this.disposed) this.onState();
    } catch {
      // A browser can refuse audio; the visual mission remains usable.
    }
  }
  update(frame: SoundFrame, audible: boolean, volume: number) {
    const ctx = this.context;
    if (!ctx || this.disposed || !this.master || !this.engine || !this.radio)
      return;
    const now = ctx.currentTime;
    this.master.gain.setTargetAtTime(
      audible ? Math.max(0, Math.min(1, volume)) * 0.4 : 0,
      now,
      0.04,
    );
    this.engine.gain.setTargetAtTime(
      audible ? frame.engine * 0.65 : 0,
      now,
      0.08,
    );
    this.radio.gain.setTargetAtTime(audible ? frame.radio : 0, now, 0.04);
    if (!audible) {
      for (const voice of this.voices) voice.stop();
      this.voices.clear();
      return;
    }
    if (ctx.state !== "running" || frame.key === this.lastCue) return;
    this.lastCue = frame.key;
    const notes =
      frame.cue === "alert" || frame.cue === "failure"
        ? [220, 165]
        : frame.cue === "success"
          ? [523, 659, 784]
          : frame.cue === "separation"
            ? [440, 880]
            : [660];
    if (!frame.cue) return;
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const start = now + index * 0.17;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
      oscillator.connect(gain).connect(this.master!);
      this.voices.add(oscillator);
      oscillator.onended = () => {
        this.voices.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(start + 0.16);
    });
  }
  dispose() {
    this.disposed = true;
    for (const source of this.sources) {
      source.stop();
      source.disconnect();
    }
    for (const voice of this.voices) {
      voice.stop();
      voice.disconnect();
    }
    this.voices.clear();
    if (this.context) {
      this.context.onstatechange = null;
      void this.context.close().catch(() => {});
    }
    this.context = null;
  }
}
