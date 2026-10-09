-- Add Viber and WhatsApp contact numbers to store_settings.
-- Pre-populate row 1 with the previously hardcoded numbers so the
-- frontend continues to show the correct buttons after deployment.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS contact_viber     TEXT,
  ADD COLUMN IF NOT EXISTS contact_whatsapp  TEXT;

UPDATE store_settings
  SET
    contact_viber    = COALESCE(contact_viber,    '+38761498340'),
    contact_whatsapp = COALESCE(contact_whatsapp, '+38761498340')
  WHERE id = 1;
