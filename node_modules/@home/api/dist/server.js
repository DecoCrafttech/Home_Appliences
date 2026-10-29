import { app, logger } from "./app.js";
import { env } from "./config/env.js";
const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, "API listening"));
for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(1), 10000).unref();
    });
