import { parentPort, workerData } from "node:worker_threads";
import { argon2id } from "hash-wasm";

try {
  parentPort.postMessage({ value: await argon2id(workerData) });
} catch {
  // Do not include password input or worker data in errors.
  parentPort.postMessage({ error: "Password derivation failed" });
}
