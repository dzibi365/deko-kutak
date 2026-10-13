-- Phase 4.2C-5D: Secure customer-uploads bucket
--
-- Section 7A: Remove the anonymous INSERT policy that allowed direct client
-- uploads to the customer-uploads bucket.  All uploads must now go through
-- the customer-upload Edge Function (service_role, with rate limiting, magic-
-- byte validation, and upload session recording).
--
-- Section 7B: Make the customer-uploads bucket private.  CDN public URLs no
-- longer work after this migration.  All file access must go through the
-- sign-image-url Edge Function, which validates the upload token before
-- issuing a 15-minute signed URL.
--
-- PREREQUISITE: Before applying this migration to production or staging, the
-- following must be confirmed:
--   1. The new secure upload code (Phase 4.2C-4 through 5B, commit f3e5010)
--      is deployed to the target Vercel environment.
--   2. A test checkout has been completed on that environment and the resulting
--      order contains a UUID.ext storage path (not a legacy CDN URL) in its
--      items.customizations JSONB.
--   3. The admin panel can display the photo for that test order via signed URL.
--
-- ROLLBACK (manual):
--   CREATE POLICY "Anyone can upload customer files"
--     ON storage.objects FOR INSERT TO anon
--     WITH CHECK (bucket_id = 'customer-uploads');
--
--   UPDATE storage.buckets SET public = true WHERE id = 'customer-uploads';

-- Section 7A — Remove the anonymous INSERT policy.
-- The EF customer-upload uses service_role and does not need an RLS policy.
DROP POLICY IF EXISTS "Anyone can upload customer files" ON storage.objects;

-- Section 7B — Make the bucket private.
-- After this, GET https://...supabase.co/storage/v1/object/public/customer-uploads/...
-- returns 400 for all files.  Signed URLs (900 s TTL) remain the only access path.
UPDATE storage.buckets
SET public = false
WHERE id = 'customer-uploads';
