import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
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
              "Choose a supported icon smaller than 256 KB.",
            )
          : error,
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
          .max(350000)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      })
      .strict()
      .parse(req.body);
    let bytes = Buffer.from(i.data, "base64");
    if (!bytes.length || bytes.length > 262144)
      throw new ApiError(
        422,
        "INVALID_MEDIA",
        "Icons must be smaller than 256 KB.",
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
    const quota =
      await db()`SELECT count(*)::int AS count FROM catalogue_media WHERE created_by=${req.staff!.id} AND created_at>now()-interval '24 hours'`;
    if (Number(quota[0]?.count) >= 40)
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
      await db()`INSERT INTO catalogue_media(object_key,content_type,byte_size,created_by) VALUES(${key},${i.contentType},${bytes.length},${req.staff!.id}) RETURNING id,object_key`;
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
    await db()`SELECT m.* FROM catalogue_media m WHERE m.id=${id} AND (${!published} OR EXISTS(SELECT 1 FROM service_catalogue s WHERE s.icon_object_key=m.object_key AND s.active AND s.publication_status='PUBLISHED') OR EXISTS(SELECT 1 FROM appliance_categories a WHERE a.icon_object_key=m.object_key AND a.active AND a.publication_status='PUBLISHED'))`;
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
