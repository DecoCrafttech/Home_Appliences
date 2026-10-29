import { z } from "zod";
export const mobile = z
    .string()
    .trim()
    .regex(/^(?:\+91)?[6-9]\d{9}$/, "Enter a valid Indian mobile number");
const text = (min, max) => z.string().trim().min(min).max(max);
export const profileSchema = z.object({
    fullName: text(2, 100),
    email: z.string().trim().email().max(254).optional().or(z.literal("")),
    phone: mobile.optional(),
});
export const bookingSchema = z.object({
    applianceCategoryId: z.string().uuid(),
    serviceId: z.string().uuid(),
    details: z
        .object({ description: text(0, 2000).default("") })
        .catchall(z.string().max(2000)),
    address: z.object({
        name: text(2, 100),
        phone: mobile,
        line1: text(3, 150),
        area: text(2, 100),
        city: text(2, 80),
        state: text(2, 80),
        pinCode: z.string().regex(/^[1-9]\d{5}$/),
        landmark: text(0, 100).optional(),
    }),
    preferredDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .refine((value) => {
        const parsed = new Date(`${value}T00:00:00Z`);
        const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Kolkata",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date());
        return (!Number.isNaN(parsed.getTime()) &&
            parsed.toISOString().slice(0, 10) === value &&
            value >= today);
    }, "Choose a valid date today or later"),
    preferredTimeWindow: text(2, 50),
    idempotencyKey: z.string().uuid(),
});
