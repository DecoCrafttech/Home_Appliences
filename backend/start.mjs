import { register } from "tsx/esm/api";

// The shared workspace exports TypeScript; retain the loader at runtime.
register();
await import("./src/server.ts");
