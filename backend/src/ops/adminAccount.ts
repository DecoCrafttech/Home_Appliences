import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createDatabasePool } from "../databasePool.js";
import { safeError } from "../security/safeError.js";
import { hashPassword } from "../security/password.js";

// This command never emits credentials to redirected output, API responses or
// a report file. The owner must use an attached local terminal.
if (!process.stdout.isTTY)
  throw new Error(
    "Open a local interactive terminal to manage admin credentials; redirected output is refused",
  );
process.env.NODE_ENV = "production";
const { env } = await import("../config/env.js");
const argument = (flag: string) => process.argv[process.argv.indexOf(flag) + 1];
const username = process.argv.includes("--username")
  ? argument("--username")
  : "admin";
const branch = process.argv.includes("--expect-branch")
  ? argument("--expect-branch")
  : undefined;
const database = process.argv.includes("--expect-database")
  ? argument("--expect-database")
  : undefined;
if (
  !/^[A-Za-z0-9_.-]{3,50}$/.test(username || "") ||
  !branch ||
  !database ||
  !process.argv.includes("--apply")
)
  throw new Error(
    "Supply --username USER --expect-branch BRANCH_ID --expect-database DATABASE --apply after reviewing the target",
  );
if (!env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = createDatabasePool(env.DATABASE_URL, { max: 1 });
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
try {
  const identity = (
    await pool.query(
      "SELECT current_database() AS database,current_setting('neon.project_id',true) AS project_id,current_setting('neon.branch_id',true) AS branch_id",
    )
  ).rows[0];
  if (identity.branch_id !== branch || identity.database !== database)
    throw new Error(
      "Connected Neon branch does not match the explicitly reviewed target",
    );
  const matches = (
    await pool.query(
      "SELECT id,username,role FROM staff_profiles WHERE lower(username)=lower($1)",
      [username],
    )
  ).rows;
  let staff = matches[0];
  if (staff && staff.role !== "SUPER_ADMIN")
    throw new Error(
      "This owner command only manages a SUPER_ADMIN account; no role escalation is allowed",
    );
  const temporaryPassword =
    "Fb!" + randomBytes(24).toString("base64url") + "9a";
  const passwordHash = await hashPassword(temporaryPassword);
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    if (!staff) {
      if (
        Number(
          (
            await connection.query(
              "SELECT count(*)::int AS count FROM staff_profiles",
            )
          ).rows[0].count,
        ) !== 0
      )
        throw new Error(
          "Staff already exists; choose the existing primary SUPER_ADMIN username",
        );
      staff = (
        await connection.query(
          "INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES($1,$2,'Primary Administrator',$3,'SUPER_ADMIN',true) RETURNING id,username,role",
          [`${username}@local.invalid`, username, passwordHash],
        )
      ).rows[0];
    } else {
      await connection.query(
        "UPDATE staff_profiles SET password_hash=$1,must_change_password=true,password_changed_at=now(),failed_attempts=0,locked_until=NULL,active=true,updated_at=now() WHERE id=$2 AND role='SUPER_ADMIN'",
        [passwordHash, staff.id],
      );
    }
    await connection.query(
      "UPDATE staff_sessions SET revoked_at=now() WHERE staff_id=$1 AND revoked_at IS NULL",
      [staff.id],
    );
    await connection.query("COMMIT");
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
  console.log(
    `\nFixbeez primary administrator\nDatabase: ${identity.database}\nBranch: ${identity.branch_id}\nUsername: ${staff.username}\nONE-TIME PASSWORD: ${temporaryPassword}\n\nStore this password privately now. It is not saved to a file. You must change it after signing in.\n`,
  );

  // Exercise real production-mode API code against this exact account.
  const { app } = await import("../app.js");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((done) => server.once("listening", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Local verification server failed");
  const origin = `http://127.0.0.1:${address.port}/api/v1/admin`;
  const checks: Record<string, boolean> = {};
  let session: string | undefined;
  try {
    const post = (path: string, body: unknown) =>
      fetch(origin + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    checks.unauthorizedDenied =
      (await fetch(origin + "/auth/me")).status === 401;
    checks.incorrectPasswordDenied =
      (
        await post("/auth/login", {
          username,
          password: temporaryPassword + "wrong",
        })
      ).status === 401;
    const login = await post("/auth/login", {
      username,
      password: temporaryPassword,
    });
    checks.correctPasswordAccepted = login.status === 200;
    if (!checks.correctPasswordAccepted)
      throw new Error(
        "Admin password verification failed; the printed temporary password remains valid",
      );
    const cookie = login.headers.get("set-cookie") || "";
    checks.secureCookie =
      /HttpOnly/i.test(cookie) &&
      /Secure/i.test(cookie) &&
      /SameSite=Strict/i.test(cookie);
    session = cookie.split(";")[0];
    const me = await fetch(origin + "/auth/me", {
      headers: { Cookie: session },
    });
    const meData = (await me.json()) as {
      data?: { must_change_password: boolean };
    };
    checks.identityRestored = me.status === 200;
    checks.passwordChangeRequired = meData.data?.must_change_password === true;
    checks.businessBlockedUntilPasswordChange =
      (
        await fetch(origin + "/dashboard/summary", {
          headers: { Cookie: session },
        })
      ).status === 403;
  } finally {
    if (session)
      await pool.query(
        "UPDATE staff_sessions SET revoked_at=now() WHERE token_hash=$1",
        [hash(session.slice("staff_session=".length))],
      );
    await new Promise<void>((done) => server.close(() => done()));
  }
  const receipt = {
    username: staff.username,
    identity,
    changedAt: new Date().toISOString(),
    mustChangePassword: true,
    checks,
    passwordStored:
      "hashed in database; plaintext displayed only in owner terminal",
  };
  const directory = fileURLToPath(
    new URL("../../../audit-private/", import.meta.url),
  );
  await mkdir(directory, { recursive: true });
  await writeFile(
    directory + "admin-credentials-receipt.json",
    JSON.stringify(receipt, null, 2),
    { mode: 0o600 },
  );
  console.log("Verification: " + JSON.stringify(checks));
  if (Object.values(checks).some((value) => !value))
    throw new Error(
      "An admin verification check failed; see the non-secret audit receipt",
    );
} catch (error) {
  console.error("Admin account operation failed", safeError(error));
  process.exitCode = 1;
} finally {
  await pool.end();
}
