import { neon, types, Pool, neonConfig, } from "@neondatabase/serverless";
import { AsyncLocalStorage } from "node:async_hooks";
import { env } from "./config/env.js";
let client;
const transactions = new AsyncLocalStorage();
let pool;
neonConfig.webSocketConstructor = WebSocket;
export async function transactionConnection() {
    pool ??= new Pool({
        connectionString: env.DATABASE_URL,
        max: 6,
        idleTimeoutMillis: 10000,
    });
    return pool.connect();
}
export function inTransaction(connection, work) {
    const query = async (text, values = []) => (await connection.query(text, values)).rows;
    const sql = Object.assign((strings, ...values) => query(strings.reduce((text, part, i) => text + (i ? "$" + i : "") + part, ""), values), {
        query,
        transaction: (queries) => Promise.all(queries),
    });
    return transactions.run(sql, work);
}
// A preferred visit DATE is a calendar day, not a timestamp. Preserve the
// PostgreSQL text so a server timezone cannot shift it to the previous day.
types.setTypeParser(1082, (value) => value);
export function db() {
    const transaction = transactions.getStore();
    if (transaction)
        return transaction;
    if (!env.DATABASE_URL)
        throw Object.assign(new Error("Database is not configured"), {
            status: 503,
            code: "DATABASE_UNAVAILABLE",
        });
    return (client ??= neon(env.DATABASE_URL));
}
