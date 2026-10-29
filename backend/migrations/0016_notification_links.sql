ALTER TABLE staff_notifications ADD COLUMN IF NOT EXISTS support_ticket_id uuid REFERENCES support_tickets(id) ON DELETE CASCADE;
ALTER TABLE customer_notifications ADD COLUMN IF NOT EXISTS related_path text;
CREATE INDEX IF NOT EXISTS mutation_results_fingerprint ON mutation_results(actor_scope,fingerprint,created_at);
