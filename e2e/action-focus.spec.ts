import { expect, test } from "@playwright/test";
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
async function expectAnimation(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe("mission-animation");
  await expect
    .poll(
      async () => {
        const box = await page.locator("#mission-animation").boundingBox();
        return !!box && box.y >= -2 && box.y < 60;
      },
      { timeout: 10000 },
    )
    .toBe(true);
}
for (const width of [1366, 390])
  test(`mission decisions and spacecraft commands return to the animation at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
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
                language: "en",
                mode: "learning",
                graphics: "3d",
                sound: false,
                reducedMotion: false,
                motionPreference: "on",
                playback: "live",
                playbackSpeed: 1,
              },
              commands: [
                { type: "Validate" },
                { type: "Launch", seed: 42 },
                { type: "Advance" },
              ],
            },
          }),
        ),
      { ...goldenBuild, modelVersion: 2 },
    );
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("button", { name: "Mission control", exact: true })
      .click();
    const canvas = page.locator(".mission-stage canvas");
    await expect(canvas).toHaveAttribute("data-ready", "true", {
      timeout: 25000,
    });
    await page.getByRole("button", { name: /Safe mode/ }).click();
    await expectAnimation(page);
    await expect(
      page.getByRole("heading", { name: "Solar flare", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Step mode", exact: true }).click();
    await page.getByRole("button", { name: "Next stage", exact: true }).click();
    await expectAnimation(page);
    await expect(canvas).toHaveAttribute("data-flight-phase", "orbitInsertion");
    await page.getByRole("button", { name: "Next stage", exact: true }).click();
    await expectAnimation(page);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await page.getByLabel("Observation target").selectOption("equator");
    await expectAnimation(page);
    const target = await page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem("space-mission-architect-v1")!,
        ).state.commands.at(-1).operations.target,
    );
    expect(target).toBe("equator");
    expect(errors).toEqual([]);
  });
