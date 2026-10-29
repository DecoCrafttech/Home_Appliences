import { z } from "zod";
export const catalogueOptionSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().trim().min(2).max(120),
    description: z.string().trim().max(500).default(""),
    active: z.boolean().default(true),
    priceType: z.enum(["FIXED", "FROM", "RANGE", "INSPECTION", "QUOTE"]),
    amountPaise: z.number().int().min(0).max(1000000000).nullable(),
    maximumPaise: z
      .number()
      .int()
      .min(0)
      .max(1000000000)
      .nullable()
      .default(null),
    included: z.string().trim().max(1000).default(""),
    exclusions: z.string().trim().max(1000).default(""),
    durationMinutes: z.number().int().min(5).max(1440).nullable().default(null),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.priceType !== "QUOTE" && v.amountPaise === null)
      ctx.addIssue({
        code: "custom",
        path: ["amountPaise"],
        message: "Enter an indicative INR amount.",
      });
    if (
      v.priceType === "RANGE" &&
      (v.maximumPaise === null ||
        v.amountPaise === null ||
        v.maximumPaise < v.amountPaise)
    )
      ctx.addIssue({
        code: "custom",
        path: ["maximumPaise"],
        message: "Maximum must be at least the starting amount.",
      });
  });
export const catalogueOptionsSchema = z
  .array(catalogueOptionSchema)
  .max(30)
  .refine(
    (v) => new Set(v.map((o) => o.id)).size === v.length,
    "Each option must have a unique ID.",
  );
export type CatalogueOption = z.infer<typeof catalogueOptionSchema>;
export function indicativePrice(
  option: Pick<CatalogueOption, "priceType" | "amountPaise" | "maximumPaise">,
) {
  const inr = (paise: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(paise / 100);
  if (option.priceType === "QUOTE" || option.amountPaise == null)
    return "Quote after inspection";
  const value = inr(option.amountPaise);
  if (option.priceType === "RANGE")
    return `${value}–${inr(option.maximumPaise ?? option.amountPaise)} approx.`;
  if (option.priceType === "FROM") return `From ${value}`;
  if (option.priceType === "INSPECTION") return `${value} inspection charge`;
  return `${value} approx.`;
}
export const technicianUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z][a-z0-9._-]{2,39}$/,
    "Use 3–40 letters, numbers, dots, hyphens or underscores; start with a letter.",
  );
export const temporaryPasswordSchema = z
  .string()
  .min(14)
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a symbol.");
export function selectedOptionIds(details: Record<string, unknown>): string[] {
  if (typeof details.optionIds === "string") {
    try {
      const ids: unknown = JSON.parse(details.optionIds);
      if (Array.isArray(ids) && ids.every((id) => typeof id === "string"))
        return [...new Set(ids)];
    } catch {
      /* Invalid values are rejected by booking validation. */
    }
    return [];
  }
  return typeof details.optionId === "string" && details.optionId
    ? [details.optionId]
    : [];
}
