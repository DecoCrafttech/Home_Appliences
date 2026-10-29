ALTER TABLE service_catalogue ADD COLUMN IF NOT EXISTS form_fields jsonb NOT NULL DEFAULT '[]'::jsonb;
