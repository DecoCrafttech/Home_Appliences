import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Worker } from "node:worker_threads";
import type { IArgon2Options } from "hash-wasm";

const scrypt = promisify(scryptCallback);
let active = 0;
const waiting: Array<() => void> = [];

// Bound memory use and keep password hashing off the request/event-loop thread.
async function derive(options: IArgon2Options): Promise<string | Uint8Array> {
  if (active >= 2 && waiting.length >= 32)
    throw Object.assign(new Error("Password hashing queue is full"), {
      code: "PASSWORD_HASH_BUSY",
    });
  if (active >= 2) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(
        new URL("./passwordWorker.mjs", import.meta.url),
        {
          workerData: options,
          execArgv: [],
        },
      );
      let reply: { value?: string | Uint8Array; error?: string } | undefined;
      worker.once("message", (message) => {
        reply = message;
      });
      worker.once("error", reject);
      worker.once("exit", (code) => {
        if (code !== 0 || !reply || reply.error || reply.value === undefined) {
          reject(new Error(reply?.error || "Password hashing worker failed"));
        } else resolve(reply.value);
      });
    });
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}

export async function hashPassword(password: string): Promise<string> {
  const hash = await derive({
    password,
    salt: randomBytes(16),
    memorySize: 19456,
    iterations: 2,
    parallelism: 1,
    hashLength: 32,
    outputType: "encoded",
  });
  if (typeof hash !== "string") throw new Error("Invalid password hash result");
  return hash;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (stored.startsWith("$argon2id$")) {
    // The application's native Argon2 hashes use this standard PHC encoding.
    const match =
      /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/.exec(
        stored,
      );
    if (!match || !password) return false;
    const memorySize = Number(match[1]),
      iterations = Number(match[2]),
      parallelism = Number(match[3]);
    const salt = Buffer.from(match[4]!, "base64"),
      expected = Buffer.from(match[5]!, "base64");
    if (
      ![memorySize, iterations, parallelism].every(
        (value) => Number.isSafeInteger(value) && value > 0,
      ) ||
      memorySize < 8 * parallelism ||
      salt.length < 8 ||
      expected.length < 4
    )
      return false;
    const key = await derive({
      password,
      salt,
      memorySize,
      iterations,
      parallelism,
      hashLength: expected.length,
      outputType: "binary",
    });
    return (
      key instanceof Uint8Array &&
      key.length === expected.length &&
      timingSafeEqual(key, expected)
    );
  }
  const [algorithm, salt, digest] = stored.split(":");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(digest, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}
