-- Phase 5.4B: Server-side order pricing validation
--
-- SECURITY MODEL
-- --------------
-- Before this migration, Checkout.tsx inserted a browser-supplied `subtotal`
-- directly into the orders table via the anon key.  A malicious caller could
-- POST subtotal=0.01 directly to the REST API and bypass the storefront UI.
--
-- This migration makes every INSERT go through a BEFORE INSERT trigger that:
--   1. Rejects malformed items JSONB (not an array, missing fields, etc.)
--   2. Rejects zero, negative, non-integer, or out-of-range quantities
--   3. Validates every product ID against products (must exist, in_stock = true)
--   4. Calculates subtotal exclusively from products.price (trusted DB source)
--      products.compare_price is the display-only "was" price and is never billed
--   5. Reads shipping_cost and free_shipping_threshold from store_settings
--   6. Applies free-shipping logic server-side
--   7. Overwrites NEW.subtotal, NEW.shipping_cost, and NEW.total unconditionally
--   8. Skips validation only when the JWT role is 'service_role' (Edge Functions)
--
-- A second BEFORE UPDATE trigger prevents any caller from modifying financial
-- columns after an order is placed (service_role excepted).
--
-- HISTORICAL ORDERS
-- -----------------
-- Existing orders used subtotal as the only amount field.  Backfill:
--   shipping_cost = 0        (no shipping was charged at order time)
--   total         = subtotal (full historical order value preserved)
-- New shipping fees are NOT applied retroactively.

-- ─── New columns ─────────────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total         NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD CONSTRAINT orders_shipping_cost_nonneg CHECK (shipping_cost >= 0),
  ADD CONSTRAINT orders_total_nonneg         CHECK (total         >= 0);

-- ─── Backfill historical rows ─────────────────────────────────────────────────

UPDATE orders
SET total = subtotal
WHERE total = 0 AND subtotal > 0;

-- ─── validate_order_pricing — BEFORE INSERT ────────────────────────────────────

CREATE OR REPLACE FUNCTION validate_order_pricing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_jwt_claims    JSONB;
  v_idx           INTEGER;
  v_len           INTEGER;
  v_item          JSONB;
  v_product_id    INTEGER;
  v_quantity      INTEGER;
  v_unit_price    NUMERIC(10,2);
  v_calc_subtotal NUMERIC(10,2) := 0;
  v_shipping_cost NUMERIC(10,2);
  v_threshold     NUMERIC(10,2);
BEGIN
  -- ── Service-role bypass ──────────────────────────────────────────────────────
  -- Edge Functions run with SUPABASE_SERVICE_ROLE_KEY and carry role='service_role'
  -- in their JWT.  This claim is set by Supabase's token signing infrastructure
  -- and cannot be set by a browser-issued anon or authenticated token.
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := '{}'::JSONB;
  END;

  IF (v_jwt_claims ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- ── Validate items JSONB ────────────────────────────────────────────────────

  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) != 'array' THEN
    RAISE EXCEPTION 'Invalid order: items must be a non-null JSON array'
      USING ERRCODE = 'check_violation';
  END IF;

  v_len := jsonb_array_length(NEW.items);

  IF v_len = 0 THEN
    RAISE EXCEPTION 'Invalid order: items array must not be empty'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_len > 50 THEN
    RAISE EXCEPTION 'Invalid order: too many items (max 50)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Validate and price each item ────────────────────────────────────────────

  FOR v_idx IN 0..(v_len - 1) LOOP
    v_item := NEW.items -> v_idx;

    -- product id: must be a positive integer representable as INTEGER
    IF (v_item ->> 'id') IS NULL
       OR (v_item ->> 'id') !~ '^[0-9]+$'
       OR (v_item ->> 'id')::BIGINT < 1
       OR (v_item ->> 'id')::BIGINT > 2147483647 THEN
      RAISE EXCEPTION 'Invalid order item at index %: id is missing or not a positive integer', v_idx
        USING ERRCODE = 'check_violation';
    END IF;
    v_product_id := (v_item ->> 'id')::INTEGER;

    -- quantity: must be a positive integer ≤ 100
    IF (v_item ->> 'quantity') IS NULL
       OR (v_item ->> 'quantity') !~ '^[0-9]+$'
       OR (v_item ->> 'quantity')::BIGINT < 1
       OR (v_item ->> 'quantity')::BIGINT > 100 THEN
      RAISE EXCEPTION
        'Invalid order item: quantity for product % must be an integer between 1 and 100',
        v_product_id
        USING ERRCODE = 'check_violation';
    END IF;
    v_quantity := (v_item ->> 'quantity')::INTEGER;

    -- fetch trusted unit price from DB
    -- products.price is the current selling price
    -- products.compare_price is the crossed-out display price only — never billed
    SELECT price INTO v_unit_price
    FROM   products
    WHERE  id = v_product_id
      AND  in_stock = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Product % is no longer available. Please refresh and update your cart.',
        v_product_id
        USING ERRCODE = 'check_violation';
    END IF;

    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION
        'Product % has no valid price configured.',
        v_product_id
        USING ERRCODE = 'check_violation';
    END IF;

    v_calc_subtotal := v_calc_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  -- ── Read shipping configuration ──────────────────────────────────────────────

  SELECT shipping_cost, free_shipping_threshold
  INTO   v_shipping_cost, v_threshold
  FROM   store_settings
  WHERE  id = 1;

  IF NOT FOUND THEN
    -- Safe defaults if store_settings is somehow missing
    v_shipping_cost := 10.00;
    v_threshold     := 100.00;
  END IF;

  -- Apply free-shipping rule: product subtotal >= threshold → shipping = 0
  IF v_calc_subtotal >= v_threshold THEN
    v_shipping_cost := 0.00;
  END IF;

  -- ── Overwrite client-supplied amounts with server-calculated values ─────────

  NEW.subtotal      := v_calc_subtotal;
  NEW.shipping_cost := v_shipping_cost;
  NEW.total         := v_calc_subtotal + v_shipping_cost;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_pricing ON orders;
CREATE TRIGGER trg_validate_order_pricing
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_pricing();

-- ─── protect_order_financials — BEFORE UPDATE ──────────────────────────────────
-- Prevents any caller from modifying subtotal, shipping_cost, or total after an
-- order is placed.  Admin status updates (Orders.tsx) only touch the status
-- column and are unaffected (the early-exit check passes immediately).
-- service_role is permitted to change financial columns for server-side
-- corrections (e.g. future refund/adjustment tooling).

CREATE OR REPLACE FUNCTION protect_order_financials()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_jwt_claims JSONB;
BEGIN
  -- No financial column is being changed — allow unconditionally.
  IF OLD.subtotal       IS NOT DISTINCT FROM NEW.subtotal
     AND OLD.shipping_cost IS NOT DISTINCT FROM NEW.shipping_cost
     AND OLD.total         IS NOT DISTINCT FROM NEW.total
  THEN
    RETURN NEW;
  END IF;

  -- A financial column is being changed — only service_role may do this.
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := '{}'::JSONB;
  END;

  IF (v_jwt_claims ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Order financial amounts cannot be modified after placement'
    USING ERRCODE = 'check_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_order_financials ON orders;
CREATE TRIGGER trg_protect_order_financials
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION protect_order_financials();
