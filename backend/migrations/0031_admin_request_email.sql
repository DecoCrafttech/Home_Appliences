CREATE TABLE admin_request_emails (
  request_id uuid PRIMARY KEY REFERENCES service_requests(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0,
  sent_at timestamptz,
  last_error text
);

CREATE INDEX admin_request_emails_pending
  ON admin_request_emails(next_attempt_at)
  WHERE sent_at IS NULL;
