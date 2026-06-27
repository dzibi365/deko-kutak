import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, LogOut, ArrowLeft } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useLang } from "../context/LanguageContext";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";

type Order = {
  id: number;
  order_number: string;
  created_at: string;
  status: string;
  subtotal: number;
  payment_method: string;
  items: Array<{ name: string; name_en?: string; quantity: number; price: number }>;
};

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-700",
  confirmed: "bg-blue-100 text-blue-700",
  shipped:   "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

function AccountContent() {
  const { user, signOut, openModal } = useCustomerAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("orders")
      .select("*")
      .eq("customer_email", user.email)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setOrders(data ?? []); setLoading(false); });
  }, [user]);

  const name = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Customer";

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center flex flex-col items-center gap-4">
        <p className="text-navy/50">{lang === "bs" ? "Prijavite se za pristup svom računu." : "Sign in to access your account."}</p>
        <button onClick={openModal}
          className="px-5 py-2.5 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors">
          {lang === "bs" ? "Prijava" : "Sign in"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <button onClick={() => navigate("/")}
        className="flex items-center gap-2 text-sm text-navy/60 hover:text-navy transition-colors mb-8 group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
        {lang === "bs" ? "Nazad na prodavnicu" : "Back to shop"}
      </button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-navy">
            {lang === "bs" ? "Moj račun" : "My Account"}
          </h1>
          <p className="text-sm text-navy/50 mt-1">{user.email}</p>
        </div>
        <button onClick={signOut}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-navy border border-gray-200 px-4 py-2 rounded-xl hover:border-navy/30 transition-colors">
          <LogOut className="w-4 h-4" strokeWidth={1.75} />
          {lang === "bs" ? "Odjava" : "Sign out"}
        </button>
      </div>

      {/* Profile card */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-navy/10 flex items-center justify-center font-semibold text-navy text-lg flex-shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="font-semibold text-navy">{name}</p>
          <p className="text-sm text-gray-400">{user.email}</p>
        </div>
      </div>

      {/* Orders */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Package className="w-4 h-4 text-navy/50" strokeWidth={1.75} />
          <h2 className="font-semibold text-navy text-sm">
            {lang === "bs" ? "Moje narudžbe" : "My Orders"}
          </h2>
        </div>

        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            {lang === "bs" ? "Učitavanje…" : "Loading…"}
          </div>
        ) : orders.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-navy/40">
              {lang === "bs" ? "Još nema narudžbi." : "No orders yet."}
            </p>
            <button onClick={() => navigate("/")}
              className="mt-4 text-sm font-semibold text-navy underline underline-offset-4">
              {lang === "bs" ? "Počnite kupovati" : "Start shopping"}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {orders.map((order) => (
              <div key={order.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="font-semibold text-navy text-sm">{order.order_number}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {new Date(order.created_at).toLocaleDateString(lang === "bs" ? "hr-BA" : "en-GB", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                    {" · "}
                    {order.items.length} {order.items.length === 1
                      ? (lang === "bs" ? "artikal" : "item")
                      : (lang === "bs" ? "artikla" : "items")}
                    {" · "}
                    {order.payment_method === "cod"
                      ? (lang === "bs" ? "Pouzećem" : "Cash on Delivery")
                      : (lang === "bs" ? "Uplata na račun" : "Bank Transfer")}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-navy">{order.subtotal.toFixed(2)} KM</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Account() {
  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col">
      <Navbar />
      <CartDrawer />
      <AuthModal />
      <main className="flex-1">
        <AccountContent />
      </main>
      <Footer />
    </div>
  );
}
