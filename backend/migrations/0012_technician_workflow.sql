CREATE TABLE technician_accounts (
 technician_id uuid PRIMARY KEY REFERENCES technicians(id) ON DELETE CASCADE,
 email text NOT NULL UNIQUE, password_hash text,
 status text NOT NULL DEFAULT 'INVITED' CHECK(status IN ('INVITED','ACTIVE','SUSPENDED')),
 invite_hash text UNIQUE, invite_expires_at timestamptz,
 failed_attempts integer NOT NULL DEFAULT 0, locked_until timestamptz,
 working_hours jsonb NOT NULL DEFAULT '{"start":"09:00","end":"18:00"}',
 leave_dates jsonb NOT NULL DEFAULT '[]', photo_url text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE technician_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), technician_id uuid NOT NULL REFERENCES technician_accounts(technician_id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE, csrf_token text NOT NULL, expires_at timestamptz NOT NULL,
 revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE technician_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
 technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
 state text NOT NULL DEFAULT 'OFFERED' CHECK(state IN ('OFFERED','ACCEPTED','REJECTED','EXPIRED','CANCELLED','REASSIGNED')),
 reason text NOT NULL DEFAULT '', offered_by uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours', responded_at timestamptz,
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX exclusive_live_assignment ON technician_assignments(request_id) WHERE state IN ('OFFERED','ACCEPTED');
CREATE INDEX technician_assignment_inbox ON technician_assignments(technician_id,created_at DESC);
CREATE TABLE technician_assignment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), assignment_id uuid NOT NULL REFERENCES technician_assignments(id) ON DELETE CASCADE,
 state text NOT NULL, actor_id uuid NOT NULL, actor_role text NOT NULL, reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE technician_notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
 request_id uuid REFERENCES service_requests(id) ON DELETE CASCADE, event_key text NOT NULL UNIQUE,
 title text NOT NULL, message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE technician_estimates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
 technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE, version integer NOT NULL,
 state text NOT NULL CHECK(state IN ('DRAFT','SUBMITTED','AWAITING_CUSTOMER_APPROVAL','APPROVED','REJECTED','SUPERSEDED')),
 diagnosis text NOT NULL, items jsonb NOT NULL, subtotal_paise bigint NOT NULL CHECK(subtotal_paise>=0),
 tax_paise bigint NOT NULL DEFAULT 0 CHECK(tax_paise>=0), total_paise bigint NOT NULL CHECK(total_paise>=0),
 decided_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id,version)
);
CREATE TABLE technician_checklists (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appliance text NOT NULL UNIQUE, items jsonb NOT NULL
);
INSERT INTO technician_checklists(appliance,items) VALUES
 ('AC','["Installation site assessed","Mounting completed","Connections checked","Safety checks completed","Test run performed"]'),
 ('TV','["Mounting surface checked","Bracket availability checked","TV securely mounted","Connections tested","Customer demonstration completed"]'),
 ('Washing Machine','["Water inlet checked","Outlet connected","Machine positioned","Test cycle completed","Customer demonstration completed"]');
CREATE TABLE technician_work_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
 technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE, version integer NOT NULL,
 state text NOT NULL DEFAULT 'SUBMITTED_FOR_REVIEW' CHECK(state IN ('SUBMITTED_FOR_REVIEW','CHANGES_REQUESTED','APPROVED','SUPERSEDED')),
 work_summary text NOT NULL, checklist jsonb NOT NULL, outcome text NOT NULL CHECK(outcome IN ('RESOLVED','PARTIALLY_RESOLVED','UNRESOLVED')),
 notes text NOT NULL DEFAULT '', parts text NOT NULL DEFAULT '', unresolved_issues text NOT NULL DEFAULT '',
 correction_reason text NOT NULL DEFAULT '', reviewed_by uuid REFERENCES staff_profiles(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(request_id,version)
);
CREATE TABLE technician_attachments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), request_id uuid NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
 technician_id uuid NOT NULL REFERENCES technicians(id) ON DELETE CASCADE,
 object_key text NOT NULL UNIQUE, content_type text NOT NULL CHECK(content_type IN ('image/jpeg','image/png','image/webp')),
 byte_size integer NOT NULL CHECK(byte_size>0 AND byte_size<=8388608),
 purpose text NOT NULL CHECK(purpose IN ('BEFORE','DIAGNOSIS','PARTS','AFTER','INSTALLATION')),
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN ('PENDING','READY')),
 report_id uuid REFERENCES technician_work_reports(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX technician_report_pending ON technician_work_reports(state,created_at DESC);
ALTER TABLE request_status_events ADD COLUMN actor_technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL;
