import { Router, type RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "./db.js";
import { requireStaff, allow } from "./adminRoutes.js";
import { ApiError } from "./customerRoutes.js";

export const dynamicCatalogue = Router();
const route =
  (fn: RequestHandler): RequestHandler =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch((error) =>
      next(
        error?.code === "23505"
          ? new ApiError(
              409,
              "DUPLICATE_NAME",
              "A category with this name already exists.",
            )
          : error?.code === "23503"
            ? new ApiError(
                409,
                "CATALOGUE_CHANGED",
                "The related category or image changed. Refresh and try again.",
              )
            : error,
      ),
    );
const idSchema = z.string().uuid();
const fields = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1500).default(""),
  iconObjectKey: z.string().max(160).nullable().default(null),
  active: z.boolean().default(true),
  publicationStatus: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  displayOrder: z.number().int().min(0).max(1000000).default(0),
});
// Patch schemas must not inherit create defaults: omitted fields stay unchanged.
const patchFields = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(1500).optional(),
  iconObjectKey: z.string().max(160).nullable().optional(),
  active: z.boolean().optional(),
  publicationStatus: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  displayOrder: z.number().int().min(0).max(1000000).optional(),
});
async function validateImage(key: string | null) {
  if (
    key &&
    !(await db()`SELECT id FROM catalogue_media WHERE object_key=${key}`)[0]
  )
    throw new ApiError(422, "INVALID_IMAGE", "Upload an image before saving.");
}
async function checkItemName(name: string, parent: string, id?: string) {
  await db()`SELECT pg_advisory_xact_lock(hashtextextended(${parent + ":" + name.toLowerCase()},0))`;
  const duplicate =
    await db()`SELECT id FROM appliance_categories WHERE catalogue_category_id=${parent} AND lower(name)=lower(${name}) AND archived_at IS NULL AND id<>COALESCE(${id ?? null}::uuid,'00000000-0000-0000-0000-000000000000'::uuid)`;
  if (duplicate.length)
    throw new ApiError(
      409,
      "DUPLICATE_ITEM",
      "An item with this name already exists in this category.",
    );
}
async function audit(
  staff: { id: string; role: string },
  action: string,
  entity: string,
  id: string,
) {
  await db()`INSERT INTO audit_logs(actor_staff_id,actor_role,action,entity_type,entity_id) VALUES(${staff.id},${staff.role},${action},${entity},${id})`;
}
dynamicCatalogue.get(
  "/catalogue/categories",
  route(async (_req, res) => {
    const rows =
      await db()`SELECT g.id,g.name,g.description,g.display_order,COALESCE((SELECT '/api/v1/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=g.icon_object_key),g.default_image_path) AS icon_url,(SELECT count(*)::int FROM appliance_categories a WHERE a.catalogue_category_id=g.id AND a.active AND a.publication_status='PUBLISHED' AND a.archived_at IS NULL) AS item_count FROM catalogue_categories g WHERE g.active AND g.publication_status='PUBLISHED' AND g.archived_at IS NULL ORDER BY g.display_order,g.name,g.id`;
    res.json({ data: rows });
  }),
);
dynamicCatalogue.get(
  "/catalogue/categories/:id/items",
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const group = (
      await db()`SELECT id,name,description FROM catalogue_categories WHERE id=${id} AND active AND publication_status='PUBLISHED' AND archived_at IS NULL`
    )[0];
    if (!group)
      throw new ApiError(404, "NOT_FOUND", "This category is not available.");
    const items =
      await db()`SELECT a.id,a.name,a.description,a.slug,a.kind,a.catalogue_category_id,a.display_order,COALESCE((SELECT '/api/v1/catalogue/media/'||m.id::text FROM catalogue_media m WHERE m.object_key=a.icon_object_key),a.default_image_path) AS icon_url,(SELECT count(*)::int FROM service_catalogue s WHERE s.appliance_category_id=a.id AND s.active AND s.publication_status='PUBLISHED' AND s.archived_at IS NULL) AS service_count FROM appliance_categories a WHERE a.catalogue_category_id=${id} AND a.active AND a.publication_status='PUBLISHED' AND a.archived_at IS NULL ORDER BY a.display_order,a.name,a.id`;
    res.json({ data: items, meta: { category: group } });
  }),
);
dynamicCatalogue.use("/admin/catalogue", requireStaff);
dynamicCatalogue.post(
  "/admin/catalogue/categories",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const i = fields.strict().parse(req.body);
    await validateImage(i.iconObjectKey);
    const row = (
      await db()`INSERT INTO catalogue_categories(name,description,icon_object_key,active,publication_status,display_order) VALUES(${i.name},${i.description},${i.iconObjectKey},${i.active},${i.publicationStatus},${i.displayOrder}) RETURNING *`
    )[0];
    await audit(
      req.staff!,
      "CATALOGUE_CATEGORY_CREATED",
      "CATALOGUE_CATEGORY",
      String(row!.id),
    );
    res.status(201).json({ data: row });
  }),
);
dynamicCatalogue.patch(
  "/admin/catalogue/categories/:id",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id),
      i = patchFields.strict().parse(req.body);
    if (i.iconObjectKey !== undefined) await validateImage(i.iconObjectKey);
    const row = (
      await db()`UPDATE catalogue_categories SET name=COALESCE(${i.name ?? null},name),description=COALESCE(${i.description ?? null},description),active=COALESCE(${i.active ?? null},active),publication_status=COALESCE(${i.publicationStatus ?? null},publication_status),display_order=COALESCE(${i.displayOrder ?? null}::int,display_order),icon_object_key=CASE WHEN ${i.iconObjectKey !== undefined} THEN ${i.iconObjectKey ?? null} ELSE icon_object_key END,updated_at=now() WHERE id=${id} AND archived_at IS NULL RETURNING *`
    )[0];
    if (!row) throw new ApiError(404, "NOT_FOUND", "Category not found.");
    await audit(
      req.staff!,
      "CATALOGUE_CATEGORY_UPDATED",
      "CATALOGUE_CATEGORY",
      id,
    );
    res.json({ data: row });
  }),
);
dynamicCatalogue.delete(
  "/admin/catalogue/categories/:id",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const rows =
      await db()`UPDATE catalogue_categories SET active=false,archived_at=now(),updated_at=now() WHERE id=${id} AND archived_at IS NULL RETURNING id`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Category not found.");
    await audit(
      req.staff!,
      "CATALOGUE_CATEGORY_ARCHIVED",
      "CATALOGUE_CATEGORY",
      id,
    );
    res.status(204).end();
  }),
);
const itemFields = fields.extend({ categoryId: idSchema });
dynamicCatalogue.post(
  "/admin/catalogue/items",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const i = itemFields.strict().parse(req.body);
    await validateImage(i.iconObjectKey);
    await checkItemName(i.name, i.categoryId);
    if (
      !(
        await db()`SELECT id FROM catalogue_categories WHERE id=${i.categoryId} AND archived_at IS NULL`
      )[0]
    )
      throw new ApiError(
        422,
        "INVALID_CATEGORY",
        "Choose an available category.",
      );
    const row = (
      await db()`INSERT INTO appliance_categories(catalogue_category_id,name,slug,description,icon_object_key,active,publication_status,display_order) VALUES(${i.categoryId},${i.name},${randomUUID()},${i.description},${i.iconObjectKey},${i.active},${i.publicationStatus},${i.displayOrder}) RETURNING *`
    )[0];
    await audit(
      req.staff!,
      "CATALOGUE_ITEM_CREATED",
      "APPLIANCE_CATEGORY",
      String(row!.id),
    );
    res.status(201).json({ data: row });
  }),
);
dynamicCatalogue.patch(
  "/admin/catalogue/items/:id",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id),
      i = patchFields
        .extend({ categoryId: idSchema.optional() })
        .strict()
        .parse(req.body);
    if (i.iconObjectKey !== undefined) await validateImage(i.iconObjectKey);
    if (i.name || i.categoryId) {
      const previous = (
        await db()`SELECT name,catalogue_category_id FROM appliance_categories WHERE id=${id} AND archived_at IS NULL`
      )[0];
      if (!previous) throw new ApiError(404, "NOT_FOUND", "Item not found.");
      await checkItemName(
        i.name || String(previous.name),
        i.categoryId || String(previous.catalogue_category_id),
        id,
      );
    }
    if (
      i.categoryId &&
      !(
        await db()`SELECT id FROM catalogue_categories WHERE id=${i.categoryId} AND archived_at IS NULL`
      )[0]
    )
      throw new ApiError(
        422,
        "INVALID_CATEGORY",
        "Choose an available category.",
      );
    const row = (
      await db()`UPDATE appliance_categories SET catalogue_category_id=COALESCE(${i.categoryId ?? null}::uuid,catalogue_category_id),name=COALESCE(${i.name ?? null},name),description=COALESCE(${i.description ?? null},description),active=COALESCE(${i.active ?? null},active),publication_status=COALESCE(${i.publicationStatus ?? null},publication_status),display_order=COALESCE(${i.displayOrder ?? null}::int,display_order),icon_object_key=CASE WHEN ${i.iconObjectKey !== undefined} THEN ${i.iconObjectKey ?? null} ELSE icon_object_key END,updated_at=now() WHERE id=${id} AND archived_at IS NULL RETURNING *`
    )[0];
    if (!row) throw new ApiError(404, "NOT_FOUND", "Item not found.");
    await audit(req.staff!, "CATALOGUE_ITEM_UPDATED", "APPLIANCE_CATEGORY", id);
    res.json({ data: row });
  }),
);
dynamicCatalogue.delete(
  "/admin/catalogue/items/:id",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id);
    const rows =
      await db()`UPDATE appliance_categories SET active=false,archived_at=now(),updated_at=now() WHERE id=${id} AND archived_at IS NULL RETURNING id`;
    if (!rows[0]) throw new ApiError(404, "NOT_FOUND", "Item not found.");
    await audit(
      req.staff!,
      "CATALOGUE_ITEM_ARCHIVED",
      "APPLIANCE_CATEGORY",
      id,
    );
    res.status(204).end();
  }),
);
dynamicCatalogue.patch(
  "/admin/catalogue/entries/:id",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const id = idSchema.parse(req.params.id),
      i = z
        .object({
          active: z.boolean().optional(),
          displayOrder: z.number().int().min(0).max(1000000).optional(),
        })
        .strict()
        .parse(req.body);
    const row = (
      await db()`UPDATE service_catalogue SET active=COALESCE(${i.active ?? null},active),display_order=COALESCE(${i.displayOrder ?? null}::int,display_order),updated_at=now() WHERE id=${id} AND archived_at IS NULL RETURNING *`
    )[0];
    if (!row) throw new ApiError(404, "NOT_FOUND", "Entry not found.");
    res.json({ data: row });
  }),
);
dynamicCatalogue.put(
  "/admin/catalogue/order",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const i = z
      .object({
        entity: z.enum(["categories", "items", "entries"]),
        ids: z.array(idSchema).min(1).max(1000),
        parentId: idSchema.optional(),
        requestType: z.enum(["SERVICE", "INSTALLATION"]).optional(),
      })
      .strict()
      .parse(req.body);
    if (new Set(i.ids).size !== i.ids.length)
      throw new ApiError(422, "INVALID_ORDER", "An item can only appear once.");
    const table = {
      categories: "catalogue_categories",
      items: "appliance_categories",
      entries: "service_catalogue",
    }[i.entity];
    const rows = await db().query(
      `SELECT id FROM ${table} WHERE archived_at IS NULL ${i.entity === "categories" ? "" : i.entity === "items" ? "AND catalogue_category_id=$1" : "AND appliance_category_id=$1 AND request_type=$2"} ORDER BY id FOR UPDATE`,
      i.entity === "categories"
        ? []
        : i.entity === "items"
          ? [i.parentId ?? null]
          : [i.parentId ?? null, i.requestType ?? null],
    );
    if (
      rows.length !== i.ids.length ||
      rows.some((r) => !i.ids.includes(String(r.id)))
    )
      throw new ApiError(
        409,
        "ORDER_CHANGED",
        "The catalogue changed. Refresh before saving its order.",
      );
    await db().query(
      `UPDATE ${table} t SET display_order=o.position-1,updated_at=now() FROM (SELECT value::uuid AS id,ordinality::int AS position FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY) o WHERE t.id=o.id`,
      [JSON.stringify(i.ids)],
    );
    res.json({ data: { ids: i.ids } });
  }),
);
export const homeBannerSchema = z
  .object({
    headline: z.string().trim().min(2).max(80),
    description: z.string().trim().max(180),
    cta: z.string().trim().min(2).max(40),
    secondary: z.string().trim().max(150),
    iconObjectKey: z.string().max(160).nullable().default(null),
  })
  .strict();
