import { neon } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";

export default async function verifyBrowserDatabase() {
  if (process.platform === "win32") {
    setDefaultResultOrder("ipv4first");
    setDefaultAutoSelectFamily(false);
  }
  if (
    process.env.RUN_DB_INTEGRATION !== "true" ||
    !process.env.TEST_DATABASE_URL
  )
    return;
  const receipt = JSON.parse(
    await readFile(resolve("audit-private/browser-test-database.json"), "utf8"),
  );
  const identity = (
    await neon(process.env.TEST_DATABASE_URL).query(
      "SELECT current_database() AS database,current_setting('neon.branch_id',true) AS branch_id",
    )
  )[0];
  if (
    identity?.database !== receipt.database ||
    identity?.branch_id !== receipt.source.branch_id ||
    identity?.database !== process.env.TEST_DATABASE_NAME ||
    !/^fixbeez_audit_[a-f0-9]{12}$/.test(String(identity?.database))
  )
    throw new Error(
      "Browser test database does not match the isolated creation receipt",
    );
}
