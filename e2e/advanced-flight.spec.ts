import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
import type { Build, MissionCommand } from "../src/types";
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
const launch: MissionCommand[] = [
    { type: "Validate" },
    { type: "Launch", seed: 42 },
  ],
  science: MissionCommand[] = [
    ...launch,
    { type: "Advance" },
    { type: "ChooseDecision", choice: "safe" },
    { type: "Advance" },
    { type: "Advance" },
  ];
async function seed(
  page: Page,
  commands: MissionCommand[],
  graphics = "schematic",
  patch: Partial<Build> = {},
) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(
    ({ build, commands, graphics }) => {
      if (!localStorage.getItem("space-mission-architect-v1"))
        localStorage.setItem(
          "space-mission-architect-v1",
          JSON.stringify({
            version: 2,
            state: {
              schemaVersion: 1,
              build,
              seed: 42,
              commands,
              settings: {
                language: "en",
                mode: "learning",
                graphics,
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
        ...patch,
      },
      commands,
      graphics,
    },
  );
  await page.goto("/");
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
test("custom orbital inputs persist, alter the comparison, and feed flight telemetry", async ({
  page,
}) => {
  await seed(page, []);
  await nav(page, "Orbit & launcher");
  await page.getByLabel("Periapsis, km").fill("120");
  await page.getByLabel("Apoapsis, km").fill("700");
  await page.getByLabel("Inclination, °").fill("88");
  await page.getByLabel("Solar beta, °").fill("25");
  await page.getByRole("button", { name: "Apply orbit", exact: true }).click();
  await expect(
    page.getByText(
      "Custom orbit applied. Calculations and flight use these parameters.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.reload();
  await nav(page, "Orbit & launcher");
  await expect(page.getByLabel("Apoapsis, km")).toHaveValue("700");
  await nav(page, "NASA science");
  await expect(page.locator(".science-table tbody tr")).toHaveCount(4);
  await expect(page.locator(".science-table tbody tr").last()).toContainText(
    "120–700",
  );
  await nav(page, "Launch preparation");
  await page
    .getByRole("button", { name: "Launch mission", exact: true })
    .click();
  await page.getByRole("button", { name: "Step mode", exact: true }).click();
  await page
    .getByRole("button", { name: "Skip animation", exact: true })
    .click();
  await page.getByRole("button", { name: /Safe mode/ }).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Next stage", exact: true }).click();
  await expect(page.getByTestId("orbital-state")).toContainText("km/s");
  await expect(
    page.getByRole("region", { name: "Upcoming events", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state
        .build,
  );
  expect(saved.customOrbit).toEqual({
    periapsisKm: 120,
    apoapsisKm: 700,
    inclinationDeg: 88,
    betaDeg: 25,
  });
});
test("accepted science leaves a persistent visible 3D survey band", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, [...science, { type: "Advance" }], "3d", {
    customOrbit: {
      periapsisKm: 100,
      apoapsisKm: 300,
      inclinationDeg: 88,
      betaDeg: 20,
    },
  });
  await nav(page, "Mission control");
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toHaveAttribute("data-coverage-passes", "1", {
    timeout: 30000,
  });
  await expect
    .poll(
      async () =>
        Number(await canvas.getAttribute("data-observation-vertices")),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-playback-paused", "true");
  await page
    .getByRole("button", { name: "Show lunar survey", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await page.screenshot({
    path: "docs/screenshots/custom-orbit-trail.png",
    fullPage: true,
  });
  await page.reload();
  await nav(page, "Mission control");
  await expect(canvas).toHaveAttribute("data-coverage-passes", "1", {
    timeout: 30000,
  });
  expect(errors).toEqual([]);
});
test("solar damage changes the spacecraft and leads to an explained power-loss playback", async ({
  page,
}) => {
  const commands: MissionCommand[] = [
    ...launch,
    { type: "Advance" },
    { type: "ChooseDecision", choice: "continue" },
    { type: "Advance" },
    { type: "Advance" },
  ];
  await seed(page, commands, "3d", {
    moduleIds: [
      ...goldenBuild.moduleIds.filter((id) => id !== "radiation"),
      "radar",
    ],
  });
  await nav(page, "Mission control");
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toHaveAttribute("data-solar-efficiency", "0.45", {
    timeout: 30000,
  });
  await expect(page.locator(".flight-damage-status")).toContainText("45%");
  await page.screenshot({
    path: "docs/screenshots/solar-cell-damage.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Run science orbit", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-incident", "power");
  await expect(
    page.getByRole("heading", {
      name: "Incident review & error list",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Finish recording & show causes",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Incident review & error list",
      exact: true,
    }),
  ).toBeVisible();
});

test("mobile fullscreen keeps survey, events and spacecraft actions usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    localStorage.setItem("orbital-flight-view", "immersive"),
  );
  await seed(page, [...science, { type: "Advance" }], "3d");
  await nav(page, "Mission control");
  const flight = page.getByRole("dialog", {
    name: "Fullscreen flight",
    exact: true,
  });
  const canvas = flight.locator("canvas");
  await expect(canvas).toHaveAttribute("data-coverage-passes", "1", {
    timeout: 30000,
  });
  await expect(
    flight.getByRole("region", { name: "Upcoming events", exact: true }),
  ).toBeVisible();
  await flight.getByRole("button", { name: "Pause", exact: true }).click();
  await flight
    .getByRole("button", { name: "Show lunar survey", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-camera-mode", "moon");
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 20000,
  });
  await flight.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(
    flight.getByRole("region", { name: "Actions", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/advanced-flight-mobile.png",
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
  expect(errors).toEqual([]);
});
