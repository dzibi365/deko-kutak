-- Phase 6.3 fix: correct order_number format in trigger
--
-- Bug: LPAD(nextval::text, 4, '0') silently truncates 5-digit sequence values.
-- LPAD('10001', 4, '0') → '1000' (PostgreSQL truncates, not pads, when input
-- exceeds target width).  Sequence values 10001-10009 would all produce 'DK-2026-1000',
-- immediately hitting the UNIQUE constraint on the second insert.
--
-- Fix: remove LPAD entirely.  Sequence values are 5+ digits by design (START 10001),
-- so they need no zero-padding and must not be truncated.
-- New format: DK-YYYY-10001, DK-YYYY-10002, ...  Still clearly distinct from the
-- old 4-digit random numbers (1000-9999) that historical orders carry.
--
-- Cleanup: the single test order created during verification (id=45,
-- customer_email='a@test.invalid', order_number='DK-2026-1000') is deleted
-- since it is not a real customer order.

DELETE FROM orders WHERE customer_email = 'a@test.invalid';

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
  -- DB-generated order number — no LPAD: sequence values are already 5+ digits
  -- (START 10001) and LPAD truncates strings longer than the target width.
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
