CREATE TABLE IF NOT EXISTS catalogue_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon_object_key text REFERENCES catalogue_media(object_key) ON DELETE RESTRICT,
  default_image_path text,
  active boolean NOT NULL DEFAULT true,
  publication_status text NOT NULL DEFAULT 'DRAFT' CHECK (publication_status IN ('DRAFT','PUBLISHED')),
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalogue_category_name_unique ON catalogue_categories(lower(name)) WHERE archived_at IS NULL;
INSERT INTO catalogue_categories(id,name,publication_status,display_order,default_image_path) VALUES
('fb000000-0000-4000-8000-000000000001','Home Appliances','PUBLISHED',0,'/categories/v8/service.webp'),
('fb000000-0000-4000-8000-000000000002','Home Maintenance','PUBLISHED',1,'/categories/v8/maintenance.webp') ON CONFLICT DO NOTHING;
ALTER TABLE appliance_categories ADD COLUMN IF NOT EXISTS catalogue_category_id uuid NOT NULL DEFAULT 'fb000000-0000-4000-8000-000000000001' REFERENCES catalogue_categories(id) ON DELETE RESTRICT;
ALTER TABLE appliance_categories ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE appliance_categories ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0);
ALTER TABLE appliance_categories ADD COLUMN IF NOT EXISTS default_image_path text;
ALTER TABLE appliance_categories ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE appliance_categories ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE service_catalogue ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE service_catalogue ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE appliance_categories SET catalogue_category_id='fb000000-0000-4000-8000-000000000002' WHERE kind='MAINTENANCE';
UPDATE appliance_categories SET archived_at=now() WHERE NOT active;
UPDATE service_catalogue SET archived_at=now() WHERE NOT active;
UPDATE appliance_categories SET default_image_path='/appliances/v8/'||CASE slug WHEN 'geyser' THEN 'water-heater' WHEN 'airfiber-internet' THEN 'internet' ELSE slug END||'.webp' WHERE slug IN ('air-conditioner','refrigerator','washing-machine','television','geyser','water-heater','microwave','water-purifier','kitchen-chimney','dishwasher','cctv','internet','airfiber-internet');
INSERT INTO appliance_categories(slug,name,kind,publication_status,catalogue_category_id,default_image_path)
SELECT 'maintenance-'||v.slug,v.name,'MAINTENANCE','PUBLISHED','fb000000-0000-4000-8000-000000000002','/maintenance/'||v.slug||'-cutout.webp'
FROM (VALUES ('electrical','Electrical'),('plumbing','Plumbing'),('painting','Painting')) AS v(slug,name)
WHERE EXISTS(SELECT 1 FROM appliance_categories a JOIN service_catalogue s ON s.appliance_category_id=a.id WHERE a.slug='home-maintenance' AND s.active AND lower(s.name) LIKE '%'||v.slug||'%') ON CONFLICT(slug) DO NOTHING;
UPDATE service_catalogue s SET appliance_category_id=target.id FROM appliance_categories old,appliance_categories target WHERE s.appliance_category_id=old.id AND old.slug='home-maintenance' AND target.slug IN ('maintenance-electrical','maintenance-plumbing','maintenance-painting') AND lower(s.name) LIKE '%'||substring(target.slug FROM 13)||'%';
UPDATE appliance_categories a SET active=false,archived_at=now() WHERE a.slug='home-maintenance' AND NOT EXISTS(SELECT 1 FROM service_catalogue s WHERE s.appliance_category_id=a.id AND s.active);
CREATE INDEX IF NOT EXISTS catalogue_items_parent_order ON appliance_categories(catalogue_category_id,display_order,id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS catalogue_entries_item_order ON service_catalogue(appliance_category_id,request_type,display_order,id) WHERE archived_at IS NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS catalogue_category_id uuid REFERENCES catalogue_categories(id) ON DELETE RESTRICT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS catalogue_category_name text;
UPDATE service_requests r SET catalogue_category_id=g.id,catalogue_category_name=g.name FROM appliance_categories a JOIN catalogue_categories g ON g.id=a.catalogue_category_id WHERE r.appliance_category_id=a.id AND r.catalogue_category_id IS NULL;
ALTER TABLE catalogue_media ADD COLUMN IF NOT EXISTS content_hash text;
ALTER TABLE catalogue_media DROP CONSTRAINT IF EXISTS catalogue_media_byte_size_check;
ALTER TABLE catalogue_media ADD CONSTRAINT catalogue_media_byte_size_check CHECK(byte_size>0 AND byte_size<=2097152);
CREATE UNIQUE INDEX IF NOT EXISTS catalogue_media_deduplicate ON catalogue_media(created_by,content_hash) WHERE content_hash IS NOT NULL;
