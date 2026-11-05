import { URL } from "node:url";
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";
import { neon } from "@neondatabase/serverless";
import process from "node:process";

setDefaultResultOrder("ipv4first");
setDefaultAutoSelectFamily(false);
for (const path of [
  ".env.push.local",
  ".env.local",
  ".env",
  "backend/.env.local",
  "backend/.env",
])
  config({ path, quiet: true });
const receipt = JSON.parse(
  await readFile(
    new URL("../audit-private/test-database.json", import.meta.url),
    "utf8",
  ),
);
if (receipt.removedAt || !/^fixbeez_audit_[a-f0-9]{12}$/.test(receipt.database))
  throw new Error(
    "Create an isolated test database using npm run audit:test-db -w @home/api -- --create first.",
  );
const target = new URL(process.env.DATABASE_URL);
target.pathname = "/" + receipt.database;
const identity = (
  await neon(target.href).query(
    "SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id",
  )
)[0];
if (
  identity?.database !== receipt.database ||
  identity?.branch_id !== receipt.source.branch_id
)
  throw new Error("The isolated database receipt does not match.");
const childEnv = {
  ...process.env,
  NODE_ENV: "test",
  DATABASE_URL: target.href,
  TEST_DATABASE_URL: target.href,
  TEST_DATABASE_NAME: receipt.database,
  TEST_NEON_BRANCH_ID: identity.branch_id,
  RUN_DB_INTEGRATION: "true",
  GOOGLE_CLIENT_ID: "",
  CUSTOMER_ORIGIN: "http://localhost:5193",
  CUSTOMER_APP_ORIGIN: "http://localhost:5193",
  ADMIN_ORIGIN: "http://localhost:5194",
  TECHNICIAN_ORIGIN: "http://localhost:5195",
};
for (const key of ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"])
  delete childEnv[key];
if (!process.env.npm_execpath)
  throw new Error("Run this script through npm run test:catalogue-e2e.");
const migration = spawnSync(
  process.execPath,
  [process.env.npm_execpath, "run", "db:migrate", "-w", "@home/api"],
  { stdio: "inherit", env: childEnv },
);
if (migration.status !== 0)
  throw new Error("Isolated test database migration failed.");
const result = spawnSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "exec",
    "--",
    "playwright",
    "test",
    "--config",
    "playwright.catalogue.config.ts",
    ...process.argv.slice(2),
  ],
  { stdio: "inherit", env: childEnv },
);
process.exitCode = result.status ?? 1;
