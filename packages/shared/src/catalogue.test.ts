import {expect,it} from "vitest";
import {catalogueOptionSchema,indicativePrice,temporaryPasswordSchema} from "./catalogue.js";
import {requestReference,operationalStatus} from "./workflow.js";
it("validates paise amounts and requires an ordered price range",() => {
  const input={id:"11111111-1111-4111-8111-111111111111",name:"Inspection",priceType:"RANGE",amountPaise:29900,maximumPaise:49900};
  expect(catalogueOptionSchema.safeParse(input).success).toBe(true);
  expect(catalogueOptionSchema.safeParse({...input,amountPaise:299.5}).success).toBe(false);
  expect(catalogueOptionSchema.safeParse({...input,maximumPaise:19900}).success).toBe(false);
  expect(catalogueOptionSchema.safeParse({...input,priceType:"QUOTE",amountPaise:null,maximumPaise:null}).success).toBe(true);
  expect(indicativePrice({priceType:"INSPECTION",amountPaise:29900,maximumPaise:null})).toContain("299");
});
it("preserves historical identifiers and never truncates growing display references",() => {
  expect(requestReference({request_number:"SR-HISTORIC"})).toBe("SR-HISTORIC");
  expect(requestReference({request_number:"old",display_number:123})).toBe("000123");
  expect(requestReference({request_number:"old",display_number:1000000})).toBe("1000000");
  expect(operationalStatus("ASSIGNMENT_PENDING")).toBe("PENDING");
  expect(operationalStatus("TECHNICIAN_ASSIGNED")).toBe("TECHNICIAN_ASSIGNED");
});
it("rejects weak temporary passwords",() => {expect(temporaryPasswordSchema.safeParse("passwordpassword").success).toBe(false);expect(temporaryPasswordSchema.safeParse("Temporary!Secure123").success).toBe(true);});
