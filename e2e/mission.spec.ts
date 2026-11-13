import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";

// Keep the engineering regression suite on its established SVG rendering path.
// The separate 3D suite covers the actual WebGL renderer and its failure modes.
test.beforeEach(async ({ page }) => {
  await page.addInitScript((build) => {
    if (!localStorage.getItem("space-mission-architect-v1"))
      localStorage.setItem(
        "space-mission-architect-v1",
        JSON.stringify({
          version: 2,
          state: {
            schemaVersion: 1,
            build,
            settings: {
              language: "ru",
              mode: "learning",
              reducedMotion: false,
              sound: false,
              graphics: "schematic",
              playback: "step",
              playbackSpeed: 1,
            },
            seed: 42,
            commands: [],
          },
        }),
      );
  }, goldenBuild);
});

async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name, exact: true })
    .click();
}
async function openBuilder(page: Page) {
  await page.goto("/");
  await nav(page, "Конструктор");
}
test("complete the contract, preserve flight on reload, replay the report", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Открыть контракт" }).click();
  await expect(
    page.getByRole("heading", { name: "Критерии успеха" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Перейти к сборке" }).click();
  await page
    .getByRole("button", { name: "Орбита и покупка запуска", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "К запуску", exact: true }).click();
  await page.getByRole("button", { name: "Запустить миссию" }).click();
  await expect(page.getByText("LIFTOFF — LIM-01")).toBeVisible();
  await page.getByRole("button", { name: "Пропустить анимацию" }).click();
  await expect(
    page.getByRole("heading", { name: "Солнечная вспышка" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(page.getByRole("button", { name: /Safe mode/ })).toBeDisabled();
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await page.reload();
  await nav(page, "Центр управления");
  await expect(
    page.getByRole("heading", { name: "Солнечная вспышка" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Safe mode/ }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Выполнить научный виток" }).click();
  await page.getByRole("button", { name: /Сократить нагрузку/ }).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Выполнить научный виток" }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await page
    .getByRole("button", { name: "Отчёт миссии", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Контракт выполнен" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Инженерный разбор" }),
  ).toBeVisible();
  const delivered = page
    .locator(".metric-row")
    .filter({ hasText: "Доставлено науки" })
    .locator("strong");
  await expect(delivered).toBeVisible();
  expect(
    Number.parseFloat((await delivered.innerText()).split("/")[0]),
  ).toBeGreaterThanOrEqual(120);
  await nav(page, "Конструктор");
  await expect(
    page.getByRole("button", { name: "Купить: Радар IceSAR" }),
  ).toBeDisabled();
  await nav(page, "Отчёт миссии");
  await page.getByRole("button", { name: "Повторить с тем же seed" }).click();
  await expect(page.getByText("LIFTOFF — LIM-01")).toBeVisible();
  expect(errors).toEqual([]);
});

test("radar changes measurements without preflight warnings; undo and reload restore build", async ({
  page,
}) => {
  await openBuilder(page);
  await page.getByRole("button", { name: "Купить: Радар IceSAR" }).click();
  await page.getByRole("button", { name: "Установить: Радар IceSAR" }).click();
  await expect(page.getByTestId("balance-mass")).toContainText("385");
  await expect(page.getByTestId("balance-energy")).toContainText("427");
  await expect(page.getByTestId("balance-energy")).not.toContainText(
    "Нарушение",
  );
  await page.reload();
  await nav(page, "Конструктор");
  await expect(
    page.getByRole("button", { name: "Удалить: Радар IceSAR" }),
  ).toBeVisible();
  await nav(page, "Подготовка запуска");
  await expect(
    page.getByRole("button", { name: "Запустить миссию" }),
  ).toBeEnabled();
  await expect(
    page.getByText(/Баланс энергии за полный виток отрицательный/),
  ).toHaveCount(0);
  await nav(page, "Конструктор");
  await page.getByRole("button", { name: "Удалить: Радар IceSAR" }).click();
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Удалить: Радар IceSAR" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Удалить: Радар IceSAR" }).click();
  await nav(page, "Подготовка запуска");
  await expect(
    page.getByRole("button", { name: "Запустить миссию" }),
  ).toBeEnabled();
});

test("zero fuel launches normally, misses capture and only then reveals the causes", async ({
  page,
}) => {
  await openBuilder(page);
  await page.getByLabel("Количество, kg").fill("120");
  await page.getByRole("button", { name: "Слить и вернуть" }).click();
  await nav(page, "Подготовка запуска");
  await expect(page.locator(".notice.error")).toHaveCount(0);
  await expect(page.getByText(/Доступный Δv меньше требования/)).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Запустить миссию" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Запустить миссию" }).click();
  await page.getByRole("button", { name: "Пропустить анимацию" }).click();
  await page.getByRole("button", { name: /Safe mode/ }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await expect(page.locator(".live-mission-view")).toHaveAttribute(
    "data-phase",
    "incident",
  );
  await expect(
    page.getByRole("heading", { name: "Разбор происшествия и список ошибок" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Завершить запись и показать причины" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Разбор происшествия и список ошибок" }),
  ).toBeVisible();
  await expect(page.locator(".diagnosis-facts")).toContainText("0 m/s");
  await page.screenshot({
    path: "docs/screenshots/trajectory-debrief.png",
    fullPage: true,
  });
});

test("the SVG view shows the same breakup before releasing its causes", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "Орбита и носитель");
  await page.getByRole("button", { name: /Лёгкий · Swift/ }).click();
  await nav(page, "Подготовка запуска");
  await page.getByRole("button", { name: "Запустить миссию" }).click();
  await page.getByRole("button", { name: "Пропустить анимацию" }).click();
  await expect(page.getByTestId("explosion-2d")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Разбор происшествия и список ошибок" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Завершить запись и показать причины" })
    .click();
  await expect(page.locator(".diagnosis-facts")).toContainText("327.0 kg");
  await expect(
    page.getByRole("heading", { name: "Разбор происшествия и список ошибок" }),
  ).toBeInViewport();
});

