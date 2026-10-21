-- ══════════════════════════════════════════════════════════════════════════════
-- Add bilingual bank transfer notes to store_settings
-- Migration: 20261025000001_add_bank_transfer_notes.sql
--
-- Adds bank_transfer_note_bs and bank_transfer_note_en as nullable TEXT columns.
-- Populates defaults on the existing row (id=1) when the columns are NULL.
-- Backward-compatible: no existing columns dropped, no constraints tightened.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS bank_transfer_note_bs TEXT,
  ADD COLUMN IF NOT EXISTS bank_transfer_note_en TEXT;

UPDATE public.store_settings
SET
  bank_transfer_note_bs = 'Molimo da prilikom uplate u polje „Svrha plaćanja" navedete broj svoje narudžbe. Narudžba se obrađuje nakon evidentiranja uplate na naš račun.',
  bank_transfer_note_en = 'Please include your order number in the payment reference field when making the transfer. Your order will be processed once the payment has been received in our bank account.'
WHERE id = 1
  AND bank_transfer_note_bs IS NULL;

-- ── ROLLBACK ─────────────────────────────────────────────────────────────────
--   ALTER TABLE public.store_settings
--     DROP COLUMN IF EXISTS bank_transfer_note_bs,
--     DROP COLUMN IF EXISTS bank_transfer_note_en;
