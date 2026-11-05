import type { RequestHandler } from "express";
import { env } from "../config/env.js";

export const trustedBrowserOrigins = new Set(
  [
    env.CUSTOMER_ORIGIN,
    env.CUSTOMER_APP_ORIGIN,
    env.ADMIN_ORIGIN,
    env.TECHNICIAN_ORIGIN,
  ].map((value) => new URL(value).origin),
);
if (env.NODE_ENV !== "production") {
  for (const origin of [...trustedBrowserOrigins]) {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      url.hostname = url.hostname === "localhost" ? "127.0.0.1" : "localhost";
      trustedBrowserOrigins.add(url.origin);
    }
  }
}

// SameSite cookies do not distinguish sibling subdomains. Check browser write
// origins as well; command-line/server clients without Origin remain supported.
export const verifyBrowserOrigin: RequestHandler = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("Origin");
  const referer = req.get("Referer");
  let source: string | undefined;
  try {
    source = origin || (referer ? new URL(referer).origin : undefined);
  } catch {
    source = "invalid";
  }
  if (source && !trustedBrowserOrigins.has(source)) {
    res.status(403).json({
      error: {
        code: "UNTRUSTED_ORIGIN",
        message: "This browser origin cannot submit changes.",
      },
    });
    return;
  }
  next();
};
