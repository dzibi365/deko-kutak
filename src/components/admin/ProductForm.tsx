import { useEffect, useRef, useState, type FormEvent } from "react";
import { X, Upload, Trash2, Plus, Search, Box } from "lucide-react";
import { MeshPickerCanvas } from "./MeshPickerCanvas";
import { supabase, type Product, type Category, type CustomField, type FieldGroup, localName } from "../../lib/supabase";
import { CustomFieldsList, newField } from "./CustomFieldsEditor";
import { RichTextEditor } from "./RichTextEditor";

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
  has_3d_preview: false,
  model_3d_url: "",
  model_texture_mesh: "",
};

type LangTab = "en" | "bs";
const MAX_GALLERY = 4;

export function ProductForm({ product, onClose, onSaved }: Props) {
  const [form, setForm] = useState({ ...empty });
  const [tab, setTab] = useState<LangTab>("en");
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"main" | number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [similarIds, setSimilarIds] = useState<number[]>([]);
  const [productSearch, setProductSearch] = useState("");

  const mainFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const gallerySlotRef = useRef<number>(-1);
  const modelFileRef = useRef<HTMLInputElement>(null);
  const [uploading3d, setUploading3d] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("field_groups").select("*").order("name"),
      supabase.from("products").select("*").order("name"),
    ]).then(([catsRes, groupsRes, prodsRes]) => {
      setCategories(catsRes.data ?? []);
      setGroups(groupsRes.data ?? []);
      setAllProducts(prodsRes.data ?? []);
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
        has_3d_preview: product.has_3d_preview ?? false,
        model_3d_url: product.model_3d_url ?? "",
        model_texture_mesh: product.model_texture_mesh ?? "",
      });
      setCustomFields(product.custom_fields ?? []);
      setSimilarIds(product.similar_products ?? []);
    } else {
      setForm({ ...empty });
      setCustomFields([]);
      setSimilarIds([]);
    }
  }, [product]);

  function set(key: string, value: string | boolean | string[]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function applyGroup(groupId: string) {
    const group = groups.find((g) => String(g.id) === groupId);
    if (!group) return;
    const copied = group.fields.map((f) => ({ ...f, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }));
    setCustomFields(copied);
  }

  async function handleModelFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading3d(true);
    setError(null);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: err } = await supabase.storage.from("models").upload(path, file, { upsert: false });
    if (err) { setError(err.message); setUploading3d(false); return; }
    const url = supabase.storage.from("models").getPublicUrl(path).data.publicUrl;
    set("model_3d_url", url);
    setUploading3d(false);
    if (modelFileRef.current) modelFileRef.current.value = "";
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
      has_3d_preview: form.has_3d_preview,
      model_3d_url: form.model_3d_url.trim() || null,
      model_texture_mesh: form.model_texture_mesh.trim() || null,
      custom_fields: customFields,
      similar_products: similarIds,
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
                  <RichTextEditor value={form.description_en} onChange={(v) => set("description_en", v)} placeholder="Short product description…" />
                  <CharCount value={form.description_en.replace(/<[^>]*>/g, "")} min={80} max={500} />
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
                  <RichTextEditor value={form.description_bs} onChange={(v) => set("description_bs", v)} placeholder="Kratki opis proizvoda…" />
                  <CharCount value={form.description_bs.replace(/<[^>]*>/g, "")} min={80} max={500} />
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
                    <><Upload className="w-6 h-6" strokeWidth={1.5} /><span className="text-sm font-medium">Click to upload main image</span><span className="text-xs text-center">Square · 800×800 px recommended · JPG, PNG or WEBP · max 2 MB</span></>
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
              <p className="text-xs text-gray-400">Same format as main image — square, 800×800 px, JPG/PNG/WEBP, max 2 MB each.</p>
            </Field>

            {/* In stock */}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => set("in_stock", !form.in_stock)}
                className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.in_stock ? "bg-navy" : "bg-gray-200"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.in_stock ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <span className="text-sm font-medium text-navy">In Stock</span>
            </label>

            {/* 3D Preview */}
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center gap-3">
                <div onClick={() => set("has_3d_preview", !form.has_3d_preview)}
                  className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${form.has_3d_preview ? "bg-navy" : "bg-gray-200"}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.has_3d_preview ? "translate-x-4" : "translate-x-0"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-navy flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
                    Enable 3D Preview
                  </p>
                  <p className="text-xs text-gray-400">Customers can preview their uploaded photo on the product in 3D.</p>
                </div>
              </div>

              {form.has_3d_preview && (
                <div className="flex flex-col gap-3 pl-[52px]">
                  {/* GLB Upload */}
                  <Field label="3D Model File (.glb)">
                    {form.model_3d_url ? (
                      <div className="flex items-center gap-3 px-3 py-2.5 bg-navy/5 border border-navy/15 rounded-lg">
                        <Box className="w-4 h-4 text-navy/50 flex-shrink-0" strokeWidth={1.5} />
                        <span className="text-xs text-navy/70 flex-1 truncate">Model uploaded</span>
                        <button type="button" onClick={() => set("model_3d_url", "")}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                          <X className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => modelFileRef.current?.click()} disabled={uploading3d}
                        className="flex flex-col items-center justify-center gap-2 w-full h-24 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-60">
                        {uploading3d ? (
                          <><Spinner /><span className="text-xs">Uploading model…</span></>
                        ) : (
                          <><Upload className="w-5 h-5" strokeWidth={1.5} /><span className="text-xs font-medium">Click to upload .glb file</span></>
                        )}
                      </button>
                    )}
                    <input ref={modelFileRef} type="file" accept=".glb,.gltf" className="hidden" onChange={handleModelFile} />
                  </Field>

                  {/* Mesh picker */}
                  {form.model_3d_url && (
                    <Field label="Photo Surface — click the part of the model where the photo should appear">
                      <MeshPickerCanvas
                        modelUrl={form.model_3d_url}
                        selectedMesh={form.model_texture_mesh}
                        onSelect={(name) => set("model_texture_mesh", name)}
                      />
                    </Field>
                  )}
                </div>
              )}
            </div>

            {/* Custom Fields */}
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-medium text-navy">Customer Input Fields</p>
                <p className="text-xs text-gray-400 mt-0.5">Fields customers fill in when adding to cart (e.g. personalization, size, color).</p>
              </div>

              {/* Load from group */}
              {groups.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => { if (e.target.value) applyGroup(e.target.value); e.target.value = ""; }}
                  className={inputCls}
                >
                  <option value="">— Load from a field group —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.fields.length} field{g.fields.length !== 1 ? "s" : ""})</option>
                  ))}
                </select>
              )}

              <CustomFieldsList fields={customFields} onChange={setCustomFields} />
            </div>

            {/* Similar Products */}
            <SimilarProductsPicker
              allProducts={allProducts}
              currentId={product?.id ?? null}
              selectedIds={similarIds}
              search={productSearch}
              onSearchChange={setProductSearch}
              onAdd={(id) => setSimilarIds((prev) => prev.includes(id) ? prev : [...prev, id])}
              onRemove={(id) => setSimilarIds((prev) => prev.filter((x) => x !== id))}
            />
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
  const descText = (form.description_en || form.description_bs || "").replace(/<[^>]*>/g, "").trim();
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

