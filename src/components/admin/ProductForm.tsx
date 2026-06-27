import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Upload, Trash2, Plus } from "lucide-react";
import { supabase, type Product, type Category } from "../../lib/supabase";

type Props = {
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
};

const empty = {
  name_en: "", name_bs: "",
  description_en: "", description_bs: "",
  category: "",
  price: "",
  image_url: "",
  gallery_images: [] as string[],
  in_stock: true,
};

type LangTab = "en" | "bs";
const MAX_GALLERY = 4;

export function ProductForm({ product, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ ...empty });
  const [tab, setTab] = useState<LangTab>("en");
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"main" | number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mainFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const gallerySlotRef = useRef<number>(-1);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (product) {
      setForm({
        name_en: product.name_en ?? product.name ?? "",
        name_bs: product.name_bs ?? "",
        description_en: product.description_en ?? product.description ?? "",
        description_bs: product.description_bs ?? "",
        category: product.category ?? "",
        price: String(product.price),
        image_url: product.image_url ?? "",
        gallery_images: product.gallery_images ?? [],
        in_stock: product.in_stock,
      });
    } else {
      setForm({ ...empty });
    }
  }, [product]);

  function set(key: string, value: string | boolean | string[]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function uploadFile(file: File): Promise<string | null> {
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: err } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: false });
    if (err) { setError(err.message); return null; }
    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  async function handleMainFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading("main");
    setError(null);
    const url = await uploadFile(file);
    if (url) set("image_url", url);
    setUploading(null);
    if (mainFileRef.current) mainFileRef.current.value = "";
  }

  async function handleGalleryFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const slot = gallerySlotRef.current;
    setUploading(slot);
    setError(null);
    const url = await uploadFile(file);
    if (url) {
      const next = [...form.gallery_images];
      if (slot < next.length) {
        next[slot] = url;
      } else {
        next.push(url);
      }
      set("gallery_images", next);
    }
    setUploading(null);
    if (galleryFileRef.current) galleryFileRef.current.value = "";
  }

  function openGalleryPicker(slot: number) {
    gallerySlotRef.current = slot;
    galleryFileRef.current?.click();
  }

  function removeGalleryImage(idx: number) {
    const next = form.gallery_images.filter((_, i) => i !== idx);
    set("gallery_images", next);
  }

  async function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    setError(null);

    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) { setError("Enter a valid price."); return; }
    if (!form.name_en.trim() && !form.name_bs.trim()) {
      setError("Enter a product name in at least one language.");
      return;
    }

    const payload = {
      name: form.name_en.trim() || form.name_bs.trim(),
      name_en: form.name_en.trim() || null,
      name_bs: form.name_bs.trim() || null,
      description: form.description_en.trim() || form.description_bs.trim() || null,
      description_en: form.description_en.trim() || null,
      description_bs: form.description_bs.trim() || null,
      category: form.category,
      price,
      image_url: form.image_url.trim() || null,
      gallery_images: form.gallery_images.length > 0 ? form.gallery_images : [],
      in_stock: form.in_stock,
    };

    setSaving(true);
    const { error: err } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);

    if (err) { setError(err.message); return; }
    onSaved();
  }

  const gallerySlots = Array.from({ length: MAX_GALLERY });
  const seoChecks = buildSeoChecks(form);
  const seoScore = seoChecks.filter((c) => c.status === "pass").length;
  const seoTotal = seoChecks.length;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-navy">{product ? "Edit Product" : "Add Product"}</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-navy rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left — form fields (scrollable) */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 border-r border-gray-100">
            {error && <p className="text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg">{error}</p>}

            {/* Language tabs */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
              {(["en", "bs"] as LangTab[]).map((l) => (
                <button key={l} type="button" onClick={() => setTab(l)}
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === l ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`}>
                  {l === "en" ? "English" : "Bosanski"}
                </button>
              ))}
            </div>

            {/* Bilingual fields */}
            {tab === "en" ? (
              <>
                <Field label="Product Name (EN)">
                  <input value={form.name_en} onChange={(e) => set("name_en", e.target.value)}
                    placeholder="e.g. Handmade Candle Set" className={inputCls} />
                  <CharCount value={form.name_en} min={20} max={70} />
                </Field>
                <Field label="Description (EN)">
                  <textarea value={form.description_en} onChange={(e) => set("description_en", e.target.value)}
                    rows={3} placeholder="Short product description…" className={`${inputCls} resize-none`} />
                  <CharCount value={form.description_en} min={80} max={500} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Naziv proizvoda (BS)">
                  <input value={form.name_bs} onChange={(e) => set("name_bs", e.target.value)}
                    placeholder="npr. Ručno rađeni set svijeća" className={inputCls} />
                  <CharCount value={form.name_bs} min={20} max={70} />
                </Field>
                <Field label="Opis (BS)">
                  <textarea value={form.description_bs} onChange={(e) => set("description_bs", e.target.value)}
                    rows={3} placeholder="Kratki opis proizvoda…" className={`${inputCls} resize-none`} />
                  <CharCount value={form.description_bs} min={80} max={500} />
                </Field>
              </>
            )}

            {/* Category + Price */}
            <div className="grid grid-cols-2 gap-4">
              <Field label="Category">
                <select value={form.category} onChange={(e) => set("category", e.target.value)} className={inputCls}>
                  <option value="">— None —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.name_en ?? c.name}>
                      {c.name_en ?? c.name}{c.name_bs ? ` / ${c.name_bs}` : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Price (KM) *">
                <input type="number" min="0" step="0.01" value={form.price}
                  onChange={(e) => set("price", e.target.value)} required placeholder="0.00" className={inputCls} />
              </Field>
            </div>

            {/* Main image */}
            <Field label="Main Image">
              {form.image_url ? (
                <div className="relative">
                  <img src={form.image_url} alt="main" className="w-full h-48 object-cover rounded-xl border border-gray-200" />
                  <button type="button" onClick={() => set("image_url", "")}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 border border-gray-200 rounded-lg text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm">
                    <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => mainFileRef.current?.click()} disabled={uploading === "main"}
                  className="flex flex-col items-center justify-center gap-2 w-full h-40 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-60">
                  {uploading === "main" ? (
                    <><Spinner /><span className="text-sm">Uploading…</span></>
                  ) : (
                    <><Upload className="w-6 h-6" strokeWidth={1.5} /><span className="text-sm font-medium">Click to upload main image</span><span className="text-xs">JPG, PNG, WEBP</span></>
                  )}
                </button>
              )}
              <input ref={mainFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleMainFile} />
            </Field>

            {/* Gallery images */}
            <Field label={`Gallery Images (up to ${MAX_GALLERY})`}>
              <div className="grid grid-cols-4 gap-2">
                {gallerySlots.map((_, idx) => {
                  const url = form.gallery_images[idx];
                  const isUploading = uploading === idx;
                  const isFull = idx >= form.gallery_images.length && idx > 0 && !form.gallery_images[idx - 1];

                  if (url) {
                    return (
                      <div key={idx} className="relative aspect-square">
                        <img src={url} alt={`gallery-${idx}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                        <button type="button" onClick={() => removeGalleryImage(idx)}
                          className="absolute top-1 right-1 p-1 bg-white/90 border border-gray-200 rounded-md text-gray-500 hover:text-red-500 transition-colors shadow-sm">
                          <X className="w-3 h-3" strokeWidth={2} />
                        </button>
                      </div>
                    );
                  }
                  if (isFull) {
                    return <div key={idx} className="aspect-square rounded-lg border border-dashed border-gray-100 bg-gray-50" />;
                  }
                  return (
                    <button key={idx} type="button" onClick={() => openGalleryPicker(idx)} disabled={!!uploading}
                      className="aspect-square flex flex-col items-center justify-center gap-1 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-60">
                      {isUploading ? <Spinner /> : <Plus className="w-5 h-5" strokeWidth={1.75} />}
                    </button>
                  );
                })}
              </div>
              <input ref={galleryFileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleGalleryFile} />
            </Field>

            {/* In stock */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => set("in_stock", !form.in_stock)}
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.in_stock ? "bg-navy" : "bg-gray-200"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.in_stock ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <span className="text-sm font-medium text-navy">In Stock</span>
            </label>
          </form>

          {/* Right — SEO panel (always visible) */}
          <div className="w-80 flex-shrink-0 overflow-y-auto bg-gray-50/50">
            <SeoPanel form={form} checks={seoChecks} score={seoScore} total={seoTotal} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => handleSubmit()} disabled={saving || !!uploading}
            className="px-5 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60">
            {saving ? "Saving…" : product ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SEO helpers ─────────────────────────────────────────────────────────────

type SeoStatus = "pass" | "warn" | "fail";
type SeoCheck = { label: string; status: SeoStatus; tip: string };

function toSlug(str: string) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product-name";
}

