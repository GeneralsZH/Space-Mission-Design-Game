import { test, expect } from "@playwright/test";
import type { Page, Locator } from "@playwright/test";
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
test.describe.configure({ timeout: 120000 });
async function start(page: Page, mobile = false, bad = false) {
  if (mobile) await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(
    ({ build, bad }) => {
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
              mode: "learning",
              graphics: "3d",
              sound: false,
              reducedMotion: false,
              motionPreference: "on",
              playback: bad ? "live" : "step",
              playbackSpeed: 1,
            },
          },
        }),
      );
    },
    {
      bad,
      build: {
        ...goldenBuild,
        modelVersion: 2,
        advancedFlight: true,
        launcherId: bad ? "soyuz2" : "falcon9",
        launchSiteId: bad ? "baikonur-31" : "cape-40",
        ...(bad ? { propellantKg: 300 } : {}),
      },
    },
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Mission control", exact: true })
    .click();
  const canvas = page.locator(".immersive-flight canvas");
  await expect(canvas).toHaveAttribute("data-launch-view", "surface", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-playback-paused", "true");
  return canvas;
}
async function reach(page: Page, canvas: Locator, progress: number) {
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(
      async () => Number(await canvas.getAttribute("data-flight-progress")),
      { timeout: 30000, intervals: [50] },
    )
    .toBeGreaterThan(progress);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-playback-paused", "true");
}
test("physical-scale launch shows atmosphere, turn, orbital coast, TLI and array deployment", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const c = await start(page);
  await expect(c).toHaveAttribute("data-earth-radius-km", "6371");
  await expect(c).toHaveAttribute("data-rocket-height-m", "70");
  await page.screenshot({ path: "docs/screenshots/surface-pad.png" });
  await page
    .getByRole("combobox", { name: "Playback speed", exact: true })
    .selectOption("4");
  await reach(page, c, 0.29);
  expect(Number(await c.getAttribute("data-ascent-pitch-deg"))).toBeLessThan(
    85,
  );
  expect(
    Number(await c.getAttribute("data-ascent-altitude-km")),
  ).toBeGreaterThan(10);
  const frozen = (await c.getAttribute("data-local-spacecraft-position"))!;
  await expect
    .poll(() => c.getAttribute("data-local-spacecraft-position"))
    .toBe(frozen);
  await page.screenshot({ path: "docs/screenshots/ascent-gravity-turn.png" });
  await page
    .getByRole("button", { name: "In-flight solar panorama", exact: true })
    .click();
  await expect(c).toHaveAttribute("data-launch-view", "mission");
  await expect(c).toHaveAttribute("data-camera-mode", "solar");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(c).toHaveAttribute("data-launch-view", "surface");
  await expect(c).toHaveAttribute("data-local-spacecraft-position", frozen);
  await reach(page, c, 0.67);
  await expect(c).toHaveAttribute("data-ascent-stage", "parking");
  await expect(c).toHaveAttribute("data-upper-burning", "false");
  await expect(c).toHaveAttribute("data-core-burning", "false");
  await page.screenshot({ path: "docs/screenshots/ascent-parking-orbit.png" });
  await reach(page, c, 0.78);
  await expect(c).toHaveAttribute("data-upper-burning", "true");
  await page.screenshot({ path: "docs/screenshots/ascent-tli.png" });
  await reach(page, c, 0.985);
  await expect(c).toHaveAttribute("data-panel-deployment", "1.0000");
  await expect(c).toHaveAttribute("data-upper-burning", "false");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page
    .getByRole("button", { name: "Skip animation", exact: true })
    .click();
  await expect(c).toHaveAttribute("data-flight-phase", "cruise");
  await expect(c).toHaveAttribute("data-launch-view", "mission");
  expect(errors).toEqual([]);
});
test("real-vehicle guidance loss keeps the close camera in the same scale until diagnosis", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const c = await start(page, false, true);
  await page
    .getByRole("combobox", { name: "Playback speed", exact: true })
    .selectOption("2");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(c).toHaveAttribute("data-flight-phase", "incident", {
    timeout: 45000,
  });
  await expect(c).toHaveAttribute("data-incident", "trajectory");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  const eye = (await c.getAttribute("data-camera-position"))!
      .split(",")
      .map(Number),
    target = (await c.getAttribute("data-local-spacecraft-position"))!
      .split(",")
      .map(Number);
  expect(Math.hypot(...eye.map((n, i) => n - target[i]))).toBeLessThan(0.7);
  await page.screenshot({ path: "docs/screenshots/ascent-guidance-loss.png" });
  await page
    .getByRole("combobox", { name: "Playback speed", exact: true })
    .selectOption("8");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(c).toHaveAttribute("data-flight-phase", "failed", {
    timeout: 15000,
  });
  expect(errors).toEqual([]);
});
test("mobile free camera survives scale changes and keeps flight controls", async ({
  page,
}) => {
  const c = await start(page, true);
  await page.getByRole("button", { name: "Rotate left", exact: true }).click();
  await expect(c).toHaveAttribute("data-camera-mode", "free");
  await page.getByRole("button", { name: "Full route", exact: true }).click();
  await expect(c).toHaveAttribute("data-launch-view", "mission");
  await page.getByRole("button", { name: "Rotate right", exact: true }).click();
  await expect(c).toHaveAttribute("data-launch-view", "mission");
  await expect(c).toHaveAttribute("data-camera-mode", "free");
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(c).toHaveAttribute("data-launch-view", "surface");
  await page.screenshot({ path: "docs/screenshots/surface-pad-mobile.png" });
  await page.getByRole("button", { name: "Rotate left", exact: true }).click();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page
    .getByRole("button", { name: "Skip animation", exact: true })
    .click();
  await expect(c).toHaveAttribute("data-flight-phase", "cruise");
  await expect(c).toHaveAttribute("data-launch-view", "mission");
  const eye = (await c.getAttribute("data-camera-position"))!
    .split(",")
    .map(Number);
  expect(Math.hypot(...eye)).toBeLessThan(100);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
