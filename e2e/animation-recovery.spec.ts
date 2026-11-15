import { expect, test } from "@playwright/test";
import { goldenBuild } from "../src/data/missionConfig";
import type { MissionCommand } from "../src/types";
import { createRun, transition } from "../src/engine/simulation";
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
const launch: MissionCommand[] = [
  { type: "Validate" },
  { type: "Launch", seed: 42 },
];
async function seed(
  page: import("@playwright/test").Page,
  commands: MissionCommand[],
  graphics = "3d",
) {
  await page.emulateMedia({ reducedMotion: "reduce" });
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
              commands,
              seed: 42,
              settings: {
                language: "en",
                mode: "learning",
                graphics,
                sound: false,
                reducedMotion: true,
                motionPreference: "off",
                playback: "step",
                playbackSpeed: 1,
              },
            },
          }),
        );
    },
    { build: { ...goldenBuild, modelVersion: 2 }, commands, graphics },
  );
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Mission control", exact: true })
    .click();
}
test("one play action recovers a paused reduced-motion 2D save and enables actual 3D liftoff", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await seed(page, [...launch, { type: "Pause" }], "schematic");
  await expect(
    page.getByText("Animation is off. Flight time is stopped.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Play 3D animation", exact: true })
    .click();
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toBeVisible({ timeout: 25000 });
  await expect(canvas).toHaveAttribute("data-motion-enabled", "true");
  await expect(canvas).toHaveAttribute("data-playback-paused", "false");
  await expect
    .poll(
      async () => Number(await canvas.getAttribute("data-launch-progress")),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.03);
  await page.getByRole("button", { name: "Motion: on", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-motion-enabled", "false");
  const frozen = await canvas.getAttribute("data-launch-progress");
  expect(Number(frozen)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Full route", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 15000,
  });
  expect(await canvas.getAttribute("data-launch-progress")).toBe(frozen);
  await page
    .getByRole("button", { name: "Play 3D animation", exact: true })
    .click();
  await expect
    .poll(
      async () => Number(await canvas.getAttribute("data-launch-progress")),
      { timeout: 15000 },
    )
    .toBeGreaterThan(Number(frozen));
  expect(errors).toEqual([]);
});
test("reduced motion holds the rocket on the pad until animation is explicitly enabled", async ({
  page,
}) => {
  await seed(page, launch);
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toHaveAttribute("data-motion-enabled", "false", {
    timeout: 25000,
  });
  await expect(canvas).toHaveAttribute("data-launch-progress", "0.0000");
  await page.getByRole("button", { name: "Full route", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-camera-settled", "true", {
    timeout: 15000,
  });
  await expect(canvas).toHaveAttribute("data-launch-progress", "0.0000");
  await page
    .getByRole("button", { name: "Play 3D animation", exact: true })
    .click();
  await expect
    .poll(
      async () => Number(await canvas.getAttribute("data-launch-progress")),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.03);
});

test("a completed saved flight can restart as a visible 3D animation without deleting the design", async ({
  page,
}) => {
  const commands: MissionCommand[] = [...launch];
  let run = createRun({ ...goldenBuild, modelVersion: 2 });
  for (const command of commands) run = transition(run, command);
  for (let i = 0; i < 30 && !run.result; i++) {
    const command: MissionCommand = run.crisis
      ? { type: "ChooseDecision", choice: "safe" }
      : { type: "Advance" };
    commands.push(command);
    run = transition(run, command);
  }
  expect(run.result?.success).toBe(true);
  await seed(page, commands);
  await page
    .getByRole("button", { name: "Watch 3D again", exact: true })
    .click();
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toHaveAttribute("data-flight-phase", "launched", {
    timeout: 25000,
  });
  await expect
    .poll(
      async () => Number(await canvas.getAttribute("data-launch-progress")),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.03);
  const saved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("space-mission-architect-v1")!).state,
  );
  expect(saved.build.moduleIds).toEqual(goldenBuild.moduleIds);
  expect(saved.build.propellantKg).toBe(120);
  expect(saved.settings.motionPreference).toBe("on");
});

test("launch and replay start live 3D automatically without a separate animation action", async ({
  page,
}) => {
  await seed(page, []);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("button", { name: "Launch preparation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Launch mission", exact: true })
    .click();
  const canvas = page.locator(".mission-stage canvas");
  await expect(canvas).toHaveAttribute("data-motion-enabled", "true", {
    timeout: 25000,
  });
  await expect(
    page.getByRole("button", { name: "Live playback", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Play 3D animation", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(
      async () => Number(await canvas.getAttribute("data-launch-progress")),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.03);
  await page.getByRole("button", { name: "Motion: on", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-motion-enabled", "false");
  await page
    .getByRole("button", { name: "Restart flight", exact: true })
    .click();
  await expect(canvas).toHaveAttribute("data-motion-enabled", "true", {
    timeout: 25000,
  });
  await expect
    .poll(
      async () => Number(await canvas.getAttribute("data-launch-progress")),
      { timeout: 15000 },
    )
    .toBeGreaterThan(0.03);
});
