import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Order = {
  id: number;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_address: string;
  customer_city: string;
  customer_postal: string | null;
  payment_method: string;
  items: Array<{ name: string; name_en: string | null; price: number; quantity: number; image_url: string | null }>;
  subtotal: number;
  status: string;
  note: string | null;
  created_at: string;
};

const STATUS_OPTIONS = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  shipped:   "bg-purple-50 text-purple-700 border-purple-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-500 border-red-200",
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: number, status: string) {
    setUpdatingId(id);
    await supabase.from("orders").update({ status }).eq("id", id);
    setUpdatingId(null);
    load();
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-navy mb-1">Orders</h1>
      <p className="text-sm text-gray-400 mb-8">{orders.length} order{orders.length !== 1 ? "s" : ""} total</p>

      {loading ? (
        <div className="text-sm text-gray-400">Loading…</div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-sm text-gray-400">
          No orders yet.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-semibold text-navy text-sm">{order.order_number}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {order.status}
                    </span>
                    <span className="text-xs text-gray-400 capitalize">
                      {order.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{order.customer_name} · {order.customer_city}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-navy">{order.subtotal.toFixed(2)} KM</p>
                  <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
                </div>
              </div>

              {/* Expanded detail */}
              {expanded === order.id && (
                <div className="border-t border-gray-100 px-5 py-5 flex flex-col gap-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Customer */}
                    <div className="flex flex-col gap-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Customer</p>
                      <p className="text-sm font-medium text-navy">{order.customer_name}</p>
                      <p className="text-sm text-gray-500">{order.customer_email}</p>
                      {order.customer_phone && <p className="text-sm text-gray-500">{order.customer_phone}</p>}
                      <p className="text-sm text-gray-500">{order.customer_address}, {order.customer_city}{order.customer_postal ? ` ${order.customer_postal}` : ""}</p>
                    </div>
                    {/* Status + note */}
                    <div className="flex flex-col gap-3">
                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Status</p>
                        <select
                          value={order.status}
                          disabled={updatingId === order.id}
                          onChange={(e) => updateStatus(order.id, e.target.value)}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      {order.note && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Note</p>
                          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{order.note}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</p>
                    <div className="flex flex-col gap-2">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            {item.image_url && <img src={item.image_url} alt={item.name_en ?? item.name} className="w-full h-full object-cover" />}
                          </div>
                          <span className="text-sm text-navy flex-1">{item.name_en ?? item.name}</span>
                          <span className="text-xs text-gray-400">× {item.quantity}</span>
                          <span className="text-sm font-semibold text-navy">{(item.price * item.quantity).toFixed(2)} KM</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-3 pt-3 border-t border-gray-100">
                      <span className="text-sm text-gray-500">Total</span>
                      <span className="font-semibold text-navy">{order.subtotal.toFixed(2)} KM</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
