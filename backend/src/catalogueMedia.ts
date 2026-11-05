import { Router, type RequestHandler } from "express";
import { randomUUID, createHash } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { requireStaff, allow } from "./adminRoutes.js";
import { ApiError } from "./customerRoutes.js";
import { db } from "./db.js";
import { storage, bucket } from "./technicianStorage.js";
const route =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((error) =>
      next(
        error instanceof z.ZodError
          ? new ApiError(
              422,
              "INVALID_MEDIA",
              "Choose a supported icon smaller than 2 MB.",
            )
          : error instanceof ApiError
            ? error
            : new ApiError(
                503,
                "MEDIA_UNAVAILABLE",
                "Image storage is unavailable. Check the storage configuration or try again shortly.",
              ),
      ),
    );
export function sanitizeCatalogueSvg(source: string): string {
  if (
    !/^\s*(?:<\?xml[^?]*\?>\s*)?<svg[\s>]/i.test(source) ||
    /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|object|embed|image|use|style)\b/i.test(
      source,
    )
  )
    throw new ApiError(
      422,
      "UNSAFE_SVG",
      "Use a static SVG without scripts, embedded content or external references.",
    );
  const tags = [
    "svg",
    "g",
    "path",
    "circle",
    "ellipse",
    "rect",
    "line",
    "polyline",
    "polygon",
    "defs",
    "linearGradient",
    "radialGradient",
    "stop",
    "clipPath",
    "title",
    "desc",
  ];
  const attributes = [
    "xmlns",
    "viewBox",
    "version",
    "preserveAspectRatio",
    "color",
    "width",
    "height",
    "x",
    "y",
    "x1",
    "x2",
    "y1",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "d",
    "points",
    "fill",
    "stroke",
    "stroke-width",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-dasharray",
    "stroke-dashoffset",
    "stroke-miterlimit",
    "vector-effect",
    "fill-rule",
    "clip-rule",
    "opacity",
    "fill-opacity",
    "stroke-opacity",
    "transform",
    "id",
    "offset",
    "stop-color",
    "stop-opacity",
    "gradientUnits",
    "gradientTransform",
    "clip-path",
  ];
  let unsafe = false;
  const cleaned = sanitizeHtml(source, {
    allowedTags: tags,
    allowedAttributes: { "*": attributes },
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    transformTags: {
      svg: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, xmlns: "http://www.w3.org/2000/svg" },
      }),
    },
    onOpenTag: (name, attrs) => {
      if (!tags.includes(name)) unsafe = true;
      for (const [key, value] of Object.entries(attrs)) {
        if (
          !attributes.includes(key) ||
          (key === "xmlns" && value !== "http://www.w3.org/2000/svg") ||
          (/(?:javascript:|data:|https?:|\/\/)/i.test(value) &&
            !(key === "xmlns" && value === "http://www.w3.org/2000/svg")) ||
          (/url\s*\(/i.test(value) && !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value))
        )
          unsafe = true;
      }
    },
  });
  if (
    unsafe ||
    !cleaned.startsWith("<svg") ||
    Buffer.byteLength(cleaned) > 262144
  )
    throw new ApiError(
      422,
      "UNSAFE_SVG",
      "SVG contains unsupported or unsafe content. Export a static vector icon.",
    );
  return cleaned;
}
export const catalogueMediaAdmin = Router(),
  catalogueMediaPublic = Router();
