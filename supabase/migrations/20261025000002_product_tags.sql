-- Product Tags
--
-- Adds a product_tags lookup table and a product_tag_assignments join table.
-- Existing products and categories are untouched.
-- products.id is BIGINT — FK references use BIGINT accordingly.

-- ── Lookup table ──────────────────────────────────────────────────────────────
CREATE TABLE product_tags (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name_en    text NOT NULL,
  name_bs    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  -- Prevent exact-duplicate EN or BS names (case-insensitive)
  CONSTRAINT product_tags_name_en_unique UNIQUE (name_en),
  CONSTRAINT product_tags_name_bs_unique UNIQUE (name_bs)
);

ALTER TABLE product_tags ENABLE ROW LEVEL SECURITY;

-- Public can read tags (needed by shop filter and product pages)
CREATE POLICY "public read product_tags"
  ON product_tags FOR SELECT TO anon, authenticated
  USING (true);

-- Admin-only write
CREATE POLICY "admin write product_tags"
  ON product_tags FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- ── Join table ────────────────────────────────────────────────────────────────
CREATE TABLE product_tag_assignments (
  product_id bigint NOT NULL REFERENCES products(id)     ON DELETE CASCADE,
  tag_id     bigint NOT NULL REFERENCES product_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, tag_id)
);

ALTER TABLE product_tag_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read product_tag_assignments"
  ON product_tag_assignments FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "admin write product_tag_assignments"
  ON product_tag_assignments FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- Index for lookups by tag (common for shop filtering)
CREATE INDEX product_tag_assignments_tag_id_idx
  ON product_tag_assignments (tag_id);
