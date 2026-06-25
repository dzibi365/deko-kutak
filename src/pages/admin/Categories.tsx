import { useEffect, useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Category } from "../../lib/supabase";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameEn, setNameEn] = useState("");
  const [nameBs, setNameBs] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase.from("categories").select("*").order("name");
    setCategories(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!nameEn.trim() && !nameBs.trim()) return;
    setAdding(true);
    setError(null);

    const name = nameEn.trim() || nameBs.trim();
    const { error: err } = await supabase.from("categories").insert({
      name,
      name_en: nameEn.trim() || null,
      name_bs: nameBs.trim() || null,
    });

    setAdding(false);
    if (err) { setError(err.message); return; }
    setNameEn("");
    setNameBs("");
    load();
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await supabase.from("categories").delete().eq("id", id);
    setDeletingId(null);
    load();
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-navy mb-1">Categories</h1>
      <p className="text-sm text-gray-400 mb-8">Group products into collections — enter names in both languages</p>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">EN</span>
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="Category name in English…"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
            />
          </div>
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">BS</span>
            <input
              value={nameBs}
              onChange={(e) => setNameBs(e.target.value)}
              placeholder="Naziv kategorije na bosanskom…"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={adding || (!nameEn.trim() && !nameBs.trim())}
          className="self-start flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Category
        </button>
      </form>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Loading…</div>
        ) : categories.length === 0 ? (
          <div className="p-6 text-sm text-gray-400">No categories yet. Add one above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">English</th>
                <th className="text-left px-5 py-3 font-medium">Bosanski</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-navy">{cat.name_en ?? cat.name}</td>
                  <td className="px-5 py-3 text-gray-500">{cat.name_bs ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => handleDelete(cat.id)}
                      disabled={deletingId === cat.id}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
