import { expect, test } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
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

test.beforeEach(async ({ page }) => {
  await page.addInitScript(
    (build) =>
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
              graphics: "3d",
              playback: "step",
              playbackSpeed: 1,
              reducedMotion: false,
              sound: false,
            },
            seed: 42,
            commands: [{ type: "Validate" }, { type: "Launch", seed: 42 }],
          },
        }),
      ),
    goldenBuild,
  );
});

test("launch is actual 3D, pause freezes flight, resume advances and skip enters cruise", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Центр управления", exact: true })
    .click();
  const region = page.getByRole("region", { name: "3D-запуск ракеты" });
  const canvas = region.locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 25000 });
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-launch-progress")))
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Пауза", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Пропустить анимацию" }),
  ).toBeDisabled();
  // Allow the last requested frame to settle, then prove that visual time is frozen.
  let pausedAt: string | null = null;
  let stableSamples = 0;
  await expect
    .poll(
      async () => {
        const current = await canvas.getAttribute("data-launch-time");
        stableSamples = current === pausedAt ? stableSamples + 1 : 0;
        pausedAt = current;
        return stableSamples;
      },
      { intervals: [150], timeout: 3000 },
    )
    .toBeGreaterThanOrEqual(3);
  await region.screenshot({ path: "docs/screenshots/launch-3d.png" });
  const before = await region.screenshot();
  await page.getByRole("button", { name: "Повернуть вправо" }).click();
  await expect
    .poll(async () => (await region.screenshot()).equals(before))
    .toBe(false);
  await page.getByRole("button", { name: "Продолжить", exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-launch-time")))
    .toBeGreaterThan(Number(pausedAt));
  await page.getByRole("button", { name: "Пропустить анимацию" }).click();
  await expect(
    page.getByRole("heading", { name: "Солнечная вспышка" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "3D-полёт миссии" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("reduced motion keeps the 3D rocket still and WebGL loss retains the skip command", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Центр управления", exact: true })
    .click();
  const canvas = page
    .getByRole("region", { name: "3D-запуск ракеты" })
    .locator("canvas");
  await expect(canvas).toBeVisible({ timeout: 25000 });
  await expect
    .poll(() => canvas.getAttribute("data-launch-progress"))
    .toBe("0.0000");
  await expect(
    page.getByRole("button", { name: "Движение: выкл", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await canvas.evaluate((element) =>
    element.dispatchEvent(new Event("webglcontextlost", { cancelable: true })),
  );
  await expect(page.getByRole("status")).toContainText("3D недоступен");
  await expect(
    page.getByText("LIFTOFF — LIM-01", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Пропустить анимацию" }).click();
  await expect(
    page.getByRole("heading", { name: "Солнечная вспышка" }),
  ).toBeVisible();
});
