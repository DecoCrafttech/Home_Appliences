import { z } from "zod";
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const uuid = z.string().uuid();
export const technicianAvailabilitySchema = z
  .object({
    availability: z.enum(["AVAILABLE", "UNAVAILABLE"]),
    workingHours: z
      .object({ start: time, end: time })
      .strict()
      .refine((v) => v.start < v.end, "End must follow start"),
    leaveDates: z.array(z.string().date()).max(90),
  })
  .strict();
export const technicianEstimateSchema = z
  .object({
    version: z.number().int().positive(),
    diagnosis: z.string().trim().min(3).max(2000),
    items: z
      .array(
        z
          .object({
            type: z.enum(["Labour", "Part", "Other"]),
            description: z.string().trim().min(2).max(200),
            quantity: z.number().int().min(1).max(100),
            unitPrice: z
              .number()
              .min(0)
              .max(100000)
              .refine(
                (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001,
                "Use two decimal places",
              ),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();
export const technicianWorkReportSchema = z
  .object({
    version: z.number().int().positive(),
    workSummary: z.string().trim().min(3).max(2000),
    checklist: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
    outcome: z.enum(["RESOLVED", "PARTIALLY_RESOLVED", "UNRESOLVED"]),
    notes: z.string().trim().max(4000).default(""),
    parts: z.string().trim().max(2000).default(""),
    unresolvedIssues: z.string().trim().max(2000).default(""),
    attachmentIds: z.array(uuid).max(12).default([]),
  })
  .strict();
export const technicianProgressTransitions: Record<string, [string, string]> = {
  "on-the-way": ["APPOINTMENT_CONFIRMED", "TECHNICIAN_EN_ROUTE"],
  arrived: ["TECHNICIAN_EN_ROUTE", "TECHNICIAN_ARRIVED"],
  start: ["TECHNICIAN_ARRIVED", "IN_PROGRESS"],
};
export const technicianAssignmentStates = [
  "OFFERED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
  "REASSIGNED",
] as const;
export type TechnicianEstimateInput = z.infer<typeof technicianEstimateSchema>;
export type TechnicianWorkReportInput = z.infer<
  typeof technicianWorkReportSchema
>;
