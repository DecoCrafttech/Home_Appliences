import { notificationReadAllSchema } from "@home/shared";
import { Router } from "express";
import { db } from "./db.js";
import { ApiError } from "./customerRoutes.js";
import { requireStaff } from "./adminRoutes.js";
import { z } from "zod";
export const notificationRoutes = Router();
notificationRoutes.patch("/notifications/read-all", requireStaff, async (req, res, next) => {
    try {
        const input = notificationReadAllSchema.parse(req.body);
        const data = await db() `UPDATE staff_notifications SET read_at=COALESCE(read_at,now()) WHERE staff_id=${req.staff.id} AND ((${input.before || null}::timestamptz IS NOT NULL AND created_at<=${input.before || null}::timestamptz) OR id=ANY(${input.ids || []}::uuid[])) RETURNING id,read_at`;
        res.json({ data });
    }
    catch (error) {
        next(error instanceof z.ZodError
            ? new ApiError(422, "VALIDATION_ERROR", "Select valid notifications.")
            : error);
    }
});
notificationRoutes.get("/notifications", requireStaff, async (req, res, next) => {
    try {
        const rows = await db() `SELECT (SELECT count(*)::int FROM staff_notifications all_notices WHERE all_notices.staff_id=${req.staff.id} AND all_notices.read_at IS NULL) AS unread_count,id,request_id,related_path,title,message,read_at,created_at FROM staff_notifications WHERE staff_id=${req.staff.id} ORDER BY created_at DESC LIMIT 100`;
        res.json({
            data: rows,
            meta: {
                unreadCount: Number(rows[0]?.unread_count || 0),
                fetchedAt: new Date().toISOString(),
            },
        });
    }
    catch (e) {
        next(e);
    }
});
notificationRoutes.patch("/notifications/:id/read", requireStaff, async (req, res, next) => {
    try {
        if (!z.string().uuid().safeParse(req.params.id).success)
            throw new ApiError(422, "INVALID_ID", "Invalid notification.");
        const rows = await db() `UPDATE staff_notifications SET read_at=COALESCE(read_at,now()) WHERE id=${req.params.id} AND staff_id=${req.staff.id} RETURNING id,read_at`;
        if (!rows[0])
            throw new ApiError(404, "NOT_FOUND", "Notification not found.");
        res.json({ data: rows[0] });
    }
    catch (e) {
        next(e);
    }
});
