CREATE SEQUENCE IF NOT EXISTS customer_reference_seq;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS customer_reference text;
UPDATE customers SET customer_reference='CUS-' || lpad(nextval('customer_reference_seq')::text,8,'0') WHERE customer_reference IS NULL;
ALTER TABLE customers ALTER COLUMN customer_reference SET DEFAULT ('CUS-' || lpad(nextval('customer_reference_seq')::text,8,'0'));
ALTER TABLE customers ALTER COLUMN customer_reference SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customers_reference_idx ON customers(customer_reference);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS review_reminder_dismissed_at timestamptz;
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES service_requests(id) ON DELETE SET NULL;
CREATE TABLE IF NOT EXISTS customer_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
 request_id uuid REFERENCES service_requests(id) ON DELETE CASCADE,kind text NOT NULL,title text NOT NULL,message text NOT NULL,
 read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(request_id,kind)
);
CREATE INDEX IF NOT EXISTS notifications_customer_idx ON customer_notifications(customer_id,created_at DESC);
CREATE TABLE IF NOT EXISTS request_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),request_id uuid NOT NULL UNIQUE REFERENCES service_requests(id) ON DELETE CASCADE,
 customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '',tags jsonb NOT NULL DEFAULT '[]',handling_status text NOT NULL DEFAULT 'NEW' CHECK(handling_status IN ('NEW','IN_REVIEW','RESOLVED')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_created_idx ON request_reviews(created_at DESC);
CREATE TABLE IF NOT EXISTS review_internal_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid NOT NULL REFERENCES request_reviews(id) ON DELETE CASCADE,
 staff_id uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS review_handling_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid NOT NULL REFERENCES request_reviews(id) ON DELETE CASCADE,
 staff_id uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,status text NOT NULL,note text NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
