-- ══════════════════════════════════════════════════════════════════════════════
-- Phase 7 — Rollback-Only Integration Tests
-- ══════════════════════════════════════════════════════════════════════════════
--
-- PURPOSE
-- -------
-- Verify that migrations 20261016000001–20261016000004 behave correctly and
-- that all existing (legacy) order behaviour is fully preserved.
--
-- HOW TO RUN
-- ----------
-- Via Supabase CLI (requires linked project):
--   supabase db query --file supabase/tests/phase1_addon_rollback_tests.sql
--
-- Via psql:
--   psql <connection-string> -f supabase/tests/phase1_addon_rollback_tests.sql
--
-- SAFETY
-- ------
-- The outer BEGIN/ROLLBACK ensures NO data is permanently modified.
-- Product addon_groups UPDATEs and order INSERTs in Groups 5–7 are all
-- rolled back.  The rate-limit counter incremented during order INSERT tests
-- is also rolled back (it lives in upload_rate_limits which is transactional).
-- Products, categories, orders and store_settings are untouched after the file runs.
--
-- PASS/FAIL
-- ---------
-- RAISE NOTICE  'PASS …' — test passed.
-- RAISE EXCEPTION 'FAIL …' — test failed; aborts with an error message.
-- Any unexpected exception that is not caught also causes a hard failure.
--
-- GROUPS
-- ------
-- 1. check_addon_groups — pure function, no DB reads
-- 2. internal_calculate_order_totals — error cases requiring only invalid input
-- 3. verify_order_pricing — with a real in-stock product
-- 4. Addon validation — temporarily sets addon_groups on a product (rolled back)
-- 5. place_order + expected_total guard (order inserts rolled back)
-- 6. Legacy order behaviour preserved (no addon_selections, variants)
-- 7. Shipping threshold
-- ══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Setup: stash a real in-stock product for later tests ─────────────────────

CREATE TEMP TABLE IF NOT EXISTS _t (key text PRIMARY KEY, val text);

DO $setup$
DECLARE
  v_id    INTEGER;
  v_price NUMERIC(10,2);
  v_opts  TEXT;
BEGIN
  -- Plain (non-variant) product
  SELECT id, price
  INTO   v_id, v_price
  FROM   products
  WHERE  in_stock = true
    AND  price > 0
    AND  price_options IS NULL
    AND  addon_groups  IS NULL
  LIMIT  1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION
      'Setup FAIL: no eligible plain in-stock product found. '
      'At least one product with price > 0, no price_options, no addon_groups is required.';
  END IF;

  INSERT INTO _t VALUES ('plain_id',    v_id::text);
  INSERT INTO _t VALUES ('plain_price', v_price::text);
  RAISE NOTICE 'Setup: plain product id=%, price=%', v_id, v_price;

  -- Variant product (optional; tests skip gracefully if absent)
  SELECT id, price_options -> 0 ->> 'id', (price_options -> 0 ->> 'price')::numeric
  INTO   v_id, v_opts, v_price
  FROM   products
  WHERE  in_stock = true
    AND  price_options IS NOT NULL
    AND  addon_groups  IS NULL
  LIMIT  1;

  IF v_id IS NOT NULL THEN
    INSERT INTO _t VALUES ('variant_id',       v_id::text);
    INSERT INTO _t VALUES ('variant_opt_id',   v_opts::text);
    INSERT INTO _t VALUES ('variant_opt_price', v_price::text);
    RAISE NOTICE 'Setup: variant product id=%, first option id=%, price=%',
      v_id, v_opts, v_price;
  ELSE
    RAISE NOTICE 'Setup: no variant product found — variant tests will be skipped';
  END IF;
END $setup$;


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP 1: check_addon_groups — pure function tests
-- ══════════════════════════════════════════════════════════════════════════════

DO $g1$
DECLARE
  r  BOOLEAN;

  -- Minimal valid group / option builders
  valid_opt  CONSTANT TEXT :=
    '{"id":"opt1","label_en":"A","label_bs":"A","price_adjustment":0}';
  valid_grp  CONSTANT TEXT :=
    '{"id":"g1","label_en":"Size","label_bs":"Veličina",'
    '"location":"product_page","options":[' || valid_opt || ']}';

