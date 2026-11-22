import pino from "pino";
import { env } from "./config/env.js";
import { db } from "./db.js";
import { safeError } from "./security/safeError.js";

const logger = pino({ name: "admin-request-email" });
const apiKey = env.HOSTINGER_MAIL_API_KEY;
const mailboxId = env.HOSTINGER_MAIL_MAILBOX_ID;
const recipients = env.ADMIN_REQUEST_EMAIL_TO;
export const adminRequestEmailConfigured = Boolean(
  apiKey && mailboxId && recipients,
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
const htmlEntities: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => htmlEntities[character] ?? character,
  );
}

export async function drainAdminRequestEmails() {
  if (!apiKey || !mailboxId || !recipients || draining) return;
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
          request.appliance, request.service_name, request.preferred_date::text AS preferred_date,
          request.preferred_time_window, request.address_snapshot,
          request.details->>'description' AS description,
          request.details->>'problem' AS selected_options`;
      if (!job) continue;

      const type =
        job.request_type === "INSTALLATION" ? "installation" : "service";
      const url = new URL(`/requests/${requestId}`, env.ADMIN_ORIGIN);
      const address = job.address_snapshot ?? {};
      const fields = [
        ["Booking reference", job.request_number],
        ["Appliance", job.appliance],
        ["Service", job.service_name],
        ["Selected options", job.selected_options],
        ["Preferred date", job.preferred_date],
        ["Preferred time (IST)", job.preferred_time_window],
        ["Customer", address.name],
        ["Contact number", address.phone],
        [
          "Service address",
          [
            address.line1,
            address.line2,
            address.area,
            address.city,
            address.state,
            address.pinCode,
          ]
            .filter(Boolean)
            .join(", "),
        ],
        ["Customer notes", job.description],
      ].filter(([, value]) => typeof value === "string" && value.trim());
      const subject = `New Fixbeez ${type} request ${job.request_number}`;
      const text = `${subject}\n\n${fields.map(([label, value]) => `${label}: ${value}`).join("\n")}\n\nOpen in Fixbeez Admin: ${url}`;
      const html = `<div style="background:#f3f6f8;padding:24px 12px;font-family:Arial,sans-serif;color:#1b2933">
        <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #dce4e8;border-radius:12px;overflow:hidden">
          <div style="background:#103746;color:#fff;padding:24px">
            <div style="font-weight:bold">Fixbeez</div>
            <h1 style="margin:8px 0 0;font-size:24px">New ${type} request</h1>
          </div>
          <div style="padding:24px">
            <table style="width:100%;border-collapse:collapse;text-align:left;font-size:14px;line-height:1.5">
              ${fields.map(([label, value]) => `<tr><th scope="row" style="width:40%;vertical-align:top;padding:8px 12px 8px 0;border-bottom:1px solid #e5eaed">${escapeHtml(label)}</th><td style="padding:8px 0;border-bottom:1px solid #e5eaed;overflow-wrap:anywhere">${escapeHtml(value).replace(/\r?\n/g, "<br>")}</td></tr>`).join("")}
            </table>
            <p style="margin:24px 0 0"><a href="${escapeHtml(url.href)}" style="display:inline-block;background:#103746;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Open in Fixbeez Admin</a></p>
          </div>
        </div>
      </div>`;
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
              to: [...new Set(recipients)],
              displayName: "Fixbeez",
              subject,
              text,
              html,
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