export const defaultHomeBanner = {
  headline: "Your Home, Our Expertise",
  description:
    "Appliance repairs, installations & home maintenance made simple.",
  cta: "Explore Services",
  secondary: "Trusted Professionals • Easy Booking • Quick Response",
  iconObjectKey: null,
};
dynamicCatalogue.get(
  "/catalogue/home-banner",
  route(async (_req, res) => {
    const row = (
      await db()`SELECT value FROM app_settings WHERE key='customer_home_banner'`
    )[0];
    const banner = row
      ? homeBannerSchema.parse(JSON.parse(String(row.value)))
      : defaultHomeBanner;
    const media = banner.iconObjectKey
      ? (
          await db()`SELECT id FROM catalogue_media WHERE object_key=${banner.iconObjectKey}`
        )[0]
      : null;
    res.json({
      data: {
        ...banner,
        icon_url: media ? `/api/v1/catalogue/media/${media.id}` : null,
      },
    });
  }),
);
dynamicCatalogue.put(
  "/admin/catalogue/home-banner",
  allow("SUPER_ADMIN", "ADMIN"),
  route(async (req, res) => {
    const i = homeBannerSchema.parse(req.body);
    await validateImage(i.iconObjectKey);
    await db()`INSERT INTO app_settings(key,value,updated_by) VALUES('customer_home_banner',${JSON.stringify(i)},${req.staff!.id}) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=now()`;
    res.json({ data: i });
  }),
);
