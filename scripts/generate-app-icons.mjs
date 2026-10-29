import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { URL } from "node:url";

// Rasterize our own vector mark so installed PWAs match the shared identity.
const svg = await readFile(
  new URL("../apps/customer-pwa/public/icon.svg", import.meta.url),
  "utf8",
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%}svg{display:block;width:100%;height:100%}</style>${svg}`,
    );
    const png = await page.screenshot({ omitBackground: true });
    for (const role of ["customer", "admin", "technician"]) {
      await writeFile(
        new URL(`../apps/${role}-pwa/public/icon-${size}.png`, import.meta.url),
        png,
      );
    }
  }
} finally {
  await browser.close();
}
