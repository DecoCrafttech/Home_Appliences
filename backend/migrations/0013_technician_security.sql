ALTER TABLE technician_accounts ADD COLUMN reset_hash text UNIQUE;
ALTER TABLE technician_accounts ADD COLUMN reset_expires_at timestamptz;
ALTER TABLE technician_accounts ADD COLUMN mfa_secret text;
ALTER TABLE technician_accounts ADD COLUMN mfa_pending_secret text;
ALTER TABLE technician_accounts ADD COLUMN mfa_last_counter bigint NOT NULL DEFAULT 0;
