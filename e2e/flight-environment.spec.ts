import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
test.use({
  actionTimeout: 10000,
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  },
});
test.describe.configure({ timeout: 90000 });
async function open(page: Page, ru = false) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(
    ({ build, ru }) => {
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
              language: ru ? "ru" : "en",
              mode: "learning",
              graphics: "3d",
              sound: false,
              reducedMotion: false,
              motionPreference: "on",
              playback: "step",
              playbackSpeed: 1,
            },
          },
        }),
      );
    },
    { build: { ...goldenBuild, modelVersion: 2, advancedFlight: true }, ru },
  );
  await page.goto("/");
  await page
    .getByRole("navigation", {
      name: ru ? "Основная навигация" : "Main navigation",
    })
    .getByRole("button", {
      name: ru ? "Центр управления" : "Mission control",
      exact: true,
    })
    .click();
  const flight = page.locator(".immersive-flight"),
    canvas = flight.locator("canvas");
  await expect(canvas).toHaveAttribute("data-environment-planets", "8", {
    timeout: 30000,
  });
  return { flight, canvas };
}
test("solar panorama is part of the same moving flight and shares its pause clock", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const { flight, canvas } = await open(page);
  await expect(canvas).toHaveAttribute("data-environment-sun", "true");
  await expect(canvas).toHaveAttribute(
    "data-earth-texture",
    "nasa-blue-marble",
    { timeout: 20000 },
  );
  await expect(
    flight.getByRole("button", {
      name: "Solar system during flight",
      exact: true,
    }),
  ).toBeVisible();
  const before = Number(await canvas.getAttribute("data-flight-progress"));
  await flight
    .getByRole("button", { name: "In-flight solar panorama", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-camera-mode", "solar");
  await expect(canvas).toHaveAttribute("data-environment-view", "solar", {
    timeout: 20000,
  });
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-flight-progress")))
    .toBeGreaterThan(before);
  await flight.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-playback-paused", "true");
  const days = await canvas.getAttribute("data-environment-days"),
    position = await canvas.getAttribute("data-spacecraft-position");
  await page.screenshot({ path: "docs/screenshots/live-solar-panorama.png" });
  expect(await canvas.getAttribute("data-environment-days")).toBe(days);
  expect(await canvas.getAttribute("data-spacecraft-position")).toBe(position);
  await expect(page.locator("canvas")).toHaveCount(1);
  await flight
    .getByRole("button", { name: "Return to spacecraft", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-camera-mode", "follow");
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await page.screenshot({ path: "docs/screenshots/live-solar-launch.png" });
  await flight.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () =>
      Number(await canvas.getAttribute("data-environment-days")),
    )
    .toBeGreaterThan(Number(days));
  expect(errors).toEqual([]);
});
test("Russian mobile panorama keeps the flight and actions on the same screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { flight, canvas } = await open(page, true);
  await flight
    .getByRole("button", { name: "Солнечная система в полёте", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-camera-mode", "solar");
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await page.screenshot({ path: "docs/screenshots/live-solar-mobile.png" });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await flight.getByRole("button", { name: "Действия", exact: true }).click();
  await expect(flight.locator(".immersive-drawer")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(flight).toBeVisible();
  await flight
    .getByRole("button", { name: "Вернуться к ракете", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-camera-mode", "follow");
});
