CREATE TABLE IF NOT EXISTS completion_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL UNIQUE REFERENCES service_requests(id) ON DELETE CASCADE,
 completed_by uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,
 work_summary text NOT NULL CHECK(length(trim(work_summary)) BETWEEN 3 AND 2000),
 completion_notes text NOT NULL DEFAULT '',
 completed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE request_status_events ADD COLUMN IF NOT EXISTS previous_status text;
CREATE INDEX IF NOT EXISTS requests_completed_at_idx ON service_requests(completed_at DESC) WHERE status='COMPLETED';
