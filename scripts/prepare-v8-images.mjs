import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const assets = JSON.parse(
  await fs.readFile(new URL("./v8-image-inputs.json", import.meta.url), "utf8"),
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  for (const asset of assets) {
    const source = await fs.readFile(asset.source);
    const result = await page.evaluate(
      async ({ src, hero }) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const canvas = document.createElement("canvas");
        canvas.width = hero ? 800 : 640;
        canvas.height = hero ? 900 : 640;
        const context = canvas.getContext("2d");
        context.imageSmoothingQuality = "high";
        const scale = Math.min(
          canvas.width / image.width,
          canvas.height / image.height,
        );
        const width = image.width * scale,
          height = image.height * scale;
        context.drawImage(
          image,
          (canvas.width - width) / 2,
          (canvas.height - height) / 2,
          width,
          height,
        );
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        let transparent = 0,
          solid = 0;
        for (let i = 3; i < pixels.length; i += 4) {
          if (pixels[i] < 10) transparent++;
          if (pixels[i] > 245) solid++;
        }
        return {
          encoded: canvas.toDataURL("image/webp", 0.9).split(",")[1],
          cornerAlpha: pixels[3],
          transparent: transparent / (canvas.width * canvas.height),
          solid: solid / (canvas.width * canvas.height),
        };
      },
      {
        src: `data:image/png;base64,${source.toString("base64")}`,
        hero: asset.key === "hero",
      },
    );
    if (
      result.cornerAlpha !== 0 ||
      result.transparent < 0.1 ||
      result.solid < 0.02
    )
      throw new Error(
        `${asset.key}: generated image lacks usable transparency or foreground`,
      );
    const bytes = Buffer.from(result.encoded, "base64");
    for (const target of asset.destinations) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
    }
    process.stdout.write(
      `${asset.key}: ${Math.round(bytes.length / 1024)} KiB, ${Math.round(result.transparent * 100)}% transparent, ${asset.destinations.length} app copies\n`,
    );
  }
} finally {
  await browser.close();
}
