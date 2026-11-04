import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
// Invoke the compiler with Node, rather than a platform-specific .bin shim.
const result = spawnSync(
  process.execPath,
  [
    require.resolve("typescript/bin/tsc"),
    ...(process.argv.includes("--noEmit")
      ? []
      : ["--project", "tsconfig.build.json"]),
    ...process.argv.slice(2),
  ],
  { cwd: fileURLToPath(new URL(".", import.meta.url)), stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
if (!process.argv.includes("--noEmit")) {
  const { dependencies } = require("./package.json");
  // Bundle our backend and shared TypeScript at build time. Native modules and
  // third-party packages keep their normal Node package resolution at runtime.
  await build({
    absWorkingDir: fileURLToPath(new URL(".", import.meta.url)),
    entryPoints: ["src/server.ts"],
    outfile: "dist/server.js",
    platform: "node",
    target: "node24",
    format: "esm",
    bundle: true,
    sourcemap: true,
    external: Object.keys(dependencies).filter(
      (name) => name !== "@home/shared",
    ),
  });
}
