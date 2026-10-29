ALTER TABLE service_requests ADD COLUMN display_number bigint GENERATED ALWAYS AS IDENTITY;
CREATE UNIQUE INDEX service_requests_display_number_unique ON service_requests(display_number);
