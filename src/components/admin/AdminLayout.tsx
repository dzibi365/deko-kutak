import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Tag, LogOut, Store, ImagePlay, ShoppingBag, Settings } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag, end: false },
  { to: "/admin/products", label: "Products", icon: Package, end: false },
  { to: "/admin/categories", label: "Categories", icon: Tag, end: false },
  { to: "/admin/homepage", label: "Homepage", icon: ImagePlay, end: false },
  { to: "/admin/settings", label: "Settings", icon: Settings, end: false },
];

export function AdminLayout() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        <div className="px-6 py-5 border-b border-gray-200">
          <a href="/" className="flex items-center gap-2 group">
            <Store className="w-5 h-5 text-copper" strokeWidth={1.5} />
            <span className="font-semibold text-navy text-sm">Deko Kutak</span>
          </a>
          <p className="text-[11px] text-gray-400 mt-0.5 ml-7">Admin Panel</p>
        </div>

        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-navy text-white"
                    : "text-gray-600 hover:bg-gray-100 hover:text-navy"
                }`
              }
            >
              <Icon className="w-4 h-4" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-gray-200">
          <p className="text-[11px] text-gray-400 px-3 mb-2 truncate">{user?.email}</p>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.75} />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
