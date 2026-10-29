import { createCipheriv, createDecipheriv, createHash, randomBytes, } from "node:crypto";
import { TOTP, Secret } from "otpauth";
import { env } from "../config/env.js";
export function seal(secret) {
    const key = keyBytes(), iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
    const data = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}
function keyBytes() {
    if (env.NODE_ENV === "production" &&
        !process.env.TECHNICIAN_MFA_ENCRYPTION_KEY)
        throw new Error("Technician MFA encryption is not configured");
    return createHash("sha256")
        .update(process.env.TECHNICIAN_MFA_ENCRYPTION_KEY ||
        "development:" + env.DATABASE_URL)
        .digest();
}
export function unseal(value) {
    const b = Buffer.from(value, "base64url"), cipher = createDecipheriv("aes-256-gcm", keyBytes(), b.subarray(0, 12));
    cipher.setAuthTag(b.subarray(12, 28));
    return Buffer.concat([
        cipher.update(b.subarray(28)),
        cipher.final(),
    ]).toString("utf8");
}
export function authenticator(secret, label) {
    return new TOTP({
        issuer: "Home Services Operations",
        label,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: Secret.fromBase32(secret),
    });
}
export function newSecret() {
    return new Secret({ size: 20 }).base32;
}
export function verifyCode(sealed, code, last) {
    const t = authenticator(unseal(sealed), "Technician"), delta = t.validate({ token: code, window: 1 });
    if (delta === null)
        return null;
    const counter = t.counter() + delta;
    return counter > last ? counter : null;
}
