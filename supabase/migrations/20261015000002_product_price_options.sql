-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 5.5 – Product price options (purchase variants)
-- ══════════════════════════════════════════════════════════════════════════════
--
-- BASELINE
-- --------
-- The live validate_order_pricing() function is from 20261014000002_fix_order_number_lpad.sql.
-- This migration replaces it (CREATE OR REPLACE) using that exact body as the
-- baseline, with two modifications only:
--   1. DECLARE adds v_price_options JSONB and v_option_id TEXT.
--   2. The per-item price-fetch block is extended with variant branching.
--
-- SECURITY NOTES
-- --------------
-- SET search_path = public is restored on validate_order_pricing (it was present
-- in 20261013000006, inadvertently dropped in 20261014000001/20261014000002).
-- All other security properties — SECURITY DEFINER, service_role bypass,
-- rate-limit trigger, protect_order_financials trigger — are unchanged.
--
-- ORDER NUMBER
-- ------------
-- NEW.order_number is preserved as the first statement before the service_role
-- bypass, exactly as in the 20261014000002 baseline:
--   'DK-' || to_char(now(), 'YYYY') || '-' || nextval('orders_order_number_seq')::text
--
-- VARIANT PRICING MODEL
-- ---------------------
-- price_options IS NOT NULL  → variant product; option_id required in every
--                              order item; price read exclusively from price_options.
-- price_options IS NULL      → existing behaviour; option_id must be absent.
--
-- BACKWARD COMPATIBILITY
-- ----------------------
-- price_options column is nullable with no default. All existing rows get NULL.
-- Existing checkout, orders and order emails are unaffected.

-- ─── 1. JSON validation function ─────────────────────────────────────────────
-- IMMUTABLE: reads only its argument, no DB access. Safe for CHECK constraint.

CREATE OR REPLACE FUNCTION check_price_options(opts jsonb)
RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  item       jsonb;
  seen_ids   text[]  := '{}';
  oid        text;
  olabel_en  text;
  olabel_bs  text;
  oprice     numeric;
BEGIN
  -- NULL is valid (product has no variants)
  IF opts IS NULL THEN
    RETURN true;
  END IF;

  -- Must be a JSON array
  IF jsonb_typeof(opts) != 'array' THEN
    RETURN false;
  END IF;

  -- Between 2 and 10 options
  IF jsonb_array_length(opts) < 2 OR jsonb_array_length(opts) > 10 THEN
    RETURN false;
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(opts) LOOP
    -- id: non-empty string, unique within array
    oid := trim(item ->> 'id');
    IF oid IS NULL OR oid = '' THEN
      RETURN false;
    END IF;
    IF oid = ANY(seen_ids) THEN
      RETURN false;
    END IF;
    seen_ids := array_append(seen_ids, oid);

    -- label_en: non-empty string
    olabel_en := trim(item ->> 'label_en');
    IF olabel_en IS NULL OR olabel_en = '' THEN
      RETURN false;
    END IF;

    -- label_bs: non-empty string
    olabel_bs := trim(item ->> 'label_bs');
    IF olabel_bs IS NULL OR olabel_bs = '' THEN
      RETURN false;
    END IF;

    -- price: parseable, positive, finite, <= 99999
    BEGIN
      oprice := (item ->> 'price')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RETURN false;
    END;
    IF oprice IS NULL OR oprice <= 0 OR oprice > 99999 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- ─── 2. Column on products ────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS price_options jsonb;

ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_price_options_valid;

ALTER TABLE products
  ADD CONSTRAINT products_price_options_valid
  CHECK (check_price_options(price_options));

-- ─── 3. Updated validate_order_pricing trigger ───────────────────────────────
-- Baseline: 20261014000002_fix_order_number_lpad.sql (the currently deployed version).
-- Changes from baseline:
--   a) SET search_path = public restored (was in 20261013000006, dropped in 20261014000001/02).
--   b) DECLARE: adds v_price_options JSONB and v_option_id TEXT.
--   c) Per-item price fetch: SELECT now fetches both price and price_options; the
--      single-branch price check is replaced with variant/non-variant branching.
-- Everything else (order_number generation, service_role bypass, items validation,
-- quantity checks, id format checks, shipping logic, financial overwrite) is
-- byte-for-byte identical to the baseline.

