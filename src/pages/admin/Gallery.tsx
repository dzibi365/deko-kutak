import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, X, ChevronUp, ChevronDown, ImageIcon } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { GalleryCategory, GalleryImage, GalleryItem } from "../../lib/supabase";

const inputCls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";

const MAX_IMAGES = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Filter = "all" | "published" | "draft";

type ProductRow = { id: number; name: string; name_en: string | null };

type ItemWithCategory = GalleryItem & {
  gallery_categories: { name_en: string; name_bs: string } | null;
};

type FormState = {
  title_en: string;
  title_bs: string;
  description_en: string;
  description_bs: string;
  cover_image_url: string;
  category_id: number | null;
  related_product_id: number | null;
  display_order: number;
  is_published: boolean;
};

type LocalImage = {
  key: string;
  id?: number;
  url: string;
  caption_en: string;
  caption_bs: string;
  display_order: number;
  toDelete: boolean;
};

const emptyForm = (): FormState => ({
  title_en: "",
  title_bs: "",
  description_en: "",
  description_bs: "",
  cover_image_url: "",
  category_id: null,
  related_product_id: null,
  display_order: 0,
  is_published: false,
});

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Only JPEG, PNG, and WebP images are allowed.";
  if (file.size > MAX_BYTES) return "Image must be under 10 MB.";
  return null;
}

