import { expect, test } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
import type { Build, MissionCommand } from "../src/types";
import type { Page } from "@playwright/test";

test.use({
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  },
});
test.describe.configure({ mode: "serial", timeout: 90000 });
async function fixture(
  page: Page,
  build: Build,
  commands: MissionCommand[] = [],
) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(
    ({ build, commands }) => {
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
                language: "ru",
                mode: "engineer",
                graphics: "3d",
                sound: false,
                reducedMotion: false,
                playback: commands.length ? "step" : "live",
                playbackSpeed: 1,
              },
            },
          }),
        );
    },
    { build, commands },
  );
  await page.goto("/");
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name, exact: true })
    .click();
}

test("bad payload lifts off, breaks up in 3D and only then releases the error list", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixture(page, { ...goldenBuild, launcherId: "light" });
  await nav(page, "Подготовка запуска");
  await expect(page.locator(".notice.error")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Запустить миссию" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Запустить миссию" }).click();
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toBeVisible({ timeout: 25000 });
  await expect(canvas).toHaveAttribute("data-incident", "explosion", {
    timeout: 30000,
  });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-flight-progress")))
    .toBeGreaterThan(0.16);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Разбор происшествия и список ошибок" }),
  ).toHaveCount(0);
  await page
    .locator(".flight-stage")
    .screenshot({ path: "docs/screenshots/rocket-breakup-3d.png" });
  const progress = await canvas.getAttribute("data-flight-progress");
  await page.waitForTimeout(250);
  expect(await canvas.getAttribute("data-flight-progress")).toBe(progress);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page
    .getByRole("button", { name: "Завершить запись и показать причины" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Разбор происшествия и список ошибок" }),
  ).toBeVisible();
  await expect(page.locator(".diagnosis-facts")).toContainText("327.0 kg");
  await expect(page.locator(".diagnosis-facts")).toContainText("250.0 kg");
  await page.screenshot({
    path: "docs/screenshots/rocket-breakup-analysis.png",
    fullPage: true,
  });
  await page.reload();
  await nav(page, "Центр управления");
  await expect(
    page.getByRole("heading", { name: "Разбор происшествия и список ошибок" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("insufficient fuel produces a visibly drifting spacecraft rather than an explosion", async ({
  page,
}) => {
  const commands: MissionCommand[] = [
    { type: "Validate" },
    { type: "Launch", seed: 42 },
    { type: "Advance" },
    { type: "ChooseDecision", choice: "safe" },
    { type: "Advance" },
  ];
  await fixture(page, { ...goldenBuild, propellantKg: 0 }, commands);
  await nav(page, "Центр управления");
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toBeVisible({ timeout: 25000 });
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await expect(canvas).toHaveAttribute("data-incident", "trajectory");
  const before = await canvas.getAttribute("data-spacecraft-position");
  await expect
    .poll(async () => await canvas.getAttribute("data-spacecraft-position"))
    .not.toBe(before);
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-flight-progress")))
    .toBeGreaterThan(0.3);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page
    .locator(".flight-stage")
    .screenshot({ path: "docs/screenshots/spacecraft-off-course-3d.png" });
  await expect(
    page.getByRole("heading", { name: "Разбор происшествия и список ошибок" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page
    .getByRole("button", { name: "Завершить запись и показать причины" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Тормозной импульс не выполнен",
      exact: true,
    }),
  ).toBeVisible();
});

test("a desktop replay remounts the 3D renderer and resets the clock even during the same launch phase", async ({
  page,
}) => {
  await fixture(page, { ...goldenBuild, launcherId: "light" }, [
    { type: "Validate" },
    { type: "Launch", seed: 42 },
    { type: "Advance" },
    { type: "Advance" },
  ]);
  await page
    .getByRole("button", { name: "Запустить заново", exact: true })
    .click();
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toBeVisible({ timeout: 25000 });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-launch-time")), {
      timeout: 15000,
    })
    .toBeGreaterThan(3);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const before = Number(await canvas.getAttribute("data-launch-time"));
  const original = await canvas.elementHandle();
  await page
    .getByRole("button", { name: "Запустить заново", exact: true })
    .click();
  expect(await original!.evaluate((e) => e.isConnected)).toBe(false);
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect(canvas).toHaveAttribute("data-flight-phase", "launched");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-launch-time")))
    .toBeLessThan(before);
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-launch-time")))
    .toBeGreaterThan(0.3);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page
    .locator(".flight-stage")
    .screenshot({ path: "docs/screenshots/replay-3d-desktop.png" });
});