CREATE OR REPLACE FUNCTION validate_order_pricing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_claims    JSONB;
  v_idx           INTEGER;
  v_len           INTEGER;
  v_item          JSONB;
  v_product_id    INTEGER;
  v_quantity      INTEGER;
  v_unit_price    NUMERIC(10,2);
  v_price_options JSONB;
  v_option_id     TEXT;
  v_calc_subtotal NUMERIC(10,2) := 0;
  v_shipping_cost NUMERIC(10,2);
  v_threshold     NUMERIC(10,2);
BEGIN
  -- DB-generated order number — no LPAD: sequence values are already 5+ digits
  -- (START 10001) and LPAD truncates strings longer than the target width.
  -- Placed before service_role bypass so Edge Function inserts also receive one.
  NEW.order_number := 'DK-' || to_char(now(), 'YYYY') || '-' ||
                      nextval('orders_order_number_seq')::text;

  -- ── Service-role bypass ──────────────────────────────────────────────────────
  BEGIN
    v_jwt_claims := current_setting('request.jwt.claims', true)::JSONB;
  EXCEPTION WHEN OTHERS THEN
    v_jwt_claims := '{}'::JSONB;
  END;

  IF (v_jwt_claims ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- ── Validate items JSONB ─────────────────────────────────────────────────────

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

  -- ── Validate and price each item ─────────────────────────────────────────────

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

    -- Fetch trusted price and variant configuration from DB.
    -- products.compare_price is the display-only "was" price and is never billed.
    -- price_options IS NOT NULL means this product requires a variant selection.
    SELECT price, price_options
    INTO   v_unit_price, v_price_options
    FROM   products
    WHERE  id = v_product_id
      AND  in_stock = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Product % is no longer available. Please refresh and update your cart.',
        v_product_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Normalise option_id: absent key and empty string are both treated as NULL.
    v_option_id := nullif(trim(v_item ->> 'option_id'), '');

    IF v_price_options IS NOT NULL THEN
      -- ── Variant product ──────────────────────────────────────────────────────
      -- option_id is mandatory; price comes exclusively from price_options.
      -- No fallback to products.price — a missing or unknown option is rejected.

      IF v_option_id IS NULL THEN
        RAISE EXCEPTION
          'Product % requires a variant to be selected.',
          v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

      SELECT (opt ->> 'price')::numeric(10,2)
      INTO   v_unit_price
      FROM   jsonb_array_elements(v_price_options) AS opt
      WHERE  opt ->> 'id' = v_option_id
      LIMIT  1;

      IF NOT FOUND OR v_unit_price IS NULL OR v_unit_price <= 0 THEN
        RAISE EXCEPTION
          'Invalid variant "%" for product %.',
          v_option_id, v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

    ELSE
      -- ── Non-variant product ──────────────────────────────────────────────────
      -- option_id must be absent; any submitted value is rejected to prevent
      -- injection of option_id onto non-variant products.

      IF v_option_id IS NOT NULL THEN
        RAISE EXCEPTION
          'Product % does not support variants.',
          v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

      IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
        RAISE EXCEPTION
          'Product % has no valid price configured.',
          v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

    END IF;

    v_calc_subtotal := v_calc_subtotal + (v_unit_price * v_quantity);
  END LOOP;

  -- ── Read shipping configuration ──────────────────────────────────────────────

  SELECT shipping_cost, free_shipping_threshold
  INTO   v_shipping_cost, v_threshold
  FROM   store_settings
  WHERE  id = 1;

  IF NOT FOUND THEN
    v_shipping_cost := 10.00;
    v_threshold     := 100.00;
  END IF;

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

-- Trigger binding unchanged; DROP+CREATE ensures the updated function is active.
DROP TRIGGER IF EXISTS trg_validate_order_pricing ON orders;
CREATE TRIGGER trg_validate_order_pricing
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION validate_order_pricing();
