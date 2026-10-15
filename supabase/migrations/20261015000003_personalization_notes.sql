-- Add optional per-product personalization notes (bilingual).
-- Both columns are nullable with no default; existing rows are unaffected.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS personalization_note_en TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS personalization_note_bs TEXT DEFAULT NULL;