export default function Gallery() {
  const [items, setItems] = useState<ItemWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  const [categories, setCategories] = useState<GalleryCategory[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [tab, setTab] = useState<"en" | "bs">("en");
  const [form, setForm] = useState<FormState>(emptyForm());
  const [localImages, setLocalImages] = useState<LocalImage[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [imagesUploading, setImagesUploading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const coverInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("gallery_items")
      .select("*, gallery_categories(name_en, name_bs)")
      .order("display_order");
    if (error) setPageError(error.message);
    else setItems((data as ItemWithCategory[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    supabase.from("gallery_categories").select("*").order("display_order")
      .then(({ data }) => setCategories((data as GalleryCategory[]) ?? []));
    supabase.from("products").select("id, name, name_en").order("name")
      .then(({ data }) => setProducts((data as ProductRow[]) ?? []));
  }, []);

  function setField<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function openEdit(item: GalleryItem) {
    setEditingItem(item);
    setForm({
      title_en: item.title_en,
      title_bs: item.title_bs,
      description_en: item.description_en ?? "",
      description_bs: item.description_bs ?? "",
      cover_image_url: item.cover_image_url ?? "",
      category_id: item.category_id,
      related_product_id: item.related_product_id,
      display_order: item.display_order,
      is_published: item.is_published,
    });
    setLocalImages([]);
    setFormError(null);
    setConfirmDelete(false);
    setTab("en");
    setModalOpen(true);

    setImagesLoading(true);
    const { data } = await supabase
      .from("gallery_images")
      .select("*")
      .eq("gallery_item_id", item.id)
      .order("display_order");
    const imgs: LocalImage[] = ((data as GalleryImage[]) ?? []).map((img) => ({
      key: String(img.id),
      id: img.id,
      url: img.image_url,
      caption_en: img.caption_en ?? "",
      caption_bs: img.caption_bs ?? "",
      display_order: img.display_order,
      toDelete: false,
    }));
    setLocalImages(imgs);
    setImagesLoading(false);
  }

  function openNew() {
    setEditingItem(null);
    setForm(emptyForm());
    setLocalImages([]);
    setFormError(null);
    setConfirmDelete(false);
    setTab("en");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setFormError(null);
    setConfirmDelete(false);
  }

  async function handleCoverUpload(file: File) {
    const err = validateFile(file);
    if (err) { setFormError(err); return; }
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `gallery/items/cover-${crypto.randomUUID()}.${ext}`;
    setCoverUploading(true);
    const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
    if (upErr) { setFormError(upErr.message); setCoverUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm((f) => ({ ...f, cover_image_url: `${publicUrl}?t=${Date.now()}` }));
    setCoverUploading(false);
  }

  async function handleAdditionalUpload(files: FileList) {
    const active = localImages.filter((img) => !img.toDelete);
    const slots = MAX_IMAGES - active.length;
    if (slots <= 0) { setFormError(`Maximum ${MAX_IMAGES} additional images reached.`); return; }

    const toUpload = Array.from(files).slice(0, slots);
    setImagesUploading(true);
    const newImages: LocalImage[] = [];
    for (const file of toUpload) {
      const err = validateFile(file);
      if (err) { setFormError(err); continue; }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `gallery/items/img-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (upErr) { setFormError(upErr.message); continue; }
      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
      newImages.push({
        key: crypto.randomUUID(),
        url: `${publicUrl}?t=${Date.now()}`,
        caption_en: "",
        caption_bs: "",
        display_order: active.length + newImages.length,
        toDelete: false,
      });
    }
    setLocalImages((prev) => [...prev, ...newImages]);
    setImagesUploading(false);
  }

  function removeImage(key: string) {
    setLocalImages((prev) =>
      prev.map((img) => img.key === key ? { ...img, toDelete: true } : img)
    );
  }

  function updateImageCaption(key: string, field: "caption_en" | "caption_bs", value: string) {
    setLocalImages((prev) =>
      prev.map((img) => img.key === key ? { ...img, [field]: value } : img)
    );
  }

  function moveImage(key: string, direction: "up" | "down") {
    setLocalImages((prev) => {
      const active = prev.filter((img) => !img.toDelete).sort((a, b) => a.display_order - b.display_order);
      const idx = active.findIndex((img) => img.key === key);
      if (idx === -1) return prev;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= active.length) return prev;

      const aOrder = active[idx].display_order;
      const bOrder = active[swapIdx].display_order;

      return prev.map((img) => {
        if (img.key === active[idx].key) return { ...img, display_order: bOrder };
        if (img.key === active[swapIdx].key) return { ...img, display_order: aOrder };
        return img;
      });
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title_en.trim()) { setFormError("English title is required."); return; }
    if (!form.title_bs.trim()) { setFormError("Bosnian title is required."); return; }
    if (form.is_published && !form.cover_image_url.trim()) {
      setFormError("A cover image is required to publish.");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      title_en: form.title_en.trim(),
      title_bs: form.title_bs.trim(),
      description_en: form.description_en.trim() || null,
      description_bs: form.description_bs.trim() || null,
      cover_image_url: form.cover_image_url.trim() || null,
      category_id: form.category_id,
      related_product_id: form.related_product_id,
      display_order: form.display_order,
      is_published: form.is_published,
    };

    if (editingItem) {
      const { error: updErr } = await supabase.from("gallery_items").update(payload).eq("id", editingItem.id);
      if (updErr) { setFormError(updErr.message); setSaving(false); return; }

      const toDelete = localImages.filter((img) => img.toDelete && img.id);
      if (toDelete.length > 0) {
        const ids = toDelete.map((img) => img.id!);
        const { error: delErr } = await supabase.from("gallery_images").delete().in("id", ids);
        if (delErr) { setFormError(delErr.message); setSaving(false); return; }
      }

      const existing = localImages.filter((img) => !img.toDelete && img.id);
      for (const img of existing) {
        const { error: imgErr } = await supabase
          .from("gallery_images")
          .update({ caption_en: img.caption_en || null, caption_bs: img.caption_bs || null, display_order: img.display_order })
          .eq("id", img.id!);
        if (imgErr) { setFormError(imgErr.message); setSaving(false); return; }
      }

      const newImgs = localImages.filter((img) => !img.toDelete && !img.id);
      if (newImgs.length > 0) {
        const { error: insErr } = await supabase.from("gallery_images").insert(
          newImgs.map((img) => ({
            gallery_item_id: editingItem.id,
            image_url: img.url,
            caption_en: img.caption_en || null,
            caption_bs: img.caption_bs || null,
            display_order: img.display_order,
          }))
        );
        if (insErr) { setFormError(insErr.message); setSaving(false); return; }
      }
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("gallery_items")
        .insert(payload)
        .select("id")
        .single();
      if (insErr || !inserted) { setFormError(insErr?.message ?? "Insert failed"); setSaving(false); return; }

      const newImgs = localImages.filter((img) => !img.toDelete);
      if (newImgs.length > 0) {
        const { error: imgInsErr } = await supabase.from("gallery_images").insert(
          newImgs.map((img) => ({
            gallery_item_id: (inserted as { id: number }).id,
            image_url: img.url,
            caption_en: img.caption_en || null,
            caption_bs: img.caption_bs || null,
            display_order: img.display_order,
          }))
        );
        if (imgInsErr) { setFormError(imgInsErr.message); setSaving(false); return; }
      }
    }

    setSaving(false);
    closeModal();
    load();
  }

  async function handleDelete() {
    if (!editingItem) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    const { error: err } = await supabase.from("gallery_items").delete().eq("id", editingItem.id);
    setDeleting(false);
    if (err) { setFormError(err.message); setConfirmDelete(false); return; }
    closeModal();
    load();
  }

  const filtered = items.filter((item) =>
    filter === "all" ? true : filter === "published" ? item.is_published : !item.is_published
  );

  const activeImages = localImages.filter((img) => !img.toDelete).sort((a, b) => a.display_order - b.display_order);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy">Gallery</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors">
          <Plus className="w-4 h-4" />
          New Item
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {(["all", "published", "draft"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors capitalize ${
              filter === f ? "bg-navy text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {pageError && (
        <div className="text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg mb-4">{pageError}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl px-6 py-16 text-center text-gray-400 text-sm">
          {filter === "all" ? "No gallery items yet. Create one to get started." : `No ${filter} items.`}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100">
              <tr className="text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-5 py-3 text-left font-semibold w-14">Cover</th>
                <th className="px-5 py-3 text-left font-semibold">Title</th>
                <th className="px-5 py-3 text-left font-semibold">Category</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-4">
                    {item.cover_image_url ? (
                      <img
                        src={item.cover_image_url}
                        alt={item.title_en}
                        className="w-10 h-10 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-gray-300" />
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4 font-medium text-navy">{item.title_en}</td>
                  <td className="px-5 py-4 text-gray-500">
                    {item.gallery_categories?.name_en ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                      item.is_published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {item.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
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
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-navy">
                {editingItem ? "Edit Item" : "New Item"}
              </h2>
              <button type="button" onClick={closeModal} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="mx-6 mt-4 text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg">{formError}</div>
            )}

            <div className="px-6 py-5 flex flex-col gap-5">
              {/* Language tabs */}
              <div className="flex gap-1 p-1 bg-gray-100 rounded-lg self-start">
                {(["en", "bs"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setTab(l)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                      tab === l ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"
                    }`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Title ({tab.toUpperCase()}) <span className="text-red-400">*</span>
                </label>
                {tab === "en" ? (
                  <input
                    className={inputCls}
                    value={form.title_en}
                    onChange={(e) => setField("title_en", e.target.value)}
                    placeholder="Item title in English"
                  />
                ) : (
                  <input
                    className={inputCls}
                    value={form.title_bs}
                    onChange={(e) => setField("title_bs", e.target.value)}
                    placeholder="Naslov na bosanskom"
                  />
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Description ({tab.toUpperCase()})
                </label>
                {tab === "en" ? (
                  <textarea
                    className={inputCls}
                    rows={4}
                    value={form.description_en}
                    onChange={(e) => setField("description_en", e.target.value)}
                    placeholder="Optional description in English"
                  />
                ) : (
                  <textarea
                    className={inputCls}
                    rows={4}
                    value={form.description_bs}
                    onChange={(e) => setField("description_bs", e.target.value)}
                    placeholder="Opcionalni opis na bosanskom"
                  />
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Category
                  </label>
                  <select
                    className={inputCls}
                    value={form.category_id ?? ""}
                    onChange={(e) => setField("category_id", e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">No category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name_en}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Related Product
                  </label>
                  <select
                    className={inputCls}
                    value={form.related_product_id ?? ""}
                    onChange={(e) => setField("related_product_id", e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">No linked product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name_en || p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
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

                {/* Published toggle */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Published
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!form.cover_image_url}
                      onClick={() => {
                        if (form.cover_image_url) setField("is_published", !form.is_published);
                      }}
                      className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${
                        form.is_published ? "bg-navy" : "bg-gray-200"
                      } disabled:opacity-40 disabled:cursor-not-allowed`}
                    >
                      <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                        form.is_published ? "translate-x-4" : "translate-x-0"
                      }`} />
                    </button>
                    <span className="text-xs text-gray-400">
                      {form.is_published ? "Published" : form.cover_image_url ? "Draft" : "Requires cover image"}
                    </span>
                  </div>
                </div>
              </div>

              <hr className="border-gray-100" />

              {/* Cover Image */}
              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cover Image</span>
                  <span className="text-xs text-gray-400">(required to publish)</span>
                </div>

                {/* Storage warning */}
                <div className="mb-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 leading-relaxed space-y-1">
                  <p><strong>EN:</strong> Gallery photographs are accessible through their direct URLs even when the item is unpublished. Do not upload private customer photos or unapproved materials.</p>
                  <p><strong>BS:</strong> Fotografije galerije su javno dostupne putem direktnog linka, čak i kada rad nije objavljen. Nemojte postavljati privatne fotografije kupaca ili neodobrene materijale.</p>
                </div>

                {form.cover_image_url ? (
                  <div className="flex items-start gap-3">
                    <img
                      src={form.cover_image_url}
                      alt={form.title_en || "Cover"}
                      className="w-24 h-24 object-cover rounded-lg border border-gray-200"
                    />
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        disabled={coverUploading}
                        onClick={() => coverInputRef.current?.click()}
                        className="px-3 py-1.5 text-xs text-navy border border-navy/20 rounded-lg hover:bg-navy/5 transition-colors disabled:opacity-60"
                      >
                        {coverUploading ? "Uploading…" : "Replace"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, cover_image_url: "", is_published: false }));
                        }}
                        className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={coverUploading}
                    onClick={() => coverInputRef.current?.click()}
                    className="w-full h-24 border-2 border-dashed border-gray-200 rounded-lg flex flex-col items-center justify-center gap-1 text-gray-400 hover:border-navy/30 hover:text-navy/50 transition-colors disabled:opacity-60"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs">{coverUploading ? "Uploading…" : "Click to upload cover image"}</span>
                  </button>
                )}
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => { if (e.target.files?.[0]) handleCoverUpload(e.target.files[0]); e.target.value = ""; }}
                />
              </div>

              <hr className="border-gray-100" />

              {/* Additional Images */}
              <div>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Additional Images</span>
                  <span className="text-xs text-gray-400">
                    {activeImages.length}/{MAX_IMAGES}
                  </span>
                </div>

                {imagesLoading ? (
                  <div className="flex items-center justify-center h-16">
                    <div className="w-5 h-5 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {activeImages.length > 0 && (
                      <div className="flex flex-col gap-3 mb-3">
                        {activeImages.map((img, idx) => (
                          <div key={img.key} className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                            <img
                              src={img.url}
                              alt={img.caption_en || form.title_en || "Gallery image"}
                              className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0 flex flex-col gap-2">
                              <input
                                className="px-2 py-1.5 border border-gray-200 rounded-md text-xs text-navy placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-navy/20 focus:border-navy transition w-full"
                                value={img.caption_en}
                                onChange={(e) => updateImageCaption(img.key, "caption_en", e.target.value)}
                                placeholder="Caption EN"
                              />
                              <input
                                className="px-2 py-1.5 border border-gray-200 rounded-md text-xs text-navy placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-navy/20 focus:border-navy transition w-full"
                                value={img.caption_bs}
                                onChange={(e) => updateImageCaption(img.key, "caption_bs", e.target.value)}
                                placeholder="Caption BS"
                              />
                            </div>
                            <div className="flex flex-col gap-1 flex-shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveImage(img.key, "up")}
                                className="p-1 text-gray-400 hover:text-navy hover:bg-white rounded transition-colors disabled:opacity-30"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === activeImages.length - 1}
                                onClick={() => moveImage(img.key, "down")}
                                className="p-1 text-gray-400 hover:text-navy hover:bg-white rounded transition-colors disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeImage(img.key)}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeImages.length < MAX_IMAGES && (
                      <button
                        type="button"
                        disabled={imagesUploading}
                        onClick={() => imagesInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 border border-dashed border-gray-300 rounded-lg hover:border-navy/30 hover:text-navy/60 transition-colors disabled:opacity-60"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {imagesUploading ? "Uploading…" : `Add Images (${MAX_IMAGES - activeImages.length} remaining)`}
                      </button>
                    )}
                    <input
                      ref={imagesInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files) handleAdditionalUpload(e.target.files); e.target.value = ""; }}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
              <div>
                {editingItem && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-60 ${
                      confirmDelete
                        ? "bg-red-500 text-white hover:bg-red-600"
                        : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {deleting ? "Deleting…" : confirmDelete ? "Confirm Delete" : "Delete"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || coverUploading || imagesUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving…" : editingItem ? "Save Changes" : "Create Item"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
