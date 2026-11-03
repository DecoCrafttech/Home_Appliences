import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { db } from "./db.js";
import { ApiError, requireAuth } from "./customerRoutes.js";
import { requireStaff } from "./adminRoutes.js";
import { requireTechnician } from "./technicianRoutes.js";
import { env } from "./config/env.js";
import type { PushRole } from "./pushService.js";
import { sendPushToUser } from "./pushService.js";

const bodySchema = z.object({ endpoint: z.string().url().max(2048), expirationTime: z.number().nullable().optional(), keys: z.object({ p256dh: z.string().min(20).max(512), auth: z.string().min(8).max(256) }) });
const limited = rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false });
const wrap = (handler: RequestHandler): RequestHandler => (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next);

function router(role: PushRole, auth: RequestHandler, identity: (req: Express.Request) => string | undefined) {
  const routes = Router();
  routes.use(limited, auth);
  routes.get("/public-key", (_req,res) => res.json({ data: { publicKey: env.VAPID_PUBLIC_KEY || null, available: Boolean(env.VAPID_PUBLIC_KEY) } }));
  routes.get("/preferences", wrap(async (req,res) => { const id=identity(req)!; const rows=await db()`SELECT enabled FROM push_preferences WHERE recipient_role=${role} AND recipient_id=${id}`; res.json({data:{enabled:rows[0]?.enabled ?? true}}); }));
  routes.patch("/preferences", wrap(async (req,res) => { const enabled=z.object({enabled:z.boolean()}).parse(req.body).enabled; const id=identity(req)!; await db()`INSERT INTO push_preferences(recipient_role,recipient_id,enabled) VALUES(${role},${id},${enabled}) ON CONFLICT(recipient_role,recipient_id) DO UPDATE SET enabled=excluded.enabled,updated_at=now()`; res.json({data:{enabled}}); }));
  routes.post("/subscriptions", wrap(async (req,res) => { if(!env.VAPID_PUBLIC_KEY) throw new ApiError(503,"PUSH_UNAVAILABLE","Push notifications are not configured"); const input=bodySchema.parse(req.body),id=identity(req)!; await db()`INSERT INTO push_preferences(recipient_role,recipient_id,enabled) VALUES(${role},${id},true) ON CONFLICT(recipient_role,recipient_id) DO UPDATE SET enabled=true,updated_at=now()`; await db()`INSERT INTO push_subscriptions(recipient_role,recipient_id,endpoint,p256dh_key,auth_key,user_agent,expires_at) VALUES(${role},${id},${input.endpoint},${input.keys.p256dh},${input.keys.auth},${req.get("user-agent") || null},${input.expirationTime ? new Date(input.expirationTime) : null}) ON CONFLICT(endpoint) DO UPDATE SET recipient_role=excluded.recipient_role,recipient_id=excluded.recipient_id,p256dh_key=excluded.p256dh_key,auth_key=excluded.auth_key,user_agent=excluded.user_agent,expires_at=excluded.expires_at,enabled=true,failure_count=0,updated_at=now()`; res.status(201).json({data:{subscribed:true}}); }));
  routes.post("/test", wrap(async (req,res) => { if(!env.VAPID_PUBLIC_KEY) throw new ApiError(503,"PUSH_UNAVAILABLE","Push notifications are not configured"); const id=identity(req)!; const subscriptions=await db()`SELECT count(*)::int AS count FROM push_subscriptions WHERE recipient_role=${role} AND recipient_id=${id} AND enabled`; if(!Number(subscriptions[0]?.count)) throw new ApiError(409,"PUSH_NOT_SUBSCRIBED","Turn on push notifications on this device first"); await sendPushToUser(role,id,`test:${Date.now()}`,{title:"Test notification",body:"Push notifications are working on this device.",path:role==="TECHNICIAN"?"/technician/profile":role==="ADMIN"?"/settings":"/profile",tag:`push-test-${id}`}); res.status(202).json({data:{queued:true}}); }));
  routes.delete("/subscriptions", wrap(async (req,res) => { const endpoint=z.object({endpoint:z.string().url().max(2048)}).parse(req.body).endpoint,id=identity(req)!; await db()`DELETE FROM push_subscriptions WHERE endpoint=${endpoint} AND recipient_role=${role} AND recipient_id=${id}`; res.status(204).end(); }));
  return routes;
}
export const customerPushRoutes=router("CUSTOMER",requireAuth,(r)=>r.customerId);
export const adminPushRoutes=router("ADMIN",requireStaff,(r)=>r.staff?.id);
export const technicianPushRoutes=router("TECHNICIAN",requireTechnician,(r)=>r.technician?.id);
