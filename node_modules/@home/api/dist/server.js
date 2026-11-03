import { app, logger } from "./app.js";
import { env } from "./config/env.js";
import { drainPushOutbox, pushConfigured } from "./pushService.js";
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, "API listening"));
if (pushConfigured) {
    void drainPushOutbox();
    setInterval(() => void drainPushOutbox(), 60_000).unref();
}
for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10000).unref();
    });
