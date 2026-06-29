import { useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2, ImagePlus } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { Category } from "../../lib/supabase";

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameEn, setNameEn] = useState("");
  const [nameBs, setNameBs] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

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
    setNameEn(""); setNameBs("");
    load();
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    await supabase.from("categories").delete().eq("id", id);
    setDeletingId(null);
    load();
  }

  async function handleImageUpload(cat: Category, file: File) {
    setUploadingId(cat.id);
    setError(null);
    const ext = file.name.split(".").pop();
    const path = `categories/${cat.id}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) { setError(uploadErr.message); setUploadingId(null); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    await supabase.from("categories").update({ image_url: url }).eq("id", cat.id);
    setUploadingId(null);
    load();
  }

  async function handleRemoveImage(cat: Category) {
    await supabase.from("categories").update({ image_url: null }).eq("id", cat.id);
    load();
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-navy mb-1">Categories</h1>
      <p className="text-sm text-gray-400 mb-8">Group products into collections — add names and a cover image for each</p>

      <form onSubmit={handleAdd} className="flex flex-col gap-3 mb-6">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">EN</span>
            <input
              value={nameEn} onChange={(e) => setNameEn(e.target.value)}
              placeholder="Category name in English…"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
            />
          </div>
          <div className="flex-1 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">BS</span>
            <input
              value={nameBs} onChange={(e) => setNameBs(e.target.value)}
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
          <div className="divide-y divide-gray-50">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center gap-4 px-5 py-4">

                {/* Image thumbnail / upload */}
                <div className="flex-shrink-0">
                  {cat.image_url ? (
                    <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-100">
                      <img src={cat.image_url} alt={cat.name_en ?? cat.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => fileRefs.current[cat.id]?.click()}
                          disabled={uploadingId === cat.id}
                          className="p-1 text-white hover:text-amber-300 transition-colors"
                          title="Replace image"
                        >
                          <ImagePlus className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      </div>
                      {uploadingId === cat.id && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRefs.current[cat.id]?.click()}
                      disabled={uploadingId === cat.id}
                      className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-200 hover:border-navy/30 hover:bg-gray-50 transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-50"
                      title="Upload category image"
                    >
                      {uploadingId === cat.id ? (
                        <div className="w-4 h-4 border-2 border-gray-300 border-t-navy rounded-full animate-spin" />
                      ) : (
                        <>
                          <ImagePlus className="w-4 h-4 text-gray-300" strokeWidth={1.5} />
                          <span className="text-[9px] text-gray-300 font-medium">Image</span>
                        </>
                      )}
                    </button>
                  )}
                  <input
                    ref={(el) => { fileRefs.current[cat.id] = el; }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(cat, file);
                      e.target.value = "";
                    }}
                  />
                </div>

                {/* Names */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-navy text-sm truncate">{cat.name_en ?? cat.name}</p>
                  {cat.name_bs && <p className="text-sm text-gray-400 truncate">{cat.name_bs}</p>}
                  {cat.image_url && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(cat)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors mt-0.5"
                    >
                      Remove image
                    </button>
                  )}
                </div>

                {/* Delete */}
                <button
                  onClick={() => handleDelete(cat.id)}
                  disabled={deletingId === cat.id}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
