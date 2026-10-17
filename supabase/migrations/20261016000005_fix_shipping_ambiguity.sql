CREATE OR REPLACE FUNCTION public.internal_calculate_order_totals(p_items JSONB)
RETURNS TABLE(subtotal NUMERIC(10,2), shipping_cost NUMERIC(10,2), total NUMERIC(10,2))
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_idx              INTEGER;
  v_len              INTEGER;
  v_item             JSONB;
  v_product_id       INTEGER;
  v_quantity         INTEGER;
  v_unit_price       NUMERIC(10,2);
  v_price_options    JSONB;
  v_option_id        TEXT;
  v_addon_groups     JSONB;
  v_addon_raw        JSONB;
  v_addon_selections JSONB;
  v_addon_surcharge  NUMERIC(10,2);
  v_sel_idx          INTEGER;
  v_sel_item         JSONB;
  v_sel_group_id     TEXT;
  v_sel_option_id    TEXT;
  v_sel_text_value   TEXT;
  v_grp_item         JSONB;
  v_opt_item         JSONB;
  v_grp_found        BOOLEAN;
  v_opt_found        BOOLEAN;
  v_opt_price_adj    NUMERIC(10,2);
  v_opt_text_req     BOOLEAN;
  v_seen_sel_groups  TEXT[];
  v_calc_subtotal    NUMERIC(10,2) := 0;
  v_shipping_cost    NUMERIC(10,2);
  v_threshold        NUMERIC(10,2);
