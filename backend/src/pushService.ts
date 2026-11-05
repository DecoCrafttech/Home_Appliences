import webpush from "web-push";
import { db } from "./db.js";
import { env } from "./config/env.js";
import pino from "pino";
import { trustedPushEndpoint } from "./security/pushEndpoint.js";
import { safeError } from "./security/safeError.js";
const logger = pino({ name: "web-push" });

export type PushRole = "CUSTOMER" | "ADMIN" | "TECHNICIAN";
export type PushPayload = {
  title: string;
  body: string;
  path: string;
  tag: string;
};

export const pushConfigured = Boolean(
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
);
if (pushConfigured)
  webpush.setVapidDetails(
    env.VAPID_SUBJECT!,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );

async function enqueue(
  role: PushRole,
  id: string,
  eventKey: string,
  payload: PushPayload,
  requestId?: string,
) {
  await db()`INSERT INTO push_deliveries(event_key,recipient_role,recipient_id,request_id,payload)
    VALUES(${eventKey},${role},${id},${requestId || null}::uuid,${JSON.stringify(payload)}::jsonb)
    ON CONFLICT(event_key,recipient_role,recipient_id) DO NOTHING`;
}

export async function sendPushToUser(
  role: PushRole,
  id: string,
  eventKey: string,
  payload: PushPayload,
  requestId?: string,
) {
  if (!pushConfigured) return;
  await enqueue(role, id, eventKey, payload, requestId);
  void drainPushOutbox().catch((error) =>
    logger.warn(safeError(error), "push delivery deferred"),
  );
}

export async function sendPushToRole(
  role: PushRole,
  eventKey: string,
  payload: PushPayload,
  requestId?: string,
) {
  if (!pushConfigured) return;
  const rows =
    role === "ADMIN"
      ? await db()`SELECT id FROM staff_profiles WHERE active=true AND role IN ('SUPER_ADMIN','ADMIN','OPERATIONS_MANAGER','SUPPORT_AGENT')`
      : role === "CUSTOMER"
        ? await db()`SELECT id FROM customers WHERE account_status='ACTIVE'`
        : await db()`SELECT id FROM technicians WHERE active=true`;
  await Promise.all(
    rows.map((row) =>
      enqueue(role, String(row.id), eventKey, payload, requestId),
    ),
  );
  void drainPushOutbox().catch((error) =>
    logger.warn(safeError(error), "push delivery deferred"),
  );
}

let draining = false;
export async function drainPushOutbox() {
  if (!pushConfigured || draining) return;
  draining = true;
  try {
    const jobs =
      await db()`SELECT d.* FROM push_deliveries d JOIN push_preferences p
      ON p.recipient_role=d.recipient_role AND p.recipient_id=d.recipient_id AND p.enabled
      WHERE d.status IN ('PENDING','FAILED','SENDING') AND d.next_attempt_at<=now() ORDER BY d.created_at LIMIT 50`;
    for (const job of jobs) {
      const claimed =
        await db()`UPDATE push_deliveries SET status='SENDING',attempts=attempts+1,next_attempt_at=now()+interval '5 minutes' WHERE id=${job.id} AND status IN ('PENDING','FAILED','SENDING') AND next_attempt_at<=now() RETURNING id`;
      if (!claimed.length) continue;
      const subscriptions =
        await db()`SELECT * FROM push_subscriptions WHERE recipient_role=${job.recipient_role} AND recipient_id=${job.recipient_id} AND enabled AND (expires_at IS NULL OR expires_at>now())`;
      let delivered = false;
      for (const sub of subscriptions)
        try {
          if (!trustedPushEndpoint(String(sub.endpoint))) {
            await db()`UPDATE push_subscriptions SET enabled=false,updated_at=now() WHERE id=${sub.id}`;
            continue;
          }
          await webpush.sendNotification(
            {
              endpoint: String(sub.endpoint),
              keys: {
                p256dh: String(sub.p256dh_key),
                auth: String(sub.auth_key),
              },
            },
            JSON.stringify(job.payload),
            { TTL: 86400, timeout: 10000 },
          );
          delivered = true;
          await db()`UPDATE push_subscriptions SET failure_count=0,last_success_at=now(),updated_at=now() WHERE id=${sub.id}`;
        } catch (error: unknown) {
          const statusCode =
            typeof error === "object" && error && "statusCode" in error
              ? Number(error.statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410)
            await db()`UPDATE push_subscriptions SET enabled=false,updated_at=now() WHERE id=${sub.id}`;
          else
            await db()`UPDATE push_subscriptions SET failure_count=failure_count+1,updated_at=now() WHERE id=${sub.id}`;
        }
      if (delivered || subscriptions.length === 0)
        await db()`UPDATE push_deliveries SET status='SENT',sent_at=now(),last_error=NULL WHERE id=${job.id}`;
      else if (Number(job.attempts) >= 4)
        await db()`UPDATE push_deliveries SET status='FAILED',next_attempt_at=now()+interval '24 hours',last_error='Delivery failed after retries' WHERE id=${job.id}`;
      else
        await db()`UPDATE push_deliveries SET status='FAILED',next_attempt_at=now()+(interval '1 minute' * power(2,attempts)),last_error='Transient delivery failure' WHERE id=${job.id}`;
    }
  } finally {
    draining = false;
  }
}

export function sendRequestNotification(
  role: PushRole,
  id: string,
  requestId: string,
  event: string,
  title: string,
  body: string,
  path: string,
) {
  return sendPushToUser(
    role,
    id,
    `${event}:${requestId}`,
    { title, body, path, tag: `request-${requestId}-${event}` },
    requestId,
  );
}
