CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS skills text NOT NULL DEFAULT '';
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS service_area text NOT NULL DEFAULT '';
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS availability text NOT NULL DEFAULT 'AVAILABLE' CHECK(availability IN ('AVAILABLE','UNAVAILABLE'));
ALTER TABLE technicians ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'UNVERIFIED' CHECK(verification_status IN ('UNVERIFIED','VERIFIED'));
ALTER TABLE service_catalogue ADD COLUMN IF NOT EXISTS base_price numeric(12,2) CHECK(base_price>=0);
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'GENERAL';
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL' CHECK(priority IN ('LOW','NORMAL','HIGH','URGENT'));
CREATE TABLE IF NOT EXISTS support_messages(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
 customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
 staff_id uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,
 author_type text NOT NULL CHECK(author_type IN ('CUSTOMER','STAFF')),
 visibility text NOT NULL DEFAULT 'PUBLIC' CHECK(visibility IN ('PUBLIC','INTERNAL')),
 message text NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 4000),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages(ticket_id,created_at);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS appointment_start_minute int GENERATED ALWAYS AS (CASE WHEN confirmed_time_window ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$' THEN substring(confirmed_time_window,1,2)::int*60+substring(confirmed_time_window,4,2)::int ELSE NULL END) STORED;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS appointment_end_minute int GENERATED ALWAYS AS (CASE WHEN confirmed_time_window ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$' THEN substring(confirmed_time_window,7,2)::int*60+substring(confirmed_time_window,10,2)::int ELSE NULL END) STORED;
ALTER TABLE service_requests ADD CONSTRAINT technician_appointment_no_overlap EXCLUDE USING gist (assigned_technician_id WITH =,confirmed_date WITH =,int4range(appointment_start_minute,appointment_end_minute,'[)') WITH &&) WHERE (status NOT IN ('COMPLETED','CANCELLED') AND assigned_technician_id IS NOT NULL AND confirmed_date IS NOT NULL AND appointment_start_minute IS NOT NULL);
