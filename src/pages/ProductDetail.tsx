import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ShoppingCart, ArrowLeft, CheckCircle, XCircle, Share2, Upload, X as XIcon, ChevronRight, ChevronLeft, Box, ZoomIn } from "lucide-react";
import { supabase, type Product, type Category, type CustomField, type PriceOption, localName, localDesc } from "../lib/supabase";
import { uploadCustomerPhoto } from "../lib/customerUpload";
import { useSignedImage } from "../hooks/useSignedImage";
import { RichDescription } from "../components/RichDescription";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { ReviewsSection } from "../components/ReviewsSection";
// Three.js is only needed when the user opens the 3D preview — load it on demand.
const ThreeDPreviewModal = lazy(() =>
  import("../components/ThreeDPreviewModal").then((m) => ({ default: m.ThreeDPreviewModal }))
);
import { PersonalizationModal } from "../components/PersonalizationModal";
import { useLang } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { SiteMeta } from "../components/SiteMeta";

function LightboxModal({ images, startIndex, onClose }: { images: string[]; startIndex: number; onClose: () => void }) {
  const [idx, setIdx] = useState(startIndex);
  const [dir, setDir] = useState<"left" | "right">("left");
  const touchStartX = useRef(0);

  function go(next: number, d: "left" | "right") { setDir(d); setIdx(next); }
  function prev() { if (idx > 0) go(idx - 1, "right"); }
  function next() { if (idx < images.length - 1) go(idx + 1, "left"); }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <motion.div
      className="fixed inset-0 z-[70] bg-black/95 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 flex-shrink-0">
        <span className="text-white/40 text-sm">{idx + 1} / {images.length}</span>
        <button onClick={onClose} className="p-2 text-white/50 hover:text-white rounded-xl hover:bg-white/10 transition-colors">
          <XIcon className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </div>

      {/* Image */}
      <div
        className="flex-1 relative overflow-hidden"
        onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
        }}
      >
        <AnimatePresence initial={false} custom={dir}>
          <motion.img
            key={idx}
            src={images[idx]}
            alt=""
            custom={dir}
            variants={{
              enter: (d: string) => ({ x: d === "left" ? "100%" : "-100%", opacity: 0.6 }),
              center: { x: 0, opacity: 1 },
              exit:  (d: string) => ({ x: d === "left" ? "-100%" : "100%", opacity: 0.6 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
            className="absolute inset-0 w-full h-full object-contain"
          />
        </AnimatePresence>

        {/* Prev / Next arrows */}
        {images.length > 1 && (
          <>
            <button
              onClick={prev} disabled={idx === 0}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors disabled:opacity-20"
            >
              <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <button
              onClick={next} disabled={idx === images.length - 1}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors disabled:opacity-20"
            >
              <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
            </button>
          </>
        )}
      </div>

      {/* Dot indicators */}
      {images.length > 1 && (
        <div className="flex justify-center gap-1.5 py-4 flex-shrink-0">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i, i > idx ? "left" : "right")}
              className={`rounded-full transition-all duration-200 ${i === idx ? "w-5 h-2 bg-white" : "w-2 h-2 bg-white/30 hover:bg-white/60"}`}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

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
  const [slideDir, setSlideDir] = useState<"left" | "right">("left");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [fieldTokens, setFieldTokens] = useState<Record<string, string>>({});
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<PriceOption | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [preview3DUrl, setPreview3DUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [personalizationOpen, setPersonalizationOpen] = useState(false);
  const touchStartX = useRef(0);
  const colRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [cardFixed, setCardFixed] = useState(false);
  const [cardAtBottom, setCardAtBottom] = useState(false);
  const [fixedStyle, setFixedStyle] = useState<React.CSSProperties>({});
  const [placeholderH, setPlaceholderH] = useState(0);

  useEffect(() => {
    const getTop = () => 10;
    const check = () => {
      if (window.innerWidth < 1024) { setCardFixed(false); setCardAtBottom(false); return; }
      const col = colRef.current; const card = cardRef.current; const row = rowRef.current;
      if (!col || !card || !row) return;
      const top = getTop();
      const colRect = col.getBoundingClientRect();
      const rowBottom = row.getBoundingClientRect().bottom;
      const h = card.offsetHeight;
      if (colRect.top <= top) {
        if (rowBottom > top + h) {
          setFixedStyle({ position: 'fixed', top, left: colRect.left, width: colRect.width, zIndex: 40 });
          setPlaceholderH(h);
          setCardFixed(true);
          setCardAtBottom(false);
        } else {
          setCardFixed(false);
          setFixedStyle({});
          setCardAtBottom(true);
        }
      } else {
        setCardFixed(false);
        setCardAtBottom(false);
        setFixedStyle({});
      }
    };
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    check();
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [product]);

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
        setSelectedOption(null);
        setVariantError(null);
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
            .in("id", data.similar_products)
            .eq("in_stock", true)
            .neq("id", data.id);
          const ordered = (data.similar_products as number[])
            .map((sid: number) => (simData ?? []).find((p) => p.id === sid))
            .filter((p): p is Product => p !== undefined);
          setSimilarProducts(ordered);
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
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20">
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
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-32 text-center">
        <p className="text-navy/50 mb-6">{tr("product_not_found")}</p>
        <button onClick={() => navigate("/")} className="text-sm font-semibold text-navy underline underline-offset-4">
          {tr("product_back")}
        </button>
      </div>
    );
  }

  const name = localName(product, lang);
  const desc = localDesc(product, lang);
  const shortDesc = lang === "bs"
    ? (product.short_description_bs || product.short_description_en || null)
    : (product.short_description_en || null);
  const plainDesc = desc ? desc.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim() : undefined;

  const productJsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    ...(plainDesc ? { description: plainDesc } : {}),
    ...(product.image_url ? { image: product.image_url } : {}),
    offers: {
      "@type": "Offer",
      url: `https://dekokutak.ba/products/${product.id}`,
      price: product.price.toFixed(2),
      priceCurrency: "BAM",
      availability: product.in_stock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
    },
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 pb-12">
      <SiteMeta title={name} description={desc || undefined} jsonLd={productJsonLd} />
      {/* Back link */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-navy/60 hover:text-navy transition-colors mb-3 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" strokeWidth={2} />
        {tr("product_back")}
      </button>

      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12" ref={rowRef}>
        {/* LEFT: Images + description */}
        <div className="min-w-0 lg:flex-1 flex flex-col gap-3">
          {/* Images: thumbnails left + main image right */}
          {(() => {
            const activeIdx = allImages.indexOf(activeImage ?? "");
            function navigateImage(url: string, dir: "left" | "right") {
              setSlideDir(dir);
              setActiveImage(url);
            }
            function goPrev() { if (activeIdx > 0) navigateImage(allImages[activeIdx - 1], "right"); }
            function goNext() { if (activeIdx < allImages.length - 1) navigateImage(allImages[activeIdx + 1], "left"); }
            return (
              <div className="flex flex-col lg:flex-row gap-3">
                {/* Main image — order-1 on mobile, order-2 on desktop */}
                <div
                  className="relative order-1 lg:order-2 flex-1 aspect-square bg-cream/60 rounded-2xl overflow-hidden border-[0.5px] border-navy/10 select-none cursor-zoom-in group"
                  onClick={() => { if (activeImage) setLightboxOpen(true); }}
                  onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
                  onTouchEnd={(e) => {
                    const diff = touchStartX.current - e.changedTouches[0].clientX;
                    if (Math.abs(diff) > 50) { e.preventDefault(); diff > 0 ? goNext() : goPrev(); }
                  }}
                >
                  <AnimatePresence initial={false} custom={slideDir}>
                    {activeImage ? (
                      <motion.img
                        key={activeImage}
                        src={activeImage}
                        alt={name}
                        custom={slideDir}
                        variants={{
                          enter: (dir: string) => ({ x: dir === "left" ? "100%" : "-100%", opacity: 0.6 }),
                          center: { x: 0, opacity: 1 },
                          exit:  (dir: string) => ({ x: dir === "left" ? "-100%" : "100%", opacity: 0.6 }),
                        }}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: "spring", stiffness: 320, damping: 32, mass: 0.8 }}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-navy/20 font-semibold tracking-widest uppercase text-sm">No Image</span>
                      </div>
                    )}
                  </AnimatePresence>

                  {/* Zoom hint */}
                  {activeImage && (
                    <div className="absolute top-3 right-3 z-10 p-1.5 bg-black/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <ZoomIn className="w-4 h-4 text-white" strokeWidth={1.75} />
                    </div>
                  )}
                </div>

                {/* Thumbnails — horizontal below on mobile, vertical left on desktop */}
                {allImages.length > 1 && (
                  <div className="order-2 lg:order-1 flex lg:flex-col gap-2 lg:w-[72px] lg:flex-shrink-0 overflow-x-auto scrollbar-hide">
                    {allImages.map((url, idx) => (
                      <button
                        key={idx}
                        onClick={() => navigateImage(url, idx > activeIdx ? "left" : "right")}
                        className={`flex-shrink-0 w-16 h-16 lg:w-auto lg:h-auto lg:aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                          activeImage === url ? "border-navy" : "border-transparent hover:border-navy/30"
                        }`}
                      >
                        <img src={url} alt={`${name} ${idx + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Description below images — desktop only */}
          {desc && desc.replace(/<[^>]*>/g, "").trim() && (
            <div className="hidden lg:block mt-4 pt-6 border-t border-navy/10">
              <h2 className="text-sm font-semibold text-navy uppercase tracking-widest mb-3">
                {lang === "bs" ? "Opis proizvoda" : "Product Details"}
              </h2>
              <RichDescription html={desc} />
            </div>
          )}
        </div>

        {/* RIGHT: purchase card */}
        <div className="lg:w-[380px] lg:flex-shrink-0 relative" ref={colRef}>
          {cardFixed && <div style={{ height: placeholderH }} />}
          <div ref={cardRef} style={cardFixed ? fixedStyle : cardAtBottom ? { position: 'absolute', bottom: 0, width: '100%' } : {}}>
          <div className="bg-white rounded-2xl border border-navy/10 shadow-md p-6 flex flex-col gap-5">
            {/* Category */}
            {product.category && (
              <span className="text-xs font-semibold text-copper uppercase tracking-widest">
                {category ? localName(category, lang) : product.category}
              </span>
            )}

            {/* Name */}
            <h1 className="text-2xl font-semibold text-navy leading-tight tracking-tight">
              {name}
            </h1>

            {/* Price */}
            {(() => {
              const hasVariants = product.price_options && product.price_options.length > 0;
              const displayPrice = selectedOption
                ? selectedOption.price
                : hasVariants
                ? Math.min(...(product.price_options as PriceOption[]).map((o) => o.price))
                : product.price;
              const pricePrefix = !selectedOption && hasVariants
                ? (lang === "bs" ? "Od " : "From ")
                : "";
              return (
                <div className="flex flex-col gap-1">
                  {!hasVariants && product.compare_price && product.compare_price > product.price && (
                    <p className="text-sm text-gray-400 line-through">{product.compare_price.toFixed(2)} KM</p>
                  )}
                  <p className="text-3xl font-bold text-navy">
                    {pricePrefix}{displayPrice.toFixed(2)} KM
                  </p>
                </div>
              );
            })()}

            {/* Short description */}
            {shortDesc && (
              <p className="text-sm text-navy/70 leading-relaxed">{shortDesc}</p>
            )}

            {/* Variant selector — shown for products with price_options */}
            {product.price_options && product.price_options.length > 0 && (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label={tr("product_select_variant")}>
                <p className="text-sm font-medium text-navy">
                  {tr("product_select_variant")} <span className="text-red-400">*</span>
                </p>
                {product.price_options.map((opt) => {
                  const label = lang === "bs" ? opt.label_bs : opt.label_en;
                  const isSelected = selectedOption?.id === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => { setSelectedOption(opt); setVariantError(null); }}
                      className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-colors ${
                        isSelected ? "border-navy bg-navy/5" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-sm font-medium text-navy">{label}</span>
                      <span className="text-sm font-semibold text-navy">{opt.price.toFixed(2)} KM</span>
                    </button>
                  );
                })}
                {variantError && (
                  <p className="text-sm text-red-500 px-3 py-2 bg-red-50 rounded-lg">{variantError}</p>
                )}
              </div>
            )}

            {product.requires_personalization ? (
              /* Personalized product — modal trigger */
              <div className="flex flex-col gap-3">
                <button
                  disabled={!product.in_stock}
                  onClick={() => {
                    if (product.price_options && product.price_options.length > 0 && !selectedOption) {
                      setVariantError(tr("product_variant_required"));
                      return;
                    }
                    setPersonalizationOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ShoppingCart className="w-5 h-5" strokeWidth={2} />
                  {tr("modal_personalize_and_add")}
                </button>

                <div className="flex gap-3">
                  <button
                    onClick={() => navigator.share?.({ title: name, url: window.location.href })}
                    className="flex-1 flex items-center justify-center py-3.5 border border-navy/20 rounded-xl text-navy/50 hover:text-navy hover:border-navy/40 transition-colors"
                  >
                    <Share2 className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ) : (
              /* Normal product — inline fields + direct add to cart */
              <>
                <div className="border-t border-navy/10" />

                <ProductCustomFields
                  fields={product.custom_fields ?? []}
                  lang={lang}
                  values={fieldValues}
                  onChange={(id, val) => { setFieldValues((prev) => ({ ...prev, [id]: val })); setFieldError(null); }}
                  onUploadingChange={(id, isUploading) =>
                    setUploadingFields((prev) => ({ ...prev, [id]: isUploading }))
                  }
                  onTokenChange={(id, token) =>
                    setFieldTokens((prev) => {
                      if (token === null) {
                        const next = { ...prev }; delete next[id]; return next;
                      }
                      return { ...prev, [id]: token };
                    })
                  }
                  has3DPreview={product.has_3d_preview}
                  model3dUrl={product.model_3d_url}
                  model3dMesh={product.model_texture_mesh}
                  onPreview3D={(url) => setPreview3DUrl(url)}
                />

                {fieldError && (
                  <p className="text-sm text-red-500 px-3 py-2 bg-red-50 rounded-lg">{fieldError}</p>
                )}

                <div className="flex gap-3">
                  <button
                    disabled={!product.in_stock || Object.values(uploadingFields).some(Boolean)}
                    onClick={() => {
                      if (product.price_options && product.price_options.length > 0 && !selectedOption) {
                        setVariantError(tr("product_variant_required"));
                        return;
                      }
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
                      const labeledTokens: Record<string, string> = {};
                      (product.custom_fields ?? []).forEach((f) => {
                        const val = fieldValues[f.id];
                        if (val) {
                          const label = lang === "bs" ? (f.label_bs || f.label_en) : (f.label_en || f.label_bs);
                          if (label) {
                            labeled[label] = val;
                            if (fieldTokens[f.id]) labeledTokens[label] = fieldTokens[f.id];
                          }
                        }
                      });
                      addItem(product, labeled, Object.keys(labeledTokens).length > 0 ? labeledTokens : undefined, selectedOption ?? undefined);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-5 h-5" strokeWidth={2} />
                    {tr("product_add_to_cart")}
                  </button>


                  <button
                    onClick={() => navigator.share?.({ title: name, url: window.location.href })}
                    className="p-3.5 border border-navy/20 rounded-xl text-navy/50 hover:text-navy hover:border-navy/40 transition-colors"
                  >
                    <Share2 className="w-5 h-5" strokeWidth={1.5} />
                  </button>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Description — mobile only (shown below price card) */}
      {desc && desc.replace(/<[^>]*>/g, "").trim() && (
        <div className="lg:hidden mt-6 pt-6 border-t border-navy/10">
          <h2 className="text-sm font-semibold text-navy uppercase tracking-widest mb-3">
            {lang === "bs" ? "Opis proizvoda" : "Product Details"}
          </h2>
          <RichDescription html={desc} />
        </div>
      )}

      {/* Reviews */}
      <ReviewsSection productId={product.id} />

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <SimilarProductsSection products={similarProducts} lang={lang} tr={tr} />
      )}

      {/* Personalization Modal */}
      {personalizationOpen && (
        <PersonalizationModal
          product={product}
          onClose={() => setPersonalizationOpen(false)}
          variantOption={selectedOption ?? undefined}
        />
      )}

      {/* 3D Preview Modal */}
      {preview3DUrl && product.has_3d_preview && product.model_3d_url && product.model_texture_mesh && (
        <Suspense fallback={<div className="fixed inset-0 bg-black/95 z-[60]" />}>
          <ThreeDPreviewModal
            modelUrl={product.model_3d_url}
            textureUrl={preview3DUrl}
            meshName={product.model_texture_mesh}
            onClose={() => setPreview3DUrl(null)}
          />
        </Suspense>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && allImages.length > 0 && (
          <LightboxModal
            images={allImages}
            startIndex={Math.max(0, allImages.indexOf(activeImage ?? ""))}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Customer-facing custom fields ───────────────────────────────────────────

const fieldInputCls =
  "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition";

function ImageUploadField({
  fieldId, value, required, label, lang, onChange, onUploadingChange, onTokenChange,
  has3DPreview, onPreview3D,
}: {
  fieldId: string;
  value: string;
  required: boolean;
  label: string;
  lang: string;
  onChange: (id: string, value: string) => void;
  onUploadingChange?: (fieldId: string, isUploading: boolean) => void;
  onTokenChange?: (fieldId: string, token: string | null) => void;
  has3DPreview?: boolean;
  onPreview3D?: (url: string) => void;
}) {
  const { tr } = useLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Local token — used only for display/preview within this session
  const [localToken, setLocalToken] = useState<string | undefined>(undefined);
  const { url: signedUrl } = useSignedImage(value, localToken);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setError(tr("upload_invalid_format"));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(tr("upload_too_large"));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setUploading(true);
    onUploadingChange?.(fieldId, true);
    setError(null);

    try {
      const { path, token } = await uploadCustomerPhoto(file);
      setLocalToken(token);
      onChange(fieldId, path);
      onTokenChange?.(fieldId, token);
    } catch {
      setError(tr("upload_failed"));
    } finally {
      setUploading(false);
      onUploadingChange?.(fieldId, false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleClear() {
    setLocalToken(undefined);
    onChange(fieldId, "");
    onTokenChange?.(fieldId, null);
  }

  // Display URL: signed URL from hook, or fall back to legacy http values
  const displayUrl = signedUrl ?? (value.startsWith("http") ? value : null);

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex flex-col gap-2">
          <div className="relative w-full">
            {displayUrl ? (
              <img src={displayUrl} alt={label} className="w-full max-h-56 object-contain rounded-xl border border-gray-200 bg-gray-50" />
            ) : (
              <div className="w-full h-36 rounded-xl border border-gray-200 bg-gray-100 animate-pulse" />
            )}
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 p-1.5 bg-white/90 border border-gray-200 rounded-lg text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm"
            >
              <XIcon className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
          {has3DPreview && onPreview3D && displayUrl && (
            <button
              type="button"
              onClick={() => onPreview3D(displayUrl)}
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
  fields, lang, values, onChange, onUploadingChange, onTokenChange,
  has3DPreview, model3dUrl, model3dMesh, onPreview3D,
}: {
  fields: CustomField[];
  lang: string;
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onUploadingChange?: (id: string, isUploading: boolean) => void;
  onTokenChange?: (id: string, token: string | null) => void;
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
                onUploadingChange={onUploadingChange}
                onTokenChange={onTokenChange}
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
    <div className="min-h-screen bg-cream font-sans text-navy">
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
