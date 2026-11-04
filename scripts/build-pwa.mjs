import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

export function buildPwa(entryUrl) {
  const require = createRequire(entryUrl);
  const cwd = fileURLToPath(new URL(".", entryUrl));
  const steps = [[require.resolve("typescript/bin/tsc"), "--noEmit"]];
  if (!process.argv.includes("--typecheck")) {
    const viteCli = join(
      dirname(require.resolve("vite/package.json")),
      "bin/vite.js",
    );
    steps.push([viteCli, "build"]);
  }
  for (const args of steps) {
    const result = spawnSync(process.execPath, args, { cwd, stdio: "inherit" });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  if (!process.argv.includes("--typecheck")) {
    copyFileSync(
      new URL("../deploy/pwa.htaccess", import.meta.url),
      join(cwd, "dist/.htaccess"),
    );
  }
}
