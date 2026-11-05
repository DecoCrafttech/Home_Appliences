import { createDatabasePool } from "../databasePool.js";
import { safeError } from "../security/safeError.js";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { env } from "../config/env.js";

if (!env.DATABASE_URL) throw new Error("A database connection is required");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const receiptPath = join(
  root,
  process.argv.includes("--browser")
    ? "audit-private/browser-test-database.json"
    : "audit-private/test-database.json",
);
const source = new URL(env.DATABASE_URL);
const sourcePool = createDatabasePool(source.href, { max: 1 });
let sourceClosed = false;
async function closeSource() {
  if (!sourceClosed) {
    sourceClosed = true;
    await sourcePool.end();
  }
}
try {
  const sourceIdentity = (
    await sourcePool.query(
      "SELECT current_database() AS database,current_user AS owner,current_setting('neon.project_id',true) AS project_id,current_setting('neon.branch_id',true) AS branch_id",
    )
  ).rows[0];
  if (process.argv.includes("--create")) {
    const previousText = await readFile(receiptPath, "utf8").catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      },
    );
    const previous = previousText === null ? null : JSON.parse(previousText);
    if (previous && !previous.removedAt)
      throw new Error(
        "An audit database already has a receipt; use --run instead of creating another",
      );
    if (previous)
      await writeFile(
        receiptPath + "." + Date.now() + ".removed.json",
        JSON.stringify(previous, null, 2),
        { mode: 0o600, flag: "wx" },
      );
    const database = "fixbeez_audit_" + randomBytes(6).toString("hex");
    if (!/^fixbeez_audit_[a-f0-9]{12}$/.test(database))
      throw new Error("Invalid isolated database name");
    await sourcePool.query(`CREATE DATABASE "${database}" TEMPLATE template0`);
    const receipt = {
      database,
      source: sourceIdentity,
      createdAt: new Date().toISOString(),
    };
    await mkdir(join(root, "audit-private"), { recursive: true });
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2), {
      mode: 0o600,
      flag: previous ? "w" : "wx",
    });
    const target = new URL(source);
    target.pathname = "/" + database;
    const pool = createDatabasePool(target.href, { max: 1 });
    const connection = await pool.connect();
    try {
      if (
        (await connection.query("SELECT current_database() AS database"))
          .rows[0].database !== database
      )
        throw new Error("Isolated database identity mismatch");
      await connection.query(
        "CREATE TABLE schema_migrations(name text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())",
      );
      for (const file of (await readdir(join(root, "backend/migrations")))
        .filter((name) => name.endsWith(".sql"))
        .sort()) {
        await connection.query("BEGIN");
        try {
          await connection.query(
            await readFile(join(root, "backend/migrations", file), "utf8"),
          );
          await connection.query(
            "INSERT INTO schema_migrations(name) VALUES($1)",
            [file],
          );
          await connection.query("COMMIT");
        } catch (error) {
          await connection.query("ROLLBACK");
          throw error;
        }
      }
      console.log(
        JSON.stringify({
          created: database,
          migrations: (
            await connection.query(
              "SELECT count(*)::int AS count FROM schema_migrations",
            )
          ).rows[0].count,
          existingDatabaseUnchanged: sourceIdentity.database,
        }),
      );
    } finally {
      connection.release();
      await pool.end();
    }
  } else if (process.argv.includes("--remove-created")) {
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    if (
      !/^fixbeez_audit_[a-f0-9]{12}$/.test(receipt.database) ||
      receipt.source.branch_id !== sourceIdentity.branch_id ||
      receipt.source.project_id !== sourceIdentity.project_id ||
      receipt.database === sourceIdentity.database ||
      receipt.removedAt
    )
      throw new Error("Audit database receipt mismatch");
    const owned = (
      await sourcePool.query(
        "SELECT datname FROM pg_database WHERE datname=$1 AND datdba=(SELECT oid FROM pg_roles WHERE rolname=current_user)",
        [receipt.database],
      )
    ).rows;
    if (owned.length !== 1) throw new Error("Audit database owner mismatch");
    await sourcePool.query("SET statement_timeout='30s'");
    await sourcePool.query(
      `DROP DATABASE "${receipt.database}"${process.argv.includes("--close-audit-connections") ? " WITH (FORCE)" : ""}`,
    );
    receipt.removedAt = new Date().toISOString();
    await writeFile(receiptPath, JSON.stringify(receipt, null, 2), {
      mode: 0o600,
    });
    console.log(
      JSON.stringify({
        removedDatabase: receipt.database,
        sourceDatabaseUnchanged: sourceIdentity.database,
      }),
    );
  } else if (process.argv.includes("--run")) {
    const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
    if (
      !/^fixbeez_audit_[a-f0-9]{12}$/.test(receipt.database) ||
      receipt.source.branch_id !== sourceIdentity.branch_id ||
      receipt.source.project_id !== sourceIdentity.project_id ||
      receipt.removedAt
    )
      throw new Error(
        "Isolated test receipt does not match the source project",
      );
    const target = new URL(source);
    target.pathname = "/" + receipt.database;
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      NODE_ENV: "test",
      DATABASE_URL: target.href,
      TEST_DATABASE_URL: target.href,
      TEST_DATABASE_NAME: receipt.database,
      TEST_NEON_BRANCH_ID: sourceIdentity.branch_id,
      RUN_DB_INTEGRATION: "true",
      NEON_BRANCH: "codex-customer-dev",
    };
    for (const key of [
      "VAPID_PUBLIC_KEY",
      "VAPID_PRIVATE_KEY",
      "VAPID_SUBJECT",
    ])
      delete childEnv[key];
    if (!process.env.npm_execpath)
      throw new Error("Run through npm run audit:test-db");
    await closeSource();
    const result = spawnSync(
      process.execPath,
      [
        process.env.npm_execpath,
        ...(process.argv.includes("--browser")
          ? ["run", "test:browser"]
          : ["test"]),
        "--",
        ...(process.argv.includes("--browser")
          ? ["--workers=1"]
          : ["--maxWorkers=1", "--fileParallelism=false"]),
        ...(process.argv.includes("--files")
          ? process.argv.slice(process.argv.indexOf("--files") + 1)
          : []),
      ],
      { cwd: root, stdio: "inherit", env: childEnv },
    );
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } else {
    console.log(
      "Use --create to create/migrate a new isolated database, or --run to test against that verified database. The existing database is never cleared.",
    );
  }
} catch (error) {
  console.error("Isolated database operation failed", safeError(error));
  process.exitCode = 1;
} finally {
  await closeSource();
}
