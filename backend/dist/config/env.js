import { config } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";
import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";
// Dual-stack connection attempts time out on the local Windows network even
// when the database is reachable over IPv4. Apply before creating API clients.
if (process.platform === "win32") {
    setDefaultResultOrder("ipv4first");
    setDefaultAutoSelectFamily(false);
}
config({ path: resolve(process.cwd(), ".env.push.local") });
config({ path: resolve(process.cwd(), "../.env.push.local") });
config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), "../.env.local") });
config({ path: resolve(process.cwd(), "../.env") });
config({ path: resolve(process.cwd(), "backend/.env.local") });
config({ path: resolve(process.cwd(), "backend/.env") });
export const env = z
    .object({
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    CUSTOMER_ORIGIN: z.string().url().default("http://localhost:5173"),
    DATABASE_URL: z.string().url().optional(),
    OTP_PROVIDER: z
        .enum(["development", "sms", "whatsapp"])
        .default("development"),
    STAFF_API_KEY: z.string().min(24).optional(),
    GOOGLE_CLIENT_ID: z.preprocess((value) => typeof value === "string" ? value.trim() || undefined : value, z
        .string()
        .regex(/^\d+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/, "Use a Google Web application client ID")
        .optional()),
    CUSTOMER_APP_ORIGIN: z.string().url().default("http://localhost:5173"),
    GOOGLE_GEOCODING_API_KEY: z.string().optional(),
    SERVICE_PIN_PREFIXES: z.string().default(""),
    APPOINTMENT_WINDOWS: z
        .string()
        .default('[{"id":"08:00-12:00","label":"Morning · 8 AM to 12 PM"},{"id":"13:00-17:00","label":"Afternoon · 1 PM to 5 PM"},{"id":"18:00-21:00","label":"Evening · 6 PM to 9 PM"}]'),
    LEGACY_OTP_ENABLED: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    VAPID_PUBLIC_KEY: z.string().min(20).optional(),
    VAPID_PRIVATE_KEY: z.string().min(20).optional(),
    VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/).optional(),
})
    .refine((value) => [value.VAPID_PUBLIC_KEY, value.VAPID_PRIVATE_KEY, value.VAPID_SUBJECT].filter(Boolean).length % 3 === 0, "VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT must be configured together")
    .parse(process.env);
