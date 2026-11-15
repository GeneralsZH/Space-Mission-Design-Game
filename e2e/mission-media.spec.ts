import { expect, test } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";

test.use({
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  },
});
test.setTimeout(90000);

test("automatic tracking recovers after gestures and real audio obeys pause, mute and volume", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (build) => {
      // Observe real Web Audio output, without replacing its signal processing.
      const audioWindow = window as typeof window & {
        missionAudioProbe: {
          context: AudioContext;
          analyser: AnalyserNode;
          gain: GainNode;
        }[];
      };
      audioWindow.missionAudioProbe = [];
      const Original = window.AudioContext;
      window.AudioContext = class extends Original {
        constructor(...args: ConstructorParameters<typeof AudioContext>) {
          super(...args);
          const createGain = this.createGain.bind(this);
          let first = true;
          this.createGain = () => {
            const gain = createGain();
            if (first) {
              first = false;
              const analyser = this.createAnalyser();
              gain.connect(analyser);
              audioWindow.missionAudioProbe.push({
                context: this,
                analyser,
                gain,
              });
            }
            return gain;
          };
        }
      };
      localStorage.setItem("orbital-flight-view", "immersive");
      localStorage.setItem(
        "space-mission-architect-v1",
        JSON.stringify({
          version: 3,
          state: {
            schemaVersion: 1,
            build,
            seed: 42,
            commands: [{ type: "Validate" }, { type: "Launch", seed: 42 }],
            settings: {
              language: "en",
              graphics: "3d",
              mode: "learning",
              sound: true,
              reducedMotion: false,
              motionPreference: "on",
              playback: "step",
              playbackSpeed: 1,
            },
          },
        }),
      );
    },
    {
      ...goldenBuild,
      launcherId: "falcon9",
      launchSiteId: "cape-40",
      modelVersion: 2 as const,
      advancedFlight: true,
    },
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Mission control", exact: true })
    .click();
  const canvas = page.locator(".immersive-flight canvas");
  const auto = page.getByRole("button", {
    name: "Automatic tracking",
    exact: true,
  });
  const sound = page.getByRole("button", { name: "Flight sound", exact: true });
  await expect(canvas).toHaveAttribute("data-launch-view", "surface", {
    timeout: 30000,
  });
  await expect(auto).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(sound).toHaveAttribute("data-audio-state", "running");
  const output = () =>
    page.evaluate(() => {
      const audioWindow = window as typeof window & {
        missionAudioProbe: {
          context: AudioContext;
          analyser: AnalyserNode;
          gain: GainNode;
        }[];
      };
      const probe = audioWindow.missionAudioProbe.find(
        (p) => p.context.state === "running",
      );
      if (!probe) return -1;
      const data = new Float32Array(probe.analyser.fftSize);
      probe.analyser.getFloatTimeDomainData(data);
      return Math.sqrt(data.reduce((sum, v) => sum + v * v, 0) / data.length);
    });
  await expect.poll(output).toBeLessThan(0.0001);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(output, { timeout: 20000 }).toBeGreaterThan(0.001);
  const initial = await canvas.getAttribute("data-camera-position");
  await expect
    .poll(() => canvas.getAttribute("data-camera-position"))
    .not.toBe(initial);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(output).toBeLessThan(0.0001);

  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, {
    steps: 8,
  });
  await expect(canvas).toHaveAttribute("data-camera-mode", "free");
  await page.mouse.up();
  await expect(canvas).toHaveAttribute("data-camera-mode", "follow", {
    timeout: 10000,
  });
  await auto.click();
  await expect(auto).toHaveAttribute("aria-pressed", "false");
  await expect(canvas).toHaveAttribute("data-camera-mode", "free");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(auto).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(output).toBeGreaterThan(0.001);
  await page.getByRole("slider", { name: "Flight volume" }).fill("0");
  await expect.poll(output).toBeLessThan(0.0001);
  await page.getByRole("slider", { name: "Flight volume" }).fill("0.5");
  await expect.poll(output).toBeGreaterThan(0.001);
  await sound.click();
  await expect(sound).toHaveAttribute("data-audio-state", "muted");
  await expect.poll(output).toBeLessThan(0.0001);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state
            .settings.sound,
      ),
    )
    .toBe(false);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await sound.click();
  await expect(sound).toHaveAttribute("data-audio-state", "running");
  await expect.poll(output).toBeLessThan(0.0001);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(auto).toBeInViewport();
  await expect(sound).toBeInViewport();
  const a = (await auto.boundingBox())!;
  const b = (await sound.boundingBox())!;
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + 1);
  const metrics = (await page.locator(".immersive-metrics").boundingBox())!;
  expect(b.y + b.height).toBeLessThanOrEqual(metrics.y);
  await page.screenshot({
    path: "test-results/screenshots/mission-media-mobile.png",
  });
  expect(errors).toEqual([]);
});
