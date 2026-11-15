import { expect, test } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
test.use({
  storageState: { cookies: [], origins: [] },
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
for (const width of [1366, 390])
  test(`fullscreen flight fills ${width}px with decisions and controls in the scene`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.addInitScript(
      (build) =>
        localStorage.setItem(
          "space-mission-architect-v1",
          JSON.stringify({
            version: 2,
            state: {
              schemaVersion: 1,
              build,
              seed: 42,
              settings: {
                language: "en",
                mode: "learning",
                graphics: "3d",
                sound: false,
                reducedMotion: false,
                motionPreference: "on",
                playback: "live",
                playbackSpeed: 1,
              },
              commands: [
                { type: "Validate" },
                { type: "Launch", seed: 42 },
                { type: "Advance" },
              ],
            },
          }),
        ),
      { ...goldenBuild, modelVersion: 2 },
    );
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Mission control", exact: true })
      .click();
    const flight = page.getByRole("dialog", {
        name: "Fullscreen flight",
        exact: true,
      }),
      canvas = flight.locator("canvas");
    await expect(flight).toBeVisible();
    await expect(canvas).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    const bounds = await canvas.boundingBox();
    expect(bounds?.x).toBeCloseTo(0, 0);
    expect(bounds?.y).toBeCloseTo(0, 0);
    expect(bounds?.width).toBeCloseTo(width, 0);
    expect(bounds?.height).toBeCloseTo(844, 0);
    await expect(
      flight.getByRole("button", { name: /Safe mode/ }),
    ).toBeVisible();
    if (width === 390) {
      const panel = await flight.locator(".immersive-drawer").boundingBox();
      expect(panel!.y).toBeGreaterThan(844 * 0.53);
      const risky = await flight
        .getByRole("button", { name: /Continue observations/ })
        .boundingBox();
      expect(risky!.y + risky!.height).toBeLessThanOrEqual(
        panel!.y + panel!.height,
      );
    }
    await page.screenshot({
      path: `test-results/screenshots/fullscreen-flight-${width}.png`,
    });
    await flight.getByRole("button", { name: /Safe mode/ }).click();
    await expect(
      flight.getByRole("region", { name: "Actions", exact: true }),
    ).toHaveCount(0);
    await expect
      .poll(
        async () => Number(await canvas.getAttribute("data-flight-progress")),
        { timeout: 15000 },
      )
      .toBeGreaterThan(0.03);
    await flight.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-playback-paused", "true");
    const position = await canvas.getAttribute("data-spacecraft-position");
    await flight.getByRole("button", { name: "Systems", exact: true }).click();
    await expect(
      flight.getByRole("region", { name: "Onboard systems", exact: true }),
    ).toBeVisible();
    await flight
      .getByRole("button", { name: "Close flight panel", exact: true })
      .click();
    expect(await canvas.getAttribute("data-spacecraft-position")).toBe(
      position,
    );
    await flight
      .getByLabel("Playback speed", { exact: true })
      .selectOption("2");
    await flight.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-playback-paused", "false");
    await flight.getByRole("button", { name: "Log", exact: true }).click();
    await expect(
      flight.getByRole("region", { name: "Flight log", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(flight).toBeVisible();
    await expect(
      flight.getByRole("region", { name: "Flight log", exact: true }),
    ).toHaveCount(0);
    if (
      width === 1366 &&
      (await page.evaluate(() => document.fullscreenEnabled))
    ) {
      await flight
        .getByRole("button", { name: "Enter browser fullscreen", exact: true })
        .click();
      await expect
        .poll(() => page.evaluate(() => !!document.fullscreenElement))
        .toBe(true);
      await flight
        .getByRole("button", { name: "Exit browser fullscreen", exact: true })
        .click();
      await expect
        .poll(() => page.evaluate(() => !!document.fullscreenElement))
        .toBe(false);
    }
    await flight
      .getByRole("button", { name: "Back to dashboard", exact: true })
      .click();
    await expect(flight).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
    await page
      .getByRole("button", { name: "Fullscreen flight", exact: true })
      .click();
    await expect(flight).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(flight).toHaveCount(0);
    expect(errors).toEqual([]);
  });

test("the entire mission, spacecraft commands and both crisis decisions stay inside fullscreen", async ({
  page,
}) => {
  await page.addInitScript(
    (build) =>
      localStorage.setItem(
        "space-mission-architect-v1",
        JSON.stringify({
          version: 2,
          state: {
            schemaVersion: 1,
            build,
            seed: 42,
            settings: {
              language: "en",
              mode: "learning",
              graphics: "schematic",
              sound: false,
              reducedMotion: false,
              motionPreference: "on",
              playback: "live",
              playbackSpeed: 1,
            },
            commands: [{ type: "Validate" }, { type: "Launch", seed: 42 }],
          },
        }),
      ),
    { ...goldenBuild, modelVersion: 2 },
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Mission control", exact: true })
    .click();
  const flight = page.getByRole("dialog", {
    name: "Fullscreen flight",
    exact: true,
  });
  await flight.getByRole("button", { name: "Auto", exact: true }).click();
  await flight
    .getByRole("button", { name: "Skip animation", exact: true })
    .click();
  await expect(
    flight.getByRole("heading", { name: "Solar flare", exact: true }),
  ).toBeVisible();
  await flight.getByRole("button", { name: /Safe mode/ }).click();
  for (let i = 0; i < 2; i++)
    await flight
      .getByRole("button", { name: "Next stage", exact: true })
      .click();
  await flight.getByRole("button", { name: "Actions", exact: true }).click();
  await flight.getByLabel("Observation target").selectOption("equator");
  await flight.getByLabel("Observation target").selectOption("pole");
  await flight
    .getByRole("button", { name: "Close flight panel", exact: true })
    .click();
  for (let i = 0; i < 2; i++)
    await flight
      .getByRole("button", { name: "Run science orbit", exact: true })
      .click();
  await expect(
    flight.getByRole("heading", { name: "Extended eclipse", exact: true }),
  ).toBeVisible();
  await flight.getByRole("button", { name: /Reduce load/ }).click();
  for (let i = 0; i < 2; i++)
    await flight
      .getByRole("button", { name: "Run science orbit", exact: true })
      .click();
  for (let i = 0; i < 2; i++)
    await flight
      .getByRole("button", { name: "Next stage", exact: true })
      .click();
  await expect(
    flight.getByRole("heading", { name: "Contract complete", exact: true }),
  ).toBeVisible();
  await flight
    .getByRole("button", { name: "Mission report", exact: true })
    .click();
  await expect(flight).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Contract complete", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.querySelector<HTMLElement>(".app-shell")?.inert,
    ),
  ).toBe(false);
});

test("Russian science controls fit the phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    (build) =>
      localStorage.setItem(
        "space-mission-architect-v1",
        JSON.stringify({
          version: 2,
          state: {
            schemaVersion: 1,
            build,
            seed: 42,
            settings: {
              language: "ru",
              mode: "learning",
              graphics: "schematic",
              sound: false,
              reducedMotion: false,
              motionPreference: "on",
              playback: "step",
              playbackSpeed: 1,
            },
            commands: [
              { type: "Validate" },
              { type: "Launch", seed: 42 },
              { type: "Advance" },
              { type: "ChooseDecision", choice: "safe" },
              { type: "Advance" },
              { type: "Advance" },
            ],
          },
        }),
      ),
    { ...goldenBuild, modelVersion: 2 },
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Центр управления", exact: true })
    .click();
  const flight = page.getByRole("dialog", {
    name: "Полноэкранный полёт",
    exact: true,
  });
  await expect(flight).toBeVisible();
  for (const button of await flight
    .locator(".immersive-controls button,.immersive-header button")
    .all()) {
    const box = await button.boundingBox();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
  }
  await flight
    .getByRole("button", { name: "Выполнить научный виток", exact: true })
    .click();
  await expect(flight.getByText(/Виток 1 \/ 4/)).toBeVisible();
  await page.screenshot({
    path: "test-results/screenshots/fullscreen-flight-ru.png",
  });
});

test("failure playback finishes before the error list opens inside fullscreen", async ({
  page,
}) => {
  await page.addInitScript(
    (build) =>
      localStorage.setItem(
        "space-mission-architect-v1",
        JSON.stringify({
          version: 2,
          state: {
            schemaVersion: 1,
            build,
            seed: 42,
            settings: {
              language: "en",
              mode: "learning",
              graphics: "schematic",
              sound: false,
              reducedMotion: false,
              motionPreference: "on",
              playback: "step",
              playbackSpeed: 1,
            },
            commands: [{ type: "Validate" }, { type: "Launch", seed: 42 }],
          },
        }),
      ),
    { ...goldenBuild, modelVersion: 2, launcherId: "light" },
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Mission control", exact: true })
    .click();
  const flight = page.getByRole("dialog", {
    name: "Fullscreen flight",
    exact: true,
  });
  await flight
    .getByRole("button", { name: "Skip animation", exact: true })
    .click();
  await expect(
    flight.getByRole("heading", {
      name: "Incident review & error list",
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(flight.locator(".live-mission-view")).toHaveAttribute(
    "data-phase",
    "incident",
  );
  await flight
    .getByRole("button", { name: "Show causes", exact: true })
    .click();
  await expect(
    flight.getByRole("heading", {
      name: "Incident review & error list",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    flight.getByRole("region", { name: "Flight result", exact: true }),
  ).toBeVisible();
});
