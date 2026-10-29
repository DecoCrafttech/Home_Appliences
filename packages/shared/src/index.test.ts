import { describe, expect, it } from "vitest";
import { indianMobileSchema, pinCodeSchema } from "./index";
describe("Indian contact validation", () => {
  it("accepts mobile numbers without country prefix", () => {
    expect(indianMobileSchema.safeParse("9876543210").success).toBe(true);
  });
  it("rejects invalid prefixes and lengths", () => {
    for (const value of ["1234567890", "98765", "+919876543210", "987654321x"])
      expect(indianMobileSchema.safeParse(value).success).toBe(false);
  });
  it("requires exactly six PIN digits", () => {
    expect(pinCodeSchema.safeParse("600001").success).toBe(true);
    expect(pinCodeSchema.safeParse("60001").success).toBe(false);
    expect(pinCodeSchema.safeParse("ABCDEF").success).toBe(false);
  });
});
