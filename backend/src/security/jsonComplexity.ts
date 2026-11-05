import type { RequestHandler } from "express";

// Bound work before schema validation, including oversized collections that
// could otherwise allocate many validation errors despite small JSON bodies.
export const limitJsonComplexity: RequestHandler = (req, res, next) => {
  const pending = [{ value: req.body, depth: 0 }];
  let visited = 0;
  while (pending.length) {
    const current = pending.pop()!;
    if (++visited > 4096 || current.depth > 16) break;
    if (current.value && typeof current.value === "object") {
      const keys = Object.keys(current.value);
      if (keys.length > (Array.isArray(current.value) ? 1000 : 512)) break;
      for (const key of keys)
        pending.push({ value: current.value[key], depth: current.depth + 1 });
    }
    if (!pending.length) {
      next();
      return;
    }
  }
  res
    .status(413)
    .json({
      error: {
        code: "PAYLOAD_TOO_COMPLEX",
        message: "The submitted content has too many nested fields or items.",
      },
    });
};
