import { app, logger } from "./app.js";
import { env } from "./config/env.js";
import { drainPushOutbox, pushConfigured } from "./pushService.js";
import { safeError } from "./security/safeError.js";
import { closeDatabase } from "./db.js";
const server = app.listen(env.PORT, () =>
  logger.info({ port: env.PORT }, "API listening"),
);
if (pushConfigured) {
  const drain = () =>
    void drainPushOutbox().catch((error) =>
      logger.warn(safeError(error), "Push outbox will retry"),
    );
  drain();
  setInterval(drain, 60_000).unref();
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    server.close(() => {
      void closeDatabase().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    });
    setTimeout(() => process.exit(1), 10000).unref();
  });
