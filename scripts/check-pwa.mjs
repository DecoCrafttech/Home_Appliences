/* global navigator, setTimeout, caches, URL, console, fetch */
import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import process from "node:process";

const profilePath = await mkdtemp(join(tmpdir(), "ha-pwa-check-"));
if (
  dirname(resolve(profilePath)) !== resolve(tmpdir()) ||
  !profilePath.split(/[\\/]/).pop()?.startsWith("ha-pwa-check-")
)
  throw new Error("Unexpected temporary profile path");
const context = await chromium.launchPersistentContext(profilePath, {
  channel: "chrome",
  headless: true,
});
try {
  for (const [name, origin] of [
    ["admin", process.env.PWA_ADMIN_ORIGIN || "http://127.0.0.1:5184"],
    ["customer", process.env.PWA_CUSTOMER_ORIGIN || "http://localhost:5183"],
    [
      "technician",
      process.env.PWA_TECHNICIAN_ORIGIN || "http://127.0.0.1:5185",
    ],
  ]) {
    const page = await context.newPage();
    await page.goto(origin);
    await page.evaluate(async () => {
      await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Service worker not ready")),
            20000,
          ),
        ),
      ]);
    });
    const cdp = await context.newCDPSession(page);
    const manifest = await cdp.send("Page.getAppManifest");
    const installability = await cdp.send("Page.getInstallabilityErrors");
    const cached = await page.evaluate(async () => {
      const paths = [];
      for (const name of await caches.keys()) {
        for (const request of await (await caches.open(name)).keys())
          paths.push(new URL(request.url).pathname);
      }
      return paths;
    });
    const parsed = JSON.parse(manifest.data);
    if (
      parsed.display !== "standalone" ||
      !parsed.icons.some((icon) => icon.sizes === "512x512")
    )
      throw new Error(`${name}: invalid manifest`);
    if (cached.some((path) => path.startsWith("/api/")))
      throw new Error(`${name}: private API response cached`);
    if (installability.installabilityErrors.length)
      throw new Error(
        `${name}: ${JSON.stringify(installability.installabilityErrors)}`,
      );
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator("#root > *").first().waitFor();
    const privateApiBlocked = await page.evaluate(async () => {
      try {
        await fetch("/api/v1/profile");
        return false;
      } catch {
        return true;
      }
    });
    if (!privateApiBlocked)
      throw new Error(`${name}: private API unexpectedly available offline`);
    console.log(
      JSON.stringify({
        name,
        manifest: "PASS",
        serviceWorker: "PASS",
        chromeInstallability: "PASS",
        privateApiCache: "NONE",
        offlineShell: "PASS",
        cachedAssets: cached.length,
      }),
    );
    await context.setOffline(false);
    await page.close();
  }
} finally {
  await context.close();
  await rm(profilePath, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}
