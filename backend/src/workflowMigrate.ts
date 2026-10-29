import { env } from "./config/env.js";
import { db } from "./db.js";
if (
  env.NODE_ENV === "production" ||
  !["codex-customer-dev", "br-gentle-wind-b4tsvt43"].includes(
    process.env.NEON_BRANCH || "",
  )
)
  throw new Error(
    "Only the configured isolated development branch may be migrated by this command.",
  );
console.log("Migrating isolated branch:", process.env.NEON_BRANCH);
const identity = (
  await db().query(
    "SELECT current_setting('neon.project_id',true) AS project_id,current_setting('neon.branch_id',true) AS branch_id",
    [],
  )
)[0];
if (
  identity?.project_id !== "snowy-hill-87120042" ||
  identity?.branch_id !== "br-gentle-wind-b4tsvt43"
)
  throw new Error(
    "Connected database is not the approved development project/branch.",
  );
await import("./migrate.js");
