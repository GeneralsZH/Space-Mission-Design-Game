import { expect, test } from "@playwright/test";
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
async function seed(page: Page, motion = "on", language = "en") {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ build, motion, language }) =>
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
              language,
              mode: "learning",
              graphics: "3d",
              sound: false,
              reducedMotion: false,
              motionPreference: motion,
              playback: "step",
              playbackSpeed: 1,
            },
          },
        }),
      ),
    {
      build: { ...goldenBuild, modelVersion: 2, advancedFlight: true },
      motion,
      language,
    },
  );
  await page.goto("/");
}
async function openAtlas(page: Page) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Solar system", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Solar system explorer",
    exact: true,
  });
  await expect(dialog.locator("canvas")).toHaveAttribute(
    "data-planet-count",
    "8",
    { timeout: 30000 },
  );
  return dialog;
}
test("solar overview renders all planets and rings, tracks selections, pauses, zooms and resets", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page);
  const atlas = await openAtlas(page),
    canvas = atlas.locator("canvas");
  await expect(canvas).toHaveAttribute("data-star-count", "2400");
  await expect(canvas).toHaveAttribute("data-saturn-rings", "true");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-solar-days")))
    .toBeGreaterThan(1);
  await atlas
    .getByRole("button", { name: "Pause planets", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-solar-playing", "false");
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  const days = await canvas.getAttribute("data-solar-days"),
    earth = await canvas.getAttribute("data-earth-position");
  await page.screenshot({
    path: "test-results/screenshots/solar-overview.png",
  });
  expect(await canvas.getAttribute("data-solar-days")).toBe(days);
  expect(await canvas.getAttribute("data-earth-position")).toBe(earth);
  const bounds = await canvas.boundingBox();
  await canvas.click({
    position: { x: bounds!.width / 2, y: bounds!.height / 2 },
  });
  await expect(canvas).toHaveAttribute("data-selected-body", "sun");
  const worlds = atlas.getByRole("navigation", {
    name: "Solar system objects",
  });
  for (const [name, id] of [
    ["Mercury", "mercury"],
    ["Venus", "venus"],
    ["Earth", "earth"],
    ["Mars", "mars"],
    ["Jupiter", "jupiter"],
    ["Saturn", "saturn"],
    ["Uranus", "uranus"],
    ["Neptune", "neptune"],
    ["Moon", "moon"],
    ["Sun", "sun"],
  ]) {
    await worlds.getByRole("button", { name, exact: true }).click();
    await expect(canvas).toHaveAttribute("data-selected-body", id);
    await expect(
      atlas.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  }
  await worlds.getByRole("button", { name: "Saturn", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await expect(atlas.locator(".solar-info")).toContainText("58,232");
  await page.screenshot({ path: "test-results/screenshots/solar-saturn.png" });
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await atlas
      .getByRole("button", { name: "Enter browser fullscreen", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(true);
    await atlas
      .getByRole("button", { name: "Exit browser fullscreen", exact: true })
      .click();
    await expect
      .poll(() => page.evaluate(() => !!document.fullscreenElement))
      .toBe(false);
  }
  const distance = Number(await canvas.getAttribute("data-camera-distance"));
  await atlas
    .getByRole("button", { name: "Zoom in on planets", exact: true })
    .click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-camera-distance")))
    .toBeLessThan(distance);
  await atlas
    .getByRole("button", { name: "Zoom out from planets", exact: true })
    .click();
  await atlas.getByRole("button", { name: "Orbits", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-orbits-visible", "false");
  await atlas.getByRole("button", { name: "Labels", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-labels-visible", "false");
  await atlas
    .getByRole("combobox", { name: "Planet speed" })
    .selectOption("120");
  await atlas
    .getByRole("button", { name: "Resume planets", exact: true })
    .click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-solar-days")))
    .toBeGreaterThan(Number(days) + 1);
  await atlas
    .getByRole("button", { name: "Pause planets", exact: true })
    .click();
  await atlas
    .getByRole("button", { name: "Reset solar system", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-solar-days", "0.00000");
  await expect(canvas).toHaveAttribute("data-selected-body", "overview");
  await page.keyboard.press("Escape");
  await expect(atlas).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("Russian mobile flight opens the atlas and returns without changing the mission", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("orbital-flight-view", "immersive"),
  );
  await seed(page, "on", "ru");
  const commands = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state
        .commands,
  );
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Центр управления", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Открыть Солнечную систему", exact: true })
    .click();
  const atlas = page.getByRole("dialog", {
      name: "Солнечная система",
      exact: true,
    }),
    canvas = atlas.locator("canvas");
  await expect(canvas).toHaveAttribute("data-planet-count", "8", {
    timeout: 30000,
  });
  await atlas
    .getByRole("button", { name: "Пауза планет", exact: true })
    .click();
  await atlas.getByRole("button", { name: "Нептун", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-selected-body", "neptune");
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await page.screenshot({ path: "test-results/screenshots/solar-mobile.png" });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await atlas.getByRole("button", { name: "К миссии", exact: true }).click();
  await expect(atlas).toHaveCount(0);
  await expect(page.locator(".immersive-flight canvas")).toHaveAttribute(
    "data-flight-phase",
    "launched",
    { timeout: 20000 },
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state
          .commands,
    ),
  ).toEqual(commands);
  expect(errors).toEqual([]);
});
test("reduced motion freezes the atlas and context loss preserves object selection and exit", async ({
  page,
}) => {
  await seed(page, "system");
  const atlas = await openAtlas(page),
    canvas = atlas.locator("canvas");
  await expect(canvas).toHaveAttribute("data-solar-playing", "false");
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await expect(canvas).toHaveAttribute("data-solar-days", "0.00000");
  await atlas.getByRole("button", { name: "Earth", exact: true }).click();
  await atlas
    .getByRole("button", { name: "Resume planets", exact: true })
    .click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-solar-days")))
    .toBeGreaterThan(0);
  await canvas.dispatchEvent("webglcontextlost");
  await expect(
    atlas.getByRole("img", { name: "Schematic planetary map" }),
  ).toBeVisible();
  await atlas.getByRole("button", { name: "Mars", exact: true }).click();
  await expect(
    atlas.getByRole("heading", { name: "Mars", exact: true }),
  ).toBeVisible();
  await expect(
    atlas.getByRole("button", { name: "Pause planets", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(atlas).toHaveCount(0);
});
