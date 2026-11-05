/* global Image, document */
import fs from "node:fs/promises";
import { URL } from "node:url";
import { Buffer } from "node:buffer";
import process from "node:process";
import path from "node:path";
import { chromium } from "playwright";

// Resize and encode AI-generated raster assets; no runtime image dependency.
const inputs = JSON.parse(
  await fs.readFile(new URL("./v7-image-inputs.json", import.meta.url), "utf8"),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const asset of inputs) {
    const bytes = await fs.readFile(asset.source);
    const encoded = await page.evaluate(
      async (source) => {
        const image = new Image();
        image.src = source;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 640;
        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        const scale = Math.min(640 / image.width, 640 / image.height);
        const width = image.width * scale,
          height = image.height * scale;
        context.drawImage(
          image,
          (640 - width) / 2,
          (640 - height) / 2,
          width,
          height,
        );
        return canvas.toDataURL("image/webp", 0.88).split(",")[1];
      },
      `data:image/png;base64,${bytes.toString("base64")}`,
    );
    const destination = path.resolve(asset.destination);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const output = Buffer.from(encoded, "base64");
    await fs.writeFile(destination, output);
    process.stdout.write(
      `${asset.key}: ${Math.round(output.length / 1024)} KiB\n`,
    );
  }
} finally {
  await browser.close();
}
