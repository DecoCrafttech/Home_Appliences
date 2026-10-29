import { z } from "zod";
import type { BookingFormValues } from "@home/shared";
const draftSchema = z.object({
  version: z.literal(1),
  ownerId: z.string(),
  type: z.enum(["service", "installation"]),
  step: z.number().int().min(0).max(3),
  savedAt: z.number(),
  idempotencyKey: z.string().uuid(),
  values: z.object({
    applianceCategoryId: z.string().max(36),
    serviceId: z.string().max(36),
    details: z.record(z.string().max(2000)),
    address: z.object({
      name: z.string().max(100),
      phone: z.string().max(15),
      line1: z.string().max(150),
      area: z.string().max(100),
      city: z.string().max(80),
      state: z.string().max(80),
      pinCode: z.string().max(6),
    }),
    preferredDate: z.string().max(10),
    preferredTimeWindow: z.string().max(50),
  }),
});
export type Draft = z.infer<typeof draftSchema>;
const key = (ownerId: string, type: string) =>
  `home-draft-v1:${ownerId}:${type}`;
export function readDraft(
  ownerId: string,
  type: "service" | "installation",
): Draft | null {
  try {
    const raw = localStorage.getItem(key(ownerId, type));
    if (!raw) return null;
    if (raw.length > 60_000) {
      localStorage.removeItem(key(ownerId, type));
      return null;
    }
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (
      !parsed.success ||
      parsed.data.ownerId !== ownerId ||
      parsed.data.type !== type ||
      Date.now() - parsed.data.savedAt > 7 * 24 * 60 * 60 * 1000
    ) {
      localStorage.removeItem(key(ownerId, type));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
export function saveDraft(
  ownerId: string,
  type: "service" | "installation",
  values: BookingFormValues,
  step: number,
  idempotencyKey: string,
): boolean {
  try {
    localStorage.setItem(
      key(ownerId, type),
      JSON.stringify({
        version: 1,
        ownerId,
        type,
        values: {
          ...values,
          address: { ...values.address, name: "", phone: "", line1: "" },
        },
        step,
        idempotencyKey,
        savedAt: Date.now(),
      }),
    );
    window.dispatchEvent(new Event("draft-changed"));
    return true;
  } catch {
    return false;
  }
}
export function clearDraft(ownerId: string, type: "service" | "installation") {
  try {
    localStorage.removeItem(key(ownerId, type));
    window.dispatchEvent(new Event("draft-changed"));
  } catch {
    /* Browser storage can be disabled. */
  }
}
