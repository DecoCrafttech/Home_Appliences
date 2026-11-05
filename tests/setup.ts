import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";
if (process.platform === "win32") {
  setDefaultResultOrder("ipv4first");
  setDefaultAutoSelectFamily(false);
}

// Integration suites create and delete fixtures. They must never select the
// database used by the public Fixbeez apps just because a local .env exists.
if (process.env.RUN_DB_INTEGRATION === "true") {
  const url = process.env.TEST_DATABASE_URL;
  const branch = process.env.TEST_NEON_BRANCH_ID;
  if (!url || !branch)
    throw new Error(
      "Database tests require TEST_DATABASE_URL and TEST_NEON_BRANCH_ID for an isolated Neon branch",
    );
  const identity = (
    await neon(url).query(
      "SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id",
      [],
      { fetchOptions: { signal: AbortSignal.timeout(15000) } },
    )
  )[0];
  const receipt = await readFile(
    new URL("../audit-private/test-database.json", import.meta.url),
    "utf8",
  )
    .then((value) => JSON.parse(value))
    .catch(() => null);
  const isolatedDatabase =
    receipt &&
    /^fixbeez_audit_[a-f0-9]{12}$/.test(receipt.database) &&
    identity?.database === receipt.database &&
    process.env.TEST_DATABASE_NAME === receipt.database &&
    receipt.source.branch_id === branch;
  if (
    identity?.branch_id !== branch ||
    (branch === "br-broad-breeze-b41iqgjz" && !isolatedDatabase)
  ) {
    throw new Error(
      "Database tests cannot use the shared launch branch or a mismatched branch identity",
    );
  }
  process.env.DATABASE_URL = url;
  process.env.NEON_BRANCH = "codex-customer-dev";
} else {
  delete process.env.DATABASE_URL;
  delete process.env.NEON_BRANCH;
}
