import { Pool, neonConfig } from "@neondatabase/serverless";
import pino from "pino";
import { safeError } from "./security/safeError.js";

export function createDatabasePool(
  connectionString: string | undefined,
  options: {
    max?: number;
    connectionTimeoutMillis?: number;
    idleTimeoutMillis?: number;
  } = {},
) {
  neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis: 15000,
    ...options,
  });
  const logger = pino({
    name: "database",
    level: process.env.NODE_ENV === "test" ? "silent" : "warn",
  });
  // A pool 'error' event can carry a client/configuration object, including the
  // connection URL. Handle idle disconnects without crashing or dumping it.
  pool.on("error", (error: unknown) =>
    logger.warn(
      safeError(error),
      "Database idle connection closed; new requests can reconnect",
    ),
  );
  return pool;
}
