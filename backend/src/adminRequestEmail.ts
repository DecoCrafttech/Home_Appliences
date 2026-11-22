import pino from "pino";
import { env } from "./config/env.js";
import { db } from "./db.js";
import { safeError } from "./security/safeError.js";

const logger = pino({ name: "admin-request-email" });
const apiKey = env.HOSTINGER_MAIL_API_KEY;
const mailboxId = env.HOSTINGER_MAIL_MAILBOX_ID;
const recipient = env.ADMIN_REQUEST_EMAIL_TO;
export const adminRequestEmailConfigured = Boolean(
  apiKey && mailboxId && recipient,
);

export async function queueAdminRequestEmail(requestId: string) {
  if (!adminRequestEmailConfigured) return;
  try {
    await db()`INSERT INTO admin_request_emails(request_id) VALUES (${requestId})
      ON CONFLICT (request_id) DO NOTHING`;
  } catch (error) {
    logger.warn(
      { ...safeError(error), requestId },
      "Could not queue admin request email",
    );
  }
}

let draining = false;
export async function drainAdminRequestEmails() {
  if (!apiKey || !mailboxId || !recipient || draining) return;
  draining = true;
  try {
    const jobs = await db()`SELECT request_id FROM admin_request_emails
      WHERE sent_at IS NULL AND next_attempt_at <= now()
      ORDER BY next_attempt_at LIMIT 20`;
    for (const { request_id: requestId } of jobs) {
      const [job] = await db()`UPDATE admin_request_emails AS email
        SET attempts = email.attempts + 1, next_attempt_at = now() + interval '5 minutes'
        FROM service_requests AS request
        WHERE email.request_id = ${requestId} AND request.id = email.request_id
          AND email.sent_at IS NULL AND email.next_attempt_at <= now()
        RETURNING email.attempts, request.request_number, request.request_type,
          request.appliance, request.service_name`;
      if (!job) continue;

      const type =
        job.request_type === "INSTALLATION" ? "installation" : "service";
      const url = new URL(`/requests/${requestId}`, env.ADMIN_ORIGIN);
      let failure = "Hostinger Mail connection failed";
      try {
        const response = await fetch(
          `https://api.mail.hostinger.com/api/v1/mailboxes/${mailboxId}/send`,
          {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(10_000),
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: [recipient],
              displayName: "Fixbeez",
              subject: `New Fixbeez ${type} request ${job.request_number}`,
              text: `Request: ${job.request_number}\nAppliance: ${job.appliance}\nService: ${job.service_name}\n\nOpen in Fixbeez Admin: ${url}`,
            }),
          },
        );
        failure =
          response.status === 204
            ? ""
            : `Hostinger Mail HTTP ${response.status}`;
        await response.body?.cancel().catch(() => {});
      } catch {
        // Keep the job queued and avoid logging credentials or provider response bodies.
      }
      if (failure) {
        const delay = 2 ** Math.min(Number(job.attempts), 10);
        await db()`UPDATE admin_request_emails
          SET last_error = ${failure}, next_attempt_at = now() + ${delay}::integer * interval '1 minute'
          WHERE request_id = ${requestId} AND attempts = ${job.attempts}`;
      } else {
        await db()`UPDATE admin_request_emails SET sent_at = now(), last_error = NULL
          WHERE request_id = ${requestId} AND attempts = ${job.attempts}`;
      }
    }
  } finally {
    draining = false;
  }
}
