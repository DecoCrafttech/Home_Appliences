import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { URL } from "node:url";
import { Buffer } from "node:buffer";

// Resize the approved branded PWA icon rather than a generic placeholder.
const logo = await readFile(
  new URL("../apps/customer-pwa/public/icon-512.png", import.meta.url),
);
const source = `data:image/png;base64,${logo.toString("base64")}`;
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  const icons = [];
  for (const size of [16, 32, 48, 180]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(
      `<style>html,body{margin:0;width:100%;height:100%}img{display:block;width:100%;height:100%}</style><img src="${source}" />`,
    );
    await page.locator("img").evaluate((image) => image.decode());
    const png = await page.screenshot({ omitBackground: true });
    if (size <= 48) icons.push({ size, png });
    for (const role of ["customer", "admin", "technician"]) {
      await writeFile(
        new URL(
          `../apps/${role}-pwa/public/${size === 180 ? "apple-touch-icon.png" : `favicon-${size}x${size}.png`}`,
          import.meta.url,
        ),
        png,
      );
    }
  }
  const header = Buffer.alloc(6 + 16 * icons.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(icons.length, 4);
  let offset = header.length;
  icons.forEach(({ size, png }, index) => {
    const base = 6 + 16 * index;
    header[base] = size;
    header[base + 1] = size;
    header.writeUInt16LE(1, base + 4);
    header.writeUInt16LE(32, base + 6);
    header.writeUInt32LE(png.length, base + 8);
    header.writeUInt32LE(offset, base + 12);
    offset += png.length;
  });
  for (const role of ["customer", "admin", "technician"])
    await writeFile(
      new URL(`../apps/${role}-pwa/public/favicon.ico`, import.meta.url),
      Buffer.concat([header, ...icons.map((icon) => icon.png)]),
    );
} finally {
  await browser.close();
}
