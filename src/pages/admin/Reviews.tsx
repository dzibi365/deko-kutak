import { useEffect, useState } from "react";
import { CheckCircle, Trash2, Star } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Review = {
  id: number;
  product_id: number;
  user_name: string;
  rating: number;
  comment: string | null;
  approved: boolean;
  created_at: string;
};

type Product = { id: number; name: string; name_en: string | null; name_bs: string | null };

type Tab = "pending" | "approved" | "all";

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Map<number, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("pending");
  const [actingId, setActingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [reviewsRes, productsRes] = await Promise.all([
      supabase.from("reviews").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id, name, name_en, name_bs"),
    ]);
    setReviews(reviewsRes.data ?? []);
    setProducts(new Map((productsRes.data ?? []).map((p) => [p.id, p])));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function approve(id: number) {
    setActingId(id);
    setError(null);
    const { error: err } = await supabase.from("reviews").update({ approved: true }).eq("id", id);
    setActingId(null);
    if (err) { setError(`Approve failed: ${err.message}`); return; }
    load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this review?")) return;
    setActingId(id);
    setError(null);
    const { error: err } = await supabase.from("reviews").delete().eq("id", id);
    setActingId(null);
    if (err) { setError(`Delete failed: ${err.message}`); return; }
    load();
  }

  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);

  const visible =
    tab === "pending" ? pending :
    tab === "approved" ? approved :
    reviews;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: pending.length },
    { key: "approved", label: "Approved", count: approved.length },
    { key: "all", label: "All", count: reviews.length },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-navy mb-1">Reviews</h1>
        <p className="text-sm text-gray-400">{pending.length} pending approval</p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-6">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === t.key ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? (t.key === "pending" ? "bg-amber-100 text-amber-700" : "bg-navy/10 text-navy") : "bg-gray-200 text-gray-500"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-400">
            {tab === "pending" ? "No reviews pending approval." : "No reviews yet."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Reviewer</th>
                <th className="text-left px-5 py-3 font-medium">Product</th>
                <th className="text-left px-5 py-3 font-medium">Rating</th>
                <th className="text-left px-5 py-3 font-medium">Comment</th>
                <th className="text-left px-5 py-3 font-medium">Date</th>
                <th className="text-center px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {visible.map((r) => {
                const product = products.get(r.product_id);
                const productName = product ? (product.name_en || product.name) : `#${r.product_id}`;
                const isActing = actingId === r.id;

                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4 font-medium text-navy">{r.user_name}</td>
                    <td className="px-5 py-4 text-gray-500 max-w-[160px] truncate">{productName}</td>
                    <td className="px-5 py-4">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "fill-gray-200 text-gray-200"}`} strokeWidth={1} />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600 max-w-xs">
                      {r.comment ? (
                        <p className="line-clamp-2 leading-relaxed">"{r.comment}"</p>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-400 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                    <td className="px-5 py-4 text-center">
                      {r.approved ? (
                        <span className="inline-block px-2 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full">Approved</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full">Pending</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {!r.approved && (
                          <button
                            onClick={() => approve(r.id)}
                            disabled={isActing}
                            title="Approve"
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-40"
                          >
                            <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          disabled={isActing}
                          title="Delete"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
