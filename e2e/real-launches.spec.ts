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
async function seed(
  page: Page,
  id = "medium",
  site?: string,
  flight = false,
  ru = false,
) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(
    ({ build, flight, ru }) => {
      localStorage.setItem(
        "orbital-flight-view",
        flight ? "immersive" : "panel",
      );
      if (!localStorage.getItem("space-mission-architect-v1"))
        localStorage.setItem(
          "space-mission-architect-v1",
          JSON.stringify({
            version: 3,
            state: {
              schemaVersion: 1,
              build,
              seed: 42,
              commands: flight
                ? [{ type: "Validate" }, { type: "Launch", seed: 42 }]
                : [],
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
    {
      build: {
        ...goldenBuild,
        modelVersion: 2,
        advancedFlight: true,
        launcherId: id,
        ...(flight && id === "falcon-heavy"
          ? {
              moduleIds: goldenBuild.moduleIds.filter(
                (id) => id !== "radiation",
              ),
              testingBudgetMUsd: 0,
            }
          : {}),
        ...(site ? { launchSiteId: site } : {}),
      },
      flight,
      ru,
    },
  );
  await page.goto("/");
}
async function nav(page: Page, name: string, ru = false) {
  await page
    .getByRole("navigation", {
      name: ru ? "Основная навигация" : "Main navigation",
    })
    .getByRole("button", { name, exact: true })
    .click();
}
test("real vehicle purchase and pad selection survive reload and complete a reported mission", async ({
  page,
}) => {
  await seed(page);
  await nav(page, "Orbit & launcher");
  await page
    .getByRole("button", { name: "Select vehicle: Soyuz-2", exact: true })
    .click();
  await expect(
    page.getByRole("group", { name: "Launch site selection" }),
  ).toContainText("Baikonur");
  await expect(
    page.getByRole("group", { name: "Launch site selection" }),
  ).not.toContainText("Kennedy");
  await page.getByRole("button", { name: /Vostochny · 1S/ }).click();
  await expect(page.locator(".launch-site-summary")).toContainText("51.88");
  await page.reload();
  await nav(page, "Orbit & launcher");
  await expect(
    page.getByRole("button", { name: /Vostochny · 1S/ }),
  ).toHaveAttribute("aria-pressed", "true");
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state,
  );
  expect(saved.build.launcherId).toBe("soyuz2");
  expect(saved.economy.launcherId).toBe("soyuz2");
  expect(saved.build.launchSiteId).toBe("vostochny-1s");
  await page
    .locator(".real-launch-designer .scene-stage")
    .scrollIntoViewIfNeeded();
  await expect(page.locator(".real-launch-designer canvas")).toHaveAttribute(
    "data-real-vehicle",
    "soyuz2",
    { timeout: 20000 },
  );
  await page.locator(".real-launch-designer").screenshot({
    path: "test-results/screenshots/real-launch-designer.png",
  });
  await nav(page, "Launch preparation");
  await page
    .getByText("Review engineering constraints", { exact: true })
    .click();
  await page
    .getByRole("button", { name: "Launch mission", exact: true })
    .click();
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toHaveAttribute("data-launch-site", "vostochny-1s", {
    timeout: 30000,
  });
  await page.getByRole("button", { name: "Step mode", exact: true }).click();
  await page.getByRole("button", { name: "Skip animation" }).click();
  await page.getByRole("button", { name: /Safe mode/ }).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Next stage", exact: true }).click();
  for (let i = 0; i < 2; i++)
    await page
      .getByRole("button", { name: "Run science orbit", exact: true })
      .click();
  await page.getByRole("button", { name: /Reduce load/ }).click();
  for (let i = 0; i < 2; i++)
    await page
      .getByRole("button", { name: "Run science orbit", exact: true })
      .click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Next stage", exact: true }).click();
  await nav(page, "Mission report");
  await expect(
    page.getByRole("heading", { name: "Contract complete", exact: true }),
  ).toBeVisible();
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download full report (HTML)" })
    .click();
  const stream = await (await downloading).createReadStream();
  let html = "";
  for await (const chunk of stream!) html += chunk.toString();
  expect(html).toContain("Soyuz-2");
  expect(html).toContain("Vostochny");
  expect(html).toContain("51.88 / 128.33");
});
for (const [id, site, boosters] of [
  ["falcon9", "cape-40", "0"],
  ["falcon-heavy", "ksc-39a", "2"],
  ["soyuz2", "baikonur-31", "4"],
  ["ariane64", "kourou-ela4", "4"],
])
  test(`${id} launches from its geographic site, moves and reaches stage separation`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await seed(page, id, site, true);
    await nav(page, "Mission control");
    const canvas = page.locator(".immersive-flight canvas");
    await expect(canvas).toHaveAttribute("data-real-vehicle", id, {
      timeout: 30000,
    });
    await expect(canvas).toHaveAttribute("data-launch-site", site);
    await expect(canvas).toHaveAttribute("data-booster-count", boosters);
    await expect
      .poll(
        async () => Number(await canvas.getAttribute("data-flight-progress")),
        { timeout: 20000 },
      )
      .toBeGreaterThan(0.08);
    const before = await canvas.getAttribute("data-spacecraft-position");
    await expect
      .poll(() => canvas.getAttribute("data-spacecraft-position"), {
        timeout: 10000,
      })
      .not.toBe(before);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-playback-paused", "true");
    await page.screenshot({
      path: `test-results/screenshots/real-${id}-launch.png`,
    });
    await page
      .getByRole("combobox", { name: "Playback speed", exact: true })
      .selectOption("8");
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-stage-separated", "true", {
      timeout: 15000,
    });
    await expect
      .poll(
        async () => Number(await canvas.getAttribute("data-flight-progress")),
        { timeout: 15000 },
      )
      .toBe(1);
    const meshPosition = (await canvas.getAttribute(
      "data-deployed-payload-position",
    ))!
      .split(",")
      .map(Number);
    const transferStart = (await canvas.getAttribute(
      "data-spacecraft-position",
    ))!
      .split(",")
      .map(Number);
    expect(
      Math.hypot(...meshPosition.map((n, i) => n - transferStart[i])),
    ).toBeLessThan(0.002);
    expect(errors).toEqual([]);
  });
test("Russian mobile launch shows the real site and retains mission controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, "soyuz2", "vostochny-1s", true, true);
  await nav(page, "Центр управления", true);
  const canvas = page.locator(".immersive-flight canvas");
  await expect(canvas).toHaveAttribute("data-launch-site", "vostochny-1s", {
    timeout: 30000,
  });
  await expect(page.locator(".launch-caption")).toContainText("Восточный");
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page.screenshot({
    path: "test-results/screenshots/real-launch-mobile.png",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
