-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 7 Step 3: Updated validate_order_pricing trigger
-- ══════════════════════════════════════════════════════════════════════════════
--
-- BASELINE
-- --------
-- The live function is from 20261015000002_product_price_options.sql.
-- This migration replaces it using that exact body as the baseline, with these
-- changes only:
--   1. All item validation and pricing is delegated to internal_calculate_order_totals.
--   2. TOCTOU guard: if app.expected_total is set in the current transaction
--      (via place_order's set_config), the calculated total is compared against
--      it; a mismatch raises PRICE_CHANGED.
--
-- WHAT IS UNCHANGED (byte-for-byte identical logic)
-- --------------------------------------------------
-- • DB-generated order_number from orders_order_number_seq (no LPAD).
-- • order_number is assigned before the service_role bypass.
-- • service_role bypass using request.jwt.claims.
-- • Financial columns overwritten: NEW.subtotal, NEW.shipping_cost, NEW.total.
-- • Trigger binding: trg_validate_order_pricing (already exists from 20261013000006).
-- • SECURITY DEFINER, SET search_path = public.
--
-- TOCTOU GUARD
-- ------------
-- place_order (migration 20261016000004) calls set_config('app.expected_total', x, true)
-- before the INSERT when p_expected_total is provided.  The is_local=true flag
-- makes the value transaction-local — it vanishes on commit or rollback.
-- If the value is absent or empty, the guard is skipped (legacy behaviour).
-- If present: ABS(expected - calculated) >= 0.01 → PRICE_CHANGED exception.
-- Both values are NUMERIC(10,2) (exact decimal arithmetic), so any nonzero
-- difference is a real price change — a 1-cent (0.01 KM) discrepancy is caught.
--
-- SECURITY NOTES
-- --------------
-- set_config is callable by any role, but only place_order (SECURITY DEFINER)
-- is the intended setter.  An attacker who sets app.expected_total to a wrong
-- value can only cause their own order to fail — they cannot force an order at
-- an incorrect price, because the trigger ALWAYS overwrites financial columns.
--
-- ROLLBACK
-- --------
-- Restore the 20261015000002 function body (the exact body is the baseline
-- above; it is preserved in git history and in the migration file itself).

CREATE OR REPLACE FUNCTION public.validate_order_pricing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_claims     JSONB;
  v_calc_subtotal  NUMERIC(10,2);
  v_calc_shipping  NUMERIC(10,2);
  v_calc_total     NUMERIC(10,2);
  v_expected_raw   TEXT;
  v_expected_total NUMERIC(10,2);
BEGIN

  -- ── DB-generated order number ────────────────────────────────────────────────
  -- Assigned before the service_role bypass so every insert gets a number.
  -- No LPAD: sequence starts at 10001 and values are always 5+ digits.
  NEW.order_number := 'DK-' || to_char(now(), 'YYYY') || '-' ||
                      nextval('orders_order_number_seq')::text;

  -- ── Service-role bypass ──────────────────────────────────────────────────────
  -- Edge Functions carry role='service_role' in their JWT (set by Supabase's
  -- token signing infrastructure; cannot be forged by a browser token).
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := '{}'::JSONB;
  END;

  IF (v_jwt_claims ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- ── Delegate all validation and pricing to the shared calculator ─────────────
  -- internal_calculate_order_totals validates items, variants, add-ons, and
  -- shipping.  Any invalid input raises an exception that surfaces to the caller.
  SELECT subtotal, shipping_cost, total
  INTO   v_calc_subtotal, v_calc_shipping, v_calc_total
  FROM   internal_calculate_order_totals(NEW.items);

  -- ── TOCTOU expected-total guard ──────────────────────────────────────────────
  -- If place_order set app.expected_total for this transaction, compare it to
  -- the freshly calculated total.  A mismatch means a price changed between
  -- verify_order_pricing and place_order — reject with PRICE_CHANGED.
  v_expected_raw := coalesce(current_setting('app.expected_total', true), '');
  IF v_expected_raw <> '' THEN
    BEGIN
      v_expected_total := v_expected_raw::NUMERIC(10,2);
    EXCEPTION WHEN OTHERS THEN
      v_expected_total := NULL;
    END;
    IF v_expected_total IS NOT NULL
       AND abs(v_expected_total - v_calc_total) >= 0.01 THEN
      RAISE EXCEPTION 'PRICE_CHANGED'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- ── Overwrite client-supplied amounts with server-calculated values ─────────
  NEW.subtotal      := v_calc_subtotal;
  NEW.shipping_cost := v_calc_shipping;
  NEW.total         := v_calc_total;

  RETURN NEW;
END;
$$;

-- Trigger binding already exists from 20261013000006; recreate to guarantee
-- it points to the updated function and fires on BEFORE INSERT.
DROP TRIGGER IF EXISTS trg_validate_order_pricing ON orders;
CREATE TRIGGER trg_validate_order_pricing
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_pricing();
