import { describe, expect, it } from "vitest";
import { serviceFormSchema, validateServiceAnswers } from "./index";
describe("service form definitions", () => {
  it("rejects duplicate and reserved keys", () => {
    const field = {
      key: "brand",
      label: "Brand",
      type: "text",
      required: false,
      options: [],
    };
    expect(serviceFormSchema.safeParse([field, field]).success).toBe(false);
    expect(
      serviceFormSchema.safeParse([{ ...field, key: "description" }]).success,
    ).toBe(false);
    expect(
      serviceFormSchema.safeParse([{ ...field, key: "constructor" }]).success,
    ).toBe(false);
  });
  it("checks required answers and numeric values", () => {
    const fields = serviceFormSchema.parse([
      { key: "capacity", label: "Capacity", type: "number", required: true },
    ]);
    expect(validateServiceAnswers(fields, {})).toBe("Capacity is required");
    expect(validateServiceAnswers(fields, { capacity: "abc" })).toBe(
      "Enter a valid Capacity",
    );
    expect(validateServiceAnswers(fields, { capacity: "1.5" })).toBeNull();
  });
});
