-- Add bilingual short description fields to products.
-- Plain text, nullable, no default — existing rows remain unchanged.
ALTER TABLE products
  ADD COLUMN short_description_en text,
  ADD COLUMN short_description_bs text;