// ─── Similar Products Picker ──────────────────────────────────────────────────

function SimilarProductsPicker({
  allProducts, currentId, selectedIds, search, onSearchChange, onAdd, onRemove,
}: {
  allProducts: Product[];
  currentId: number | null;
  selectedIds: number[];
  search: string;
  onSearchChange: (v: string) => void;
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const q = search.toLowerCase();
  const candidates = allProducts.filter((p) =>
    p.id !== currentId &&
    !selectedIds.includes(p.id) &&
    (
      (p.name_en ?? p.name ?? "").toLowerCase().includes(q) ||
      (p.name_bs ?? "").toLowerCase().includes(q)
    )
  );

  const selected = allProducts.filter((p) => selectedIds.includes(p.id));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-medium text-navy">Similar Products</p>
        <p className="text-xs text-gray-400 mt-0.5">Products shown as recommendations on this product's page.</p>
      </div>

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <span key={p.id} className="flex items-center gap-1.5 px-3 py-1 bg-navy/10 text-navy text-xs font-medium rounded-full">
              {p.image_url && (
                <img src={p.image_url} alt="" className="w-5 h-5 rounded-full object-cover" />
              )}
              {p.name_en ?? p.name_bs ?? p.name}
              <button type="button" onClick={() => onRemove(p.id)}
                className="p-0.5 hover:text-red-500 transition-colors">
                <X className="w-3 h-3" strokeWidth={2} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" strokeWidth={2} />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search products to add…"
          className={`${inputCls} pl-8`}
        />
      </div>

      {/* Results */}
      {search.trim() && (
        <div className="border border-gray-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No matching products</p>
          ) : (
            candidates.slice(0, 20).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onAdd(p.id); onSearchChange(""); }}
                className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 text-left"
              >
                {p.image_url ? (
                  <img src={p.image_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0 border border-gray-100" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-cream/80 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy truncate">{p.name_en ?? p.name_bs ?? p.name}</p>
                  {p.name_bs && <p className="text-xs text-gray-400 truncate">{p.name_bs}</p>}
                </div>
                <span className="text-xs font-semibold text-copper flex-shrink-0">{p.price.toFixed(2)} KM</span>
              </button>
            ))
          )}
        </div>
      )}
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
