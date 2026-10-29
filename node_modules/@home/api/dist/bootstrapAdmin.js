import { z } from "zod";
import { db } from "./db.js";
import { hashPassword } from "./security/password.js";
const input = z.object({ ADMIN_USERNAME: z.string().min(3).default("Alex"), ADMIN_PASSWORD: z.string().min(14), ADMIN_NAME: z.string().min(2).default("Alex") }).parse(process.env);
const existing = await db() `SELECT count(*)::int AS count FROM staff_profiles`;
if (Number(existing[0]?.count) > 0)
    throw new Error("Staff already exists; use an authorized staff-management workflow");
const passwordHash = await hashPassword(input.ADMIN_PASSWORD);
await db() `INSERT INTO staff_profiles(email,username,full_name,password_hash,role,must_change_password) VALUES(${`${input.ADMIN_USERNAME.toLowerCase()}@local.invalid`},${input.ADMIN_USERNAME},${input.ADMIN_NAME},${passwordHash},'SUPER_ADMIN',true)`;
console.log("Initial SUPER_ADMIN created");
