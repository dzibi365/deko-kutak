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

// ── Area / line chart ────────────────────────────────────────────────────────

const CW = 538; // chart content width
const CH = 134; // chart content height  (viewBox 600×180 → ~240px at 800px container)
const ML = 50;  // left margin (y-axis labels)
const MT = 12;  // top margin
const MB = 34;  // bottom margin (x-axis labels)
const MR = 12;  // right margin
const VW = ML + CW + MR; // 600
const VH = MT + CH + MB; // 180

/** Midpoint cubic bezier through points — stays bounded between adjacent values. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  const d = [`M ${pts[0].x} ${pts[0].y}`];
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2;
    d.push(`C ${mx} ${pts[i - 1].y} ${mx} ${pts[i].y} ${pts[i].x} ${pts[i].y}`);
  }
  return d.join(" ");
}

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
  const labelEvery = period === 7 ? 1 : period === 30 ? 5 : 15;
  const n = days.length;

  // Map each day to an SVG point; distribute evenly across CW
  const pts = days.map((_, i) => ({
    x: ML + (n > 1 ? (i / (n - 1)) * CW : CW / 2),
    y: MT + CH - (days[i].revenue / maxRevenue) * CH,
  }));

  const linePath = smoothPath(pts);
  const baseline = MT + CH;
  const areaPath = pts.length > 0
    ? `${linePath} L ${pts[n - 1].x} ${baseline} L ${pts[0].x} ${baseline} Z`
    : "";

  const yRefs = [0, 0.5, 1].map((frac) => ({
    y: MT + CH - frac * CH,
    label: frac === 0 ? "0" : `${Math.round(maxRevenue * frac)} KM`,
  }));

  function onMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - r.left) / r.width) * VW;
    const chartX = svgX - ML;
    if (chartX < -10 || chartX > CW + 10) { setHoverIdx(null); return; }
    const idx = n <= 1 ? 0 : Math.round((Math.max(0, Math.min(CW, chartX)) / CW) * (n - 1));
    setHoverIdx(idx);
  }

  const hov = hoverIdx !== null ? { day: days[hoverIdx], pt: pts[hoverIdx] } : null;
  const TIP_W = 96;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full h-auto select-none"
      onMouseMove={onMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
    >
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#c8813a" stopOpacity={0.18} />
          <stop offset="100%" stopColor="#c8813a" stopOpacity={0}    />
        </linearGradient>
      </defs>

      {/* Subtle grid lines + y-axis labels */}
      {yRefs.map(({ y, label }) => (
        <g key={y}>
          <line x1={ML} x2={ML + CW} y1={y} y2={y} stroke="#F3F4F6" strokeWidth={1} />
          <text x={ML - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize={10} fill="#D1D5DB">
            {label}
          </text>
        </g>
      ))}

      {/* Area fill */}
      {areaPath && <path d={areaPath} fill="url(#areaGrad)" />}

      {/* Smooth orange line */}
      {linePath && (
        <path
          d={linePath}
          fill="none"
          stroke="#c8813a"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {/* X-axis labels */}
      {days.map((day, i) => {
        if (i % labelEvery !== 0) return null;
        const x = ML + (n > 1 ? (i / (n - 1)) * CW : CW / 2);
        return (
          <text key={day.date} x={x} y={VH - 4} textAnchor="middle" fontSize={9} fill="#D1D5DB">
            {day.label}
          </text>
        );
      })}

      {/* Hover: dashed vertical line + dot + tooltip */}
      {hov && (() => {
        const tipX = Math.max(ML + TIP_W / 2, Math.min(ML + CW - TIP_W / 2, hov.pt.x));
        const tipY = Math.max(MT + 2, hov.pt.y - 40);
        // Format tooltip date: "14. okt" from ISO string
        const [yr, mo, dy] = hov.day.date.split("-").map(Number);
        const local = new Date(yr, mo - 1, dy);
        const tipDate = `${dy}. ${local.toLocaleDateString("bs-BA", { month: "short" })}`;
        return (
          <g>
            <line
              x1={hov.pt.x} x2={hov.pt.x}
              y1={MT} y2={baseline}
              stroke="#E5E7EB" strokeWidth={1} strokeDasharray="3 2"
            />
            <circle cx={hov.pt.x} cy={hov.pt.y} r={4} fill="#c8813a" stroke="white" strokeWidth={2} />
            <rect x={tipX - TIP_W / 2} y={tipY} width={TIP_W} height={30} rx={5} fill="white" stroke="#E5E7EB" strokeWidth={1} />
            <text x={tipX} y={tipY + 11} textAnchor="middle" fontSize={9}  fill="#9CA3AF">{tipDate}</text>
            <text x={tipX} y={tipY + 23} textAnchor="middle" fontSize={11} fill="#1a1a2e" fontWeight="700">{hov.day.revenue.toFixed(2)} KM</text>
          </g>
        );
      })()}
    </svg>
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