BEGIN

  -- 1.1 NULL → valid
  r := check_addon_groups(NULL);
  IF r IS NOT TRUE THEN RAISE EXCEPTION 'FAIL 1.1: NULL should return true'; END IF;
  RAISE NOTICE 'PASS 1.1: NULL input → true';

  -- 1.2 Valid single group, single option
  r := check_addon_groups(('[' || valid_grp || ']')::jsonb);
  IF r IS NOT TRUE THEN RAISE EXCEPTION 'FAIL 1.2: valid single group should return true'; END IF;
  RAISE NOTICE 'PASS 1.2: valid single group → true';

  -- 1.3 Not an array
  r := check_addon_groups('{"id":"g1"}'::jsonb);
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.3: non-array should return false'; END IF;
  RAISE NOTICE 'PASS 1.3: non-array → false';

  -- 1.4 Empty array (0 groups)
  r := check_addon_groups('[]'::jsonb);
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.4: empty array should return false'; END IF;
  RAISE NOTICE 'PASS 1.4: empty array → false';

  -- 1.5 11 groups (exceeds limit)
  DECLARE
    many_grps TEXT;
    i         INTEGER;
  BEGIN
    many_grps := '[';
    FOR i IN 1..11 LOOP
      IF i > 1 THEN many_grps := many_grps || ','; END IF;
      many_grps := many_grps
        || '{"id":"g' || i || '","label_en":"L","label_bs":"L",'
        || '"location":"product_page","options":[' || valid_opt || ']}';
    END LOOP;
    many_grps := many_grps || ']';
    r := check_addon_groups(many_grps::jsonb);
    IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.5: 11 groups should return false'; END IF;
    RAISE NOTICE 'PASS 1.5: 11 groups → false';
  END;

  -- 1.6 Group missing id
  r := check_addon_groups(
    ('[{"label_en":"A","label_bs":"A","location":"product_page",'
    '"options":[' || valid_opt || ']}]')::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.6: group missing id should return false'; END IF;
  RAISE NOTICE 'PASS 1.6: group missing id → false';

  -- 1.7 Duplicate group id
  r := check_addon_groups(
    ('[' || valid_grp || ',' || valid_grp || ']')::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.7: duplicate group id should return false'; END IF;
  RAISE NOTICE 'PASS 1.7: duplicate group id → false';

  -- 1.8 Invalid location
  r := check_addon_groups(
    ('[{"id":"g1","label_en":"A","label_bs":"A","location":"modal",'
    '"options":[' || valid_opt || ']}]')::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.8: invalid location should return false'; END IF;
  RAISE NOTICE 'PASS 1.8: invalid location → false';

  -- 1.9 required field is not boolean
  r := check_addon_groups(
    ('[{"id":"g1","label_en":"A","label_bs":"A","location":"product_page",'
    '"required":"yes","options":[' || valid_opt || ']}]')::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.9: non-boolean required should return false'; END IF;
  RAISE NOTICE 'PASS 1.9: non-boolean required → false';

  -- 1.10 Group with no options field
  r := check_addon_groups(
    '[{"id":"g1","label_en":"A","label_bs":"A","location":"product_page"}]'::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.10: missing options should return false'; END IF;
  RAISE NOTICE 'PASS 1.10: missing options → false';

  -- 1.11 Group with 21 options (exceeds limit)
  DECLARE
    many_opts TEXT;
    j         INTEGER;
  BEGIN
    many_opts := '[';
    FOR j IN 1..21 LOOP
      IF j > 1 THEN many_opts := many_opts || ','; END IF;
      many_opts := many_opts
        || '{"id":"o' || j || '","label_en":"L","label_bs":"L","price_adjustment":0}';
    END LOOP;
    many_opts := many_opts || ']';
    r := check_addon_groups(
      ('[{"id":"g1","label_en":"A","label_bs":"A","location":"product_page",'
      '"options":' || many_opts || '}]')::jsonb
    );
    IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.11: 21 options should return false'; END IF;
    RAISE NOTICE 'PASS 1.11: 21 options → false';
  END;

  -- 1.12 Option duplicate id within group
  r := check_addon_groups(
    ('[{"id":"g1","label_en":"A","label_bs":"A","location":"product_page","options":['
    || valid_opt || ',' || valid_opt || ']}]')::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.12: duplicate option id should return false'; END IF;
  RAISE NOTICE 'PASS 1.12: duplicate option id → false';

  -- 1.13 Option price_adjustment negative
  r := check_addon_groups(
    '[{"id":"g1","label_en":"A","label_bs":"A","location":"product_page","options":['
    '{"id":"o1","label_en":"A","label_bs":"A","price_adjustment":-1}]}]'::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.13: negative price_adjustment should return false'; END IF;
  RAISE NOTICE 'PASS 1.13: negative price_adjustment → false';

  -- 1.14 Option price_adjustment > 99999
  r := check_addon_groups(
    '[{"id":"g1","label_en":"A","label_bs":"A","location":"product_page","options":['
    '{"id":"o1","label_en":"A","label_bs":"A","price_adjustment":100000}]}]'::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.14: price_adjustment > 99999 should return false'; END IF;
  RAISE NOTICE 'PASS 1.14: price_adjustment > 99999 → false';

  -- 1.15 Option text_required not boolean
  r := check_addon_groups(
    '[{"id":"g1","label_en":"A","label_bs":"A","location":"product_page","options":['
    '{"id":"o1","label_en":"A","label_bs":"A","price_adjustment":0,"text_required":"yes"}]}]'::jsonb
  );
  IF r IS NOT FALSE THEN RAISE EXCEPTION 'FAIL 1.15: non-boolean text_required should return false'; END IF;
  RAISE NOTICE 'PASS 1.15: non-boolean text_required → false';

  -- 1.16 text_required absent (optional field) → valid
  r := check_addon_groups(('[' || valid_grp || ']')::jsonb);
  IF r IS NOT TRUE THEN RAISE EXCEPTION 'FAIL 1.16: absent text_required should return true'; END IF;
  RAISE NOTICE 'PASS 1.16: absent text_required → true';

  -- 1.17 Both product_page and personalization_modal locations → valid
  r := check_addon_groups(
    ('[{"id":"g1","label_en":"A","label_bs":"A","location":"product_page","options":[' || valid_opt || ']},'
    '{"id":"g2","label_en":"B","label_bs":"B","location":"personalization_modal","options":['
    '{"id":"o2","label_en":"B","label_bs":"B","price_adjustment":5.50}]}]')::jsonb
  );
  IF r IS NOT TRUE THEN RAISE EXCEPTION 'FAIL 1.17: mixed locations should return true'; END IF;
  RAISE NOTICE 'PASS 1.17: mixed locations → true';

END $g1$;


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP 2: internal_calculate_order_totals — error paths
-- (No product lookup needed for input-validation errors)
-- ══════════════════════════════════════════════════════════════════════════════

DO $g2$
DECLARE v_dummy RECORD;
BEGIN

  -- 2.1 NULL items
  BEGIN
    SELECT * INTO v_dummy FROM internal_calculate_order_totals(NULL);
    RAISE EXCEPTION 'FAIL 2.1: NULL items should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 2.1: NULL items → check_violation';
  END;

  -- 2.2 Non-array items
  BEGIN
    SELECT * INTO v_dummy FROM internal_calculate_order_totals('"string"');
    RAISE EXCEPTION 'FAIL 2.2: non-array items should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 2.2: non-array items → check_violation';
  END;

  -- 2.3 Empty array
  BEGIN
    SELECT * INTO v_dummy FROM internal_calculate_order_totals('[]');
    RAISE EXCEPTION 'FAIL 2.3: empty items should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 2.3: empty items array → check_violation';
  END;

  -- 2.4 51 items (over limit)
  DECLARE
    v_items TEXT;
    i       INTEGER;
  BEGIN
    v_items := '[';
    FOR i IN 1..51 LOOP
      IF i > 1 THEN v_items := v_items || ','; END IF;
      v_items := v_items || '{"id":1,"quantity":1}';
    END LOOP;
    v_items := v_items || ']';
    BEGIN
      SELECT * INTO v_dummy FROM internal_calculate_order_totals(v_items::jsonb);
      RAISE EXCEPTION 'FAIL 2.4: 51 items should raise';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'PASS 2.4: 51 items → check_violation';
    END;
  END;

  -- 2.5 Item with string id
  BEGIN
    SELECT * INTO v_dummy
    FROM   internal_calculate_order_totals('[{"id":"abc","quantity":1}]');
    RAISE EXCEPTION 'FAIL 2.5: string id should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 2.5: string id → check_violation';
  END;

  -- 2.6 Item with quantity 0
  BEGIN
    SELECT * INTO v_dummy
    FROM   internal_calculate_order_totals('[{"id":1,"quantity":0}]');
    RAISE EXCEPTION 'FAIL 2.6: quantity 0 should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 2.6: quantity 0 → check_violation';
  END;

  -- 2.7 Item with quantity 101
  BEGIN
    SELECT * INTO v_dummy
    FROM   internal_calculate_order_totals('[{"id":1,"quantity":101}]');
    RAISE EXCEPTION 'FAIL 2.7: quantity 101 should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 2.7: quantity 101 → check_violation';
  END;

  -- 2.8 Non-existent product id
  BEGIN
    SELECT * INTO v_dummy
    FROM   internal_calculate_order_totals('[{"id":2147483647,"quantity":1}]');
    RAISE EXCEPTION 'FAIL 2.8: non-existent product should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 2.8: non-existent product → check_violation';
  END;

END $g2$;


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP 3: verify_order_pricing with a real product
-- ══════════════════════════════════════════════════════════════════════════════

DO $g3$
DECLARE
  v_id         INTEGER;
  v_price      NUMERIC(10,2);
  v_items      JSONB;
  v_result     RECORD;
  v_ship_cost  NUMERIC(10,2);
  v_threshold  NUMERIC(10,2);
  v_exp_sub    NUMERIC(10,2);
  v_exp_ship   NUMERIC(10,2);
BEGIN
  v_id    := (SELECT val FROM _t WHERE key = 'plain_id')::INTEGER;
  v_price := (SELECT val FROM _t WHERE key = 'plain_price')::NUMERIC(10,2);

  SELECT shipping_cost, free_shipping_threshold
  INTO   v_ship_cost, v_threshold
  FROM   store_settings WHERE id = 1;

  -- 3.1 Single item, qty 1 — subtotal correct
  v_items := ('[{"id":' || v_id || ',"quantity":1}]')::jsonb;

  SELECT * INTO v_result FROM verify_order_pricing(v_items);

  v_exp_sub := v_price;
  IF v_result.subtotal <> v_exp_sub THEN
    RAISE EXCEPTION 'FAIL 3.1: subtotal=% expected=%', v_result.subtotal, v_exp_sub;
  END IF;
  RAISE NOTICE 'PASS 3.1: subtotal correct (% KM)', v_result.subtotal;

  -- 3.2 total = subtotal + shipping_cost
  IF v_result.total <> v_result.subtotal + v_result.shipping_cost THEN
    RAISE EXCEPTION 'FAIL 3.2: total != subtotal + shipping_cost';
  END IF;
  RAISE NOTICE 'PASS 3.2: total = subtotal + shipping_cost (% KM)', v_result.total;

  -- 3.3 Correct shipping logic applied
  IF v_exp_sub >= v_threshold THEN
    IF v_result.shipping_cost <> 0 THEN
      RAISE EXCEPTION 'FAIL 3.3: subtotal >= threshold but shipping_cost != 0';
    END IF;
    RAISE NOTICE 'PASS 3.3: free shipping applied (subtotal % >= threshold %)',
      v_exp_sub, v_threshold;
  ELSE
    IF v_result.shipping_cost <> v_ship_cost THEN
      RAISE EXCEPTION 'FAIL 3.3: shipping_cost=% expected=%',
        v_result.shipping_cost, v_ship_cost;
    END IF;
    RAISE NOTICE 'PASS 3.3: standard shipping cost applied (% KM)', v_result.shipping_cost;
  END IF;

  -- 3.4 Single item, qty 3 — subtotal = price * 3
  v_items  := ('[{"id":' || v_id || ',"quantity":3}]')::jsonb;
  SELECT * INTO v_result FROM verify_order_pricing(v_items);
  v_exp_sub := v_price * 3;
  IF v_result.subtotal <> v_exp_sub THEN
    RAISE EXCEPTION 'FAIL 3.4: qty 3 subtotal=% expected=%', v_result.subtotal, v_exp_sub;
  END IF;
  RAISE NOTICE 'PASS 3.4: qty * price accumulation correct (% KM)', v_result.subtotal;

  -- 3.5 option_id on non-variant product → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing(
      ('[{"id":' || v_id || ',"quantity":1,"option_id":"opt-xxx"}]')::jsonb
    );
    RAISE EXCEPTION 'FAIL 3.5: option_id on non-variant product should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 3.5: option_id on non-variant product → check_violation';
  END;

  -- 3.6 addon_selections on product with addon_groups IS NULL → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing(
      ('[{"id":' || v_id || ',"quantity":1,"addon_selections":[{"group_id":"g1","option_id":"o1"}]}]')::jsonb
    );
    RAISE EXCEPTION 'FAIL 3.6: addon_selections on no-addon product should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 3.6: addon_selections on no-addon product → check_violation';
  END;

END $g3$;


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP 4: Addon validation — temporarily sets addon_groups on a product
-- All UPDATEs are inside this BEGIN and rolled back at the outer ROLLBACK.
-- ══════════════════════════════════════════════════════════════════════════════

DO $g4$
DECLARE
  v_id        INTEGER;
  v_price     NUMERIC(10,2);
  v_result    RECORD;
  v_groups    JSONB;

  v_groups_optional CONSTANT JSONB := '[{
    "id": "grp-test-packaging",
    "label_en": "Packaging",
    "label_bs": "Pakovanje",
    "location": "product_page",
    "required": false,
    "options": [
      {"id":"opt-standard","label_en":"Standard","label_bs":"Standardno","price_adjustment":0},
      {"id":"opt-premium", "label_en":"Premium", "label_bs":"Premium",  "price_adjustment":2.50}
    ]
  }]';

  v_groups_required CONSTANT JSONB := '[{
    "id": "grp-test-color",
    "label_en": "Colour",
    "label_bs": "Boja",
    "location": "product_page",
    "required": true,
    "options": [
      {"id":"opt-gold",   "label_en":"Gold",   "label_bs":"Zlatna",   "price_adjustment":0},
      {"id":"opt-silver", "label_en":"Silver", "label_bs":"Srebrna",  "price_adjustment":1.00}
    ]
  }]';

  v_groups_text_req CONSTANT JSONB := '[{
    "id": "grp-test-note",
    "label_en": "Engraving",
    "label_bs": "Gravura",
    "location": "personalization_modal",
    "required": false,
    "options": [
      {"id":"opt-engrave","label_en":"Add engraving","label_bs":"Dodaj gravuru",
       "price_adjustment":3.00,"text_required":true}
    ]
  }]';

BEGIN
  v_id    := (SELECT val FROM _t WHERE key = 'plain_id')::INTEGER;
  v_price := (SELECT val FROM _t WHERE key = 'plain_price')::NUMERIC(10,2);

  -- ── 4a: optional addon groups ──────────────────────────────────────────────
  UPDATE products SET addon_groups = v_groups_optional WHERE id = v_id;

  -- 4.1 No selections on optional group → accepted (surcharge 0)
  SELECT * INTO v_result
  FROM   verify_order_pricing(('[{"id":' || v_id || ',"quantity":1}]')::jsonb);
  IF v_result.subtotal <> v_price THEN
    RAISE EXCEPTION 'FAIL 4.1: optional group, no selection: subtotal=% expected=%',
      v_result.subtotal, v_price;
  END IF;
  RAISE NOTICE 'PASS 4.1: optional group + no selections → subtotal unchanged (% KM)', v_result.subtotal;

  -- 4.2 Valid selection with price_adjustment=0
  SELECT * INTO v_result
  FROM   verify_order_pricing((
    '[{"id":' || v_id || ',"quantity":1,'
    '"addon_selections":[{"group_id":"grp-test-packaging","option_id":"opt-standard"}]}]'
  )::jsonb);
  IF v_result.subtotal <> v_price THEN
    RAISE EXCEPTION 'FAIL 4.2: zero surcharge: subtotal=% expected=%',
      v_result.subtotal, v_price;
  END IF;
  RAISE NOTICE 'PASS 4.2: zero-surcharge option selected → subtotal unchanged (% KM)', v_result.subtotal;

  -- 4.3 Valid selection with price_adjustment=2.50, qty=2
  SELECT * INTO v_result
  FROM   verify_order_pricing((
    '[{"id":' || v_id || ',"quantity":2,'
    '"addon_selections":[{"group_id":"grp-test-packaging","option_id":"opt-premium"}]}]'
  )::jsonb);
  -- Expected: (price + 2.50) * 2
  IF v_result.subtotal <> (v_price + 2.50) * 2 THEN
    RAISE EXCEPTION 'FAIL 4.3: surcharge: subtotal=% expected=%',
      v_result.subtotal, (v_price + 2.50) * 2;
  END IF;
  RAISE NOTICE 'PASS 4.3: price_adjustment=2.50 × qty 2 → subtotal=% KM', v_result.subtotal;

  -- 4.4 Unknown group_id → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_id || ',"quantity":1,'
      '"addon_selections":[{"group_id":"grp-UNKNOWN","option_id":"opt-standard"}]}]'
    )::jsonb);
    RAISE EXCEPTION 'FAIL 4.4: unknown group_id should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4.4: unknown group_id → check_violation';
  END;

  -- 4.5 Unknown option_id within known group → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_id || ',"quantity":1,'
      '"addon_selections":[{"group_id":"grp-test-packaging","option_id":"opt-UNKNOWN"}]}]'
    )::jsonb);
    RAISE EXCEPTION 'FAIL 4.5: unknown option_id should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4.5: unknown option_id → check_violation';
  END;

  -- 4.6 Duplicate group_id in selections → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_id || ',"quantity":1,'
      '"addon_selections":['
        '{"group_id":"grp-test-packaging","option_id":"opt-standard"},'
        '{"group_id":"grp-test-packaging","option_id":"opt-premium"}'
      ']}]'
    )::jsonb);
    RAISE EXCEPTION 'FAIL 4.6: duplicate group_id should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4.6: duplicate group_id → check_violation';
  END;

  -- Restore: remove optional addon_groups
  UPDATE products SET addon_groups = NULL WHERE id = v_id;

  -- ── 4b: required addon group ───────────────────────────────────────────────
  UPDATE products SET addon_groups = v_groups_required WHERE id = v_id;

  -- 4.7 Required group, no selection → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing(('[{"id":' || v_id || ',"quantity":1}]')::jsonb);
    RAISE EXCEPTION 'FAIL 4.7: required group with no selection should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4.7: required group + no selection → check_violation';
  END;

  -- 4.8 Required group, valid selection with surcharge
  SELECT * INTO v_result
  FROM   verify_order_pricing((
    '[{"id":' || v_id || ',"quantity":1,'
    '"addon_selections":[{"group_id":"grp-test-color","option_id":"opt-silver"}]}]'
  )::jsonb);
  IF v_result.subtotal <> v_price + 1.00 THEN
    RAISE EXCEPTION 'FAIL 4.8: required group surcharge: subtotal=% expected=%',
      v_result.subtotal, v_price + 1.00;
  END IF;
  RAISE NOTICE 'PASS 4.8: required group + valid selection → subtotal=% KM', v_result.subtotal;

  -- Restore
  UPDATE products SET addon_groups = NULL WHERE id = v_id;

  -- ── 4c: text_required option ───────────────────────────────────────────────
  UPDATE products SET addon_groups = v_groups_text_req WHERE id = v_id;

  -- 4.9 text_required option, text_value absent → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_id || ',"quantity":1,'
      '"addon_selections":[{"group_id":"grp-test-note","option_id":"opt-engrave"}]}]'
    )::jsonb);
    RAISE EXCEPTION 'FAIL 4.9: text_required without text_value should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4.9: text_required + absent text_value → check_violation';
  END;

  -- 4.10 text_required option, text_value blank → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_id || ',"quantity":1,'
      '"addon_selections":[{"group_id":"grp-test-note","option_id":"opt-engrave",'
      '"text_value":"   "}]}]'
    )::jsonb);
    RAISE EXCEPTION 'FAIL 4.10: text_required with blank text_value should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4.10: text_required + blank text_value → check_violation';
  END;

  -- 4.11 text_required option, text_value 201 chars → rejected
  BEGIN
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_id || ',"quantity":1,'
      '"addon_selections":[{"group_id":"grp-test-note","option_id":"opt-engrave",'
      '"text_value":"' || repeat('x', 201) || '"}]}]'
    )::jsonb);
    RAISE EXCEPTION 'FAIL 4.11: text_value > 200 chars should raise';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4.11: text_value 201 chars → check_violation';
  END;

  -- 4.12 text_required option, text_value exactly 200 chars → accepted
  SELECT * INTO v_result
  FROM   verify_order_pricing((
    '[{"id":' || v_id || ',"quantity":1,'
    '"addon_selections":[{"group_id":"grp-test-note","option_id":"opt-engrave",'
    '"text_value":"' || repeat('a', 200) || '"}]}]'
  )::jsonb);
  IF v_result.subtotal <> v_price + 3.00 THEN
    RAISE EXCEPTION 'FAIL 4.12: 200-char text value: subtotal=% expected=%',
      v_result.subtotal, v_price + 3.00;
  END IF;
  RAISE NOTICE 'PASS 4.12: text_value 200 chars accepted → subtotal=% KM', v_result.subtotal;

  -- Restore
  UPDATE products SET addon_groups = NULL WHERE id = v_id;

