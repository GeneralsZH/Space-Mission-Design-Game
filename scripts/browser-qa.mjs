import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch({
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
  });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (e) => failures.push(e.message));
  page.on("requestfailed", (r) =>
    failures.push(`${r.url()} ${r.failure()?.errorText}`),
  );
  await page.goto("http://127.0.0.1:4173/");
  await mkdir("docs/screenshots", { recursive: true });
  await page.screenshot({ path: "docs/screenshots/hub.png", fullPage: true });
  await page
    .getByRole("navigation", { name: "Основная навигация" })
    .getByRole("button", { name: "Конструктор", exact: true })
    .click();
  if (await page.locator('.spacecraft-view[data-view="3d"]').count()) {
    const scene = page.locator(".scene-stage");
    await scene
      .locator('canvas[data-ready="true"]')
      .waitFor({ timeout: 30000 });
    await scene.screenshot({ path: "docs/screenshots/spacecraft-3d.png" });
  }
  await page.screenshot({
    path: "docs/screenshots/builder.png",
    fullPage: true,
  });
  if (process.argv.includes("--offline")) {
    const cacheInfo = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            resolve,
            { once: true },
          ),
        );
      const names = await caches.keys();
      const cache = await caches.open(names[0]);
      const response = await cache.match("/index.html");
      return {
        names,
        keys: (await cache.keys()).map((r) => r.url),
        html: (await response?.text())?.slice(0, 200),
        controller: navigator.serviceWorker.controller?.scriptURL,
      };
    });
    console.log(JSON.stringify(cacheInfo));
    await context.setOffline(true);
    const response = await page.reload();
    console.log(
      JSON.stringify({
        status: response?.status(),
        body: (await response?.text())?.slice(0, 200),
        html: (await page.content()).slice(0, 300),
        failures,
      }),
    );
  }
} finally {
  await browser.close();
}