BEGIN

  -- ── Validate items JSONB ────────────────────────────────────────────────────

  IF p_items IS NULL OR jsonb_typeof(p_items) != 'array' THEN
    RAISE EXCEPTION 'Invalid order: items must be a non-null JSON array'
      USING ERRCODE = 'check_violation';
  END IF;

  v_len := jsonb_array_length(p_items);

  IF v_len = 0 THEN
    RAISE EXCEPTION 'Invalid order: items array must not be empty'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_len > 50 THEN
    RAISE EXCEPTION 'Invalid order: too many items (max 50)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- ── Per-item validation and pricing ─────────────────────────────────────────

  FOR v_idx IN 0..(v_len - 1) LOOP
    v_item := p_items -> v_idx;

    -- product id: positive integer
    IF (v_item ->> 'id') IS NULL
       OR (v_item ->> 'id') !~ '^[0-9]+$'
       OR (v_item ->> 'id')::BIGINT < 1
       OR (v_item ->> 'id')::BIGINT > 2147483647 THEN
      RAISE EXCEPTION
        'Invalid order item at index %: id is missing or not a positive integer', v_idx
        USING ERRCODE = 'check_violation';
    END IF;
    v_product_id := (v_item ->> 'id')::INTEGER;

    -- quantity: 1–100
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

    -- Fetch price, variants, and addon configuration from DB in a single read.
    -- products.compare_price is the display-only crossed-out price — never billed.
    SELECT price, price_options, addon_groups
    INTO   v_unit_price, v_price_options, v_addon_groups
    FROM   products
    WHERE  id = v_product_id
      AND  in_stock = true;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Product % is no longer available. Please refresh and update your cart.',
        v_product_id
        USING ERRCODE = 'check_violation';
    END IF;

    -- Normalise option_id: absent key and empty string are both NULL.
    v_option_id := nullif(trim(coalesce(v_item ->> 'option_id', '')), '');

    IF v_price_options IS NOT NULL THEN

      -- ── Variant product ────────────────────────────────────────────────────
      IF v_option_id IS NULL THEN
        RAISE EXCEPTION 'Product % requires a variant to be selected.', v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

      SELECT (opt ->> 'price')::numeric(10,2)
      INTO   v_unit_price
      FROM   jsonb_array_elements(v_price_options) AS opt
      WHERE  opt ->> 'id' = v_option_id
      LIMIT  1;

      IF NOT FOUND OR v_unit_price IS NULL OR v_unit_price <= 0 THEN
        RAISE EXCEPTION 'Invalid variant "%" for product %.', v_option_id, v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

    ELSE

      -- ── Non-variant product ────────────────────────────────────────────────
      IF v_option_id IS NOT NULL THEN
        RAISE EXCEPTION 'Product % does not support variants.', v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

      IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
        RAISE EXCEPTION 'Product % has no valid price configured.', v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

    END IF;

    -- ── Add-on groups validation ─────────────────────────────────────────────

    -- Normalise addon_selections: absent key or JSON null → empty array.
    v_addon_raw := v_item -> 'addon_selections';
    IF v_addon_raw IS NULL OR jsonb_typeof(v_addon_raw) = 'null' THEN
      v_addon_selections := '[]'::jsonb;
    ELSIF jsonb_typeof(v_addon_raw) != 'array' THEN
      RAISE EXCEPTION
        'addon_selections for product % must be a JSON array or absent.', v_product_id
        USING ERRCODE = 'check_violation';
    ELSE
      v_addon_selections := v_addon_raw;
    END IF;

    v_addon_surcharge := 0;

    IF v_addon_groups IS NULL THEN

      -- Product has no add-on groups: any selection is an error.
      IF jsonb_array_length(v_addon_selections) > 0 THEN
        RAISE EXCEPTION 'Product % does not support add-on selections.', v_product_id
          USING ERRCODE = 'check_violation';
      END IF;

    ELSE

      -- Product has add-on groups: validate each submitted selection.
      v_seen_sel_groups := '{}';

      FOR v_sel_idx IN 0..(jsonb_array_length(v_addon_selections) - 1) LOOP
        v_sel_item      := v_addon_selections -> v_sel_idx;
        v_sel_group_id  := nullif(trim(coalesce(v_sel_item ->> 'group_id',  '')), '');
        v_sel_option_id := nullif(trim(coalesce(v_sel_item ->> 'option_id', '')), '');

        IF v_sel_group_id IS NULL OR v_sel_option_id IS NULL THEN
          RAISE EXCEPTION
            'Invalid add-on selection at index % for product %: '
            'group_id and option_id are required.', v_sel_idx, v_product_id
            USING ERRCODE = 'check_violation';
        END IF;

        IF v_sel_group_id = ANY(v_seen_sel_groups) THEN
          RAISE EXCEPTION
            'Duplicate add-on group "%" for product %.', v_sel_group_id, v_product_id
            USING ERRCODE = 'check_violation';
        END IF;
        v_seen_sel_groups := array_append(v_seen_sel_groups, v_sel_group_id);

        -- Find the submitted group_id in the product's addon_groups.
        v_grp_found := false;
        FOR v_grp_item IN SELECT * FROM jsonb_array_elements(v_addon_groups) LOOP
          IF v_grp_item ->> 'id' = v_sel_group_id THEN
            v_grp_found := true;

            -- Find the submitted option_id within this group.
            v_opt_found := false;
            FOR v_opt_item IN
              SELECT * FROM jsonb_array_elements(v_grp_item -> 'options')
            LOOP
              IF v_opt_item ->> 'id' = v_sel_option_id THEN
                v_opt_found := true;

                -- Accumulate price surcharge — read exclusively from DB.
                -- Any price_adjustment in the submitted selection is ignored.
                v_opt_price_adj :=
                  coalesce((v_opt_item ->> 'price_adjustment')::NUMERIC(10,2), 0);
                IF v_opt_price_adj < 0 THEN
                  RAISE EXCEPTION
                    'Invalid price_adjustment for option "%" in group "%" for product %.',
                    v_sel_option_id, v_sel_group_id, v_product_id
                    USING ERRCODE = 'check_violation';
                END IF;
                v_addon_surcharge := v_addon_surcharge + v_opt_price_adj;

                -- text_required: validate text_value if the option requires it.
                v_opt_text_req :=
                  coalesce((v_opt_item ->> 'text_required')::BOOLEAN, false);
                IF v_opt_text_req THEN
                  v_sel_text_value :=
                    nullif(trim(coalesce(v_sel_item ->> 'text_value', '')), '');
                  IF v_sel_text_value IS NULL THEN
                    RAISE EXCEPTION
                      'Add-on option "%" in group "%" for product % requires a text value.',
                      v_sel_option_id, v_sel_group_id, v_product_id
                      USING ERRCODE = 'check_violation';
                  END IF;
                  IF char_length(v_sel_text_value) > 200 THEN
                    RAISE EXCEPTION
                      'Text value for add-on option "%" in group "%" for product % '
                      'must not exceed 200 characters.',
                      v_sel_option_id, v_sel_group_id, v_product_id
                      USING ERRCODE = 'check_violation';
                  END IF;
                END IF;

                EXIT; -- option found; exit options loop
              END IF;
            END LOOP;

            IF NOT v_opt_found THEN
              RAISE EXCEPTION
                'Invalid add-on option "%" for group "%" in product %.',
                v_sel_option_id, v_sel_group_id, v_product_id
                USING ERRCODE = 'check_violation';
            END IF;

            EXIT; -- group found; exit groups loop
          END IF;
        END LOOP;

        IF NOT v_grp_found THEN
          RAISE EXCEPTION
            'Invalid add-on group "%" for product %.', v_sel_group_id, v_product_id
            USING ERRCODE = 'check_violation';
        END IF;
      END LOOP; -- end selections loop

      -- Verify all required groups have a selection.
      FOR v_grp_item IN SELECT * FROM jsonb_array_elements(v_addon_groups) LOOP
        IF coalesce((v_grp_item ->> 'required')::BOOLEAN, false) THEN
          IF NOT ((v_grp_item ->> 'id') = ANY(v_seen_sel_groups)) THEN
            RAISE EXCEPTION
              'Required add-on group "%" is missing a selection for product %.',
              (v_grp_item ->> 'id'), v_product_id
              USING ERRCODE = 'check_violation';
          END IF;
        END IF;
      END LOOP;

    END IF; -- end addon_groups block

    -- Accumulate: (base price + addon surcharge) × quantity
    v_calc_subtotal := v_calc_subtotal + (v_unit_price + v_addon_surcharge) * v_quantity;

  END LOOP; -- end items loop

  -- ── Shipping ─────────────────────────────────────────────────────────────────

  SELECT ss.shipping_cost, ss.free_shipping_threshold
  INTO   v_shipping_cost, v_threshold
  FROM   store_settings ss
  WHERE  ss.id = 1;

  IF NOT FOUND THEN
    -- Safe fallback if store_settings is missing.
    v_shipping_cost := 10.00;
    v_threshold     := 100.00;
  END IF;

  -- Free shipping when product subtotal meets threshold.
  IF v_calc_subtotal >= v_threshold THEN
    v_shipping_cost := 0.00;
  END IF;

  RETURN QUERY SELECT v_calc_subtotal, v_shipping_cost, v_calc_subtotal + v_shipping_cost;
END;
$$;

-- Restrict direct access; this function is only callable from SECURITY DEFINER
-- callers running as the function owner (postgres).
REVOKE EXECUTE ON FUNCTION public.internal_calculate_order_totals(jsonb) FROM PUBLIC;
