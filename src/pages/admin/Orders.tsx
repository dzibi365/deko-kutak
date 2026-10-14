import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { classifyImageValue } from "../../lib/customerUpload";

type OrderItem = {
  name: string;
  name_en: string | null;
  price: number;
  quantity: number;
  image_url: string | null;
  customizations?: Record<string, string>;
};

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
  items: OrderItem[];
  subtotal: number;
  shipping_cost: number;
  total: number;
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

// Extracts the storage object path from a legacy public CDN URL.
// Returns null for URLs that don't belong to this project's customer-uploads bucket.
const SUPABASE_PROJECT_ORIGIN = new URL(import.meta.env.VITE_SUPABASE_URL as string).origin;
const LEGACY_PREFIX = "/storage/v1/object/public/customer-uploads/";

function extractCustomerUploadPath(legacyUrl: string): string | null {
  try {
    const parsed = new URL(legacyUrl);
    if (parsed.origin !== SUPABASE_PROJECT_ORIGIN) return null;
    if (!parsed.pathname.startsWith(LEGACY_PREFIX)) return null;
    const decoded = decodeURIComponent(parsed.pathname.slice(LEGACY_PREFIX.length));
    return decoded || null;
  } catch {
    return null;
  }
}

// Renders a customization image for admin. Covers three cases:
// 1. storage-path (UUID.ext): signs via the admin SELECT RLS policy.
// 2. legacy-url from this project's customer-uploads bucket: extracts the path
//    and signs it the same way — bucket is now private, public URLs return 400.
// 3. legacy-url from an unrelated origin: renders directly (early external photos).
function AdminSignedImage({ value, label }: { value: string; label: string }) {
  const type = classifyImageValue(value);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (type === "storage-path") {
        const { data } = await supabase.storage
          .from("customer-uploads")
          .createSignedUrl(value, 3600);
        if (!cancelled) {
          if (data?.signedUrl) setUrl(data.signedUrl);
          else setFailed(true);
        }
      } else if (type === "legacy-url") {
        const path = extractCustomerUploadPath(value);
        if (!path) {
          // Not a customer-uploads URL — render the external URL directly.
          if (!cancelled) setUrl(value);
          return;
        }
        const { data } = await supabase.storage
          .from("customer-uploads")
          .createSignedUrl(path, 3600);
        if (!cancelled) {
          if (data?.signedUrl) setUrl(data.signedUrl);
          else setFailed(true);
        }
      }
    }

    resolve();
    return () => { cancelled = true; };
  }, [value, type]);

  if (failed) {
    return (
      <div className="w-20 h-20 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center">
        <span className="text-xs text-red-400">Missing</span>
      </div>
    );
  }

  if (!url) {
    return (
      <div className="w-20 h-20 rounded-lg bg-gray-100 animate-pulse" />
    );
  }

  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img
        src={url}
        alt={label}
        className="w-20 h-20 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
      />
    </a>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);
  const [resendResult, setResendResult] = useState<Record<number, string>>({});
  // Pending status per order — holds an unsaved dropdown selection
  const [pendingStatuses, setPendingStatuses] = useState<Record<number, string>>({});

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveStatus(order: Order) {
    const newStatus = pendingStatuses[order.id] ?? order.status;
    if (newStatus === order.status) return;

    setUpdatingId(order.id);
    await supabase.from("orders").update({ status: newStatus }).eq("id", order.id);
    setUpdatingId(null);
    // Clear pending selection
    setPendingStatuses((prev) => { const next = { ...prev }; delete next[order.id]; return next; });
    load();

    // Fire status notification — server-side, fire-and-forget
    if (newStatus === "shipped" || newStatus === "delivered") {
      setNotifyingId(order.id);
      supabase.functions
        .invoke("send-status-email", {
          body: { orderId: order.id, notificationType: newStatus },
        })
        .finally(() => setNotifyingId(null));
    }
  }

  async function resendEmails(order: Order) {
    setResendingId(order.id);
    setResendResult((prev) => { const n = { ...prev }; delete n[order.id]; return n; });
    try {
      const { data } = await supabase.functions.invoke("send-order-email", {
        body: { adminRetryOrderId: order.id },
      });
      const sent = [
        data?.customer_sent ? "customer" : null,
        data?.owner_sent ? "owner" : null,
      ].filter(Boolean);
      setResendResult((prev) => ({
        ...prev,
        [order.id]: sent.length > 0
          ? `Sent: ${sent.join(", ")}`
          : "No new emails sent (already delivered)",
      }));
    } catch {
      setResendResult((prev) => ({ ...prev, [order.id]: "Failed — check EF logs" }));
    } finally {
      setResendingId(null);
    }
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
                    {notifyingId === order.id && (
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <span className="inline-block w-2.5 h-2.5 border-2 border-gray-300 border-t-copper rounded-full animate-spin" />
                        Sending email…
                      </span>
                    )}
                    <span className="text-xs text-gray-400 capitalize">
                      {order.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{order.customer_name} · {order.customer_city}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-semibold text-navy">{order.total.toFixed(2)} KM</p>
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
                          value={pendingStatuses[order.id] ?? order.status}
                          disabled={updatingId === order.id}
                          onChange={(e) => setPendingStatuses((prev) => ({ ...prev, [order.id]: e.target.value }))}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                          ))}
                        </select>
                        {pendingStatuses[order.id] && pendingStatuses[order.id] !== order.status && (
                          <button
                            onClick={() => saveStatus(order)}
                            disabled={updatingId === order.id}
                            className="mt-2 w-full py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60"
                          >
                            {updatingId === order.id ? "Saving…" : "Save status"}
                          </button>
                        )}
                      </div>
                      {order.note && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Note</p>
                          <p className="text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{order.note}</p>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Emails</p>
                        <button
                          onClick={() => resendEmails(order)}
                          disabled={resendingId === order.id}
                          className="w-full py-2 border border-gray-200 text-sm text-navy rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
                        >
                          {resendingId === order.id ? "Sending…" : "Resend confirmation emails"}
                        </button>
                        {resendResult[order.id] && (
                          <p className="text-xs text-gray-500 mt-1.5">{resendResult[order.id]}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</p>
                    <div className="flex flex-col gap-3">
                      {order.items.map((item, idx) => {
                        const customEntries = item.customizations
                          ? Object.entries(item.customizations).filter(([, v]) => v)
                          : [];
                        return (
                          <div key={idx} className="flex flex-col gap-2">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                                {item.image_url && <img src={item.image_url} alt={item.name_en ?? item.name} className="w-full h-full object-cover" />}
                              </div>
                              <span className="text-sm text-navy flex-1">{item.name_en ?? item.name}</span>
                              <span className="text-xs text-gray-400">× {item.quantity}</span>
                              <span className="text-sm font-semibold text-navy">{(item.price * item.quantity).toFixed(2)} KM</span>
                            </div>
                            {customEntries.length > 0 && (
                              <div className="ml-13 pl-13 flex flex-col gap-1.5 ml-[52px] border-l-2 border-gray-100 pl-3">
                                {customEntries.map(([label, value]) => {
                                  const imageType = classifyImageValue(value);
                                  const isImage = imageType !== "other";
                                  return (
                                    <div key={label} className="flex items-start gap-2">
                                      <span className="text-xs font-medium text-gray-400 whitespace-nowrap">{label}:</span>
                                      {isImage ? (
                                        <AdminSignedImage value={value} label={label} />
                                      ) : (
                                        <span className="text-xs text-gray-600">{value}</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex flex-col gap-1.5 mt-3 pt-3 border-t border-gray-100">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Subtotal</span>
                        <span className="text-sm text-navy">{order.subtotal.toFixed(2)} KM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-500">Shipping</span>
                        <span className={`text-sm ${order.shipping_cost === 0 ? "text-green-600 font-medium" : "text-navy"}`}>
                          {order.shipping_cost === 0 ? "Free" : `${order.shipping_cost.toFixed(2)} KM`}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-gray-100 mt-0.5">
                        <span className="text-sm font-semibold text-navy">Total</span>
                        <span className="font-semibold text-navy">{order.total.toFixed(2)} KM</span>
                      </div>
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
