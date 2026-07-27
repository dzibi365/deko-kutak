import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ShoppingCart, Heart, ArrowLeft, CheckCircle, XCircle, Share2, Upload, X as XIcon, ChevronRight, Box } from "lucide-react";
import { supabase, type Product, type Category, type CustomField, localName, localDesc } from "../lib/supabase";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { ReviewsSection } from "../components/ReviewsSection";
import { ThreeDPreviewModal } from "../components/ThreeDPreviewModal";
import { useLang } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { SiteMeta } from "../components/SiteMeta";

function ProductDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang, tr } = useLang();
  const { addItem } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [preview3DUrl, setPreview3DUrl] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      if (!data) {
        setNotFound(true);
      } else {
        setProduct(data);
        setActiveImage(data.image_url ?? data.gallery_images?.[0] ?? null);
        if (data.category) {
          const { data: cat } = await supabase
            .from("categories")
            .select("*")
            .eq("name_en", data.category)
            .maybeSingle();
          setCategory(cat ?? null);
        }
        if (data.similar_products && data.similar_products.length > 0) {
          const { data: simData } = await supabase
            .from("products")
            .select("*")
            .in("id", data.similar_products);
          setSimilarProducts(simData ?? []);
        } else {
          setSimilarProducts([]);
        }
      }
      setLoading(false);
    }
    load();
  }, [id]);

  const allImages = product
    ? [product.image_url, ...(product.gallery_images ?? [])].filter(Boolean) as string[]
    : [];

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-pulse">
          <div className="flex flex-col gap-3">
            <div className="aspect-square bg-cream/80 rounded-2xl" />
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="aspect-square bg-cream/80 rounded-lg" />)}
            </div>
          </div>
          <div className="flex flex-col gap-4 pt-4">
            <div className="h-4 w-24 bg-cream/80 rounded" />
            <div className="h-8 w-3/4 bg-cream/80 rounded" />
            <div className="h-6 w-24 bg-cream/80 rounded" />
            <div className="h-24 w-full bg-cream/80 rounded mt-4" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-32 text-center">
        <p className="text-navy/50 mb-6">{tr("product_not_found")}</p>
        <button onClick={() => navigate("/")} className="text-sm font-semibold text-navy underline underline-offset-4">
          {tr("product_back")}
        </button>
      </div>
    );
  }

  const name = localName(product, lang);
  const desc = localDesc(product, lang);

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
      <SiteMeta title={name} description={desc || undefined} />
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-navy/60 hover:text-navy transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
        {tr("product_back")}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">
        {/* Images */}
        <div className="flex flex-col gap-3">
          {/* Main image */}
          <div className="aspect-square bg-cream/60 rounded-2xl overflow-hidden border-[0.5px] border-navy/10 flex items-center justify-center">
            {activeImage ? (
              <img
                src={activeImage}
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-navy/20 font-semibold tracking-widest uppercase text-sm">No Image</span>
            )}
          </div>

          {/* Thumbnails */}
          {allImages.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {allImages.map((url, idx) => (
                <button
                  key={idx}
                  onClick={() => setActiveImage(url)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    activeImage === url
                      ? "border-navy"
                      : "border-transparent hover:border-navy/30"
                  }`}
                >
                  <img src={url} alt={`${name} ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex flex-col pt-2">
          {/* Category */}
          {product.category && (
            <span className="text-xs font-semibold text-copper uppercase tracking-widest mb-3">
              {category ? localName(category, lang) : product.category}
            </span>
          )}

          {/* Name */}
          <h1 className="text-3xl font-semibold text-navy leading-tight tracking-tight mb-4">
            {name}
          </h1>

          {/* Price */}
          <p className="text-2xl font-semibold text-navy mb-5">
            {product.price.toFixed(2)} KM
          </p>

          {/* Stock */}
          <div className="flex items-center gap-2 mb-6">
            {product.in_stock ? (
              <>
                <CheckCircle className="w-4 h-4 text-green-500" strokeWidth={2} />
                <span className="text-sm font-medium text-green-600">{tr("product_in_stock")}</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-red-400" strokeWidth={2} />
                <span className="text-sm font-medium text-red-500">{tr("product_out_of_stock")}</span>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-navy/10 mb-6" />

          {/* Description */}
          {desc && (
            <div className="text-navy/70 leading-relaxed mb-8 text-base">
              {desc.split('\n').map((line, i) =>
                line.trim() === ''
                  ? <br key={i} />
                  : <p key={i} className="mb-1">{line}</p>
              )}
            </div>
          )}

          {/* Custom fields */}
          <ProductCustomFields
            fields={product.custom_fields ?? []}
            lang={lang}
            values={fieldValues}
            onChange={(id, val) => { setFieldValues((prev) => ({ ...prev, [id]: val })); setFieldError(null); }}
            has3DPreview={product.has_3d_preview}
            model3dUrl={product.model_3d_url}
            model3dMesh={product.model_texture_mesh}
            onPreview3D={(url) => setPreview3DUrl(url)}
          />

          {fieldError && (
            <p className="text-sm text-red-500 mb-4 px-3 py-2 bg-red-50 rounded-lg">{fieldError}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-auto">
            <button
              disabled={!product.in_stock}
              onClick={() => {
                const missing = (product.custom_fields ?? []).find(
                  (f) => f.required && !fieldValues[f.id]?.trim()
                );
                if (missing) {
                  const label = lang === "bs" ? (missing.label_bs || missing.label_en) : (missing.label_en || missing.label_bs);
                  setFieldError(`Please fill in: ${label}`);
                  return;
                }
                setFieldError(null);
                const labeled: Record<string, string> = {};
                (product.custom_fields ?? []).forEach((f) => {
                  const val = fieldValues[f.id];
                  if (val) {
                    const label = lang === "bs" ? (f.label_bs || f.label_en) : (f.label_en || f.label_bs);
                    if (label) labeled[label] = val;
                  }
                });
                addItem(product, labeled);
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShoppingCart className="w-5 h-5" strokeWidth={2} />
              {tr("product_add_to_cart")}
            </button>

            <button className="p-3.5 border border-navy/20 rounded-xl text-navy/50 hover:text-copper hover:border-copper transition-colors">
              <Heart className="w-5 h-5" strokeWidth={1.5} />
            </button>

            <button
              onClick={() => navigator.share?.({ title: name, url: window.location.href })}
              className="p-3.5 border border-navy/20 rounded-xl text-navy/50 hover:text-navy hover:border-navy/40 transition-colors"
            >
              <Share2 className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Reviews */}
      <ReviewsSection productId={product.id} />

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <SimilarProductsSection products={similarProducts} lang={lang} tr={tr} />
      )}

      {/* 3D Preview Modal */}
      {preview3DUrl && product.has_3d_preview && product.model_3d_url && product.model_texture_mesh && (
        <ThreeDPreviewModal
          modelUrl={product.model_3d_url}
          textureUrl={preview3DUrl}
          meshName={product.model_texture_mesh}
          onClose={() => setPreview3DUrl(null)}
        />
      )}
    </div>
  );
}

// ─── Customer-facing custom fields ───────────────────────────────────────────

const fieldInputCls =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition";

function ImageUploadField({
  fieldId, value, required, label, lang, onChange,
  has3DPreview, onPreview3D,
}: {
  fieldId: string;
  value: string;
  required: boolean;
  label: string;
  lang: string;
  onChange: (id: string, value: string) => void;
  has3DPreview?: boolean;
  onPreview3D?: (url: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("customer-uploads")
      .upload(path, file, { upsert: false });
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }
    const url = supabase.storage.from("customer-uploads").getPublicUrl(path).data.publicUrl;
    onChange(fieldId, url);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            <img src={value} alt={label} className="w-full max-h-56 object-contain rounded-xl border border-gray-200 bg-gray-50" />
            <button
              type="button"
              onClick={() => onChange(fieldId, "")}
              className="absolute top-2 right-2 p-1.5 bg-white/90 border border-gray-200 rounded-lg text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
            >
              <XIcon className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          {has3DPreview && onPreview3D && (
            <button
              type="button"
              onClick={() => onPreview3D(value)}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors"
            >
              <Box className="w-4 h-4" strokeWidth={1.75} />
              {lang === "bs" ? "Pogledaj u 3D" : "Preview in 3D"}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 w-full h-36 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
              <span className="text-sm">{lang === "bs" ? "Učitavanje…" : "Uploading…"}</span>
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" strokeWidth={1.5} />
              <span className="text-sm font-medium">{lang === "bs" ? "Kliknite za upload fotografije" : "Click to upload photo"}</span>
              <span className="text-xs">JPG, PNG or WEBP · max 5 MB</span>
            </>
          )}
        </button>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
    </div>
  );
}

function ProductCustomFields({
  fields, lang, values, onChange,
  has3DPreview, model3dUrl, model3dMesh, onPreview3D,
}: {
  fields: CustomField[];
  lang: string;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  has3DPreview?: boolean;
  model3dUrl?: string | null;
  model3dMesh?: string | null;
  onPreview3D?: (url: string) => void;
}) {
  if (fields.length === 0) return null;

  const canPreview = !!(has3DPreview && model3dUrl && model3dMesh);

  return (
    <div className="flex flex-col gap-4 mb-6">
      {fields.map((field) => {
        const label = lang === "bs"
          ? (field.label_bs || field.label_en)
          : (field.label_en || field.label_bs);

        const placeholder = lang === "bs"
          ? (field.placeholder_bs || field.placeholder_en || label)
          : (field.placeholder_en || field.placeholder_bs || label);

        return (
          <div key={field.id} className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-navy">
              {label}
              {field.required && <span className="text-red-400 ml-1">*</span>}
            </label>

            {field.type === "text" && (
              <input
                value={values[field.id] ?? ""}
                onChange={(e) => onChange(field.id, e.target.value)}
                placeholder={placeholder}
                className={fieldInputCls}
              />
            )}

            {field.type === "textarea" && (
              <textarea
                value={values[field.id] ?? ""}
                onChange={(e) => onChange(field.id, e.target.value)}
                rows={3}
                placeholder={placeholder}
                className={`${fieldInputCls} resize-none`}
              />
            )}

            {field.type === "select" && field.options.length > 0 && (
              <select
                value={values[field.id] ?? ""}
                onChange={(e) => onChange(field.id, e.target.value)}
                className={fieldInputCls}
              >
                <option value="">— {lang === "bs" ? "Odaberi" : "Select"} —</option>
                {field.options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            )}

            {field.type === "checkbox" && (
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={values[field.id] === "yes"}
                  onChange={(e) => onChange(field.id, e.target.checked ? "yes" : "")}
                  className="w-4 h-4 accent-navy rounded"
                />
                <span className="text-sm text-navy/70">{label}</span>
              </label>
            )}

            {field.type === "image" && (
              <ImageUploadField
                fieldId={field.id}
                value={values[field.id] ?? ""}
                required={field.required}
                label={label ?? ""}
                lang={lang}
                onChange={onChange}
                has3DPreview={canPreview}
                onPreview3D={onPreview3D}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Similar products section ─────────────────────────────────────────────────

function SimilarProductsSection({
  products,
  lang,
  tr,
}: {
  products: Product[];
  lang: string;
  tr: (key: string) => string;
}) {
  return (
    <div className="mt-16">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-navy">
          {lang === "bs" ? "Slični proizvodi" : "Similar Products"}
        </h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {products.map((p) => {
          const name = localName(p, lang as "en" | "bs");
          return (
            <Link
              key={p.id}
              to={`/products/${p.id}`}
              className="group flex flex-col rounded-2xl overflow-hidden border border-navy/8 hover:border-navy/20 bg-white hover:shadow-md transition-all"
            >
              <div className="aspect-square bg-cream/60 overflow-hidden">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full" />
                )}
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium text-navy leading-snug line-clamp-2">{name}</p>
                <p className="text-sm font-semibold text-copper">{p.price.toFixed(2)} KM</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <Navbar />
      <CartDrawer />
      <AuthModal />
      <main className="flex-1">
        <ProductDetailContent />
      </main>
      <Footer />
    </div>
  );
}
