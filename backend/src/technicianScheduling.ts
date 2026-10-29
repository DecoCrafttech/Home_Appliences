import { db } from "./db.js";
import { ApiError } from "./customerRoutes.js";
export async function checkTechnicianSchedule(
  technicianId: string,
  requestId: string,
  date: string,
  window: string,
) {
  const rows =
    await db()`SELECT a.status,t.active,t.verification_status FROM technicians t LEFT JOIN technician_accounts a ON a.technician_id=t.id WHERE t.id=${technicianId}`;
  const a = rows[0];
  if (!a) return;
  if (
    (a.status !== null && a.status !== "ACTIVE") ||
    !a.active ||
    a.verification_status !== "VERIFIED"
  )
    throw new ApiError(
      409,
      "TECHNICIAN_UNAVAILABLE",
      "Technician account is no longer eligible.",
    );
  if (!/^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/.test(window)) return;
  const start = window.slice(0, 5),
    end = window.slice(6);
  if (start >= end)
    throw new ApiError(
      422,
      "INVALID_TIME_WINDOW",
      "Choose a valid visit time window.",
    );
  const minutes = (t: string) =>
    Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const conflicts =
    await db()`SELECT id FROM service_requests WHERE id!=${requestId} AND assigned_technician_id=${technicianId} AND confirmed_date=${date}::date AND status NOT IN ('COMPLETED','CANCELLED') AND (appointment_start_minute IS NULL OR (appointment_start_minute<${minutes(end)} AND appointment_end_minute>${minutes(start)})) LIMIT 1`;
  if (conflicts.length)
    throw new ApiError(
      409,
      "APPOINTMENT_CONFLICT",
      "Technician already has an overlapping appointment.",
    );
}
