import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Software WebGL contexts are intentionally tested sequentially on Windows.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4186",
    // Existing dashboard regressions explicitly retain the optional panel view.
    // The immersive suite clears this state to exercise the new default.
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:4186",
          localStorage: [{ name: "orbital-flight-view", value: "panel" }],
        },
      ],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
  webServer: {
    command: "npm run preview -- --port 4186 --strictPort",
    url: "http://127.0.0.1:4186",
    // Never silently test an unrelated server occupying the preview port.
    reuseExistingServer: false,
  },
});
