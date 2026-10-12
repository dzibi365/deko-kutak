import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-sm text-gray-400">Loading…</span>
      </div>
    );
  }

  if (!session) return <Navigate to="/admin/login" replace />;

  // Require app_metadata.role === "admin" — set server-side only via service role.
  // app_metadata cannot be modified by the user themselves, unlike user_metadata.
  // A customer who edits their own user_metadata cannot bypass this check.
  if (session.user.app_metadata?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