END $g4$;


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP 5: place_order + p_expected_total guard
--
-- NOTE ON ORDER INSERTS:
-- Tests 5.1, 5.2, 5.4 call place_order and get a committed INSERT within the
-- outer transaction.  The outer ROLLBACK at the end of this file removes them.
-- The orders_order_number_seq will advance (sequences are non-transactional),
-- leaving a small gap in the sequence — this is intentional and harmless.
-- The rate-limit counter in upload_rate_limits is also rolled back.
--
-- SAVEPOINT is not valid inside a PL/pgSQL DO block; PL/pgSQL's EXCEPTION
-- clause provides equivalent rollback semantics for the failure tests.
-- ══════════════════════════════════════════════════════════════════════════════

DO $g5$
DECLARE
  v_id         INTEGER;
  v_price      NUMERIC(10,2);
  v_ship_cost  NUMERIC(10,2);
  v_threshold  NUMERIC(10,2);
  v_calc_total NUMERIC(10,2);
  v_result     RECORD;
  v_cfg        TEXT;

  -- Placeholder customer data — distinct email avoids any unique-constraint risk
  c_name    CONSTANT TEXT := 'Test Rollback';
  c_email   CONSTANT TEXT := 'rollback@test.invalid';
  c_addr    CONSTANT TEXT := 'Test Street 1';
  c_city    CONSTANT TEXT := 'Sarajevo';
