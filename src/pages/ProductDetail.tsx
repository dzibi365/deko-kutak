import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShoppingCart, Heart, ArrowLeft, CheckCircle, XCircle, Share2 } from "lucide-react";
import { supabase, type Product, type Category, type CustomField, localName, localDesc } from "../lib/supabase";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { ReviewsSection } from "../components/ReviewsSection";
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
            <p className="text-navy/70 leading-relaxed mb-8 text-base">{desc}</p>
          )}

          {/* Custom fields */}
          <ProductCustomFields
            fields={product.custom_fields ?? []}
            lang={lang}
            values={fieldValues}
            onChange={(id, val) => { setFieldValues((prev) => ({ ...prev, [id]: val })); setFieldError(null); }}
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
    </div>
  );
}

// ─── Customer-facing custom fields ───────────────────────────────────────────

const fieldInputCls =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition";

function ProductCustomFields({
  fields, lang, values, onChange,
}: {
  fields: CustomField[];
  lang: string;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}) {
  if (fields.length === 0) return null;

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
          </div>
        );
      })}
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
