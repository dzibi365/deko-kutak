-- Phase 4.2A.2: Secure order ownership using user_id
--
-- PRE-MIGRATION INSPECTION (confirmed before writing this file)
--   information_schema.triggers WHERE trigger_schema = 'public': 0 rows
--   pg_proc WHERE proname LIKE '%order%' AND pronamespace = public:  0 rows
--   No existing triggers or functions conflict with this migration.
--
-- DEPLOYMENT NOTE
--   This migration removes the email-based customer SELECT policy and replaces it
--   with user_id-based ownership in a single step.  The transition window between
--   applying this migration and the new frontend bundle deploying on Vercel is
--   ~30–60 seconds.  During that window the old Account.tsx bundle queries by
--   customer_email; with the email policy gone it returns zero rows.
--
--   Impact assessment: zero real regression for this store.  All 13 existing
--   orders predate this migration and have user_id = NULL.  No authenticated
--   customer currently sees any orders via the email policy (the only customer_email
--   that matches an auth account is karic104@gmail.com, the admin, who views
--   orders through the admin panel, not the customer Account page).
--
-- TRIGGER STRATEGY
--   user_id is stamped server-side by a BEFORE INSERT trigger that calls auth.uid().
--   Any client-supplied user_id in the INSERT payload is silently overwritten.
--   Checkout.tsx requires no changes — the trigger handles ownership assignment
--   without trusting client-supplied values.
--   Guest checkout: auth.uid() returns NULL → user_id = NULL.
--   Authenticated checkout: auth.uid() returns the caller's UUID → user_id set.

-- ─── 1. Column ────────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for Account.tsx query: .eq("user_id", user.id)
CREATE INDEX idx_orders_user_id ON orders (user_id);

-- ─── 2. Trigger function ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_order_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Overwrite whatever the client sent with the server-verified JWT uid.
  -- auth.uid() reads request.jwt.claims set by PostgREST per request — it is
  -- not user-controlled and is NULL for anon sessions (guest checkout).
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;

-- Trigger functions called via CREATE TRIGGER do not require an explicit GRANT.
-- Do not expose this function as a callable RPC — no GRANT to public/anon.

-- ─── 3. Trigger ───────────────────────────────────────────────────────────────

-- BEFORE INSERT: fires before RLS WITH CHECK evaluates the row, so the
-- trigger-modified user_id is what the policy sees.
CREATE TRIGGER trg_orders_set_user_id
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_user_id();

-- ─── 4. RLS — replace email-based SELECT policy ───────────────────────────────

-- Remove the email-matching policy introduced in Phase 4.2A.
DROP POLICY "customer read own orders" ON orders;

-- Customers see only orders they placed while authenticated (user_id = their UUID).
-- Guest orders (user_id IS NULL) are not visible in any customer account.
-- Administrators see all orders via the existing "admin read orders" policy.
CREATE POLICY "customer read own orders"
  ON orders FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- "admin read orders"   — unchanged (USING is_admin())
-- "admin update orders" — unchanged (USING + WITH CHECK is_admin())
-- "public insert orders"— unchanged (trigger enforces ownership server-side;
--                          client-supplied user_id is overwritten before CHECK)
