import {
  neon,
  types,
  Pool,
  neonConfig,
  type NeonQueryFunction,
  type PoolClient,
} from "@neondatabase/serverless";
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "./config/env.js";

export type Sql = NeonQueryFunction<false, false>;
let client: Sql | undefined;
const transactions = new AsyncLocalStorage<Sql>();
let pool: Pool | undefined;
neonConfig.webSocketConstructor = WebSocket;

export async function transactionConnection(): Promise<PoolClient> {
  pool ??= new Pool({
    connectionString: env.DATABASE_URL,
    max: 6,
    idleTimeoutMillis: 10000,
  });
  return pool.connect();
}

export function inTransaction<T>(connection: PoolClient, work: () => T): T {
  const query = async (text: string, values: unknown[] = []) =>
    (await connection.query(text, values)).rows;
  const sql = Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) =>
      query(
        strings.reduce((text, part, i) => text + (i ? "$" + i : "") + part, ""),
        values,
      ),
    {
      query,
      transaction: (queries: Promise<unknown>[]) => Promise.all(queries),
    },
  ) as unknown as Sql;
  return transactions.run(sql, work);
}
// A preferred visit DATE is a calendar day, not a timestamp. Preserve the
// PostgreSQL text so a server timezone cannot shift it to the previous day.
types.setTypeParser(1082, (value: string) => value);

export function db(): Sql {
  const transaction = transactions.getStore();
  if (transaction) return transaction;
  if (!env.DATABASE_URL)
    throw Object.assign(new Error("Database is not configured"), {
      status: 503,
      code: "DATABASE_UNAVAILABLE",
    });
  return (client ??= neon(env.DATABASE_URL));
}
