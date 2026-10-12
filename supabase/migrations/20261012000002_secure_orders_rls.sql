-- Phase 4.2A: Secure orders and order_notifications
--
-- SCHEMA LIMITATION NOTE
-- The orders table has no user_id column.  Orders are placed as guests and
-- the only customer identifier is customer_email.  auth.jwt() ->> 'email' is
-- the Supabase Auth-verified email embedded in the JWT — set by the server
-- during account creation and changeable only through a verified email-change
-- flow.  It is NOT user_metadata.email and cannot be self-assigned.  Using it
-- for order ownership is meaningfully more secure than using the form-supplied
-- customer_email alone, even though it is not as strong as auth.uid().
-- A user_id column can be added in a future migration if needed.
--
-- EDGE FUNCTIONS
-- send-order-email and send-status-email both use SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS entirely.  These functions are unaffected by this migration.
--
-- POLICY EVALUATION
-- Supabase/PostgreSQL applies multiple SELECT policies with OR logic.
-- The admin policy grants all rows; the customer policy grants only matching
-- rows.  An admin user satisfies both, which is correct.

-- ─── orders ──────────────────────────────────────────────────────────────────

-- Remove the two broad policies that granted any authenticated user full access.
DROP POLICY IF EXISTS "auth read orders"   ON orders;
DROP POLICY IF EXISTS "auth update orders" ON orders;

-- Administrators can read all orders (admin panel: Orders.tsx selects all).
CREATE POLICY "admin read orders"
  ON orders FOR SELECT TO authenticated
  USING (is_admin());

-- Customers can read orders where the order's customer_email matches their
-- JWT-verified auth email.  Satisfies Account.tsx: .eq("customer_email", user.email).
CREATE POLICY "customer read own orders"
  ON orders FOR SELECT TO authenticated
  USING (
    (auth.jwt() ->> 'email') = customer_email
  );

-- Only administrators may update order status.
-- admin/Orders.tsx: supabase.from("orders").update({ status }).eq("id", ...)
CREATE POLICY "admin update orders"
  ON orders FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- The existing "public insert orders" policy (anon INSERT) is intentionally
-- preserved — guest checkout inserts orders without authentication.

-- ─── order_notifications ─────────────────────────────────────────────────────

-- Enable RLS.  The table was previously completely unprotected.
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;

-- Administrators may read notification records (e.g. for future admin tooling).
CREATE POLICY "admin read order_notifications"
  ON order_notifications FOR SELECT TO authenticated
  USING (is_admin());

-- No INSERT / UPDATE policies are created here.
-- The send-status-email Edge Function uses SUPABASE_SERVICE_ROLE_KEY, which
-- bypasses RLS.  No frontend code writes to order_notifications, so no
-- frontend INSERT policy is needed or desirable.
