CREATE TABLE IF NOT EXISTS push_preferences (
  recipient_role text NOT NULL CHECK (recipient_role IN ('CUSTOMER','ADMIN','TECHNICIAN')),
  recipient_id uuid NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (recipient_role, recipient_id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_role text NOT NULL CHECK (recipient_role IN ('CUSTOMER','ADMIN','TECHNICIAN')),
  recipient_id uuid NOT NULL,
  endpoint text NOT NULL UNIQUE,
  p256dh_key text NOT NULL,
  auth_key text NOT NULL,
  user_agent text,
  enabled boolean NOT NULL DEFAULT true,
  failure_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  last_success_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_recipient_idx
  ON push_subscriptions(recipient_role, recipient_id) WHERE enabled;

CREATE TABLE IF NOT EXISTS push_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL,
  recipient_role text NOT NULL CHECK (recipient_role IN ('CUSTOMER','ADMIN','TECHNICIAN')),
  recipient_id uuid NOT NULL,
  request_id uuid,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','SENDING','SENT','FAILED')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (event_key, recipient_role, recipient_id)
);
CREATE INDEX IF NOT EXISTS push_deliveries_pending_idx
  ON push_deliveries(next_attempt_at) WHERE status IN ('PENDING','FAILED');
