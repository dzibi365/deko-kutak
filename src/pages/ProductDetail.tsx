import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ShoppingCart, Heart, ArrowLeft, CheckCircle, XCircle, Share2 } from "lucide-react";
import { supabase, type Product, localName, localDesc } from "../lib/supabase";
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
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

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
              {product.category}
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

          {/* Actions */}
          <div className="flex gap-3 mt-auto">
            <button
              disabled={!product.in_stock}
              onClick={() => addItem(product)}
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

export default function ProductDetail() {
  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col">
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
