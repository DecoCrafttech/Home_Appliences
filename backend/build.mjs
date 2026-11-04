import { createRequire, isBuiltin } from "node:module";
import { spawnSync } from "node:child_process";
import { copyFileSync } from "node:fs";
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
  const bundle = await build({
    absWorkingDir: fileURLToPath(new URL(".", import.meta.url)),
    entryPoints: ["src/server.ts"],
    outfile: "dist/server.js",
    platform: "node",
    target: "node24",
    format: "esm",
    bundle: true,
    sourcemap: true,
    metafile: true,
    external: Object.keys(dependencies).filter(
      (name) => name !== "@home/shared",
    ),
  });
  const runtime = require("./runtime/package.json");
  for (const output of Object.values(bundle.metafile.outputs)) {
    for (const imported of output.imports) {
      if (!imported.external || isBuiltin(imported.path)) continue;
      const parts = imported.path.split("/");
      const name = imported.path.startsWith("@")
        ? parts.slice(0, 2).join("/")
        : parts[0];
      if (!runtime.dependencies[name]) {
        throw new Error(`Missing standalone runtime dependency: ${name}`);
      }
      if (runtime.dependencies[name] !== dependencies[name]) {
        throw new Error(
          `Update runtime/package.json and its lockfile for ${name}`,
        );
      }
    }
  }
  const runtimeDir = fileURLToPath(new URL("./dist/", import.meta.url));
  for (const file of ["package.json", "package-lock.json"]) {
    copyFileSync(
      new URL(`./runtime/${file}`, import.meta.url),
      new URL(`./dist/${file}`, import.meta.url),
    );
  }
  // Hostinger deploys the selected workspace without its parent's hoisted
  // node_modules. Install a complete, lockfile-pinned runtime inside the output.
  if (!process.env.npm_execpath) throw new Error("Build using npm run build");
  const install = spawnSync(
    process.execPath,
    [
      process.env.npm_execpath,
      "ci",
      "--prefix",
      runtimeDir,
      "--omit=dev",
      "--workspaces=false",
      "--no-audit",
      "--no-fund",
    ],
    {
      cwd: runtimeDir,
      stdio: "inherit",
      env: {
        ...process.env,
        npm_config_workspaces: "false",
        npm_config_ignore_scripts: "false",
      },
    },
  );
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
}
