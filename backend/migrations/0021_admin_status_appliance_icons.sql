ALTER TABLE service_requests ADD COLUMN status_source text NOT NULL DEFAULT 'WORKFLOW';
ALTER TABLE service_requests ADD COLUMN status_overridden_at timestamptz;
CREATE TABLE request_status_overrides (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES service_requests(id),
 request_version integer NOT NULL,
 previous_status text NOT NULL,
 new_status text NOT NULL,
 reason text NOT NULL,
 completion_note text,
 staff_id uuid NOT NULL REFERENCES staff_profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(request_id,request_version)
);
ALTER TABLE appliance_categories ADD COLUMN icon_object_key text REFERENCES catalogue_media(object_key);
ALTER TABLE appliance_categories ADD COLUMN publication_status text NOT NULL DEFAULT 'PUBLISHED' CHECK(publication_status IN ('DRAFT','PUBLISHED'));
