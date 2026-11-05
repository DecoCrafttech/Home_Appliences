import { expect, it } from "vitest";
import { z } from "zod";

it("rejects oversized arrays before validating their elements", () => {
  let visited = 0;
  const schema = z
    .array(
      z.string().superRefine(() => {
        visited += 1;
      }),
    )
    .max(100);

  const result = schema.safeParse(Array(10_000).fill("invalid item"));

  expect(result.success).toBe(false);
  expect(visited).toBe(0);
  if (!result.success) {
    expect(result.error.issues).toHaveLength(1);
    expect(result.error.issues[0].code).toBe("too_big");
  }
});
