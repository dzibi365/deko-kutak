import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShoppingBag, Package, Clock, TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase";

type OrderRow = {
  id: number;
  order_number: string;
  total: number;
  status: string;
  created_at: string;
};

type Period = 7 | 30 | 90;

// Statuses that count as revenue (not cancelled)
const REVENUE_STATUSES = new Set(["pending", "confirmed", "shipped", "delivered"]);

const STATUS_LABELS: Record<string, string> = {
  pending:   "Na čekanju",
  confirmed: "Potvrđena",
  shipped:   "Poslana",
  delivered: "Isporučena",
  cancelled: "Otkazana",
};

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  confirmed: "bg-blue-50 text-blue-700 border-blue-200",
  shipped:   "bg-purple-50 text-purple-700 border-purple-200",
  delivered: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-red-50 text-red-500 border-red-200",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("bs-BA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Sales chart ──────────────────────────────────────────────────────────────

const CW = 540; // chart area width
const CH = 110; // chart area height
const ML = 52;  // left margin (y-axis labels)
const MT = 10;  // top margin
const MB = 32;  // bottom margin (x-axis labels)
const MR = 8;   // right margin
const VW = ML + CW + MR;
const VH = MT + CH + MB;

type ChartDay = { date: string; label: string; revenue: number };

function buildDays(orders: OrderRow[], period: Period): ChartDay[] {
  const revenueMap = new Map<string, number>();
  const cutoffTs = Date.now() - (period - 1) * 86400_000;

  for (const o of orders) {
    if (!REVENUE_STATUSES.has(o.status)) continue;
    const ts = new Date(o.created_at).getTime();
    if (ts < cutoffTs) continue;
    const d = o.created_at.slice(0, 10);
    revenueMap.set(d, (revenueMap.get(d) ?? 0) + o.total);
  }

  const days: ChartDay[] = [];
  for (let i = period - 1; i >= 0; i--) {
    const dt = new Date(Date.now() - i * 86400_000);
    const dateStr = dt.toISOString().slice(0, 10);
    // Use local-time date for label formatting
    const local = new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
    // "15. sep", "5. okt" — numeric day + abbreviated month in Bosnian
    const label =
      period === 7
        ? local.toLocaleDateString("bs-BA", { weekday: "short" })
        : `${local.getDate()}. ${local.toLocaleDateString("bs-BA", { month: "short" })}`;
    days.push({ date: dateStr, label, revenue: revenueMap.get(dateStr) ?? 0 });
  }
  return days;
}

