CREATE OR REPLACE FUNCTION next_customer_reference() RETURNS text LANGUAGE sql VOLATILE AS $$ SELECT 'CUS-' || lpad(value::text,GREATEST(8,length(value::text)),'0') FROM (SELECT nextval('customer_reference_seq') AS value) n $$;
ALTER TABLE customers ALTER COLUMN customer_reference SET DEFAULT next_customer_reference();
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS review_id uuid UNIQUE REFERENCES request_reviews(id) ON DELETE SET NULL;
