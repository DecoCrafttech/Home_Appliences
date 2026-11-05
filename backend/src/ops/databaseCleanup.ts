import { createDecipheriv, createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createDatabasePool } from "../databasePool.js";
import { env } from "../config/env.js";
import { safeError } from "../security/safeError.js";

type Table = { name: string; count: number; rows: string };
type Snapshot = {
  identity: { database: string; project_id: string; branch_id: string };
  tables: Table[];
};
async function snapshot(path: string): Promise<Snapshot> {
  const record = JSON.parse(await readFile(path, "utf8"));
  if (!/^[\w.-]+\.(dpapi|key)$/.test(record.keyFile))
    throw new Error("Invalid key reference");
  let key = await readFile(
    join(homedir(), ".fixbeez-backup-keys", record.keyFile),
  );
  if (record.keyFile.endsWith(".dpapi")) {
    if (process.platform !== "win32")
      throw new Error("Backup requires its Windows owner");
    const result = spawnSync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Add-Type -AssemblyName System.Security; $buffer=New-Object IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($buffer); $key=[Security.Cryptography.ProtectedData]::Unprotect($buffer.ToArray(),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($key))",
      ],
      { input: key, windowsHide: true, encoding: "buffer" },
    );
    if (result.status !== 0) throw new Error("Cannot unlock backup");
    key = Buffer.from(result.stdout.toString().trim(), "base64");
  }
  const decrypt = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(record.iv, "base64"),
  );
  decrypt.setAuthTag(Buffer.from(record.tag, "base64"));
  const plain = Buffer.concat([
    decrypt.update(Buffer.from(record.ciphertext, "base64")),
    decrypt.final(),
  ]);
  if (createHash("sha256").update(plain).digest("hex") !== record.sha256)
    throw new Error("Backup checksum mismatch");
  const data = JSON.parse(plain.toString());
  for (const table of data.tables)
    if (JSON.parse(table.rows).length !== table.count)
      throw new Error("Backup count mismatch");
  return data;
}
// Sort PostgreSQL's canonical row JSON text, preserving numeric precision.
const fingerprint = (rows: string[]) =>
  createHash("sha256").update(JSON.stringify(rows.sort())).digest("hex");
