-- Secure administrator identity helper
--
-- Reads app_metadata.role from the current JWT.
-- app_metadata is set server-side only (service role / Supabase dashboard).
-- It cannot be modified by the user themselves, unlike user_metadata.
--
-- Usage in RLS policies:  USING (is_admin())
-- Usage in SQL:           SELECT is_admin();

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Revoke direct execution from public; the function is called via RLS which
-- always runs in a Supabase security context that can reach auth.jwt().
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO anon;
