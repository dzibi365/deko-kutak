-- Phase 5.2A: Email reliability and abuse protection
--
-- 1. Extends order_notifications to track confirmation emails per recipient
--    so customer and owner emails are retried independently on failure.
--
-- 2. claim_confirmation_notification(): SECURITY DEFINER function that
--    atomically claims a per-email slot in order_notifications.
--    Returns the row id to send, or NULL if the email is already sent /
--    being processed.  Stale 'pending' claims (> 2 min) are reclaimed.
--
-- 3. Order creation rate limiting: 5 orders per hashed IP per hour via a
--    BEFORE INSERT trigger.  Reuses upload_rate_limits (prefixed key) so
--    no new table is needed.

-- ─── 1. Extend notification_type to include confirmation emails ───────────────
--
-- confirmation_customer — order confirmation sent to the buyer
-- confirmation_owner    — new-order alert sent to the store owner
--
-- The existing UNIQUE(order_id, notification_type) constraint provides
-- idempotency: one record per notification type per order.

ALTER TABLE order_notifications
  DROP CONSTRAINT IF EXISTS order_notifications_notification_type_check;

ALTER TABLE order_notifications
  ADD CONSTRAINT order_notifications_notification_type_check
  CHECK (notification_type IN (
    'shipped', 'delivered',
    'confirmation_customer', 'confirmation_owner'
  ));

-- ─── 2. Atomic per-email claim function ───────────────────────────────────────
--
-- The INSERT either creates a new 'pending' record (no prior send attempt)
-- or takes over an existing 'failed' / stale-'pending' record.
--
-- Returns the notification id that this worker should send, or NULL when:
--   • status = 'sent'                                       → skip (done)
--   • status = 'pending' AND created_at >= now()-2 min     → skip (in-flight)
--
-- The DO UPDATE … WHERE clause is a PostgreSQL conditional upsert: when the
-- WHERE is false (sent / recent pending) PostgreSQL treats it as DO NOTHING
-- and RETURNING returns no rows, leaving v_id as NULL.

CREATE OR REPLACE FUNCTION claim_confirmation_notification(
  p_order_id        BIGINT,
  p_type            TEXT,
  p_recipient_email TEXT,
  p_lang            TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  INSERT INTO order_notifications (order_id, notification_type, recipient_email, lang, status)
  VALUES (p_order_id, p_type, p_recipient_email, p_lang, 'pending')
  ON CONFLICT (order_id, notification_type) DO UPDATE
    SET status        = 'pending',
        created_at    = now(),
        error_message = NULL
    WHERE order_notifications.status = 'failed'
       OR (order_notifications.status = 'pending'
           AND order_notifications.created_at < now() - INTERVAL '2 minutes')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION claim_confirmation_notification(BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION claim_confirmation_notification(BIGINT, TEXT, TEXT, TEXT) TO service_role;

-- ─── 3. Order creation rate limiting ─────────────────────────────────────────
--
-- Limit: 5 orders per hashed IP per hour.
-- Reuses upload_rate_limits with an 'orders:' key prefix to avoid a new
-- table while preventing key collisions with upload entries.

CREATE OR REPLACE FUNCTION check_order_rate(
  p_ip_hash TEXT,
  p_limit   INT DEFAULT 5
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  INT;
  v_window TIMESTAMPTZ := date_trunc('hour', now());
  v_key    TEXT        := 'orders:' || p_ip_hash;
BEGIN
  INSERT INTO upload_rate_limits (ip_hash, window_start, upload_count)
  VALUES (v_key, v_window, 1)
  ON CONFLICT (ip_hash, window_start)
  DO UPDATE SET upload_count = upload_rate_limits.upload_count + 1
  RETURNING upload_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_order_rate(TEXT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION check_order_rate(TEXT, INT) TO service_role;

-- Trigger function: enforces per-IP rate limit on order INSERT.
-- Reads x-forwarded-for from PostgREST session headers; service_role
-- requests (admin panel, Edge Functions, migrations) bypass the limit.
-- Raises 'order_rate_limit_exceeded' so Checkout.tsx can show a localised
-- message without leaking internal details.

CREATE OR REPLACE FUNCTION enforce_order_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip_raw  TEXT;
  v_ip_hash TEXT;
  v_allowed BOOLEAN;
BEGIN
  -- service_role calls (admin, EFs, tests) bypass rate limiting.
  IF coalesce(current_setting('request.jwt.claims', true), '{}')::jsonb
       ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Extract leftmost IP from x-forwarded-for; fall back to a shared bucket
  -- if headers are absent (e.g. direct psql, pre-migration checks).
  BEGIN
    v_ip_raw := split_part(
      coalesce(
        current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for',
        '0.0.0.0'
      ),
      ',', 1
    );
  EXCEPTION WHEN OTHERS THEN
    v_ip_raw := '0.0.0.0';
  END;

  v_ip_hash := encode(sha256(btrim(v_ip_raw)::bytea), 'hex');
  v_allowed := check_order_rate(v_ip_hash, 5);

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'order_rate_limit_exceeded' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

-- Drop first in case this migration is re-run (idempotent deploy).
DROP TRIGGER IF EXISTS trg_orders_rate_limit ON orders;

CREATE TRIGGER trg_orders_rate_limit
  BEFORE INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION enforce_order_rate_limit();