const preserve = new Set([
  "schema_migrations",
  "app_settings",
  "appliance_categories",
  "service_catalogue",
  "catalogue_media",
  "technician_checklists",
  "staff_profiles",
  "audit_logs",
]);
const expected = {
  database: "neondb",
  project_id: "snowy-hill-87120042",
  branch_id: "br-broad-breeze-b41iqgjz",
};
const root = resolve(import.meta.dirname, "../../..");
const argument = (key: string) => {
  const index = process.argv.indexOf(key);
  const value = process.argv[index + 1];
  if (index < 0 || !value || value.startsWith("--"))
    throw new Error("Missing argument: " + key);
  return value;
};
let pool: ReturnType<typeof createDatabasePool> | undefined;
try {
  if (
    !process.argv.includes("--apply-approved") ||
    !process.argv.includes("--approved-backup") ||
    !process.argv.includes("--fresh-backup")
  )
    throw new Error(
      "Supply approved and fresh backup paths and --apply-approved",
    );
  const approved = await snapshot(resolve(argument("--approved-backup")));
  const fresh = await snapshot(resolve(argument("--fresh-backup")));
  if (
    [approved, fresh].some((data) =>
      Object.entries(expected).some(
        ([k, v]) => data.identity[k as keyof typeof expected] !== v,
      ),
    )
  )
    throw new Error("Backup target mismatch");
  if (
    approved.tables.length !== 41 ||
    approved.tables
      .filter((t) => !preserve.has(t.name))
      .reduce((n, t) => n + t.count, 0) !== 626
  )
    throw new Error("Approved scope mismatch");
  pool = createDatabasePool(env.DATABASE_URL, { max: 1 });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='10s'");
    await client.query("SET LOCAL statement_timeout='30s'");
    const identity = (
      await client.query(
        "SELECT current_database() AS database,current_setting('neon.project_id',true) AS project_id,current_setting('neon.branch_id',true) AS branch_id",
      )
    ).rows[0];
    if (Object.entries(expected).some(([k, v]) => identity[k] !== v))
      throw new Error("Live target mismatch");
    const names = (
      await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
      )
    ).rows.map((r) => String(r.table_name));
    if (
      JSON.stringify(names) !==
      JSON.stringify(approved.tables.map((t) => t.name).sort())
    )
      throw new Error("Schema table set changed");
    const quote = (name: string) =>
      'public."' + name.replaceAll('"', '""') + '"';
    await client.query(
      "LOCK TABLE " + names.map(quote).join(",") + " IN ACCESS EXCLUSIVE MODE",
    );
    const digests = new Map<string, string>();
    for (const table of approved.tables) {
      // Let PostgreSQL parse backup rows, avoiding JS float precision changes.
      const digest = async (rows: string) =>
        fingerprint(
          (
            await client.query(
              "SELECT value::text AS row FROM jsonb_array_elements($1::jsonb)",
              [rows],
            )
          ).rows.map((r) => String(r.row)),
        );
      const live = (
        await client.query(
          `SELECT to_jsonb(records)::text AS row FROM ${quote(table.name)} records`,
        )
      ).rows.map((r) => String(r.row));
      const original = await digest(table.rows),
        current = fingerprint(live);
      const freshTable = fresh.tables.find((t) => t.name === table.name);
      if (
        live.length !== table.count ||
        !freshTable ||
        current !== original ||
        (await digest(freshTable.rows)) !== original
      )
        throw new Error(
          "Dataset changed; cleanup stopped before deletion: " + table.name,
        );
      digests.set(table.name, current);
    }
    const clear = new Set(names.filter((n) => !preserve.has(n)));
    const edges = (
      await client.query(
        "SELECT child.relname AS child,parent.relname AS parent FROM pg_constraint c JOIN pg_class child ON child.oid=c.conrelid JOIN pg_class parent ON parent.oid=c.confrelid JOIN pg_namespace ns ON ns.oid=child.relnamespace WHERE c.contype='f' AND ns.nspname='public' AND c.conrelid<>c.confrelid",
      )
    ).rows;
    const counts: Record<string, number> = {};
    while (clear.size) {
      const next = [...clear].find(
        (name) =>
          !edges.some((edge) => edge.parent === name && clear.has(edge.child)),
      );
      if (!next) throw new Error("Foreign key cycle; cleanup rolled back");
      counts[next] =
        (await client.query("DELETE FROM " + quote(next))).rowCount || 0;
      clear.delete(next);
    }
    for (const name of preserve) {
      const rows = (
        await client.query(
          `SELECT to_jsonb(records)::text AS row FROM ${quote(name)} records`,
        )
      ).rows.map((r) => String(r.row));
      if (fingerprint(rows) !== digests.get(name))
        throw new Error("Preserved data changed; rollback");
    }
    for (const name of Object.keys(counts))
      if (
        Number(
          (
            await client.query(
              "SELECT count(*)::int AS count FROM " + quote(name),
            )
          ).rows[0].count,
        ) !== 0
      )
        throw new Error("Cleanup verification failed");
    await client.query("SET CONSTRAINTS ALL IMMEDIATE");
    await client.query("COMMIT");
    const receipt = {
      completedAt: new Date().toISOString(),
      identity,
      approvedBackup: resolve(argument("--approved-backup")),
      freshBackup: resolve(argument("--fresh-backup")),
      deleted: counts,
      totalDeleted: Object.values(counts).reduce((a, b) => a + b, 0),
      preservedTables: [...preserve],
      preservedRows: 160,
      foreignKeys:
        "constraints enforced; preserved data fingerprints unchanged",
      storageObjectsDeleted: 0,
    };
    await writeFile(
      join(root, "audit-private/database-cleanup-receipt.json"),
      JSON.stringify(receipt, null, 2),
      { mode: 0o600 },
    );
    console.log(JSON.stringify(receipt, null, 2));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
} catch (error) {
  console.error("Cleanup did not complete", safeError(error));
  process.exitCode = 1;
} finally {
  await pool?.end();
}
