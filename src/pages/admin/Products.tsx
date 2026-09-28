import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle, XCircle } from "lucide-react";
import { supabase, type Product, type Category } from "../../lib/supabase";
import { ProductForm } from "../../components/admin/ProductForm";

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name_en"),
    ]);
    setProducts(prods ?? []);
    setCategories(cats ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setFormOpen(true); }
  function openEdit(p: Product) { setEditing(p); setFormOpen(true); }
  function closeForm() { setFormOpen(false); setEditing(null); }
  function onSaved() { closeForm(); load(); }

  async function handleDelete(id: number) {
    if (!confirm("Delete this product?")) return;
    setDeletingId(id);
    await supabase.from("products").delete().eq("id", id);
    setDeletingId(null);
    load();
  }

  const filtered = selectedCategory
    ? products.filter((p) => p.category === selectedCategory)
    : products;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy mb-1">Products</h1>
          <p className="text-sm text-gray-400">
            {filtered.length} of {products.length} product{products.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add Product
        </button>
      </div>

      {/* Category filter chips */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              selectedCategory === null
                ? "bg-navy text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.name_en === selectedCategory ? null : cat.name_en)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedCategory === cat.name_en
                  ? "bg-copper text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {cat.name_en}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm text-gray-400 mb-3">
              {selectedCategory ? `No products in "${selectedCategory}".` : "No products yet."}
            </p>
            {!selectedCategory && (
              <button onClick={openAdd} className="text-sm font-semibold text-navy underline underline-offset-2">
                Add your first product
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3 font-medium">Product</th>
                <th className="text-left px-5 py-3 font-medium">Category</th>
                <th className="text-right px-5 py-3 font-medium">Price</th>
                <th className="text-center px-5 py-3 font-medium">Stock</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0" />
                      )}
                      <div>
                        <p className="font-medium text-navy">{p.name}</p>
                        {p.description && <p className="text-xs text-gray-400 line-clamp-1 max-w-xs">{p.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {p.category ? (
                      <button
                        onClick={() => setSelectedCategory(p.category === selectedCategory ? null : p.category)}
                        className="inline-block px-2 py-0.5 bg-copper/10 text-copper text-xs font-semibold rounded-full hover:bg-copper/20 transition-colors"
                      >
                        {p.category}
                      </button>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-semibold text-navy">{p.price.toFixed(2)} KM</td>
                  <td className="px-5 py-4 text-center">
                    {p.in_stock ? (
                      <CheckCircle className="w-4 h-4 text-green-500 inline" strokeWidth={2} />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 inline" strokeWidth={2} />
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(p)}
                        className="p-1.5 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={deletingId === p.id}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {formOpen && <ProductForm product={editing} onClose={closeForm} onSaved={onSaved} />}
    </div>
  );
}
