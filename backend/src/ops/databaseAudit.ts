import { createDatabasePool } from "../databasePool.js";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { safeError } from "../security/safeError.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const keyRoot = join(homedir(), ".fixbeez-backup-keys");
function protect(bytes: Buffer, decrypt = false): Buffer {
  if (process.platform !== "win32") return bytes;
  const operation = decrypt ? "Unprotect" : "Protect";
  const script = `Add-Type -AssemblyName System.Security; $buffer = New-Object IO.MemoryStream; [Console]::OpenStandardInput().CopyTo($buffer); $result = [Security.Cryptography.ProtectedData]::${operation}($buffer.ToArray(), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Write([Convert]::ToBase64String($result))`;
  const result = spawnSync(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { input: bytes, windowsHide: true, encoding: "buffer" },
  );
  if (result.error || result.status !== 0)
    throw new Error("Windows backup-key protection failed");
  return Buffer.from(result.stdout.toString().trim(), "base64");
}
async function verifyBackup(path: string) {
  const record = JSON.parse(await readFile(path, "utf8"));
  if (!/^[\w.-]+\.(dpapi|key)$/.test(record.keyFile))
    throw new Error("Invalid backup key reference");
  const key = protect(
    await readFile(join(keyRoot, record.keyFile)),
    record.keyFile.endsWith(".dpapi"),
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(record.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, "base64")),
    decipher.final(),
  ]);
  if (createHash("sha256").update(plaintext).digest("hex") !== record.sha256)
    throw new Error("Backup checksum mismatch");
  const snapshot = JSON.parse(plaintext.toString("utf8"));
  for (const table of snapshot.tables)
    if (JSON.parse(table.rows).length !== table.count)
      throw new Error("Backup row-count mismatch");
  return {
    verified: true,
    identity: snapshot.identity,
    tables: snapshot.tables.length,
    records: snapshot.tables.reduce(
      (sum: number, table: { count: number }) => sum + table.count,
      0,
    ),
  };
}
try {
  if (process.argv.includes("--verify")) {
    const path = process.argv[process.argv.indexOf("--verify") + 1];
    if (!path) throw new Error("Supply an encrypted backup file to verify");
    console.log(JSON.stringify(await verifyBackup(resolve(path)), null, 2));
  } else {
    if (!env.DATABASE_URL)
      throw new Error(
        "DATABASE_URL is required for the read-only database audit",
      );
    const pool = createDatabasePool(env.DATABASE_URL, {
      max: 1,
      connectionTimeoutMillis: 15000,
    });
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
      const identityRow = (
        await connection.query(
          "SELECT current_database() AS database,current_setting('neon.project_id',true) AS project_id,current_setting('neon.branch_id',true) AS branch_id",
        )
      ).rows[0];
      const identity = {
        ...identityRow,
        host: new URL(env.DATABASE_URL).hostname,
      };
      const names = (
        await connection.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name",
        )
      ).rows.map((row) => String(row.table_name));
      const tables = [];
      for (const name of names) {
        const identifier = '"' + name.replaceAll('"', '""') + '"';
        const count = Number(
          (
            await connection.query(
              `SELECT count(*)::text AS count FROM public.${identifier}`,
            )
          ).rows[0].count,
        );
        const rows = process.argv.includes("--backup")
          ? (
              await connection.query(
                `SELECT coalesce(jsonb_agg(to_jsonb(records)), '[]'::jsonb)::text AS data FROM public.${identifier} AS records`,
              )
            ).rows[0].data
          : null;
        tables.push({ name, count, rows });
      }
      const indexes = (
        await connection.query(
          "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
        )
      ).rows;
      const constraints = (
        await connection.query(
          "SELECT c.conrelid::regclass::text AS table_name,c.conname,c.contype,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY 1,2",
        )
      ).rows;
      const columns = (
        await connection.query(
          "SELECT table_name,column_name,udt_name,column_default,is_nullable FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
        )
      ).rows;
      const staff = names.includes("staff_profiles")
        ? (
            await connection.query(
              "SELECT id,username,role,active,must_change_password FROM staff_profiles ORDER BY created_at",
            )
          ).rows
        : [];
      const duplicates = names.includes("service_requests")
        ? (
            await connection.query(
              "SELECT count(*)::int AS duplicate_idempotency_groups FROM (SELECT idempotency_key FROM service_requests WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key HAVING count(*)>1) d",
            )
          ).rows[0]
        : {};
      const snapshot = {
        format: "fixbeez-data-snapshot-v1",
        createdAt: new Date().toISOString(),
        identity,
        tables,
        indexes,
        constraints,
        columns,
      };
      await connection.query("COMMIT");
      const summary = {
        createdAt: snapshot.createdAt,
        identity,
        tables: tables.map(({ name, count }) => ({ name, count })),
        staff,
        duplicates,
        foreignKeys: constraints.filter((row) => row.contype === "f"),
      };
      await mkdir(join(root, "audit-private"), { recursive: true });
      await writeFile(
        join(root, "audit-private", "database-inventory.json"),
        JSON.stringify(summary, null, 2),
        { mode: 0o600 },
      );
      if (process.argv.includes("--backup")) {
        const id = `${new Date().toISOString().replaceAll(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
        const key = randomBytes(32),
          iv = randomBytes(12),
          plaintext = Buffer.from(JSON.stringify(snapshot));
        const cipher = createCipheriv("aes-256-gcm", key, iv);
        const ciphertext = Buffer.concat([
          cipher.update(plaintext),
          cipher.final(),
        ]);
        await mkdir(keyRoot, { recursive: true, mode: 0o700 });
        const keyFile = id + (process.platform === "win32" ? ".dpapi" : ".key");
        await writeFile(join(keyRoot, keyFile), protect(key), {
          mode: 0o600,
          flag: "wx",
        });
        await mkdir(join(root, "backups"), { recursive: true });
        const path = join(root, "backups", id + ".json.enc");
        await writeFile(
          path,
          JSON.stringify({
            version: 1,
            keyFile,
            iv: iv.toString("base64"),
            tag: cipher.getAuthTag().toString("base64"),
            sha256: createHash("sha256").update(plaintext).digest("hex"),
            ciphertext: ciphertext.toString("base64"),
          }),
          { mode: 0o600, flag: "wx" },
        );
        Object.assign(summary, {
          backup: path,
          backupVerification: await verifyBackup(path),
          keyProtection:
            process.platform === "win32"
              ? "Windows DPAPI current user"
              : "local owner-only key file",
        });
        await writeFile(
          join(root, "audit-private", "database-inventory.json"),
          JSON.stringify(summary, null, 2),
          { mode: 0o600 },
        );
      }
      console.log(JSON.stringify(summary, null, 2));
    } finally {
      await connection.query("ROLLBACK").catch(() => {});
      connection.release();
      await pool.end();
    }
  }
} catch (error) {
  console.error("Database audit failed", safeError(error));
  process.exitCode = 1;
}
