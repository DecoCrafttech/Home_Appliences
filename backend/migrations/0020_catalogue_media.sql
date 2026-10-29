CREATE TABLE catalogue_media (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 object_key text NOT NULL UNIQUE,
 content_type text NOT NULL CHECK(content_type IN ('image/svg+xml','image/png','image/jpeg','image/webp')),
 byte_size integer NOT NULL CHECK(byte_size>0 AND byte_size<=262144),
 created_by uuid NOT NULL REFERENCES staff_profiles(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE service_catalogue ADD CONSTRAINT catalogue_icon_media_fk FOREIGN KEY(icon_object_key) REFERENCES catalogue_media(object_key);
