CREATE TABLE IF NOT EXISTS technicians (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),full_name text NOT NULL,phone text NOT NULL,active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS assigned_technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS confirmed_date date;
ALTER TABLE service_requests ADD COLUMN IF NOT EXISTS confirmed_time_window text;
