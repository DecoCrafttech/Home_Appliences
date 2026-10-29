import { describe, expect, it } from "vitest";
import { db } from "./db.js";
describe.runIf(Boolean(process.env.DATABASE_URL))("calendar dates", () => {
  it("preserves a PostgreSQL DATE without a timezone conversion", async () => {
    const rows = await db()`SELECT '2099-10-25'::date AS preferred_date`;
    expect(rows[0]!.preferred_date).toBe("2099-10-25");
  });
});
