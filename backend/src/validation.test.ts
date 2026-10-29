import { describe, expect, it } from "vitest";
import { bookingSchema, profileSchema } from "./validation.js";
describe("customer input validation", () => {
  it("accepts a normalized profile and rejects invalid contact details", () => {
    expect(
      profileSchema.parse({
        fullName: "  Customer Name  ",
        phone: "9876543210",
      }).fullName,
    ).toBe("Customer Name");
    expect(
      profileSchema.safeParse({ fullName: " ", phone: "1234567890" }).success,
    ).toBe(false);
    expect(
      profileSchema.safeParse({ fullName: "Customer", email: "invalid" })
        .success,
    ).toBe(false);
  });
  it("rejects past and impossible booking dates", () => {
    const date = bookingSchema.shape.preferredDate;
    expect(date.safeParse("2000-01-01").success).toBe(false);
    expect(date.safeParse("2099-02-30").success).toBe(false);
    expect(date.safeParse("2099-12-10").success).toBe(true);
  });
});
