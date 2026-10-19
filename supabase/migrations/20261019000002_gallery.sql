-- ══════════════════════════════════════════════════════════════════════════════
-- Gallery Phase 1: gallery_categories, gallery_items, gallery_images
-- ══════════════════════════════════════════════════════════════════════════════
--
-- Phase 2 (Custom Creation Requests) is a separate future migration.
--
-- STORAGE NOTE (read before uploading draft photos):
--   Gallery photos are stored in the existing product-images bucket, which is
--   PUBLIC-READ. Any uploaded URL is accessible to anyone who discovers it —
--   path-obscured but not URL-private. The gallery admin UI MUST display a
--   warning: "Photos uploaded here are publicly accessible via their URL, even
--   while this item is a draft. Do not upload sensitive photos before you are
--   comfortable with this." A signed-URL flow is a future Phase 2 enhancement.
--   The customer-uploads bucket must NEVER be used for gallery photos.
--
-- FK TYPE NOTE:
--   products.id is BIGINT (confirmed by live staging query:
--   information_schema.columns.data_type = 'bigint' for products.id).
--   Earlier evidence of INTEGER (v_product_id INTEGER in migration function
--   bodies) reflected implicit narrowing casts, not the actual column DDL.
--   related_product_id is declared BIGINT to match exactly.
--
-- EXISTING TABLES:
--   This migration does NOT touch products, orders, pages, categories, reviews,
--   hero_config, store_settings, field_groups, or any other existing table.
--   No DROP, ALTER TABLE, or policy changes on existing objects.
--
-- RLS POLICY COUNT: 8 total (2 + 3 + 3 across the three tables).
--
-- IDEMPOTENCY:
--   CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS are idempotent.
--   CREATE OR REPLACE FUNCTION/TRIGGER is idempotent (PostgreSQL 14+).
--   CREATE POLICY is NOT idempotent — running this migration twice will error
--   on the policy names. Supabase migration tooling applies each file exactly
--   once, so this is safe in normal operation.

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNCTION: updated_at trigger for gallery_items
-- ─────────────────────────────────────────────────────────────────────────────
-- No existing set_updated_at() in this project. Gallery-specific function name
-- avoids any dependency on functions defined in other migrations.

CREATE OR REPLACE FUNCTION public.gallery_items_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: gallery_categories
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gallery_categories (
  id             BIGSERIAL    PRIMARY KEY,
  name_en        TEXT         NOT NULL CHECK (trim(name_en)  <> ''),
  name_bs        TEXT         NOT NULL CHECK (trim(name_bs)  <> ''),
  display_order  INT          NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE gallery_categories ENABLE ROW LEVEL SECURITY;

-- All users (anon + authenticated) may read all category names.
-- Category rows contain no sensitive data. The gallery page frontend must derive
-- filter chips from the published-items fetch result only — never from a
-- standalone gallery_categories query — so that empty/unreleased categories
-- never appear in the public UI.
CREATE POLICY "public read gallery categories"
  ON gallery_categories FOR SELECT
  USING (true);

CREATE POLICY "admin write gallery categories"
  ON gallery_categories FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: gallery_items
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gallery_items (
  id                 BIGSERIAL    PRIMARY KEY,
  title_en           TEXT         NOT NULL CHECK (trim(title_en) <> ''),
  title_bs           TEXT         NOT NULL CHECK (trim(title_bs) <> ''),
  description_en     TEXT,
  description_bs     TEXT,
  cover_image_url    TEXT,
  category_id        BIGINT       REFERENCES gallery_categories(id) ON DELETE SET NULL,
  is_published       BOOLEAN      NOT NULL DEFAULT false,
  display_order      INT          NOT NULL DEFAULT 0,
  -- BIGINT matches products.id BIGINT exactly (confirmed on live staging DB).
  related_product_id BIGINT       REFERENCES products(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Publishing requires a non-null, non-whitespace cover image.
  -- Rejects NULL, empty string '', and whitespace-only strings e.g. '   '.
  CONSTRAINT gallery_items_published_requires_cover
    CHECK (is_published = false
           OR (cover_image_url IS NOT NULL AND trim(cover_image_url) <> ''))
);

ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- Public visitors (anon) and authenticated customers see published items only.
-- No TO clause → applies to ALL roles including anon.
-- Intentional deviation from the pages table pattern (TO anon), which accidentally
-- blocks authenticated customers from reading published pages — a pre-existing bug
-- in that table that this migration does not replicate.
CREATE POLICY "public read published gallery items"
  ON gallery_items FOR SELECT
  USING (is_published = true);

-- Admins see all items including drafts.
-- PostgreSQL OR-combines multiple SELECT policies per authenticated user:
--   customer: (is_published=true) OR (is_admin()→false)  = published only  ✓
--   admin:    (is_published=true) OR (is_admin()→true)   = all rows        ✓
CREATE POLICY "admin read all gallery items"
  ON gallery_items FOR SELECT
  TO authenticated
  USING (is_admin());

-- FOR ALL covers INSERT/UPDATE/DELETE for admin. It also applies to SELECT,
-- but the explicit "admin read all" above already handles that via OR-combining —
-- no conflict, no gap.
CREATE POLICY "admin write gallery items"
  ON gallery_items FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

CREATE OR REPLACE TRIGGER gallery_items_updated_at
  BEFORE UPDATE ON gallery_items
  FOR EACH ROW EXECUTE FUNCTION public.gallery_items_set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLE: gallery_images
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gallery_images (
  id              BIGSERIAL    PRIMARY KEY,
  gallery_item_id BIGINT       NOT NULL REFERENCES gallery_items(id) ON DELETE CASCADE,
  image_url       TEXT         NOT NULL CHECK (trim(image_url) <> ''),
  caption_en      TEXT,
  caption_bs      TEXT,
  display_order   INT          NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

ALTER TABLE gallery_images ENABLE ROW LEVEL SECURITY;

-- Public SELECT via correlated subquery: only images whose parent item is published.
-- Prevents integer enumeration of images from draft items even if gallery_item_id
-- is guessed directly via a raw REST request against this table.
CREATE POLICY "public read published gallery images"
  ON gallery_images FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM   gallery_items gi
      WHERE  gi.id = gallery_item_id
        AND  gi.is_published = true
    )
  );

-- Admins see all images including those attached to unpublished items.
CREATE POLICY "admin read all gallery images"
  ON gallery_images FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "admin write gallery images"
  ON gallery_images FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_gallery_items_published_order
  ON gallery_items (is_published, display_order);

CREATE INDEX IF NOT EXISTS idx_gallery_items_category
  ON gallery_items (category_id);

CREATE INDEX IF NOT EXISTS idx_gallery_images_item_order
  ON gallery_images (gallery_item_id, display_order);
