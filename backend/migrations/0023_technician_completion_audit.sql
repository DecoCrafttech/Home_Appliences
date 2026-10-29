ALTER TABLE completion_reports
  ADD COLUMN completed_by_technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL;

ALTER TABLE technician_work_reports
  ADD COLUMN reviewed_by_technician_id uuid REFERENCES technicians(id) ON DELETE SET NULL;
