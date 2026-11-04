import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";
import process from "node:process";

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
process.exit(result.status ?? 1);