BEGIN
  v_id    := (SELECT val FROM _t WHERE key = 'plain_id')::INTEGER;
  v_price := (SELECT val FROM _t WHERE key = 'plain_price')::NUMERIC(10,2);

  SELECT shipping_cost, free_shipping_threshold
  INTO   v_ship_cost, v_threshold
  FROM   store_settings WHERE id = 1;

  IF v_price >= v_threshold THEN
    v_calc_total := v_price;
  ELSE
    v_calc_total := v_price + v_ship_cost;
  END IF;

  -- 5.1 Legacy call (no p_expected_total) → succeeds
  -- Order INSERT stays in outer transaction and is removed by the outer ROLLBACK.
  BEGIN
    SELECT * INTO v_result
    FROM   place_order(
      c_name, c_email, NULL, c_addr, c_city, NULL, 'cod',
      ('[{"id":' || v_id || ',"quantity":1}]')::jsonb,
      v_price, NULL, 'en'
      -- p_expected_total omitted → DEFAULT NULL → guard skipped
    );
    IF v_result.order_number IS NULL THEN
      RAISE EXCEPTION 'FAIL 5.1: order_number is null on legacy call';
    END IF;
    RAISE NOTICE 'PASS 5.1: legacy call (no p_expected_total) → order_number=%',
      v_result.order_number;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL 5.1: unexpected error: %', SQLERRM;
  END;

  -- 5.2 p_expected_total matches calculated total → succeeds
  BEGIN
    SELECT * INTO v_result
    FROM   place_order(
      c_name, c_email, NULL, c_addr, c_city, NULL, 'cod',
      ('[{"id":' || v_id || ',"quantity":1}]')::jsonb,
      v_price, NULL, 'en',
      v_calc_total
    );
    IF v_result.order_number IS NULL THEN
      RAISE EXCEPTION 'FAIL 5.2: order_number is null';
    END IF;
    RAISE NOTICE 'PASS 5.2: matching p_expected_total → order_number=%',
      v_result.order_number;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL 5.2: unexpected error: %', SQLERRM;
  END;

  -- 5.3 p_expected_total differs by >= 0.01 → PRICE_CHANGED exception.
  -- PL/pgSQL's EXCEPTION clause rolls back the failed INSERT implicitly.
  BEGIN
    SELECT * INTO v_result
    FROM   place_order(
      c_name, c_email, NULL, c_addr, c_city, NULL, 'cod',
      ('[{"id":' || v_id || ',"quantity":1}]')::jsonb,
      v_price, NULL, 'en',
      v_calc_total + 10.00   -- intentionally wrong
    );
    RAISE EXCEPTION 'FAIL 5.3: mismatched p_expected_total should raise PRICE_CHANGED';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 5.3: mismatched p_expected_total → check_violation (PRICE_CHANGED)';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL 5.3: unexpected error code: % — %', SQLSTATE, SQLERRM;
  END;

  -- 5.4 p_expected_total differs by exactly 0.01 KM (1 feninga) → PRICE_CHANGED.
  -- Verifies the >= 0.01 threshold: a 1-cent difference must NOT be silently
  -- accepted.  Both values are NUMERIC(10,2) so the comparison is exact.
  BEGIN
    SELECT * INTO v_result
    FROM   place_order(
      c_name, c_email, NULL, c_addr, c_city, NULL, 'cod',
      ('[{"id":' || v_id || ',"quantity":1}]')::jsonb,
      v_price, NULL, 'en',
      v_calc_total + 0.01   -- exactly 1 cent over
    );
    RAISE EXCEPTION 'FAIL 5.4: 1-cent difference should raise PRICE_CHANGED';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 5.4: 1-cent difference (0.01 KM) → check_violation (PRICE_CHANGED)';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'FAIL 5.4: unexpected error code: % — %', SQLSTATE, SQLERRM;
  END;

  -- 5.5 set_config with is_local=true is visible in the current transaction
  -- (cross-transaction isolation is inherent to is_local and not separately testable
  -- within a single transaction, but the GUC mechanism itself can be verified).
  BEGIN
    PERFORM set_config('app.expected_total', '77.77', true);
    v_cfg := coalesce(current_setting('app.expected_total', true), '');
    IF v_cfg <> '77.77' THEN
      RAISE EXCEPTION 'FAIL 5.5: set_config(is_local=true) not working: got %', v_cfg;
    END IF;
    RAISE NOTICE 'PASS 5.5: set_config(is_local=true) visible in transaction; '
      'outer ROLLBACK will clear it so no new transaction inherits this value';
  END;

