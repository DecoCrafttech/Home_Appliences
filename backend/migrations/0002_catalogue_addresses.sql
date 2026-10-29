CREATE TABLE IF NOT EXISTS appliance_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS service_catalogue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appliance_category_id uuid NOT NULL REFERENCES appliance_categories(id) ON DELETE RESTRICT,
  request_type text NOT NULL CHECK (request_type IN ('SERVICE','INSTALLATION')),
  slug text NOT NULL,
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appliance_category_id, request_type, slug)
);
CREATE INDEX IF NOT EXISTS catalogue_category_type_idx ON service_catalogue(appliance_category_id, request_type);
CREATE TABLE IF NOT EXISTS customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label text NOT NULL,
  recipient_name text NOT NULL,
  phone text NOT NULL,
  line1 text NOT NULL,
  area text NOT NULL,
  landmark text,
  city text NOT NULL,
  state text NOT NULL,
  pin_code text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS addresses_customer_idx ON customer_addresses(customer_id, created_at);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS appliance_category_id uuid REFERENCES appliance_categories(id) ON DELETE RESTRICT;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS service_catalogue_id uuid REFERENCES service_catalogue(id) ON DELETE RESTRICT;
INSERT INTO appliance_categories(slug,name) VALUES
 ('air-conditioner','Air Conditioner'),('washing-machine','Washing Machine'),('refrigerator','Refrigerator'),('television','Television'),('water-purifier','Water Purifier'),('microwave','Microwave'),('geyser','Geyser'),('kitchen-chimney','Kitchen Chimney'),('dishwasher','Dishwasher'),('other','Other Appliances')
ON CONFLICT(slug) DO UPDATE SET name=excluded.name,active=true;
INSERT INTO service_catalogue(appliance_category_id,request_type,slug,name)
SELECT a.id,v.request_type,v.slug,v.name FROM appliance_categories a JOIN (VALUES
 ('washing-machine','SERVICE','not-spinning','Not Spinning'),('washing-machine','SERVICE','not-draining','Not Draining'),('washing-machine','SERVICE','water-leakage','Water Leakage'),('washing-machine','SERVICE','general-maintenance','General Maintenance'),
 ('air-conditioner','SERVICE','not-cooling','Not Cooling'),('air-conditioner','SERVICE','water-leakage','Water Leakage'),('air-conditioner','SERVICE','general-service','General Service'),
 ('television','SERVICE','display-issue','Display Issue'),('television','SERVICE','sound-issue','Sound Issue'),('television','SERVICE','not-switching-on','Not Switching On'),
 ('television','INSTALLATION','wall-mount','Wall Mount Installation'),('television','INSTALLATION','table-installation','Table Installation'),
 ('air-conditioner','INSTALLATION','new-installation','New Installation'),('air-conditioner','INSTALLATION','reinstallation','Reinstallation'),('air-conditioner','INSTALLATION','uninstallation','Uninstallation'),
 ('washing-machine','INSTALLATION','new-installation','New Installation'),('washing-machine','INSTALLATION','reinstallation','Reinstallation'),
 ('water-purifier','INSTALLATION','installation','Installation'),('water-purifier','INSTALLATION','reinstallation','Reinstallation'),('water-purifier','INSTALLATION','uninstallation','Uninstallation')
) AS v(category_slug,request_type,slug,name) ON a.slug=v.category_slug
ON CONFLICT(appliance_category_id,request_type,slug) DO NOTHING;
