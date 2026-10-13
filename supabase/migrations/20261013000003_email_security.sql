-- Phase 5.2: CRIT-2 — Secure order confirmation email triggering
--
-- Root cause: send-order-email accepted a publicly-guessable order number
-- (DK-YYYY-NNNN, 9 000 possibilities/year) authenticated only with the
-- publicly-distributed anon key.  Any visitor could enumerate order numbers
-- and trigger unsolicited confirmation emails for real orders.
--
-- Fix: each order now carries a one-time UUID email_token set by the checkout
-- client (crypto.randomUUID()).  The send-order-email Edge Function atomically
-- claims the token (UPDATE … WHERE email_token = $1 AND email_sent_at IS NULL
-- RETURNING *) and rejects requests where the UPDATE returns no rows — covering
-- both unknown tokens and already-sent cases.  A 128-bit random UUID cannot be
-- guessed in practice and is tied to the specific order row.
--
-- email_token
--   Set by Checkout.tsx at submit time (crypto.randomUUID()).
--   DEFAULT gen_random_uuid() ensures existing orders and any future inserts
--   that omit the field still have a unique token; since no one knows those
--   tokens, they can never be used to trigger emails for historical orders.
--
-- email_sent_at
--   NULL until the EF atomically claims it before sending.
--   Reset to NULL by the EF on SMTP failure so the same token can be retried.
--
-- INSERT RLS tightening
--   Updated from WITH CHECK (true) to WITH CHECK (email_sent_at IS NULL) so
--   no client can insert an order with email_sent_at already set and thereby
--   permanently suppress its own confirmation email.

-- 1. email_token — generate random tokens for all existing rows so the NOT NULL
--    constraint can be applied immediately.  Historical tokens are unknown to any
--    client, so they cannot be used to trigger emails for past orders.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS email_token uuid NOT NULL DEFAULT gen_random_uuid();

-- 2. email_sent_at — tracks whether the confirmation email has been dispatched.
--    NULL = not yet sent (or SMTP failed and was reset by the EF).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz DEFAULT NULL;

-- 3. Tighten the public INSERT policy: prevent a client from pre-marking an
--    order as already-emailed (which would silently suppress confirmation).
--    Omitting email_sent_at in the INSERT payload uses the column DEFAULT (NULL),
--    which satisfies this check.  Explicitly passing email_sent_at = now() is
--    rejected.
ALTER POLICY "public insert orders" ON orders
  WITH CHECK (email_sent_at IS NULL);
