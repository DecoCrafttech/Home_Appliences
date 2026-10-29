CREATE TABLE IF NOT EXISTS mutation_results (
 actor_scope text NOT NULL,
 operation_key uuid NOT NULL,
 fingerprint text NOT NULL,
 response_status integer NOT NULL,
 response_body jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '7 days',
 PRIMARY KEY(actor_scope,operation_key)
);
CREATE INDEX IF NOT EXISTS mutation_results_expiry ON mutation_results(expires_at);
CREATE TABLE IF NOT EXISTS staff_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 staff_id uuid NOT NULL REFERENCES staff_profiles(id) ON DELETE CASCADE,
 request_id uuid REFERENCES service_requests(id) ON DELETE CASCADE,
 related_path text NOT NULL,
 event_key text NOT NULL,
 title text NOT NULL,
 message text NOT NULL,
 read_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(staff_id,event_key)
);
CREATE INDEX IF NOT EXISTS staff_notifications_inbox ON staff_notifications(staff_id,created_at DESC);