END $g5$;


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP 6: Legacy order behaviour preserved (regression checks)
-- ══════════════════════════════════════════════════════════════════════════════

DO $g6$
DECLARE
  v_id          INTEGER;
  v_price       NUMERIC(10,2);
  v_var_id      INTEGER;
  v_var_opt_id  TEXT;
  v_var_price   NUMERIC(10,2);
  v_result      RECORD;
BEGIN
  v_id    := (SELECT val FROM _t WHERE key = 'plain_id')::INTEGER;
  v_price := (SELECT val FROM _t WHERE key = 'plain_price')::NUMERIC(10,2);

  -- 6.1 Plain item, no addon_selections: verify_order_pricing unchanged
  SELECT * INTO v_result
  FROM   verify_order_pricing(('[{"id":' || v_id || ',"quantity":1}]')::jsonb);
  IF v_result.subtotal <> v_price THEN
    RAISE EXCEPTION 'FAIL 6.1: legacy plain item subtotal wrong: % expected %',
      v_result.subtotal, v_price;
  END IF;
  RAISE NOTICE 'PASS 6.1: legacy plain item → correct subtotal (% KM)', v_result.subtotal;

  -- 6.2 Plain item with addon_selections: [] (explicit empty) → accepted
  SELECT * INTO v_result
  FROM   verify_order_pricing((
    '[{"id":' || v_id || ',"quantity":1,"addon_selections":[]}]'
  )::jsonb);
  IF v_result.subtotal <> v_price THEN
    RAISE EXCEPTION 'FAIL 6.2: empty addon_selections subtotal wrong';
  END IF;
  RAISE NOTICE 'PASS 6.2: empty addon_selections [] → accepted, subtotal unchanged';

  -- 6.3 Variant product tests (skipped if no variant product in catalog)
  IF (SELECT val FROM _t WHERE key = 'variant_id') IS NULL THEN
    RAISE NOTICE 'SKIP 6.3–6.5: no variant product in catalog';
  ELSE
    v_var_id      := (SELECT val FROM _t WHERE key = 'variant_id')::INTEGER;
    v_var_opt_id  := (SELECT val FROM _t WHERE key = 'variant_opt_id');
    v_var_price   := (SELECT val FROM _t WHERE key = 'variant_opt_price')::NUMERIC(10,2);

    -- 6.3 Variant product, valid option_id
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_var_id || ',"quantity":1,"option_id":"' || v_var_opt_id || '"}]'
    )::jsonb);
    IF v_result.subtotal <> v_var_price THEN
      RAISE EXCEPTION 'FAIL 6.3: variant item subtotal=% expected=%',
        v_result.subtotal, v_var_price;
    END IF;
    RAISE NOTICE 'PASS 6.3: variant item → correct subtotal (% KM)', v_result.subtotal;

    -- 6.4 Variant product, missing option_id → rejected (existing rule preserved)
    BEGIN
      SELECT * INTO v_result
      FROM   verify_order_pricing((
        '[{"id":' || v_var_id || ',"quantity":1}]'
      )::jsonb);
      RAISE EXCEPTION 'FAIL 6.4: variant product without option_id should raise';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'PASS 6.4: variant product + no option_id → check_violation';
    END;

    -- 6.5 Variant product, invalid option_id → rejected
    BEGIN
      SELECT * INTO v_result
      FROM   verify_order_pricing((
        '[{"id":' || v_var_id || ',"quantity":1,"option_id":"opt-INVALID"}]'
      )::jsonb);
      RAISE EXCEPTION 'FAIL 6.5: invalid option_id should raise';
    EXCEPTION WHEN check_violation THEN
      RAISE NOTICE 'PASS 6.5: variant product + invalid option_id → check_violation';
    END;
  END IF;

