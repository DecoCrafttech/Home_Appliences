CREATE TABLE IF NOT EXISTS staff_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('SUPER_ADMIN','ADMIN','OPERATIONS_MANAGER','SUPPORT_AGENT','FINANCE_MANAGER')),
  active boolean NOT NULL DEFAULT true,
  mfa_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS staff_login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS staff_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_staff_id uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,
  actor_role text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  previous_value jsonb,
  new_value jsonb,
  request_id text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_logs(entity_type,entity_id,created_at DESC);
ALTER TABLE request_status_events ADD COLUMN IF NOT EXISTS actor_staff_id uuid REFERENCES staff_profiles(id) ON DELETE SET NULL;
ALTER TABLE request_status_events ADD COLUMN IF NOT EXISTS actor_role text;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;
