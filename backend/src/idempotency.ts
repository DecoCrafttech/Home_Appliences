import { createHash, randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { z } from "zod";
import { inTransaction, transactionConnection } from "./db.js";
import { requireAuth, ApiError } from "./customerRoutes.js";
import { requireStaff } from "./adminRoutes.js";
import { requireTechnician } from "./technicianRoutes.js";
import { createWorkflowNotifications } from "./workflowNotifications.js";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => JSON.stringify(key) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export const idempotentMutations: RequestHandler = (req, res, next) => {
  const businessPath =
    /^\/api\/v1\/(?:admin\/(?:requests|technicians|catalogue|support|feedback|notifications|appointment-reschedules)|technician\/(?:assignments|jobs|notifications|profile)|service-requests|installation-requests|addresses|profile|requests|support|estimates|notifications)(?:\/|$)/.test(
      req.path,
    );
  if (!businessPath || !["POST", "PATCH", "PUT", "DELETE"].includes(req.method))
    return next();
  if (/\/(photos|documents|photo)(\/|$)|\/(invite|recovery)$/.test(req.path))
    return next();
  const key =
    req.body?.idempotencyKey || req.header("Idempotency-Key") || randomUUID();
  if (
    req.body?.idempotencyKey &&
    req.header("Idempotency-Key") &&
    req.body.idempotencyKey !== req.header("Idempotency-Key")
  )
    return next(
      new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The booking and operation keys must match.",
      ),
    );
  if (!z.string().uuid().safeParse(key).success)
    return next(
      new ApiError(
        422,
        "INVALID_IDEMPOTENCY_KEY",
        "Use a valid operation key.",
      ),
    );
  const authenticate = req.path.startsWith("/api/v1/admin/")
    ? requireStaff
    : req.path.startsWith("/api/v1/technician/")
      ? requireTechnician
      : requireAuth;
  void Promise.resolve(
    authenticate(req, res, (error?: unknown) => {
      if (error) return next(error);
      void execute().catch(next);
    }),
  ).catch(next);
  async function execute() {
    const scope = req.staff
      ? "staff:" + req.staff.id + ":" + req.staff.role
      : req.technician
        ? "technician:" + req.technician.id
        : "customer:" + req.customerId;
    const fingerprint = createHash("sha256")
      .update(req.method + ":" + req.originalUrl + ":" + canonical(req.body))
      .digest("hex");
    const connection = await transactionConnection();
    const original = res.json.bind(res);
    const originalEnd = res.end.bind(res);
    try {
      await connection.query("BEGIN");
      await connection.query("SET LOCAL statement_timeout = '30s'");
      await connection.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [scope + ":" + key],
      );
      const previous = await connection.query(
        "SELECT * FROM mutation_results WHERE actor_scope=$1 AND operation_key=$2 AND expires_at>now()",
        [scope, key],
      );
      if (previous.rows[0]) {
        const saved = previous.rows[0];
        if (saved.fingerprint !== fingerprint)
          throw new ApiError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This operation key was already used with different details.",
          );
        await connection.query("COMMIT");
        res.setHeader("Idempotency-Replayed", "true");
        original.call(res.status(saved.response_status), saved.response_body);
        return;
      }
      // Separate tabs can generate different keys for the same accidental submission.
      await connection.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [scope + ":payload:" + fingerprint],
      );
      const duplicate = await connection.query(
        "SELECT * FROM mutation_results WHERE actor_scope=$1 AND fingerprint=$2 AND created_at>now()-interval '10 seconds' AND expires_at>now() LIMIT 1",
        [scope, fingerprint],
      );
      if (duplicate.rows[0]) {
        const saved = duplicate.rows[0];
        await connection.query(
          "INSERT INTO mutation_results(actor_scope,operation_key,fingerprint,response_status,response_body) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(actor_scope,operation_key) DO UPDATE SET fingerprint=EXCLUDED.fingerprint,response_status=EXCLUDED.response_status,response_body=EXCLUDED.response_body,created_at=now(),expires_at=now()+interval '7 days'",
          [
            scope,
            key,
            fingerprint,
            saved.response_status,
            JSON.stringify(saved.response_body),
          ],
        );
        await connection.query("COMMIT");
        res.setHeader("Idempotency-Replayed", "true");
        original.call(res.status(saved.response_status), saved.response_body);
        return;
      }
      await connection.query(
        "DELETE FROM mutation_results WHERE expires_at<now()",
      );
      // Hold the response until the business mutation and replay record commit together.
      const body = await inTransaction(
        connection,
        () =>
          new Promise<unknown>((resolve) => {
            res.json = ((payload: unknown) => {
              resolve(payload);
              return res;
            }) as typeof res.json;
            res.end = (() => {
              resolve(null);
              return res;
            }) as typeof res.end;
            next();
          }),
      );
      if (res.statusCode >= 200 && res.statusCode < 300) {
        await inTransaction(connection, () =>
          createWorkflowNotifications(req, body),
        );
        await connection.query(
          "INSERT INTO mutation_results(actor_scope,operation_key,fingerprint,response_status,response_body) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(actor_scope,operation_key) DO UPDATE SET fingerprint=EXCLUDED.fingerprint,response_status=EXCLUDED.response_status,response_body=EXCLUDED.response_body,created_at=now(),expires_at=now()+interval '7 days'",
          [scope, key, fingerprint, res.statusCode, JSON.stringify(body)],
        );
        await connection.query("COMMIT");
      } else await connection.query("ROLLBACK");
      res.json = original;
      res.end = originalEnd;
      if (!res.destroyed) {
        if (res.statusCode === 204) originalEnd();
        else original(body);
      }
    } catch (error) {
      await connection.query("ROLLBACK").catch(() => {});
      res.json = original;
      res.end = originalEnd;
      throw error;
    } finally {
      connection.release();
    }
  }
};
