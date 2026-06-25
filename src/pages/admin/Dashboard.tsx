import { useEffect, useState } from "react";
import { Package, Tag, CheckCircle, XCircle } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Stats = {
  totalProducts: number;
  inStock: number;
  outOfStock: number;
  totalCategories: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    async function load() {
      const [{ count: total }, { count: inStock }, { count: cats }] = await Promise.all([
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("products").select("*", { count: "exact", head: true }).eq("in_stock", true),
        supabase.from("categories").select("*", { count: "exact", head: true }),
      ]);
      setStats({
        totalProducts: total ?? 0,
        inStock: inStock ?? 0,
        outOfStock: (total ?? 0) - (inStock ?? 0),
        totalCategories: cats ?? 0,
      });
    }
    load();
  }, []);

  const cards = stats
    ? [
        { label: "Total Products", value: stats.totalProducts, icon: Package, color: "text-navy" },
        { label: "In Stock", value: stats.inStock, icon: CheckCircle, color: "text-green-600" },
        { label: "Out of Stock", value: stats.outOfStock, icon: XCircle, color: "text-red-500" },
        { label: "Categories", value: stats.totalCategories, icon: Tag, color: "text-copper" },
      ]
    : [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-navy mb-1">Dashboard</h1>
      <p className="text-sm text-gray-400 mb-8">Overview of your store</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats === null
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-6 animate-pulse">
                <div className="h-4 w-24 bg-gray-100 rounded mb-4" />
                <div className="h-8 w-12 bg-gray-100 rounded" />
              </div>
            ))
          : cards.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">{label}</p>
                  <Icon className={`w-5 h-5 ${color}`} strokeWidth={1.75} />
                </div>
                <p className="text-3xl font-semibold text-navy">{value}</p>
              </div>
            ))}
      </div>
    </div>
  );
}
