/* global Image, document */
import fs from "node:fs/promises";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import process from "node:process";
import path from "node:path";
import { chromium } from "playwright";

// Asset preparation only: the application has no browser-conversion dependency.
const inputs = JSON.parse(
  await fs.readFile(
    new URL("./v6-appliance-inputs.json", import.meta.url),
    "utf8",
  ),
);
const destination = path.resolve("apps/customer-pwa/public/appliances/v6");
await fs.mkdir(destination, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const asset of inputs) {
    const bytes = await fs.readFile(asset.source);
    const data = await page.evaluate(
      async (source) => {
        const img = new Image();
        img.src = source;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 640;
        const context = canvas.getContext("2d");
        const scale = Math.min(640 / img.width, 640 / img.height);
        const width = img.width * scale,
          height = img.height * scale;
        context.drawImage(
          img,
          (640 - width) / 2,
          (640 - height) / 2,
          width,
          height,
        );
        return canvas.toDataURL("image/webp", 0.86).split(",")[1];
      },
      `data:image/png;base64,${bytes.toString("base64")}`,
    );
    await fs.writeFile(
      path.join(destination, `${asset.key}.webp`),
      Buffer.from(data, "base64"),
    );
    process.stdout.write(`${asset.key}.webp saved\n`);
  }
} finally {
  await browser.close();
}
