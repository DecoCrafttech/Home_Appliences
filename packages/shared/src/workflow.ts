import { z } from "zod";
export function requestReference(value: {
  display_number?: number | string;
  request_number: string;
}): string {
  return value.display_number == null
    ? value.request_number
    : String(value.display_number).padStart(6, "0");
}
export function operationalStatus(status: string): string {
  if (
    [
      "REQUESTED",
      "UNDER_REVIEW",
      "EXECUTIVE_CONTACTED",
      "ASSIGNMENT_PENDING",
    ].includes(status)
  )
    return "PENDING";
  if (["TECHNICIAN_ASSIGNED", "APPOINTMENT_CONFIRMED"].includes(status))
    return "TECHNICIAN_ASSIGNED";
  if (
    [
      "TECHNICIAN_EN_ROUTE",
      "TECHNICIAN_ARRIVED",
      "IN_PROGRESS",
      "ESTIMATE_PENDING_APPROVAL",
    ].includes(status)
  )
    return "IN_PROGRESS";
  return status;
}
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return "[" + value.map(canonicalJson).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}
export const assignmentStateSchema = z.enum([
  "OFFERED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "REASSIGNED",
]);
export type AssignmentState = z.infer<typeof assignmentStateSchema>;
export const workReportStateSchema = z.enum([
  "SUBMITTED_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SUPERSEDED",
]);
export type WorkReportState = z.infer<typeof workReportStateSchema>;
export const assignmentOfferSchema = z
  .object({
    technicianId: z.string().uuid(),
    version: z.number().int().positive(),
    reason: z.string().trim().min(3).max(300),
  })
  .strict();
export const notificationSchema = z.object({
  id: z.string().uuid(),
  request_id: z.string().uuid().nullable(),
  title: z.string(),
  message: z.string(),
  read_at: z.string().nullable(),
  created_at: z.string(),
  related_path: z.string().optional(),
});
export type WorkflowNotification = z.infer<typeof notificationSchema>;
export const notificationReadAllSchema=z.object({ids:z.array(z.string().uuid()).min(1).max(100).optional(),before:z.string().datetime({offset:true}).optional()}).strict().refine(v => !!v.ids !== !!v.before,"Provide a notification snapshot or notification IDs.");
