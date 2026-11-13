import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
import type { MissionCommand } from "../src/types";

async function seed(page: Page, commands: MissionCommand[]) {
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
              commands,
              seed: 42,
              settings: {
                language: "ru",
                mode: "learning",
                graphics: "schematic",
                sound: false,
                reducedMotion: false,
                playback: "step",
                playbackSpeed: 1,
              },
            },
          }),
        );
    },
    { build: { ...goldenBuild, launcherId: "light" }, commands },
  );
  await page.goto("/");
}
async function nav(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name, exact: true })
    .click();
}
const width = (page: Page) =>
  page
    .locator(".stage-playback-progress .meter > span")
    .evaluate((e) => parseFloat((e as HTMLElement).style.width));

test("finished flight survives reload and restarts repeatedly from the beginning with the same purchases", async ({
  page,
}) => {
  await seed(page, [
    { type: "Validate" },
    { type: "Launch", seed: 42 },
    { type: "Advance" },
    { type: "Advance" },
  ]);
  await expect(
    page.getByRole("heading", { name: "Предыдущий полёт завершён" }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Запустить заново", exact: true }),
  ).toBeInViewport();
  const before = await page.evaluate(
    () => JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state,
  );
  await page
    .getByRole("button", { name: "Запустить заново", exact: true })
    .click();
  await expect(page.locator(".live-mission-view")).toHaveAttribute(
    "data-phase",
    "launched",
  );
  await expect(
    page.getByRole("button", { name: "Прямой эфир", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => width(page)).toBeGreaterThan(8);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await page
    .getByRole("button", { name: "Запустить заново", exact: true })
    .click();
  await expect.poll(() => width(page)).toBeLessThan(5);
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state,
  );
  expect(after.build).toEqual(before.build);
  expect(after.economy).toEqual(before.economy);
  expect(after.commands).toHaveLength(2);
  await page.screenshot({
    path: "docs/screenshots/replay-recovery.png",
    fullPage: true,
  });
  for (const viewportWidth of [390, 768, 1366]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `replay layout at ${viewportWidth}`,
    ).toBe(true);
    await expect(
      page.getByRole("button", { name: "Запустить заново", exact: true }),
    ).toBeVisible();
  }
});
test("a paused save resumes live and an explicit animation choice survives Windows Reduce Motion and reload", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await seed(page, [
    { type: "Validate" },
    { type: "Launch", seed: 42 },
    { type: "Pause" },
  ]);
  await expect(
    page.getByRole("heading", { name: "Полёт сохранён на паузе" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Продолжить в эфире", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Пауза", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Движение: выкл", exact: true })
    .click();
  await page.reload();
  await page
    .getByRole("button", { name: "Продолжить в эфире", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Движение: вкл", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => width(page)).toBeGreaterThan(3);
});
test("navigation replaces a stale cached shell online and still reloads offline", async ({
  page,
  context,
}) => {
  await seed(page, []);
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
  const previousChunk = await page.evaluate(async () => {
    const prior = await caches.open("mission-architect-previous-test");
    await prior.put(
      "/assets/previous-viewer.js",
      new Response("export const priorViewer = 'PREVIOUS_VIEWER';", {
        headers: { "Content-Type": "application/javascript" },
      }),
    );
    return (await fetch("/assets/previous-viewer.js")).text();
  });
  expect(previousChunk).toContain("PREVIOUS_VIEWER");
  await page.evaluate(async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith("mission-architect-")) {
        const cache = await caches.open(key);
        await cache.put(
          "/",
          new Response("STALE_SHELL", {
            headers: { "Content-Type": "text/html" },
          }),
        );
        await cache.put(
          "/index.html",
          new Response("STALE_SHELL", {
            headers: { "Content-Type": "text/html" },
          }),
        );
      }
    }
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Открыть контракт", exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const keys = await caches.keys();
        const texts = await Promise.all(
          keys
            .filter((k) => k.startsWith("mission-architect-"))
            .map(async (k) =>
              (await (await caches.open(k)).match("/index.html"))?.text(),
            ),
        );
        return texts.some((t) => t && !t.includes("STALE_SHELL"));
      }),
    )
    .toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Открыть контракт", exact: true }),
  ).toBeVisible();
  await nav(page, "Конструктор");
  await expect(
    page.getByRole("heading", { name: "Ваш космический проект", exact: true }),
  ).toBeVisible();
});
