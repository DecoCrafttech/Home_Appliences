CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL UNIQUE,
  full_name text NOT NULL DEFAULT '',
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_e164 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS otp_phone_created_idx ON otp_challenges(phone_e164, created_at DESC);
CREATE TABLE IF NOT EXISTS customer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  request_type text NOT NULL CHECK (request_type IN ('SERVICE','INSTALLATION')),
  appliance text NOT NULL,
  service_name text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  address_snapshot jsonb NOT NULL,
  preferred_date date NOT NULL,
  preferred_time_window text NOT NULL,
  status text NOT NULL DEFAULT 'REQUESTED',
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(customer_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS requests_customer_created_idx ON service_requests(customer_id, created_at DESC);
CREATE TABLE IF NOT EXISTS request_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_events_idx ON request_status_events(request_id, created_at);
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  subject text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_customer_created_idx ON support_tickets(customer_id, created_at DESC);