function buildSeoChecks(form: typeof empty): SeoCheck[] {
  const checks: SeoCheck[] = [];

  const enLen = form.name_en.trim().length;
  checks.push(
    enLen === 0 ? { label: "English title", status: "fail", tip: "No English product name set." }
    : enLen < 20 ? { label: "English title", status: "warn", tip: `The English title is too short (${enLen} chars). Use at least 20 characters.` }
    : enLen > 70 ? { label: "English title", status: "warn", tip: `The English title is too long (${enLen} chars). Keep it under 70.` }
    : { label: "English title", status: "pass", tip: `The English title has a good length (${enLen} chars).` }
  );

  const bsLen = form.name_bs.trim().length;
  checks.push(
    bsLen === 0 ? { label: "Bosnian title", status: "fail", tip: "No Bosnian product name set." }
    : bsLen < 20 ? { label: "Bosnian title", status: "warn", tip: `The Bosnian title is too short (${bsLen} chars). Use at least 20 characters.` }
    : bsLen > 70 ? { label: "Bosnian title", status: "warn", tip: `The Bosnian title is too long (${bsLen} chars). Keep it under 70.` }
    : { label: "Bosnian title", status: "pass", tip: `The Bosnian title has a good length (${bsLen} chars).` }
  );

  const enDesc = form.description_en.trim().length;
  checks.push(
    enDesc === 0 ? { label: "English description", status: "fail", tip: "No English description added." }
    : enDesc < 80 ? { label: "English description", status: "warn", tip: `The English description is too short (${enDesc} chars). Aim for at least 80.` }
    : { label: "English description", status: "pass", tip: `The English description is a good length (${enDesc} chars).` }
  );

  const bsDesc = form.description_bs.trim().length;
  checks.push(
    bsDesc === 0 ? { label: "Bosnian description", status: "fail", tip: "No Bosnian description added." }
    : bsDesc < 80 ? { label: "Bosnian description", status: "warn", tip: `The Bosnian description is too short (${bsDesc} chars). Aim for at least 80.` }
    : { label: "Bosnian description", status: "pass", tip: `The Bosnian description is a good length (${bsDesc} chars).` }
  );

  checks.push(
    form.image_url
      ? { label: "Main image", status: "pass", tip: "The product has a main image." }
      : { label: "Main image", status: "fail", tip: "No main product image has been added." }
  );

  const gc = form.gallery_images.length;
  checks.push(
    gc >= 2 ? { label: "Gallery photos", status: "pass", tip: `The product has ${gc} gallery photos — nice!` }
    : gc === 1 ? { label: "Gallery photos", status: "warn", tip: "Only 1 gallery photo added. Add at least one more." }
    : { label: "Gallery photos", status: "fail", tip: "No gallery photos added. Show the product from multiple angles." }
  );

  checks.push(
    form.category
      ? { label: "Category", status: "pass", tip: "The product is assigned to a category." }
      : { label: "Category", status: "warn", tip: "No category set. Assign one so customers can filter by category." }
  );

  return checks;
}

