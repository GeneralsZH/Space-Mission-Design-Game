import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
import { defaultSettings } from "../src/store/useMissionStore";
test.use({
  launchOptions: {
    args: [
      "--use-gl=angle",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
  },
});
test.describe.configure({ mode: "serial", timeout: 60000 });
async function builder(page: Page) {
  await page.addInitScript(
    ({ build, settings }) => {
      if (!localStorage.getItem("space-mission-architect-v1"))
        localStorage.setItem(
          "space-mission-architect-v1",
          JSON.stringify({
            version: 2,
            state: {
              schemaVersion: 1,
              build,
              settings,
              seed: 42,
              commands: [],
            },
          }),
        );
    },
    { build: goldenBuild, settings: defaultSettings },
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Конструктор", exact: true })
    .click();
}
test("3D renders, rotates, zooms, explodes and reacts to catalog changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await builder(page);
  const region = page.getByRole("region", {
    name: "Интерактивная 3D-модель аппарата",
  });
  await expect(region.locator('canvas[data-ready="true"]')).toBeVisible({
    timeout: 20000,
  });
  const before = await region.screenshot({
    path: "docs/screenshots/spacecraft-3d.png",
  });
  await page
    .getByRole("button", { name: "Повернуть вправо", exact: true })
    .click();
  await expect
    .poll(async () => (await region.screenshot()).equals(before))
    .toBe(false);
  const rotated = await region.screenshot();
  await page.getByRole("button", { name: "Приблизить", exact: true }).click();
  await expect
    .poll(async () => (await region.screenshot()).equals(rotated))
    .toBe(false);
  await region.focus();
  await page.keyboard.press("ArrowLeft");
  await page.getByRole("button", { name: "Детали", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Детали", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Детали", exact: true }).click();
  await page.getByRole("button", { name: "Сбросить камеру" }).click();
  const assembled = await region.screenshot();
  await page.getByRole("button", { name: "Купить: Радар IceSAR" }).click();
  await page.getByRole("button", { name: "Установить: Радар IceSAR" }).click();
  await expect
    .poll(async () => (await region.screenshot()).equals(assembled))
    .toBe(false);
  await expect(page.getByTestId("balance-energy")).toContainText("427");
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Схема выбранного космического аппарата" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await expect(region.locator("canvas")).toBeVisible();
  expect(errors).toEqual([]);
});
test("unavailable WebGL falls back to the fully working SVG builder", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<typeof original>
    ) {
      if (String(args[0]).startsWith("webgl")) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await builder(page);
  await expect(
    page.getByRole("status").filter({ hasText: "3D недоступен" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "2D", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("img", { name: "Схема выбранного космического аппарата" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Купить: Радар IceSAR" }).click();
  await page.getByRole("button", { name: "Установить: Радар IceSAR" }).click();
  await expect(page.getByTestId("balance-energy")).toContainText("427");
});
test("context loss switches to SVG; 3D preference and reduced motion are respected", async ({
  page,
}) => {
  await builder(page);
  const canvas = page.locator(".scene-stage canvas");
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await canvas.evaluate((element) =>
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(
    page.getByText("3D недоступен. Показана рабочая 2D-схема."),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Настройки", exact: true })
    .last()
    .click();
  await page.getByLabel("Уменьшить движение").check();
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Конструктор", exact: true })
    .click();
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "Автовращение" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await page.reload();
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Конструктор", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "2D", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});
