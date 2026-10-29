ALTER TABLE customers ALTER COLUMN phone_e164 DROP NOT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile_photo_url text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE','SUSPENDED','DELETION_REQUESTED'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS customer_auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('GOOGLE','LEGACY_PHONE')),
  provider_subject text NOT NULL,
  verified_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider,provider_subject)
);
CREATE INDEX IF NOT EXISTS customer_identity_customer_idx ON customer_auth_identities(customer_id);
