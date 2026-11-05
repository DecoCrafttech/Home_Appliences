import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { requireStaff, allow } from "./adminRoutes.js";
import { ApiError } from "./customerRoutes.js";
import { db } from "./db.js";
export const applianceCatalogueRoutes = Router();
const route =
  (handler: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
applianceCatalogueRoutes.get(
  "/catalogue/appliances",
  route(async (_req, res) => {
    const rows =
      await db()`SELECT a.id,a.name,a.slug,a.kind,a.catalogue_category_id,g.name AS category_name,a.description,a.display_order,COALESCE((SELECT '/api/v1/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=a.icon_object_key),a.default_image_path) AS icon_url,(SELECT count(*)::int FROM service_catalogue s WHERE s.appliance_category_id=a.id AND s.active AND s.publication_status='PUBLISHED' AND s.archived_at IS NULL) AS service_count FROM appliance_categories a JOIN catalogue_categories g ON g.id=a.catalogue_category_id WHERE a.active AND a.publication_status='PUBLISHED' AND a.archived_at IS NULL AND g.active AND g.publication_status='PUBLISHED' AND g.archived_at IS NULL ORDER BY g.display_order,g.name,g.id,a.display_order,a.name,a.id`;
    res.json({ data: rows });
  }),
);
applianceCatalogueRoutes.get(
  "/catalogue/appliances/:id/services",
  route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const category = (
      await db()`SELECT a.id,a.name,a.slug,a.kind,a.catalogue_category_id,g.name AS category_name FROM appliance_categories a JOIN catalogue_categories g ON g.id=a.catalogue_category_id WHERE a.id=${id} AND a.active AND a.publication_status='PUBLISHED' AND a.archived_at IS NULL AND g.active AND g.publication_status='PUBLISHED' AND g.archived_at IS NULL`
    )[0];
    if (!category)
      throw new ApiError(404, "NOT_FOUND", "Appliance is not available");
    const rows =
      await db()`SELECT s.id,s.appliance_category_id,${category.catalogue_category_id}::uuid AS catalogue_category_id,${category.category_name}::text AS catalogue_category_name,s.request_type,s.name,s.description,s.form_fields,s.booking_options,s.base_price,${category.name}::text AS appliance_name,${category.kind}::text AS category_kind,(SELECT '/api/v1/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=s.icon_object_key) AS icon_url FROM service_catalogue s WHERE s.appliance_category_id=${id} AND s.active AND s.publication_status='PUBLISHED' AND s.archived_at IS NULL ORDER BY s.display_order,s.name`;
    res.json({ data: rows, meta: { appliance: category } });
  }),
);
applianceCatalogueRoutes.post(
  "/admin/catalogue/appliances",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const { name, kind } = z
      .object({
        name: z.string().trim().min(2).max(100),
        kind: z.enum(["APPLIANCE", "MAINTENANCE"]).default("APPLIANCE"),
      })
      .strict()
      .parse(req.body);
    await db().query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      "appliance-name:" + name.toLowerCase(),
    ]);
    const duplicate =
      await db()`SELECT id FROM appliance_categories WHERE lower(name)=lower(${name}) AND active`;
    if (duplicate[0])
      throw new ApiError(
        409,
        "DUPLICATE_APPLIANCE",
        "An appliance with this name already exists.",
      );
    const slug = `${
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || "appliance"
    }-${randomUUID().slice(0, 8)}`;
    const rows =
      await db()`INSERT INTO appliance_categories(name,slug,kind,publication_status) VALUES(${name},${slug},${kind},'DRAFT') RETURNING id,name,publication_status`;
    await db()`INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id,new_value) VALUES(${req.staff!.id},${req.staff!.role},'APPLIANCE_CREATED','APPLIANCE_CATEGORY',${rows[0]!.id},${JSON.stringify({ name })}::jsonb)`;
    res.status(201).json({ data: rows[0] });
  }),
);
applianceCatalogueRoutes.patch(
  "/admin/catalogue/appliances/:id",
  requireStaff,
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const i = z
      .object({
        name: z.string().trim().min(2).max(100).optional(),
        iconObjectKey: z.string().max(160).nullable(),
        publicationStatus: z.enum(["DRAFT", "PUBLISHED"]),
      })
      .strict()
      .parse(req.body);
    if (
      i.iconObjectKey &&
      !(
        await db()`SELECT id FROM catalogue_media WHERE object_key=${i.iconObjectKey}`
      )[0]
    )
      throw new ApiError(
        422,
        "INVALID_ICON",
        "Upload an approved appliance icon first",
      );
    const rows =
      await db()`UPDATE appliance_categories SET name=COALESCE(${i.name || null},name),icon_object_key=${i.iconObjectKey},publication_status=${i.publicationStatus} WHERE id=${id} AND active RETURNING id,name,icon_object_key,publication_status`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Appliance not found");
    await db()`INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id,new_value) VALUES(${req.staff!.id},${req.staff!.role},'APPLIANCE_UPDATED','APPLIANCE_CATEGORY',${id},${JSON.stringify(i)}::jsonb)`;
    res.json({ data: rows[0] });
  }),
);
