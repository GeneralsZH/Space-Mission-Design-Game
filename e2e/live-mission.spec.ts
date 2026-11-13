import { expect, test } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
import { parseSave, replay } from "../src/store/schema";
test.use({
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  },
});
test.describe.configure({ mode: "serial", timeout: 120000 });
test("the launcher leaves the pad and releases the visible spacecraft above Earth", async ({
  page,
}) => {
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
              language: "ru",
              mode: "learning",
              graphics: "3d",
              sound: false,
              reducedMotion: false,
              playback: "step",
              playbackSpeed: 8,
            },
            commands: [{ type: "Validate" }, { type: "Launch", seed: 42 }],
          },
        }),
      ),
    goldenBuild,
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Центр управления", exact: true })
    .click();
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-launch-progress")))
    .toBeGreaterThan(0.95);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(
    page.getByText("Раскрытие обтекателя · отделение аппарата", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "3D-запуск ракеты" })
    .screenshot({ path: "docs/screenshots/live-separation.png" });
  const position = await canvas.getAttribute("data-spacecraft-position");
  expect(Number(position?.split(",")[1])).toBeGreaterThan(6);
});
test("the whole mission plays live: ascent, separation, lunar transfer, science orbits and downlink", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
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
              language: "ru",
              mode: "learning",
              graphics: "3d",
              sound: false,
              reducedMotion: false,
              playback: "live",
              playbackSpeed: 1,
            },
            commands: [{ type: "Validate" }, { type: "Launch", seed: 42 }],
          },
        }),
      ),
    goldenBuild,
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Центр управления", exact: true })
    .click();
  const view = page.locator(".live-mission-view");
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-launch-progress")))
    .toBeGreaterThan(0.08);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  const time = await canvas.getAttribute("data-launch-time");
  await page.getByRole("button", { name: "Весь маршрут", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Весь маршрут", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Сопровождение", exact: true })
    .click();
  expect(await canvas.getAttribute("data-launch-time")).toBe(time);
  await page.getByLabel("Скорость эфира").selectOption("8");
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Солнечная вспышка" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(view).toHaveAttribute("data-phase", "cruise");
  await page.getByRole("button", { name: "Весь маршрут", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-settled", "true");
  await page
    .getByRole("region", { name: "3D-полёт миссии" })
    .screenshot({ path: "docs/screenshots/live-route.png" });
  await expect(view).toHaveAttribute("data-phase", "cruise");
  await page.getByRole("button", { name: /Safe mode/ }).click();
  await expect(view).toHaveAttribute("data-phase", "orbitInsertion", {
    timeout: 20000,
  });
  await expect(view).toHaveAttribute("data-phase", "scienceOperations", {
    timeout: 20000,
  });
  await page
    .getByRole("button", { name: "Сопровождение", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-scanning", "true");
  await expect
    .poll(async () =>
      Number(
        (await canvas.getAttribute("data-spacecraft-position"))?.split(",")[1],
      ),
    )
    .not.toBe(1);
  await page
    .getByRole("region", { name: "3D-полёт миссии" })
    .screenshot({ path: "docs/screenshots/live-science.png" });
  await expect(
    page.getByRole("heading", { name: "Продлённое затмение" }),
  ).toBeVisible({ timeout: 20000 });
  const eclipseOrbit = await view.getAttribute("data-orbit");
  expect(eclipseOrbit).toBe("2");
  await page.getByRole("button", { name: "Весь маршрут", exact: true }).click();
  await expect(view).toHaveAttribute("data-orbit", "2");
  await page.getByRole("button", { name: /Сократить нагрузку/ }).click();
  await expect(view).toHaveAttribute("data-phase", "downlink", {
    timeout: 20000,
  });
  await expect(canvas).toHaveAttribute("data-downlink", "true");
  await page
    .getByRole("region", { name: "3D-полёт миссии" })
    .screenshot({ path: "docs/screenshots/live-downlink.png" });
  await expect(view).toHaveAttribute("data-phase", "completed", {
    timeout: 20000,
  });
  const save = await page.evaluate(() =>
    JSON.stringify(
      JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state,
    ),
  );
  const data = parseSave(save);
  const restored = replay(data.build, data.seed, data.commands);
  expect(restored.result?.success).toBe(true);
  expect(restored.deliveredScience).toBeGreaterThanOrEqual(120);
  expect(restored.orbit).toBe(4);
  expect(restored.flareResolved && restored.eclipseResolved).toBe(true);
  await page
    .getByRole("button", { name: "Отчёт миссии", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Контракт выполнен" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("live route works without WebGL, and reduced motion has an explicit animation override", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
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
              reducedMotion: true,
              playback: "live",
              playbackSpeed: 8,
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
    goldenBuild,
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Центр управления", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Движение: выкл", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "Маршрут миссии: Земля, Луна и положение аппарата",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Движение: выкл", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Движение: вкл", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("heading", { name: "Продлённое затмение" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".live-mission-view")).toHaveAttribute(
    "data-orbit",
    "2",
  );
});
