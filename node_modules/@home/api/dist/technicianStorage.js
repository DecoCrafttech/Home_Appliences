import { Router } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "./db.js";
import { ApiError } from "./customerRoutes.js";
import { requireTechnician } from "./technicianRoutes.js";
import { requireStaff, allow } from "./adminRoutes.js";
const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => next(e instanceof z.ZodError
    ? new ApiError(422, "VALIDATION_ERROR", e.issues[0]?.message || "Invalid upload")
    : e));
export const bucket = process.env.TECHNICIAN_STORAGE_BUCKET || "uploads";
export function storage() {
    if (!process.env.AWS_ENDPOINT_URL_S3 ||
        !process.env.AWS_ACCESS_KEY_ID ||
        !process.env.AWS_SECRET_ACCESS_KEY)
        throw new ApiError(503, "STORAGE_UNAVAILABLE", "Photo storage is not configured. Your report can still be submitted without optional photos.");
    return new S3Client({
        endpoint: process.env.AWS_ENDPOINT_URL_S3,
        region: process.env.AWS_REGION || "auto",
        forcePathStyle: true,
    });
}
export const technicianStorageRoutes = Router(), adminStorageRoutes = Router();
technicianStorageRoutes.use(requireTechnician);
async function owned(id, technicianId) {
    const r = await db() `SELECT r.id,r.status FROM service_requests r JOIN technician_assignments a ON a.request_id=r.id WHERE r.id=${id} AND a.technician_id=${technicianId} AND a.state='ACCEPTED' AND r.assigned_technician_id=${technicianId}`;
    if (!r[0])
        throw new ApiError(404, "NOT_FOUND", "Job not found");
    return r[0];
}
technicianStorageRoutes.post("/jobs/:id/photos", route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id), j = await owned(id, req.technician.id);
    if (j.status !== "IN_PROGRESS")
        throw new ApiError(409, "JOB_CLOSED", "Photos can be added while work is in progress.");
    const i = z
        .object({
        contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        size: z.number().int().positive().max(8388608),
        purpose: z.enum([
            "BEFORE",
            "DIAGNOSIS",
            "PARTS",
            "AFTER",
            "INSTALLATION",
        ]),
    })
        .strict()
        .parse(req.body);
    const count = await db() `SELECT count(*)::int AS count FROM technician_attachments WHERE request_id=${id}`;
    if (Number(count[0]?.count) >= 50)
        throw new ApiError(422, "UPLOAD_LIMIT", "This job has reached its photo limit.");
    const key = "technician-jobs/" + id + "/" + randomUUID();
    const client = storage();
    const url = await getSignedUrl(client, new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: i.contentType,
        ContentLength: i.size,
    }), { expiresIn: 120 });
    const rows = await db() `INSERT INTO technician_attachments(request_id,technician_id,object_key,content_type,byte_size,purpose) VALUES(${id},${req.technician.id},${key},${i.contentType},${i.size},${i.purpose}) RETURNING id`;
    res
        .status(201)
        .json({ data: { id: rows[0].id, uploadUrl: url, expiresIn: 120 } });
}));
technicianStorageRoutes.post("/photos/:id/confirm", route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id), rows = await db() `SELECT * FROM technician_attachments WHERE id=${id} AND technician_id=${req.technician.id}`, a = rows[0];
    if (!a)
        throw new ApiError(404, "NOT_FOUND", "Photo not found");
    await owned(String(a.request_id), req.technician.id);
    const client = storage(), head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: String(a.object_key) }));
    const object = await client.send(new GetObjectCommand({
        Bucket: bucket,
        Key: String(a.object_key),
        Range: "bytes=0-11",
    })), bytes = await object.Body.transformToByteArray();
    const valid = a.content_type === "image/jpeg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : a.content_type === "image/png"
            ? Buffer.from(bytes)
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : Buffer.from(bytes).subarray(0, 4).toString() === "RIFF" &&
                Buffer.from(bytes).subarray(8, 12).toString() === "WEBP";
    if (head.ContentLength !== a.byte_size ||
        head.ContentType !== a.content_type ||
        !valid) {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: String(a.object_key) }));
        throw new ApiError(422, "INVALID_IMAGE", "File contents do not match the selected image format and size.");
    }
    const result = await db() `UPDATE technician_attachments SET state='READY' WHERE id=${id} RETURNING id,purpose`;
    res.json({ data: result[0] });
}));
technicianStorageRoutes.get("/photos/:id/access", route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id), rows = await db() `SELECT * FROM technician_attachments WHERE id=${id} AND technician_id=${req.technician.id} AND state='READY'`, a = rows[0];
    if (!a)
        throw new ApiError(404, "NOT_FOUND", "Photo not found");
    await owned(String(a.request_id), req.technician.id);
    res.json({
        data: {
            url: await getSignedUrl(storage(), new GetObjectCommand({
                Bucket: bucket,
                Key: String(a.object_key),
                ResponseContentDisposition: "inline",
            }), { expiresIn: 60 }),
        },
    });
}));
adminStorageRoutes.get("/work-reports/:id/photos", requireStaff, allow("SUPER_ADMIN", "ADMIN", "OPERATIONS_MANAGER"), route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id), rows = await db() `SELECT id,object_key,purpose FROM technician_attachments WHERE report_id=${id} AND state='READY'`;
    const data = await Promise.all(rows.map(async (a) => ({
        id: a.id,
        purpose: a.purpose,
        url: await getSignedUrl(storage(), new GetObjectCommand({ Bucket: bucket, Key: String(a.object_key) }), { expiresIn: 60 }),
    })));
    res.json({ data });
}));
