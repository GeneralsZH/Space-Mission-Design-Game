import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { catalog, goldenBuild } from "../src/data/missionConfig";

async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function start(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "WebGL2RenderingContext", {
      value: undefined,
      configurable: true,
    });
    delete (window as unknown as Record<string, unknown>)
      .WebGL2RenderingContext;
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Настройки", exact: true })
    .last()
    .click();
  await page.getByLabel("Графика").selectOption("schematic");
  await nav(page, "Конструктор");
}
test("student buys, assembles, qualifies and flies their own project, including flight commands", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await start(page);
  await expect(page.getByTestId("cash")).toContainText("110");
  await expect(
    page.getByText("Проект ещё не собран", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Базовая сборка", exact: true }),
  ).toHaveCount(0);
  for (const id of goldenBuild.moduleIds) {
    const part = catalog.find((c) => c.id === id)!;
    await page
      .getByRole("button", { name: `Купить: ${part.name.ru}`, exact: true })
      .click();
    await page
      .getByRole("button", { name: `Установить: ${part.name.ru}`, exact: true })
      .click();
  }
  await page.getByLabel("Количество, kg").fill("120");
  await page.getByRole("button", { name: /Купить · 1.44/ }).click();
  await nav(page, "Орбита и носитель");
  await page.getByRole("button", { name: /Средний · Atlas/ }).click();
  await nav(page, "Конструктор");
  for (const name of [
    "Электропитание",
    "Тепловакуум",
    "Канал связи",
    "Вибростенд",
  ]) {
    await page
      .locator(".test-bench")
      .filter({ has: page.getByRole("heading", { name, exact: true }) })
      .getByRole("button", { name: "Провести испытание" })
      .click();
  }
  await expect(page.getByTestId("cash")).toContainText("22.56");
  await page.getByRole("tab", { name: /Склад/ }).click();
  await page.screenshot({
    path: "docs/screenshots/student-hangar.png",
    fullPage: true,
  });
  await page.reload();
  await nav(page, "Конструктор");
  await expect(page.getByTestId("cash")).toContainText("22.56");
  await nav(page, "Подготовка запуска");
  await page
    .getByRole("button", { name: "Запустить миссию", exact: true })
    .click();
  await page.getByRole("button", { name: "Пошагово", exact: true }).click();
  await page.getByRole("button", { name: "Пропустить анимацию" }).click();
  await page.getByRole("button", { name: /Safe mode/ }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await page.getByRole("checkbox", { name: /Камера Terrain/ }).uncheck();
  await expect(page.getByText(/приборов выключено 1/).first()).toBeVisible();
  await page.getByRole("checkbox", { name: /Камера Terrain/ }).check();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Выполнить научный виток" }).click();
  await page.getByRole("button", { name: /Сократить нагрузку/ }).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Выполнить научный виток" }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await page.getByLabel("Ориентация антенны").selectOption("stowed");
  await expect(
    page.getByText("Сеанс связи · антенна не направлена на Землю", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Ориентация антенны").selectOption("earth");
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await nav(page, "Отчёт миссии");
  await expect(
    page.getByRole("heading", { name: "Контракт выполнен", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/student-debrief.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("warehouse drag and drop respects category mounts and keyboard installation is available", async ({
  page,
}) => {
  await start(page);
  await page
    .getByRole("button", { name: "Купить: Шина Standard", exact: true })
    .click();
  await page.getByRole("tab", { name: /Склад/ }).click();
  const part = page.getByTestId("module-bus-standard");
  await part.dragTo(page.getByTestId("slot-instrument"));
  await expect(page.getByTestId("slot-bus")).toContainText("Свободный узел");
  await part.dragTo(page.getByTestId("slot-bus"));
  await expect(page.getByTestId("slot-bus")).toContainText("Шина Standard");
  await expect(page.getByTestId("cash")).toContainText("99");
  await page
    .getByRole("button", { name: "Удалить: Шина Standard", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Выбрать: Шина Standard", exact: true })
    .click();
  await page.getByTestId("slot-bus").click();
  await expect(page.getByTestId("slot-bus")).toContainText("Шина Standard");
  for (const width of [1366, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}`,
    ).toBe(true);
  }
  await page.screenshot({
    path: "docs/screenshots/student-mobile.png",
    fullPage: true,
  });
});
