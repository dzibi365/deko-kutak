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

  // Block customer accounts (created via product review signup) from accessing admin
  if (session.user.user_metadata?.role === "customer") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
