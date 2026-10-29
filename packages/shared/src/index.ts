import { z } from "zod";
export * from "./workflow.js";
export * from "./contact.js";
export const indianMobileSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");
export const pinCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Enter a six-digit PIN code");
export type ApiResult<T> = { data: T };
export const cancellationStatuses = [
  "REQUESTED",
  "UNDER_REVIEW",
  "EXECUTIVE_CONTACTED",
  "ASSIGNMENT_PENDING",
] as const;
export const requestTransitions: Record<string, string[]> = {
  REQUESTED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: [
    "EXECUTIVE_CONTACTED",
    "ASSIGNMENT_PENDING",
    "ON_HOLD",
    "CANCELLED",
  ],
  EXECUTIVE_CONTACTED: [
    "ASSIGNMENT_PENDING",
    "TECHNICIAN_ASSIGNED",
    "APPOINTMENT_CONFIRMED",
    "ON_HOLD",
    "CANCELLED",
  ],
  ASSIGNMENT_PENDING: ["TECHNICIAN_ASSIGNED", "ON_HOLD", "CANCELLED"],
  TECHNICIAN_ASSIGNED: ["APPOINTMENT_CONFIRMED", "CANCELLED"],
  APPOINTMENT_CONFIRMED: ["TECHNICIAN_EN_ROUTE", "CANCELLED"],
  TECHNICIAN_EN_ROUTE: ["TECHNICIAN_ARRIVED"],
  TECHNICIAN_ARRIVED: ["IN_PROGRESS"],
  IN_PROGRESS: ["ESTIMATE_PENDING_APPROVAL", "COMPLETED", "ON_HOLD"],
  ESTIMATE_PENDING_APPROVAL: ["IN_PROGRESS", "CANCELLED"],
  ON_HOLD: ["UNDER_REVIEW", "IN_PROGRESS", "CANCELLED"],
};
export const requestStatusPresentation: Record<
  string,
  { label: string; tone: "info" | "success" | "warning" | "danger" }
> = {
  REQUESTED: { label: "Awaiting review", tone: "info" },
  UNDER_REVIEW: { label: "Under review", tone: "info" },
  EXECUTIVE_CONTACTED: { label: "Executive contacted", tone: "info" },
  ASSIGNMENT_PENDING: { label: "Assignment pending", tone: "warning" },
  TECHNICIAN_ASSIGNED: { label: "Technician assigned", tone: "info" },
  APPOINTMENT_CONFIRMED: { label: "Appointment confirmed", tone: "info" },
  TECHNICIAN_EN_ROUTE: { label: "Technician en route", tone: "info" },
  TECHNICIAN_ARRIVED: { label: "Technician arrived", tone: "info" },
  IN_PROGRESS: { label: "In progress", tone: "info" },
  ESTIMATE_PENDING_APPROVAL: {
    label: "Estimate pending approval",
    tone: "warning",
  },
  COMPLETED: { label: "Completed", tone: "success" },
  ON_HOLD: { label: "On hold", tone: "warning" },
  CANCELLED: { label: "Cancelled", tone: "danger" },
};
export const reviewTags = [
  "Professional service",
  "On time",
  "Good communication",
  "Quality work",
  "Value for money",
  "Delayed service",
  "Issue unresolved",
] as const;
export const reviewSchema = z
  .object({
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().max(2000).default(""),
    tags: z.array(z.enum(reviewTags)).max(7).default([]),
  })
  .strict();
export const addressSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: indianMobileSchema,
  line1: z.string().trim().min(3).max(150),
  area: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(80),
  state: z.string().trim().min(2).max(80),
  pinCode: z.string().regex(/^[1-9]\d{5}$/),
  landmark: z.string().trim().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});
export const bookingFormSchema = z.object({
  applianceCategoryId: z.string().uuid(),
  serviceId: z.string().uuid(),
  details: z
    .object({ description: z.string().trim().max(2000).default("") })
    .catchall(z.string().max(2000)),
  address: addressSchema,
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredTimeWindow: z.string().min(2).max(50),
});
export type BookingFormValues = z.infer<typeof bookingFormSchema>;

export const serviceFormFieldSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: z.string().trim().min(2).max(100),
    type: z.enum(["text", "textarea", "select", "number"]),
    required: z.boolean(),
    options: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  })
  .superRefine((field, ctx) => {
    if (
      field.type === "select" &&
      (field.options.length < 1 ||
        new Set(field.options).size !== field.options.length)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Dropdown fields need unique options",
        path: ["options"],
      });
  });
export const serviceFormSchema = z
  .array(serviceFormFieldSchema)
  .max(20)
  .superRefine((fields, ctx) => {
    if (
      new Set(fields.map((f) => f.key)).size !== fields.length ||
      fields.some((f) =>
        ["description", "__proto__", "constructor", "prototype"].includes(
          f.key,
        ),
      )
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Use unique field keys; description is reserved",
      });
  });
export type ServiceFormField = z.infer<typeof serviceFormFieldSchema>;
export function validateServiceAnswers(
  fields: ServiceFormField[],
  answers: Record<string, unknown>,
): string | null {
  for (const field of fields) {
    const value = answers[field.key];
    if (value === undefined || value === null || value === "") {
      if (field.required) return `${field.label} is required`;
      continue;
    }
    if (typeof value !== "string" || value.length > 2000)
      return `Check ${field.label}`;
    if (field.required && !value.trim()) return `${field.label} is required`;
    if (field.type === "select" && !field.options.includes(value))
      return `Choose a valid ${field.label}`;
    if (field.type === "number" && !Number.isFinite(Number(value)))
      return `Enter a valid ${field.label}`;
  }
  return null;
}

export * from "./technician.js";
export * from "./catalogue.js";