catalogueMediaAdmin.post(
  "/catalogue/media",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const i = z
      .object({
        contentType: z.enum([
          "image/svg+xml",
          "image/png",
          "image/jpeg",
          "image/webp",
        ]),
        data: z
          .string()
          .min(1)
          .max(2800000)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .strict()
      .parse(req.body);
    let bytes = Buffer.from(i.data, "base64");
    if (!bytes.length || bytes.length > 2097152)
      throw new ApiError(
        422,
        "INVALID_MEDIA",
        "Icons must be smaller than 2 MB.",
      );
    if (i.contentType === "image/svg+xml")
      bytes = Buffer.from(sanitizeCatalogueSvg(bytes.toString("utf8")), "utf8");
    else {
      const valid =
        i.contentType === "image/png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : i.contentType === "image/jpeg"
            ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            : bytes.toString("ascii", 0, 4) === "RIFF" &&
              bytes.toString("ascii", 8, 12) === "WEBP";
      if (!valid)
        throw new ApiError(
          422,
          "INVALID_MEDIA",
          "File contents do not match the selected image type.",
        );
    }
    const contentHash = createHash("sha256").update(bytes).digest("hex");
    await db()`SELECT pg_advisory_xact_lock(hashtextextended(${req.staff!.id + ":" + contentHash},0))`;
    const existing = (
      await db()`SELECT id,object_key FROM catalogue_media WHERE created_by=${req.staff!.id} AND content_hash=${contentHash}`
    )[0];
    if (existing) {
      await db()`UPDATE catalogue_media SET last_selected_at=now() WHERE id=${existing.id}`;
      res.status(200).json({
        data: {
          ...existing,
          previewUrl: `/api/v1/admin/catalogue/media/${existing.id}`,
        },
      });
      return;
    }
    const quota =
      await db()`SELECT count(*)::int AS count FROM catalogue_media WHERE created_by=${req.staff!.id} AND created_at>now()-interval '24 hours'`;
    if (Number(quota[0]?.count) >= 200)
      throw new ApiError(
        429,
        "UPLOAD_LIMIT",
        "Daily icon upload limit reached.",
      );
    const key = `catalogue/icons/${randomUUID()}`;
    await storage().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: bytes,
        ContentType: i.contentType,
      }),
    );
    const rows =
      await db()`INSERT INTO catalogue_media(object_key,content_type,byte_size,created_by,content_hash) VALUES(${key},${i.contentType},${bytes.length},${req.staff!.id},${contentHash}) RETURNING id,object_key`;
    res.status(201).json({
      data: {
        ...rows[0],
        previewUrl: `/api/v1/admin/catalogue/media/${rows[0]!.id}`,
      },
    });
  }),
);
async function serve(
  id: string,
  published: boolean,
  res: Parameters<RequestHandler>[1],
) {
  z.string().uuid().parse(id);
  const rows =
    await db()`SELECT m.* FROM catalogue_media m WHERE m.id=${id} AND (${!published} OR EXISTS(SELECT 1 FROM service_catalogue s WHERE s.icon_object_key=m.object_key AND s.active AND s.publication_status='PUBLISHED' AND s.archived_at IS NULL AND EXISTS(SELECT 1 FROM appliance_categories a JOIN catalogue_categories g ON g.id=a.catalogue_category_id WHERE a.id=s.appliance_category_id AND a.active AND a.publication_status='PUBLISHED' AND a.archived_at IS NULL AND g.active AND g.publication_status='PUBLISHED' AND g.archived_at IS NULL)) OR EXISTS(SELECT 1 FROM appliance_categories a WHERE a.icon_object_key=m.object_key AND a.active AND a.publication_status='PUBLISHED' AND a.archived_at IS NULL AND EXISTS(SELECT 1 FROM catalogue_categories g WHERE g.id=a.catalogue_category_id AND g.active AND g.publication_status='PUBLISHED' AND g.archived_at IS NULL)) OR EXISTS(SELECT 1 FROM catalogue_categories g WHERE g.icon_object_key=m.object_key AND g.active AND g.publication_status='PUBLISHED' AND g.archived_at IS NULL) OR EXISTS(SELECT 1 FROM app_settings v WHERE v.key='customer_home_banner' AND v.value::jsonb->>'iconObjectKey'=m.object_key))`;
  if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Icon not found.");
  const media = rows[0],
    file = await storage().send(
      new GetObjectCommand({ Bucket: bucket, Key: String(media.object_key) }),
    );
  res.setHeader("Content-Type", String(media.content_type));
  res.setHeader(
    "Content-Security-Policy",
    "sandbox; default-src 'none'; style-src 'none'",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(Buffer.from(await file.Body!.transformToByteArray()));
}
catalogueMediaAdmin.get(
  "/catalogue/media/:id",
  requireStaff,
  route(async (req, res) => serve(String(req.params.id), false, res)),
);
catalogueMediaPublic.get(
  "/catalogue/media/:id",
  route(async (req, res) => serve(String(req.params.id), true, res)),
);
catalogueMediaAdmin.delete(
  "/catalogue/media/:id",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const media = (
      await db()`SELECT * FROM catalogue_media WHERE id=${id} FOR UPDATE`
    )[0];
    if (!media) {
      res.status(204).end();
      return;
    }
    const used =
      await db()`SELECT 1 FROM catalogue_categories WHERE icon_object_key=${media.object_key} UNION ALL SELECT 1 FROM appliance_categories WHERE icon_object_key=${media.object_key} UNION ALL SELECT 1 FROM service_catalogue WHERE icon_object_key=${media.object_key} UNION ALL SELECT 1 FROM app_settings WHERE key='customer_home_banner' AND value::jsonb->>'iconObjectKey'=${media.object_key}`;
    if (used.length)
      throw new ApiError(
        409,
        "IMAGE_IN_USE",
        "This image is still used by the catalogue and cannot be removed.",
      );
    await db()`DELETE FROM catalogue_media WHERE id=${id}`;
    await storage().send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: String(media.object_key),
      }),
    );
    res.status(204).end();
  }),
);
catalogueMediaAdmin.post(
  "/catalogue/media/cleanup",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const { ids } = z
      .object({ ids: z.array(z.string().uuid()).min(1).max(50).optional() })
      .strict()
      .parse(req.body);
    const images =
      await db()`SELECT m.id,m.object_key FROM catalogue_media m WHERE (${ids === undefined} OR m.id=ANY(${ids || []}::uuid[])) AND m.last_selected_at<now()-interval '24 hours'
        AND NOT EXISTS(SELECT 1 FROM catalogue_categories WHERE icon_object_key=m.object_key)
        AND NOT EXISTS(SELECT 1 FROM appliance_categories WHERE icon_object_key=m.object_key)
        AND NOT EXISTS(SELECT 1 FROM service_catalogue WHERE icon_object_key=m.object_key)
        AND NOT EXISTS(SELECT 1 FROM app_settings WHERE key='customer_home_banner' AND value::jsonb->>'iconObjectKey'=m.object_key)
        ORDER BY m.id LIMIT 100 FOR UPDATE`;
    const removed: string[] = [];
    for (const media of images) {
      const used =
        await db()`SELECT 1 FROM catalogue_categories WHERE icon_object_key=${media.object_key} UNION ALL SELECT 1 FROM appliance_categories WHERE icon_object_key=${media.object_key} UNION ALL SELECT 1 FROM service_catalogue WHERE icon_object_key=${media.object_key} UNION ALL SELECT 1 FROM app_settings WHERE key='customer_home_banner' AND value::jsonb->>'iconObjectKey'=${media.object_key}`;
      if (used.length) continue;
      await db()`DELETE FROM catalogue_media WHERE id=${media.id}`;
      await storage().send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: String(media.object_key),
        }),
      );
      removed.push(String(media.id));
    }
    res.json({ data: { removed } });
  }),
);
