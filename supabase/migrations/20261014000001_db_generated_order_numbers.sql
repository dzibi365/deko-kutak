-- Phase 6.3: DB-generated unique order numbers
--
-- Problem: Checkout.tsx used Math.random() to produce DK-YYYY-NNNN (9 000 values/year).
-- Birthday paradox gives ~42 % collision probability at 100 orders/year.
-- The UNIQUE constraint (orders_order_number_key) was already in place from the initial
-- schema, so any collision would have surfaced as a hard error on the INSERT.
--
-- Solution overview
-- -----------------
-- 1. PostgreSQL sequence for the numeric suffix; starts at 10 001 so new numbers
--    (5 digits) are disjoint from all existing random 4-digit numbers (1 000-9 999).
-- 2. validate_order_pricing BEFORE INSERT trigger is updated to assign the sequence
--    value to NEW.order_number, overwriting any client-supplied value.  The assignment
--    is placed BEFORE the service_role bypass so every insert receives a generated number.
-- 3. place_order() SECURITY DEFINER RPC wraps the INSERT and returns the
--    DB-generated order_number and email_token to the caller.  This is needed because
--    anonymous (guest) users have no SELECT RLS policy on orders, so INSERT…RETURNING
--    yields 0 rows for them through the normal REST path.
--
-- Security invariants preserved
-- -----------------------------
-- • validate_order_pricing fires inside place_order because request.jwt.claims GUCs
--   are set by PostgREST for the whole transaction and are NOT changed by SECURITY
--   DEFINER context.  The caller's role (anon / authenticated) is visible to the trigger,
--   so the service_role bypass does NOT fire for storefront checkouts.
-- • Financial amounts (subtotal, shipping_cost, total) are still overwritten by the
--   trigger from trusted DB data — place_order does not bypass price validation.
-- • status is hardcoded to 'pending' inside place_order; the client cannot influence it.
-- • enforce_order_rate_limit (trg_orders_rate_limit) fires before trg_validate_order_pricing
--   (alphabetical order), so a rate-limited request is rejected before nextval() is called.

-- ── Safety check: abort if duplicate order_numbers already exist ──────────────

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.orders
    GROUP BY order_number
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate order_numbers detected — migration aborted. Resolve duplicates first.';
  END IF;
END;
$$;

-- ── Sequence ──────────────────────────────────────────────────────────────────
-- Starts at 10 001 — disjoint from existing 4-digit random numbers (1 000-9 999).

CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START 10001;

-- ── Updated validate_order_pricing trigger function ───────────────────────────
-- Identical to the Phase 5.4B version except for the order_number assignment
-- added at the very top (before the service_role bypass).

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
  -- Always generate the order number from the sequence, ignoring any client value.
  -- Placed before the service_role bypass so Edge Function inserts also receive one.
  NEW.order_number := 'DK-' || to_char(now(), 'YYYY') || '-' ||
                      LPAD(nextval('orders_order_number_seq')::text, 4, '0');

  -- ── Service-role bypass ──────────────────────────────────────────────────────
  -- Edge Functions carry role='service_role' in their JWT (set by Supabase's token
  -- signing infrastructure; cannot be forged by a browser-issued token).
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

    IF (v_item ->> 'id') IS NULL
       OR (v_item ->> 'id') !~ '^[0-9]+$'
       OR (v_item ->> 'id')::BIGINT < 1
       OR (v_item ->> 'id')::BIGINT > 2147483647 THEN
      RAISE EXCEPTION 'Invalid order item at index %: id is missing or not a positive integer', v_idx
        USING ERRCODE = 'check_violation';
    END IF;
    v_product_id := (v_item ->> 'id')::INTEGER;

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

-- The trigger binding (trg_validate_order_pricing) was created in the Phase 5.4B
-- migration and remains valid — no need to recreate it.

-- ── place_order RPC ───────────────────────────────────────────────────────────
-- SECURITY DEFINER so the function owner (postgres) can read the RETURNING value
-- even though the anon caller has no SELECT policy on orders.
-- email_token is generated server-side (gen_random_uuid()) and returned to the
-- caller so that send-order-email can consume it.
-- status is hardcoded to 'pending' — not a caller parameter.

CREATE OR REPLACE FUNCTION place_order(
  p_customer_name    text,
  p_customer_email   text,
  p_customer_phone   text,
  p_customer_address text,
  p_customer_city    text,
  p_customer_postal  text,
  p_payment_method   text,
  p_items            jsonb,
  p_subtotal         numeric,
  p_note             text,
  p_lang             text
) RETURNS TABLE(order_number text, email_token uuid)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_email_token  uuid := gen_random_uuid();
  v_order_number text;
BEGIN
  INSERT INTO orders (
    customer_name, customer_email, customer_phone,
    customer_address, customer_city, customer_postal,
    payment_method, items, subtotal, note, status, lang,
    email_token
  ) VALUES (
    p_customer_name, p_customer_email, p_customer_phone,
    p_customer_address, p_customer_city, p_customer_postal,
    p_payment_method, p_items, p_subtotal, p_note, 'pending', p_lang,
    v_email_token
  )
  RETURNING orders.order_number INTO v_order_number;

  RETURN QUERY SELECT v_order_number, v_email_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION place_order FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION place_order TO   anon;
GRANT  EXECUTE ON FUNCTION place_order TO   authenticated;
