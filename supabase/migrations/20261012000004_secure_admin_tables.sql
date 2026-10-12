-- Phase 4.2B: Secure admin-managed tables
--
-- PROBLEM SUMMARY (all issues confirmed by pre-migration policy inspection)
--
--   products, categories, hero_config, store_settings
--     "auth write *" policies used USING (auth.role() = 'authenticated').
--     Any authenticated customer could INSERT, UPDATE, or DELETE store data.
--
--   pages
--     "auth write pages" — same broad write flaw.
--     "auth read all pages" — any authenticated customer could read draft pages
--     (is_published = false).
--
--   field_groups
--     RLS was never enabled.  The table was completely unprotected.
--     Only admin/ProductForm.tsx reads field_groups; no storefront access needed.
--
--   reviews — five broken policies:
--     "Admin can approve reviews"  USING true → any authenticated user could
--       UPDATE any review, including setting approved = true on their own.
--     "Admin can delete reviews"   USING true → any authenticated user could
--       DELETE any review.
--     "Owner update"               no WITH CHECK → a customer could self-approve
--       their review via UPDATE.  Also, there is no customer edit-review UI
--       (ReviewsSection.tsx only INSERT + DELETE), making this policy unnecessary.
--     "Public read"                USING true → unapproved reviews were visible
--       publicly (leaking user names, unmoderated comments).
--     "Auth insert"                WITH CHECK only checked user_id, not approved.
--       A customer could send approved=true in the payload to bypass moderation.
--       (reviews.approved has DEFAULT false, confirmed.)
--
-- STORE_SETTINGS SENSITIVITY NOTE
--   owner_email and email_enabled are internal admin config that ideally should
--   not be part of the public SELECT.  However bank_name, bank_account_holder,
--   and bank_iban are required by OrderConfirmation.tsx via the public Supabase
--   client and must remain readable.  Separating these would require a second
--   table ("admin_settings").  Write protection is implemented here; column-level
--   read restriction is deferred and flagged for a future phase.

-- ─── products ─────────────────────────────────────────────────────────────────

DROP POLICY "auth write products" ON products;

CREATE POLICY "admin write products"
  ON products FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- "public read products" (USING true) is unchanged.

-- ─── categories ───────────────────────────────────────────────────────────────

DROP POLICY "auth write categories" ON categories;

CREATE POLICY "admin write categories"
  ON categories FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- "public read categories" (USING true) is unchanged.

-- ─── hero_config ──────────────────────────────────────────────────────────────

DROP POLICY "auth write hero" ON hero_config;

CREATE POLICY "admin write hero"
  ON hero_config FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- "public read hero" (USING true) is unchanged.

-- ─── store_settings ───────────────────────────────────────────────────────────

DROP POLICY "auth write store_settings" ON store_settings;

CREATE POLICY "admin write store_settings"
  ON store_settings FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- "public read store_settings" (USING true) is unchanged.
-- owner_email / email_enabled exposure noted above — deferred to a future phase.

-- ─── pages ────────────────────────────────────────────────────────────────────

-- Any authenticated customer could read drafts and write pages.
DROP POLICY "auth read all pages" ON pages;
DROP POLICY "auth write pages"    ON pages;

-- Admin sees all pages including drafts.
CREATE POLICY "admin read all pages"
  ON pages FOR SELECT TO authenticated
  USING (is_admin());

-- Admin can INSERT / UPDATE / DELETE pages.
CREATE POLICY "admin write pages"
  ON pages FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- "public read published pages" (TO anon, USING is_published = true) is unchanged.

-- ─── field_groups ─────────────────────────────────────────────────────────────

-- RLS was disabled — enable it before adding policies.
ALTER TABLE field_groups ENABLE ROW LEVEL SECURITY;

-- Admin panel (ProductForm.tsx, FieldGroups.tsx) is the only consumer of this
-- table.  No storefront component queries field_groups directly; personalisation
-- fields are stored denormalised in products.custom_fields (JSONB).
CREATE POLICY "admin manage field_groups"
  ON field_groups FOR ALL TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- ─── reviews ──────────────────────────────────────────────────────────────────

-- Remove all five broken policies.
DROP POLICY "Public read"               ON reviews;
DROP POLICY "Auth insert"               ON reviews;
DROP POLICY "Owner update"              ON reviews;
DROP POLICY "Admin can approve reviews" ON reviews;
DROP POLICY "Admin can delete reviews"  ON reviews;

-- Public (anon + authenticated): only approved reviews are visible.
-- Prevents unapproved / moderation-pending reviews from leaking.
CREATE POLICY "public read approved reviews"
  ON reviews FOR SELECT TO public
  USING (approved = true);

-- Admin sees all reviews (including pending) for the moderation panel.
CREATE POLICY "admin read reviews"
  ON reviews FOR SELECT TO authenticated
  USING (is_admin());

-- Customers may submit a review for any product, associated to their own user_id.
-- WITH CHECK also requires approved = false so a customer cannot inject an
-- already-approved review.  The column default is false, so normal inserts
-- (without an approved field in the payload) always satisfy this condition.
CREATE POLICY "customer insert review"
  ON reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT approved);

-- No customer UPDATE policy.
-- ReviewsSection.tsx has no edit-review UI — only insert and delete.
-- Dropping "Owner update" eliminates the self-approval vector entirely.

-- Administrators can UPDATE any review (approve, edit content, etc.).
CREATE POLICY "admin update reviews"
  ON reviews FOR UPDATE TO authenticated
  USING    (is_admin())
  WITH CHECK (is_admin());

-- Customers can retract their own review.
-- "Owner delete" USING (auth.uid() = user_id) is unchanged.

-- Administrators can delete any review.
CREATE POLICY "admin delete reviews"
  ON reviews FOR DELETE TO authenticated
  USING (is_admin());
