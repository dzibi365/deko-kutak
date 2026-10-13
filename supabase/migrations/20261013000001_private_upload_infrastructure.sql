-- Phase 4.2C-3B: Private Upload Infrastructure
--
-- Creates two tables:
--   upload_sessions    — upload session records; credentials stored as SHA-256 hashes
--   upload_rate_limits — atomic per-IP hourly upload rate limiting
--
-- Creates two helper functions:
--   check_upload_rate(p_ip_hash, p_limit) — atomic rate check + increment
--   cleanup_upload_infrastructure()       — stale row cleanup (for cron job)
--
-- This migration does NOT change the customer-uploads bucket configuration.
-- The bucket remains public and the existing anon INSERT policy stays active.
-- The new Edge Functions (customer-upload, sign-image-url) use these tables.
--
-- PRE-FLIGHT NOTES
--   orders.id is BIGINT (confirmed: order_notifications.order_id references it as bigint).
--   Partial indexes use static predicates only — no now() in WHERE clauses.

-- ─── upload_sessions ──────────────────────────────────────────────────────────
--
-- Each row represents one customer upload.  The plaintext token is generated
-- server-side in the Edge Function and never stored here; only its SHA-256 hex
-- digest is stored so a DB leak cannot yield usable bearer tokens.
--
-- expires_at defaults to 7 days — generous enough that a customer who adds a
-- personalized item to their cart on a Friday and buys the following weekend
-- is not forced to re-upload.  After checkout the photo is accessed via order
-- ownership (Phase 4.2C-4), so the token TTL only matters during the cart phase.

CREATE TABLE upload_sessions (
  id         BIGSERIAL    PRIMARY KEY,
  token_hash TEXT         NOT NULL UNIQUE,
  path       TEXT         NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ  NOT NULL DEFAULT now() + INTERVAL '7 days',
  revoked_at TIMESTAMPTZ  NULL,
  order_id   BIGINT       REFERENCES orders(id) ON DELETE SET NULL,

  CONSTRAINT upload_sessions_path_format CHECK (
    path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  )
);

-- Fast token lookup for the sign-image-url Edge Function.
-- Partial predicate (revoked_at IS NULL) keeps the index lean — revoked rows
-- are never queried through this path and are excluded from the index.
-- IMPORTANT: no now() here — partial predicates are evaluated at index creation
-- time and would become permanently stale if they contained time functions.
CREATE INDEX idx_upload_sessions_token_hash_active
  ON upload_sessions (token_hash)
  WHERE revoked_at IS NULL;

-- Path lookup for the order-ownership validation planned in Phase 4.2C-4.
CREATE INDEX idx_upload_sessions_path ON upload_sessions (path);

ALTER TABLE upload_sessions ENABLE ROW LEVEL SECURITY;

-- Administrators can inspect sessions for debugging and moderation.
-- All write access (INSERT, UPDATE) goes through Edge Functions via service role,
-- which bypasses RLS entirely — no write policies are needed or desired here.
CREATE POLICY "admin read upload_sessions"
  ON upload_sessions FOR SELECT TO authenticated
  USING (is_admin());

-- ─── upload_rate_limits ───────────────────────────────────────────────────────
--
-- Tracks upload attempt counts per hashed IP per one-hour window.
-- The check_upload_rate() function performs atomic increment + comparison
-- in a single statement, preventing concurrent bypass.

CREATE TABLE upload_rate_limits (
  ip_hash      TEXT        NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  upload_count INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (ip_hash, window_start)
);

ALTER TABLE upload_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: this table is accessed exclusively through the
-- check_upload_rate() SECURITY DEFINER function, never via PostgREST directly.

-- ─── check_upload_rate ────────────────────────────────────────────────────────
--
-- Atomically increments the counter for (ip_hash, current_hour) and returns
-- TRUE if the resulting count is within p_limit, FALSE if exceeded.
--
-- Uses INSERT ... ON CONFLICT DO UPDATE so both the insert and increment are
-- a single serialised operation — concurrent requests from the same IP cannot
-- both read a count below the limit and both be allowed through.

CREATE OR REPLACE FUNCTION public.check_upload_rate(
  p_ip_hash TEXT,
  p_limit   INT DEFAULT 10
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count  INT;
  v_window TIMESTAMPTZ := date_trunc('hour', now());
BEGIN
  INSERT INTO upload_rate_limits (ip_hash, window_start, upload_count)
  VALUES (p_ip_hash, v_window, 1)
  ON CONFLICT (ip_hash, window_start)
  DO UPDATE SET upload_count = upload_rate_limits.upload_count + 1
  RETURNING upload_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

-- Restrict callers to the service_role used by Edge Functions.
-- anon and authenticated must not be able to call this directly via PostgREST.
REVOKE EXECUTE ON FUNCTION public.check_upload_rate(TEXT, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_upload_rate(TEXT, INT) TO service_role;

-- ─── cleanup_upload_infrastructure ───────────────────────────────────────────
--
-- Removes stale rate-limit rows (older than 25 hours — one full window plus a
-- buffer).  Intended to be called by a pg_cron job; not used yet in this phase.

CREATE OR REPLACE FUNCTION public.cleanup_upload_infrastructure()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM upload_rate_limits
  WHERE window_start < now() - INTERVAL '25 hours';
$$;

REVOKE EXECUTE ON FUNCTION public.cleanup_upload_infrastructure() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.cleanup_upload_infrastructure() TO service_role;
