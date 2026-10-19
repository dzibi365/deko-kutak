-- Add optional hero image URL to the pages table.
-- Used by About.tsx to render a two-column hero when an image is uploaded.
-- No RLS changes needed: existing admin read/write and public read policies
-- cover all columns on the pages table automatically.

ALTER TABLE pages
  ADD COLUMN IF NOT EXISTS hero_image_url TEXT NULL;