test("JSON export/import, malformed file handling and scoped reset", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("unrelated", "keep"));
  await page
    .getByRole("button", { name: "Настройки", exact: true })
    .last()
    .click();
  await page.getByLabel("Импорт JSON", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.getByRole("alert")).toContainText(
    "Не удалось загрузить файл",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Экспорт JSON" }).click();
  const file = await download;
  const savePath = await file.path();
  expect(savePath).toBeTruthy();
  await page
    .getByLabel("Импорт JSON", { exact: true })
    .setInputFiles(savePath!);
  await expect(
    page.getByRole("heading", { name: "Ваш космический проект" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Настройки", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Отмена", exact: true }).click();
  await page.getByRole("button", { name: "Новый проект" }).click();
  await page.getByRole("button", { name: "Сбросить", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("unrelated"))).toBe(
    "keep",
  );
});

test("English UI, engineer mode, minimal SVG and no horizontal overflow", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Язык", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Open mission brief" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .last()
    .click();
  await page.getByLabel("Detail mode").selectOption("engineer");
  await page.getByLabel("Graphics").selectOption("minimal");
  await page.getByLabel("Reduce motion").check();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Spacecraft builder", exact: true })
    .click();
  await expect(
    page.getByRole("img", { name: "Schematic of the selected spacecraft" }),
  ).toHaveClass(/minimal/);
  for (const width of [1920, 1366, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `overflow at ${width}`,
    ).toBe(true);
  }
  await page
    .getByRole("button", { name: "Settings", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});

test("production build reloads offline with saved configuration", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openBuilder(page);
  await page.getByRole("button", { name: "Купить: Магнитометр" }).click();
  await page.getByRole("button", { name: "Установить: Магнитометр" }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => resolve(),
          { once: true },
        ),
      );
  });
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Открыть контракт" }),
    JSON.stringify(errors),
  ).toBeVisible();
  await nav(page, "Конструктор");
  await expect(
    page.getByRole("button", { name: "Удалить: Магнитометр" }),
  ).toBeVisible();
});

test("corrupt local save recovers without breaking the interface", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem("space-mission-architect-v1", "{invalid"),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Открыть контракт" }),
  ).toBeVisible();
});

test("risky decisions without shielding produce an explained failed report", async ({
  page,
}) => {
  await openBuilder(page);
  await page.getByRole("button", { name: "Удалить: Термопакет MLI" }).click();
  await page
    .getByRole("button", { name: "Удалить: Радиационный экран" })
    .click();
  await nav(page, "Подготовка запуска");
  await page.getByLabel("Seed сценария").fill("1");
  await page.getByRole("button", { name: "Запустить миссию" }).click();
  await page.getByRole("button", { name: "Пропустить анимацию" }).click();
  await page.getByRole("button", { name: /Продолжить наблюдения/ }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  await page.getByRole("button", { name: "Следующий этап" }).click();
  for (let i = 0; i < 2; i++)
    await page.getByRole("button", { name: "Выполнить научный виток" }).click();
  await page.getByRole("button", { name: /Продолжить наблюдения/ }).click();
  await page
    .getByRole("button", { name: "Завершить запись и показать причины" })
    .click();
  await page
    .getByRole("button", { name: "Отчёт миссии", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Контракт не выполнен" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Повышайте защиту, бюджет испытаний/),
  ).toBeVisible();
});
