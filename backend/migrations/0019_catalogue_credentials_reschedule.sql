ALTER TABLE service_catalogue ADD COLUMN description text NOT NULL DEFAULT '';
ALTER TABLE service_catalogue ADD COLUMN display_order integer NOT NULL DEFAULT 0;
ALTER TABLE service_catalogue ADD COLUMN publication_status text NOT NULL DEFAULT 'PUBLISHED' CHECK(publication_status IN ('DRAFT','PUBLISHED'));
ALTER TABLE service_catalogue ADD COLUMN booking_options jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(booking_options)='array');
ALTER TABLE service_catalogue ADD COLUMN icon_object_key text;
ALTER TABLE technician_accounts ALTER COLUMN email DROP NOT NULL;
ALTER TABLE technician_accounts ADD COLUMN username text UNIQUE CHECK(username IS NULL OR username ~ '^[a-z][a-z0-9._-]{2,39}$');
ALTER TABLE technician_accounts ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
CREATE TABLE appointment_reschedule_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
 technician_id uuid NOT NULL REFERENCES technicians(id),
 proposed_date date NOT NULL,
 proposed_time_window text NOT NULL CHECK(proposed_time_window ~ '^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$'),
 reason text NOT NULL DEFAULT '',
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','APPROVED','REJECTED','SUPERSEDED')),
 version integer NOT NULL DEFAULT 1,
 requested_at timestamptz NOT NULL DEFAULT now(),
 decided_at timestamptz,
 decided_by uuid REFERENCES staff_profiles(id),
 decision_reason text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX one_pending_reschedule_per_booking ON appointment_reschedule_requests(request_id) WHERE state='PENDING';
