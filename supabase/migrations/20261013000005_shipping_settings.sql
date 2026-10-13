-- Phase 5.4A: Shipping configuration in store_settings
--
-- Adds two configurable columns to store_settings:
--   shipping_cost            — the flat delivery fee charged per order (KM)
--   free_shipping_threshold  — product subtotal at which shipping becomes free (KM)
--
-- Defaults reflect the approved business rules:
--   shipping_cost            = 10.00 KM
--   free_shipping_threshold  = 100.00 KM
--
-- Existing row (id = 1) automatically receives the defaults via PostgreSQL's
-- ADD COLUMN ... DEFAULT ... backfill (no explicit UPDATE required).
--
-- RLS is unchanged: the existing "public read store_settings" (USING true) policy
-- allows the storefront anon client to read both new columns for shipping display.
-- The existing "admin write store_settings" policy restricts writes to admins.
--
-- Phase 5.4B (pending approval) will add shipping_cost and total columns to orders
-- and a BEFORE INSERT trigger that validates prices and calculates amounts
-- server-side, making it impossible for clients to submit manipulated totals.

ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS shipping_cost           NUMERIC(10,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS free_shipping_threshold NUMERIC(10,2) NOT NULL DEFAULT 100.00;

ALTER TABLE store_settings
  ADD CONSTRAINT store_settings_shipping_cost_nonneg  CHECK (shipping_cost >= 0),
  ADD CONSTRAINT store_settings_threshold_positive     CHECK (free_shipping_threshold > 0);
