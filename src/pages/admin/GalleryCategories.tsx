import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { GalleryCategory } from "../../lib/supabase";

const inputCls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";

type FormState = {
  name_en: string;
  name_bs: string;
  display_order: number;
};

const emptyForm = (): FormState => ({ name_en: "", name_bs: "", display_order: 0 });

export default function GalleryCategories() {
  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<GalleryCategory | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("gallery_categories")
      .select("*")
      .order("display_order");
    if (error) setError(error.message);
    else setCategories((data as GalleryCategory[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(cat: GalleryCategory) {
    setEditing(cat);
    setForm({ name_en: cat.name_en, name_bs: cat.name_bs, display_order: cat.display_order });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setFormError(null);
  }

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name_en.trim()) { setFormError("English name is required."); return; }
    if (!form.name_bs.trim()) { setFormError("Bosnian name is required."); return; }

    setSaving(true);
    setFormError(null);

    const payload = {
      name_en: form.name_en.trim(),
      name_bs: form.name_bs.trim(),
      display_order: form.display_order,
    };

    let err;
    if (editing) {
      ({ error: err } = await supabase.from("gallery_categories").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("gallery_categories").insert(payload));
    }

    if (err) { setFormError(err.message); setSaving(false); return; }
    setSaving(false);
    closeModal();
    load();
  }

  async function handleDeleteClick(cat: GalleryCategory) {
    if (confirmDeleteId === cat.id) {
      setDeleting(true);
      const { error: err } = await supabase.from("gallery_categories").delete().eq("id", cat.id);
      setDeleting(false);
      setConfirmDeleteId(null);
      setDeleteWarning(null);
      if (err) setError(err.message);
      else load();
      return;
    }

    setConfirmDeleteId(cat.id);
    const { count } = await supabase
      .from("gallery_items")
      .select("id", { count: "exact", head: true })
      .eq("category_id", cat.id);

    if ((count ?? 0) > 0) {
      setDeleteWarning(
        `${count} gallery item${count === 1 ? "" : "s"} ${count === 1 ? "is" : "are"} assigned to this category. Deleting it will unassign them — the items will not be deleted.`
      );
    } else {
      setDeleteWarning(null);
    }
  }

  function cancelDelete() {
    setConfirmDeleteId(null);
    setDeleteWarning(null);
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Gallery Categories</h1>
          <p className="text-sm text-gray-400 mt-0.5">Organise gallery items into categories</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors">
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg mb-4">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-16 text-center text-gray-400 text-sm">
          No categories yet. Add one to get started.
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold">Name (EN)</th>
                <th className="px-5 py-3 text-left font-semibold">Name (BS)</th>
                <th className="px-5 py-3 text-left font-semibold">Order</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-4 font-medium text-navy">{cat.name_en}</td>
                  <td className="px-5 py-4 text-gray-600">{cat.name_bs}</td>
                  <td className="px-5 py-4 text-gray-400">{cat.display_order}</td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {confirmDeleteId === cat.id ? (
                        <div className="flex items-end gap-2 flex-col sm:flex-row">
                          {deleteWarning && (
                            <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded max-w-xs text-right">
                              {deleteWarning}
                            </p>
                          )}
                          <div className="flex gap-1">
                            <button
                              onClick={cancelDelete}
                              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleDeleteClick(cat)}
                              disabled={deleting}
                              className="px-3 py-1.5 text-xs text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-60"
                            >
                              {deleting ? "Deleting…" : "Confirm Delete"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => openEdit(cat)}
                            className="p-1.5 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(cat)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4">
          <form
            onSubmit={handleSave}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-navy">
                {editing ? "Edit Category" : "New Category"}
              </h2>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg">{formError}</div>
            )}

            <div className="px-6 py-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Name (English) <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.name_en}
                  onChange={(e) => setField("name_en", e.target.value)}
                  placeholder="e.g. Wedding Gifts"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Name (Bosnian) <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.name_bs}
                  onChange={(e) => setField("name_bs", e.target.value)}
                  placeholder="npr. Vjenčani pokloni"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Display Order
                </label>
                <input
                  type="number"
                  className={inputCls}
                  value={form.display_order}
                  onChange={(e) => setField("display_order", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Category"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
