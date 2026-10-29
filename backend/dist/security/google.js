import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
const client = new OAuth2Client();
export async function verifyGoogleCredential(credential) { if (!env.GOOGLE_CLIENT_ID)
    throw Object.assign(new Error("Google authentication is not configured"), { status: 503, code: "GOOGLE_AUTH_UNAVAILABLE" }); const ticket = await client.verifyIdToken({ idToken: credential, audience: env.GOOGLE_CLIENT_ID }); const payload = ticket.getPayload(); if (!payload?.sub || !payload.email || payload.email_verified !== true)
    throw Object.assign(new Error("Google credential is invalid"), { status: 401, code: "INVALID_GOOGLE_CREDENTIAL" }); return { subject: payload.sub, email: payload.email, name: payload.name || payload.email.split("@")[0], picture: payload.picture }; }
