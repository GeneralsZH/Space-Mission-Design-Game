import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
import { orbitalParameters, orbitElements } from "../src/engine/orbital";
test.use({
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  },
});
test.describe.configure({ timeout: 90000 });
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function fixture(
  page: Page,
  graphics = "schematic",
  commands: unknown[] = [],
) {
  await page.addInitScript(
    ({ build, graphics, commands }) => {
      if (!localStorage.getItem("space-mission-architect-v1"))
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
                graphics,
                sound: false,
                reducedMotion: false,
                playback: "step",
                playbackSpeed: 1,
              },
              commands,
            },
          }),
        );
    },
    { build: { ...goldenBuild, modelVersion: 2 }, graphics, commands },
  );
}
async function fly(page: Page) {
  await nav(page, "Launch preparation");
  await page
    .getByText("Review engineering constraints", { exact: true })
    .click();
  await expect(
    page.getByText("Available / required Δv", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Launch mission", exact: true })
    .click();
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
}
test("NASA samples, configuration comparison, complete flight, report download and revised attempt", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await fixture(page);
  await page.goto("/");
  const sw = await page.request.get("/sw.js");
  const shellAssets = (await sw.text()).split("self.addEventListener")[0];
  expect(shellAssets).not.toContain("SpacecraftScene");
  expect(shellAssets).not.toContain("TelemetryChart");
  await nav(page, "NASA science");
  await expect(
    page.getByRole("heading", { name: "Lunar science lab" }),
  ).toBeVisible();
  const sample = page.getByRole("button", { name: /Sample 840:/ });
  await sample.click();
  await expect(
    page.getByRole("heading", { name: "Selected sample #840" }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: /Cyan outline/ }).uncheck();
  await expect(
    page.getByRole("checkbox", { name: /Cyan outline/ }),
  ).not.toBeChecked();
  const table = page.locator(".science-table");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  const rows = await table.locator("tbody tr").allTextContents();
  expect(rows[0]).toContain(
    (orbitalParameters(orbitElements["low-polar"]).periodSeconds / 60).toFixed(
      2,
    ),
  );
  expect(rows[1]).toContain("300–300");
  for (const resource of [
    "/science/provenance.json",
    "/science/lroc-source-label.txt",
    "/science/moon-lroc-2025-2k.jpg",
  ]) {
    const response = await page.request.get(resource);
    expect(response.ok()).toBe(true);
    expect((await response.body()).length).toBeGreaterThan(100);
  }
  await page.screenshot({
    path: "test-results/screenshots/lroc-science.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1366, height: 768 });
  await fly(page);
  await expect(
    page.getByRole("heading", { name: "Contract complete", exact: true }),
  ).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download full report (HTML)" })
    .click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("orbital-mission-report.html");
  const stream = await download.createReadStream();
  let html = "";
  for await (const chunk of stream!) html += chunk.toString();
  expect(html).toContain("WAC_POLE_ILL_TWI_SOUTH_100M");
  expect(html).toContain("No ice measurements are invented");
  await page.reload();
  await nav(page, "Mission report");
  await expect(
    page.getByRole("heading", { name: "Contract complete", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to design", exact: true })
    .click();
  await nav(page, "Orbit & launcher");
  await page.getByRole("button", { name: /High polar/ }).click();
  await fly(page);
  await expect(
    page.getByLabel("Previous flights in this browser (up to 8)"),
  ).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Previous", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("computed 3D lunar orbit loads NASA texture, moves, pauses and changes camera", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await fixture(page, "3d", [
    { type: "Validate" },
    { type: "Launch", seed: 42 },
    { type: "Advance" },
    { type: "ChooseDecision", choice: "safe" },
    { type: "Advance" },
    { type: "Advance" },
  ]);
  const texture = page.waitForResponse((r) =>
    r.url().endsWith("moon-lroc-2025-2k.jpg"),
  );
  await page.goto("/");
  await nav(page, "Mission control");
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toBeVisible({ timeout: 30000 });
  expect((await texture).ok()).toBe(true);
  await expect(page.getByTestId("orbital-state")).toContainText("100.0 km");
  await expect
    .poll(() => canvas.getAttribute("data-flight-progress"), { timeout: 20000 })
    .not.toBe("0.0000");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-playback-paused", "true");
  const position = await canvas.getAttribute("data-spacecraft-position");
  await page.getByRole("button", { name: "Full route", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  expect(await canvas.getAttribute("data-spacecraft-position")).toBe(position);
  await page.getByRole("button", { name: "Follow", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await page.screenshot({
    path: "test-results/screenshots/lunar-two-body-3d.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
