import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "./db.js";
import { ApiError } from "./customerRoutes.js";
import { requireTechnician } from "./technicianRoutes.js";
import { requireStaff, allow } from "./adminRoutes.js";
import { storage, bucket } from "./technicianStorage.js";
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => next(e instanceof z.ZodError
    ? new ApiError(422, "VALIDATION_ERROR", e.issues[0]?.message || "Invalid file")
    : e));
export const technicianIdentityRoutes = Router(), adminIdentityRoutes = Router();
const input = z
    .object({
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    size: z.number().int().positive().max(8388608),
})
    .strict();
async function upload(technicianId, purpose, body) {
    const quota = await db() `SELECT count(*)::int AS count FROM technician_identity_files WHERE technician_id=${technicianId} AND created_at>now()-interval '24 hours'`;
    if (Number(quota[0]?.count) >= 20)
        throw new ApiError(429, "UPLOAD_LIMIT", "Daily identity upload limit reached. Contact operations.");
    const i = input.parse(body), key = "technician-identity/" + technicianId + "/" + randomUUID();
    const exists = await db() `SELECT id FROM technicians WHERE id=${technicianId} AND active`;
    if (!exists.length)
        throw new ApiError(404, "NOT_FOUND", "Technician not found");
    const url = await getSignedUrl(storage(), new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: i.contentType,
        ContentLength: i.size,
    }), { expiresIn: 120 });
    const rows = await db() `INSERT INTO technician_identity_files(technician_id,object_key,content_type,byte_size,purpose) VALUES(${technicianId},${key},${i.contentType},${i.size},${purpose}) RETURNING id`;
    return { id: rows[0].id, uploadUrl: url, expiresIn: 120 };
}
async function confirm(technicianId, id, purpose) {
    const rows = await db() `SELECT * FROM technician_identity_files WHERE id=${id} AND technician_id=${technicianId} AND purpose=${purpose}`, a = rows[0];
    if (!a)
        throw new ApiError(404, "NOT_FOUND", "File not found");
    if (new Date(String(a.created_at)).getTime() < Date.now() - 300000)
        throw new ApiError(410, "UPLOAD_EXPIRED", "Upload expired. Select the file again.");
    const client = storage(), head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: String(a.object_key) })), file = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: String(a.object_key),
        Range: "bytes=0-11",
    })), bytes = Buffer.from(await file.Body.transformToByteArray());
    const valid = a.content_type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : a.content_type === "image/png"
            ? bytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : bytes.subarray(0, 4).toString() === "RIFF" &&
                bytes.subarray(8, 12).toString() === "WEBP";
    if (!valid ||
        head.ContentLength !== a.byte_size ||
        head.ContentType !== a.content_type) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: String(a.object_key) }));
        throw new ApiError(422, "INVALID_IMAGE", "File contents do not match the selected image.");
    }
    await db() `UPDATE technician_identity_files SET state='READY' WHERE id=${id}`;
    if (purpose === "PROFILE")
        await db() `UPDATE technician_accounts SET profile_photo_id=${id} WHERE technician_id=${technicianId}`;
    return { id };
}
technicianIdentityRoutes.post("/profile/photo/upload", requireTechnician, route(async (req, res) => res
    .status(201)
    .json({ data: await upload(req.technician.id, "PROFILE", req.body) })));
technicianIdentityRoutes.post("/profile/photo/:id/confirm", requireTechnician, route(async (req, res) => res.json({
    data: await confirm(req.technician.id, z.string().uuid().parse(req.params.id), "PROFILE"),
})));
technicianIdentityRoutes.get("/profile/photo", requireTechnician, route(async (req, res) => {
    const rows = await db() `SELECT f.object_key FROM technician_identity_files f JOIN technician_accounts a ON a.profile_photo_id=f.id WHERE a.technician_id=${req.technician.id} AND f.technician_id=a.technician_id AND f.state='READY'`, a = rows[0];
    res.json({
        data: {
            url: a
                ? await getSignedUrl(storage(), new GetObjectCommand({
                    Bucket: bucket,
                    Key: String(a.object_key),
                }), { expiresIn: 60 })
                : null,
        },
    });
}));
const manage = allow("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER");
adminIdentityRoutes.post("/technicians/:id/documents/upload", requireStaff, manage, route(async (req, res) => res
    .status(201)
    .json({
    data: await upload(z.string().uuid().parse(req.params.id), "VERIFICATION", req.body),
})));
adminIdentityRoutes.post("/technicians/:id/documents/:fileId/confirm", requireStaff, manage, route(async (req, res) => res.json({
    data: await confirm(z.string().uuid().parse(req.params.id), z.string().uuid().parse(req.params.fileId), "VERIFICATION"),
})));
adminIdentityRoutes.get("/technicians/:id/documents", requireStaff, manage, route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id), rows = await db() `SELECT id,object_key,created_at FROM technician_identity_files WHERE technician_id=${id} AND purpose='VERIFICATION' AND state='READY' ORDER BY created_at DESC`;
    res.json({
        data: await Promise.all(rows.map(async (a) => ({
            id: a.id,
            created_at: a.created_at,
            url: await getSignedUrl(storage(), new GetObjectCommand({ Bucket: bucket, Key: String(a.object_key) }), { expiresIn: 60 }),
        }))),
    });
}));
