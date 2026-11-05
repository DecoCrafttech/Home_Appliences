import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { transactionConnection, closeDatabase } from "./db.js";

const migrations = resolve(process.cwd(), "migrations");
const connection = await transactionConnection();
try {
  await connection.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const applied = new Set(
    (await connection.query("SELECT name FROM schema_migrations")).rows.map(
      (row) => String(row.name),
    ),
  );
  for (const file of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (applied.has(file)) continue;
    await connection.query("BEGIN");
    try {
      await connection.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('fixbeez:schema-migrations',0))",
      );
      if (
        !(
          await connection.query(
            "SELECT name FROM schema_migrations WHERE name=$1",
            [file],
          )
        ).rows.length
      ) {
        await connection.query(
          await readFile(resolve(migrations, file), "utf8"),
        );
        await connection.query(
          "INSERT INTO schema_migrations(name) VALUES($1)",
          [file],
        );
        console.log(`Applied ${file}`);
      }
      await connection.query("COMMIT");
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  connection.release();
  await closeDatabase();
}
