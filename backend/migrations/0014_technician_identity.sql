CREATE TABLE technician_identity_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
 object_key text NOT NULL UNIQUE, content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 byte_size integer NOT NULL CHECK(byte_size>0 AND byte_size<=8388608),
 purpose text NOT NULL CHECK(purpose IN ('PROFILE','VERIFICATION')), state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','READY')),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE technician_accounts ADD COLUMN profile_photo_id uuid REFERENCES technician_identity_files(id) ON DELETE SET NULL;
ALTER TABLE request_reviews ADD COLUMN technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL;
UPDATE request_reviews v SET technician_id=r.assigned_technician_id FROM service_requests r WHERE r.id=v.request_id AND v.technician_id IS NULL;
CREATE INDEX technician_review_rating ON request_reviews(technician_id,rating);
