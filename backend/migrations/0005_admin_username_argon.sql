ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS username text;
UPDATE staff_profiles SET username=split_part(email,'@',1) WHERE username IS NULL;
ALTER TABLE staff_profiles ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_username_lower_unique ON staff_profiles(lower(username));
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT true;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS failed_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS locked_until timestamptz;