function SeoPanel({ form, checks, score, total }: { form: typeof empty; checks: SeoCheck[]; score: number; total: number }) {
  const pct = score / total;
  const scoreLabel = pct >= 0.86 ? "Good" : pct >= 0.57 ? "OK" : "Needs improvement";
  const scoreBg = pct >= 0.86 ? "bg-green-500" : pct >= 0.57 ? "bg-amber-400" : "bg-red-500";
  const scoreText = pct >= 0.86 ? "text-green-700 bg-green-50" : pct >= 0.57 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";

  const problems = checks.filter((c) => c.status === "fail");
  const improvements = checks.filter((c) => c.status === "warn");
  const good = checks.filter((c) => c.status === "pass");

  const titleText = form.name_en.trim() || form.name_bs.trim() || "Product Title";
  const descText = form.description_en.trim() || form.description_bs.trim() || "";
  const slug = toSlug(form.name_en.trim() || form.name_bs.trim());

  return (
    <div className="text-sm h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${scoreBg}`} />
        <span className="font-semibold text-gray-800">SEO analysis</span>
        <span className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full ${scoreText}`}>
          {scoreLabel}
        </span>
      </div>

      {/* Google preview */}
      <div className="px-4 py-3 border-b border-gray-100 bg-white">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Search preview</p>
        <div className="flex flex-col gap-0.5 px-3 py-2.5 border border-gray-100 rounded-lg bg-white">
          <p className="text-[#1a0dab] text-sm font-medium leading-snug truncate">
            {titleText.length > 60 ? titleText.slice(0, 57) + "…" : titleText}
          </p>
          <p className="text-[#006621] text-xs">dekokutak.ba › products › {slug}</p>
          <p className="text-[#545454] text-xs leading-relaxed line-clamp-2 mt-0.5">
            {descText ? (descText.length > 160 ? descText.slice(0, 157) + "…" : descText) : "No description added yet."}
          </p>
        </div>
      </div>

      {/* Checks */}
      <div className="px-4 py-3 flex flex-col gap-3 bg-white flex-1">
        {problems.length > 0 && (
          <CheckGroup label="Problems" color="bg-red-500" checks={problems} />
        )}
        {improvements.length > 0 && (
          <CheckGroup label="Improvements" color="bg-amber-400" checks={improvements} />
        )}
        {good.length > 0 && (
          <CheckGroup label="Good results" color="bg-green-500" checks={good} />
        )}
      </div>
    </div>
  );
}

function CheckGroup({ label, color, checks }: { label: string; color: string; checks: SeoCheck[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{label}</p>
      {checks.map((c) => (
        <div key={c.label} className="flex items-start gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${color}`} />
          <p className="text-xs text-gray-600 leading-relaxed">{c.tip}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function CharCount({ value, min, max }: { value: string; min: number; max: number }) {
  const len = value.trim().length;
  if (len === 0) return null;
  const color = len < min ? "text-amber-500" : len > max ? "text-red-400" : "text-green-500";
  return <p className={`text-xs text-right ${color}`}>{len} / {max}</p>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-navy">{label}</label>
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />;
}

const inputCls =
  "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";