END $g6$;


-- ══════════════════════════════════════════════════════════════════════════════
-- GROUP 7: Shipping threshold — verify free shipping when subtotal is enough
-- ══════════════════════════════════════════════════════════════════════════════

DO $g7$
DECLARE
  v_id         INTEGER;
  v_price      NUMERIC(10,2);
  v_threshold  NUMERIC(10,2);
  v_result     RECORD;
  v_qty        INTEGER;
BEGIN
  v_id    := (SELECT val FROM _t WHERE key = 'plain_id')::INTEGER;
  v_price := (SELECT val FROM _t WHERE key = 'plain_price')::NUMERIC(10,2);

  SELECT free_shipping_threshold INTO v_threshold
  FROM   store_settings WHERE id = 1;

  -- Calculate how many units push the subtotal at or above the threshold
  v_qty := ceil(v_threshold / v_price)::INTEGER;

  IF v_qty > 100 THEN
    RAISE NOTICE 'SKIP 7.1: product price too low to reach threshold within qty limit';
  ELSE
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_id || ',"quantity":' || v_qty || '}]'
    )::jsonb);

    IF v_result.shipping_cost <> 0 THEN
      RAISE EXCEPTION 'FAIL 7.1: subtotal % >= threshold % but shipping_cost=% != 0',
        v_result.subtotal, v_threshold, v_result.shipping_cost;
    END IF;
    RAISE NOTICE 'PASS 7.1: subtotal % >= threshold % → shipping_cost=0',
      v_result.subtotal, v_threshold;
  END IF;

  -- 7.2 verify total = subtotal when shipping is free
  IF v_qty <= 100 THEN
    SELECT * INTO v_result
    FROM   verify_order_pricing((
      '[{"id":' || v_id || ',"quantity":' || v_qty || '}]'
    )::jsonb);
    IF v_result.total <> v_result.subtotal THEN
      RAISE EXCEPTION 'FAIL 7.2: total=% != subtotal=% when shipping free',
        v_result.total, v_result.subtotal;
    END IF;
    RAISE NOTICE 'PASS 7.2: total = subtotal when shipping is free';
  END IF;

END $g7$;


-- ══════════════════════════════════════════════════════════════════════════════
-- Summary
-- ══════════════════════════════════════════════════════════════════════════════

DO $summary$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  Phase 7 rollback tests complete — if you see this message,';
  RAISE NOTICE '  all tests passed.  No data was committed (outer ROLLBACK).';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $summary$;

ROLLBACK;
