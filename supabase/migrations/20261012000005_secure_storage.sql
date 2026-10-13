-- Phase 4.2C-1: Tier 1 Storage Hardening
--
-- BUCKET INVENTORY (pre-migration)
--   product-images  121 files, ~111 MB — WEBP(91), PNG(20), JPEG(10)
--   models            5 files,  ~49 MB — application/octet-stream (GLB)
--   customer-uploads 62 files,  ~46 MB — PNG(35), JPEG(19), WEBP(8)
--
-- PRE-FLIGHT ACCEPT ATTRIBUTE AUDIT (no silently broken functionality)
--   product-images:
--     ProductForm.tsx:321,354 — accept="image/jpeg,image/png,image/webp"   covered
--     StoreSettings.tsx:305,361 — accept="image/*"                         covered (jpeg/png/webp/gif)
--     StoreSettings.tsx:770 — accept="image/jpeg,image/png,image/webp"     covered
--     RichTextEditor.tsx:245 — accept="image/*"                            covered (gif added for this)
--     Categories.tsx:163 — accept="image/*"                                covered (gif added for this)
--   models:
--     ProductForm.tsx:418 — accept=".glb,.gltf"
--     GLB files upload as application/octet-stream (confirmed from bucket metadata)
--     Both model/gltf-binary and application/octet-stream allowed.
--   customer-uploads:
--     PersonalizationModal.tsx:310 — accept="image/*"  (see RISK NOTE below)
--     ProductDetail.tsx:605 — accept="image/jpeg,image/png,image/webp"     covered
--
-- RISK NOTE — customer-uploads MIME restriction
--   PersonalizationModal.tsx uses accept="image/*", which is broader than
--   the server allowlist image/jpeg, image/png, image/webp.
--   A customer uploading HEIC or AVIF will receive a server-side rejection.
--   All 62 existing files are JPEG/PNG/WEBP — no current user impact.
--   Narrowing the accept= attribute to match is deferred to Phase 4.2C-2
--   to keep this migration DB-only.
--
-- EXISTING POLICIES DROPPED IN THIS MIGRATION
--
--   product-images (keep "public read product images" — CDN access unchanged):
--     "auth upload product images"           INSERT TO authenticated, no is_admin check
--     "Authenticated users can upload brand assets"  INSERT duplicate, no is_admin check
--     "Authenticated users can update brand assets"  UPDATE, no is_admin check
--     "auth delete product images"           DELETE, no is_admin check
--
--   models (keep "Public read access for models" — storefront 3D viewer unchanged):
--     "Public read models"                   duplicate SELECT, redundant
--     "Auth upload models"                   INSERT TO authenticated, no is_admin check
--
--   customer-uploads (keep "Anyone can upload customer files" — personalization unchanged):
--     "Anyone can read customer files"       SELECT TO anon — removes unauthenticated list

-- ─── product-images ────────────────────────────────────────────────────────────

DROP POLICY "auth upload product images"                  ON storage.objects;
DROP POLICY "Authenticated users can upload brand assets" ON storage.objects;
DROP POLICY "Authenticated users can update brand assets" ON storage.objects;
DROP POLICY "auth delete product images"                  ON storage.objects;

CREATE POLICY "admin upload product images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "admin update product images"
  ON storage.objects FOR UPDATE TO authenticated
  USING     (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "admin delete product images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND public.is_admin());

-- "public read product images" (SELECT TO anon, USING bucket_id = 'product-images') unchanged.

UPDATE storage.buckets
SET
  file_size_limit    = 10485760,  -- 10 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
WHERE id = 'product-images';

-- ─── models ────────────────────────────────────────────────────────────────────

DROP POLICY "Public read models"  ON storage.objects;  -- duplicate of "Public read access for models"
DROP POLICY "Auth upload models"  ON storage.objects;

CREATE POLICY "admin upload models"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'models' AND public.is_admin());

CREATE POLICY "admin update models"
  ON storage.objects FOR UPDATE TO authenticated
  USING     (bucket_id = 'models' AND public.is_admin())
  WITH CHECK (bucket_id = 'models' AND public.is_admin());

CREATE POLICY "admin delete models"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'models' AND public.is_admin());

-- "Public read access for models" (SELECT TO anon, USING bucket_id = 'models') unchanged.

UPDATE storage.buckets
SET
  file_size_limit    = 52428800,  -- 50 MB
  allowed_mime_types = ARRAY['model/gltf-binary', 'application/octet-stream']
WHERE id = 'models';

-- ─── customer-uploads ──────────────────────────────────────────────────────────

DROP POLICY "Anyone can read customer files" ON storage.objects;

-- Admins can list (SELECT) and remove (DELETE) uploaded personalisation images.
CREATE POLICY "admin list customer uploads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'customer-uploads' AND public.is_admin());

CREATE POLICY "admin delete customer uploads"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'customer-uploads' AND public.is_admin());

-- "Anyone can upload customer files" (INSERT TO anon, WITH CHECK bucket_id = 'customer-uploads') unchanged.
-- Guest personalisation uploads continue to work; no authenticated SELECT needed by storefront.

UPDATE storage.buckets
SET
  file_size_limit    = 5242880,   -- 5 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'customer-uploads';