function SalesChart({ orders, period }: { orders: OrderRow[]; period: Period }) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const days = useMemo(() => buildDays(orders, period), [orders, period]);

  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  const barStep = CW / period;
  const barW = Math.max(barStep - 3, 2);
  const labelEvery = period === 7 ? 1 : period === 30 ? 5 : 15;

  // Three y-axis reference lines at 0%, 50%, 100%
  const yRefs = [0, 0.5, 1].map((frac) => ({
    y: MT + CH - frac * CH,
    label: frac === 0 ? "0" : `${Math.round(maxRevenue * frac)} KM`,
  }));

  const hDay = hoverIdx !== null ? days[hoverIdx] : null;

  return (
    <div className="relative select-none">
      <svg
        viewBox={`0 0 ${VW} ${VH}`}
        className="w-full h-auto"
        onMouseLeave={() => setHoverIdx(null)}
      >
        {/* Horizontal grid + y-axis labels */}
        {yRefs.map(({ y, label }) => (
          <g key={y}>
            <line x1={ML} x2={ML + CW} y1={y} y2={y} stroke="#E5E7EB" strokeWidth={1} />
            <text x={ML - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#9CA3AF">
              {label}
            </text>
          </g>
        ))}

        {/* Bars + x-axis labels */}
        {days.map((day, i) => {
          const barH = Math.max((day.revenue / maxRevenue) * CH, day.revenue > 0 ? 2 : 0);
          const bx = ML + i * barStep + (barStep - barW) / 2;
          const by = MT + CH - barH;
          const isHov = hoverIdx === i;

          // Tooltip: clamp horizontally so it doesn't overflow
          const tipCx = ML + i * barStep + barStep / 2;
          const tipW = 72;
          const tipX = Math.max(ML + tipW / 2 + 2, Math.min(ML + CW - tipW / 2 - 2, tipCx));
          const tipY = Math.max(MT + 4, by - 8);

          return (
            <g key={day.date}>
              {/* Invisible hover target spanning full column height */}
              <rect
                x={ML + i * barStep}
                y={MT}
                width={barStep}
                height={CH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />

              {/* Bar */}
              {barH > 0 && (
                <rect
                  x={bx}
                  y={by}
                  width={barW}
                  height={barH}
                  rx={Math.min(barW / 2, 3)}
                  fill={isHov ? "#c8813a" : "#1a1a2e"}
                  style={{ transition: "fill 0.1s" }}
                />
              )}

              {/* X-axis label */}
              {i % labelEvery === 0 && (
                <text
                  x={ML + i * barStep + barStep / 2}
                  y={MT + CH + MB - 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#9CA3AF"
                >
                  {day.label}
                </text>
              )}

              {/* Inline tooltip above hovered bar */}
              {isHov && (
                <g>
                  <rect x={tipX - tipW / 2} y={tipY - 18} width={tipW} height={20} rx={4} fill="white" stroke="#E5E7EB" strokeWidth={1} />
                  <text x={tipX} y={tipY - 4} textAnchor="middle" fontSize={10} fill="#1a1a2e" fontWeight="600">
                    {day.revenue.toFixed(2)} KM
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* Date label below tooltip */}
      {hDay && (
        <p className="absolute top-1 right-2 text-xs text-gray-400 pointer-events-none">
          {hDay.date}
        </p>
      )}
    </div>
  );
}

// ── Main dashboard ───────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [totalProducts, setTotalProducts] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const [period, setPeriod] = useState<Period>(30);

  useEffect(() => {
    async function load() {
      const [ordersRes, productsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, total, status, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true }),
      ]);

      if (ordersRes.error || productsRes.error) {
        setError(true);
        return;
      }

      setOrders(ordersRes.data ?? []);
      setTotalProducts(productsRes.count ?? 0);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    if (!orders) return null;
    const totalSales = orders
      .filter((o) => REVENUE_STATUSES.has(o.status))
      .reduce((sum, o) => sum + o.total, 0);
    return {
      totalSales,
      totalOrders: orders.length,
      pendingOrders: orders.filter((o) => o.status === "pending").length,
    };
  }, [orders]);

  const latestOrders = orders?.slice(0, 5) ?? [];
  const loading = orders === null || totalProducts === null;

  if (error) {
    return (
      <div className="p-6 lg:p-8">
        <h1 className="text-2xl font-semibold text-navy mb-1">Dashboard</h1>
        <div className="mt-8 bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-600">
          Greška pri učitavanju podataka. Osvježite stranicu.
        </div>
      </div>
    );
  }

  const kpiCards = [
    {
      label: "Vrijednost narudžbi",
      value: stats ? `${stats.totalSales.toFixed(2)} KM` : null,
      icon: TrendingUp,
      iconClass: "text-copper",
    },
    {
      label: "Ukupno narudžbi",
      value: stats ? String(stats.totalOrders) : null,
      icon: ShoppingBag,
      iconClass: "text-navy",
    },
    {
      label: "Na čekanju",
      value: stats ? String(stats.pendingOrders) : null,
      icon: Clock,
      iconClass: "text-amber-500",
    },
    {
      label: "Ukupno proizvoda",
      value: totalProducts !== null ? String(totalProducts) : null,
      icon: Package,
      iconClass: "text-navy",
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      <h1 className="text-2xl font-semibold text-navy mb-1">Dashboard</h1>
      <p className="text-sm text-gray-400 mb-8">Pregled prodavnice</p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpiCards.map(({ label, value, icon: Icon, iconClass }) =>
          loading ? (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
              <div className="h-4 w-28 bg-gray-100 rounded mb-4" />
              <div className="h-7 w-20 bg-gray-100 rounded" />
            </div>
          ) : (
            <div key={label} className="bg-white border border-gray-200 rounded-xl p-6">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{label}</p>
                <Icon className={`w-5 h-5 ${iconClass}`} strokeWidth={1.75} />
              </div>
              <p className="text-2xl font-semibold text-navy">{value}</p>
            </div>
          )
        )}
      </div>

      {/* Sales chart */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-navy">Vrijednost narudžbi</h2>
          <div className="flex gap-1">
            {([7, 30, 90] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  period === p
                    ? "bg-navy text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {p} dana
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-44 bg-gray-50 rounded-lg animate-pulse" />
        ) : orders!.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-sm text-gray-400">
            Nema podataka za prikaz
          </div>
        ) : (
          <SalesChart orders={orders!} period={period} />
        )}
      </div>

      {/* Latest orders */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-navy">Najnovije narudžbe</h2>
          <Link
            to="/admin/orders"
            className="text-xs text-gray-400 hover:text-navy transition-colors"
          >
            Prikaži sve →
          </Link>
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-6 py-4 animate-pulse flex items-center gap-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-100 rounded" />
                  <div className="h-3 w-20 bg-gray-100 rounded" />
                </div>
                <div className="h-4 w-16 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : latestOrders.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            Nema narudžbi
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {latestOrders.map((order) => (
              <Link
                key={order.id}
                to={`/admin/orders?expand=${order.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-navy group-hover:text-navy/80">
                      {order.order_number}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                        STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-500 border-gray-200"
                      }`}
                    >
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                </div>
                <p className="text-sm font-semibold text-navy flex-shrink-0">
                  {order.total.toFixed(2)} KM
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
