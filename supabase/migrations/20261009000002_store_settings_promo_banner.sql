-- Add promotional banner content and visibility to store_settings.
-- Pre-populate with the previously hardcoded translation strings so
-- the banner looks identical after deployment.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS promo_banner_en      TEXT,
  ADD COLUMN IF NOT EXISTS promo_banner_bs      TEXT,
  ADD COLUMN IF NOT EXISTS promo_banner_enabled BOOLEAN NOT NULL DEFAULT true;

UPDATE store_settings
  SET
    promo_banner_en      = COALESCE(promo_banner_en, 'Free Delivery on orders over 100 KM'),
    promo_banner_bs      = COALESCE(promo_banner_bs, 'Besplatna dostava za narudžbe iznad 100 KM'),
    promo_banner_enabled = COALESCE(promo_banner_enabled, true)
  WHERE id = 1;
