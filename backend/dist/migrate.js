import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { db } from "./db.js";
const migrations = resolve(process.cwd(), "migrations");
await db() `CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
for (const file of (await readdir(migrations))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const applied = await db() `SELECT name FROM schema_migrations WHERE name=${file}`;
    if (applied.length)
        continue;
    const sql = await readFile(resolve(migrations, file), "utf8");
    for (const statement of sql
        .split(/;\s*(?=(?:CREATE|ALTER|INSERT|UPDATE)|$)/)
        .map((part) => part.trim())
        .filter(Boolean))
        await db().query(statement, [], { fullResults: true, arrayMode: false });
    await db() `INSERT INTO schema_migrations(name) VALUES(${file}) ON CONFLICT DO NOTHING`;
    console.log(`Applied ${file}`);
}
