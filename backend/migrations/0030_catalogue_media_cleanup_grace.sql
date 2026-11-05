ALTER TABLE catalogue_media ADD COLUMN IF NOT EXISTS last_selected_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS catalogue_media_cleanup_age ON catalogue_media(last_selected_at);
