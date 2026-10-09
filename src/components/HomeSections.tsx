import { useEffect, useState } from "react";
import { PersonalizationModal } from "./PersonalizationModal";
import { ArrowRight, Instagram, Users, Hand, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'behold-widget': { 'feed-id': string };
    }
  }
}
import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { supabase, type Category, type Product, localName } from "../lib/supabase";

type HeroConfig = {
  badge_en: string; badge_bs: string;
  heading_en: string; heading_bs: string;
  subtext_en: string; subtext_bs: string;
  cta_primary_en: string; cta_primary_bs: string;
  cta_secondary_en: string; cta_secondary_bs: string;
  show_cta_primary: boolean;
  show_cta_secondary: boolean;
  image_url: string;
  stat1_value: string; stat1_label_en: string; stat1_label_bs: string;
  stat2_value: string; stat2_label_en: string; stat2_label_bs: string;
};

export function Hero() {
  const { lang, tr } = useLang();
  const [cfg, setCfg] = useState<HeroConfig | null>(null);

  useEffect(() => {
    supabase.from("hero_config").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) setCfg(data);
    });
  }, []);

  // Personalized Wooden Wedding USB & Calendar Gift Set — warm wood tones, personalized
  const heroImageUrl = "https://smlaoqjushalotduuhcx.supabase.co/storage/v1/object/public/product-images/1789044812034-3850160wbvw.webp";

  const badge    = cfg ? (lang === "bs" ? cfg.badge_bs    : cfg.badge_en)    : tr("hero_badge");
  const heading  = cfg ? (lang === "bs" ? cfg.heading_bs  : cfg.heading_en)  : tr("hero_heading");
  const subtext  = cfg ? (lang === "bs" ? cfg.subtext_bs  : cfg.subtext_en)  : tr("hero_sub");
  const ctaShop       = cfg ? (lang === "bs" ? cfg.cta_primary_bs   : cfg.cta_primary_en)   : tr("hero_cta_shop");
  const ctaStory      = cfg ? (lang === "bs" ? cfg.cta_secondary_bs : cfg.cta_secondary_en) : tr("hero_cta_story");
  const showPrimary   = cfg ? cfg.show_cta_primary   : true;
  const showSecondary = cfg ? cfg.show_cta_secondary : true;
  const stat1Val = cfg?.stat1_value ?? "500+";
  const stat1Lbl = cfg ? (lang === "bs" ? cfg.stat1_label_bs : cfg.stat1_label_en) : tr("hero_stat_customers");
  const stat2Val = cfg?.stat2_value ?? "100%";
  const stat2Lbl = cfg ? (lang === "bs" ? cfg.stat2_label_bs : cfg.stat2_label_en) : tr("hero_stat_quality");

  return (
    <section className="bg-navy text-cream py-14 lg:py-12 relative overflow-hidden">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-8 items-center">
          <div className="flex flex-col items-start gap-5 lg:gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-[0.5px] border-copper/40 bg-copper/10 text-copper text-xs font-semibold tracking-wide uppercase">
              {badge}
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight text-white">
              {heading}
            </h1>
            <p className="text-base lg:text-lg text-cream/80 max-w-md leading-relaxed">
              {subtext}
            </p>
            {(showPrimary || showSecondary) && (
              <div className="flex flex-wrap items-center gap-4 pt-4">
                {showPrimary && (
                  <button
                    onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}
                    className="px-6 py-3 bg-copper text-white font-semibold rounded-lg hover:bg-copper/90 transition-colors"
                  >
                    {ctaShop}
                  </button>
                )}
                {showSecondary && (
                  <button
                    onClick={() => document.getElementById("testimonials")?.scrollIntoView({ behavior: "smooth" })}
                    className="px-6 py-3 bg-transparent border-[0.5px] border-cream/30 text-cream font-semibold rounded-lg hover:bg-cream/5 transition-colors"
                  >
                    {ctaStory}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="relative h-[400px] w-full hidden lg:block">
            <div className="absolute inset-0 rounded-3xl overflow-hidden">
              <img
                src={heroImageUrl}
                alt="Personalized wooden gift set by Deko Kutak"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>

            {/* Badge 1 — top-left, sitting at the image edge */}
            <div className="absolute top-4 left-10 bg-white text-navy px-4 py-3 rounded-2xl border-[0.5px] border-navy/10 flex items-center gap-3 shadow-md">
              <Users className="w-8 h-8 text-copper flex-shrink-0" strokeWidth={1.5} />
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-bold text-navy leading-none">{stat1Val}</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">{stat1Lbl}</span>
              </div>
            </div>

            {/* Badge 2 — bottom-right, slightly inset */}
            <div className="absolute bottom-4 right-6 bg-white text-navy px-4 py-3 rounded-2xl border-[0.5px] border-navy/10 flex items-center gap-3 shadow-md">
              <Hand className="w-8 h-8 text-copper flex-shrink-0" strokeWidth={1.5} />
              <div className="flex flex-col gap-0.5">
                <span className="text-2xl font-bold text-navy leading-none">{stat2Val}</span>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-navy/50">{stat2Lbl}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type CategoryStripProps = {
  selected: string | null;
  onSelect: (cat: string | null) => void;
};

export function CategoryStrip({ selected, onSelect }: CategoryStripProps) {
  const { tr, lang } = useLang();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase.from("categories").select("*").order("name").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  return (
    <div className="w-full">
      {/* Mobile: compact dropdown — hidden on md+ */}
      <div className="flex items-center gap-3 md:hidden">
        <span className="text-sm font-medium text-navy/60 whitespace-nowrap flex-shrink-0">
          {tr("cat_categories_label")}
        </span>
        <select
          value={selected ?? ""}
          onChange={(e) => onSelect(e.target.value === "" ? null : e.target.value)}
          className="flex-1 text-sm text-navy border border-navy/15 rounded-xl px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy cursor-pointer"
        >
          <option value="">{tr("cat_all")}</option>
          {categories.map((cat) => {
            const label = localName(cat, lang);
            const value = cat.name_en ?? cat.name;
            return (
              <option key={cat.id} value={value}>{label}</option>
            );
          })}
        </select>
      </div>

      {/* Desktop: horizontal scrollable pills — hidden below md */}
      <div className="hidden md:flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2">
        <button
          onClick={() => onSelect(null)}
          className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-colors border-[0.5px] ${
            selected === null
              ? "bg-navy text-white border-navy"
              : "bg-transparent text-navy hover:border-navy/40 border-navy/20"
          }`}
        >
          {tr("cat_all")}
        </button>

        {categories.map((cat) => {
          const label = localName(cat, lang);
          const value = cat.name_en ?? cat.name;
          return (
            <button
              key={cat.id}
              onClick={() => onSelect(value)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-colors border-[0.5px] ${
                selected === value
                  ? "bg-navy text-white border-navy"
                  : "bg-transparent text-navy hover:border-navy/40 border-navy/20"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PromoBanner() {
  const { tr } = useLang();

  return (
    <section className="bg-navy text-cream py-12 md:py-16 border-y-[0.5px] border-copper/20">
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8 text-center md:text-left">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl md:text-3xl font-semibold tracking-tight text-white">
            {tr("promo_heading")}
          </h2>
          <p className="text-cream/70 text-base md:text-lg">{tr("promo_sub")}</p>
        </div>
        <button
          onClick={() => document.getElementById("shop")?.scrollIntoView({ behavior: "smooth" })}
          className="shrink-0 flex items-center gap-2 px-6 py-3 bg-copper text-white font-semibold rounded-lg hover:bg-copper/90 transition-colors"
        >
          {tr("promo_btn")}
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}

const NEW_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function CategoryShowcase() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("categories").select("*").order("name"),
      supabase.from("products").select("*").eq("in_stock", true).order("created_at", { ascending: false }),
    ]).then(([catsRes, prodsRes]) => {
      setCategories(catsRes.data ?? []);
      setProducts(prodsRes.data ?? []);
      setLoading(false);
    });
  }, []);

  const rows = categories
    .map((cat) => {
      const key = cat.name_en ?? cat.name;
      return { cat, products: products.filter((p) => p.category === key) };
    })
    .filter((r) => r.products.length > 0);

  if (loading || rows.length === 0) return null;

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-4">
          {rows.map(({ cat, products: catProducts }) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              products={catProducts.slice(0, 3)}
              lang={lang}
              onNavigate={(id) => navigate(`/products/${id}`)}
              onCategoryClick={(catName) => navigate(`/shop?category=${encodeURIComponent(catName)}`)}
              onPersonalize={(product) => setModalProduct(product)}
              onAddToCart={(product) => addItem(product)}
            />
          ))}
        </div>
      </section>
      {modalProduct && (
        <PersonalizationModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
        />
      )}
    </>
  );
}

type RowProps = {
  cat: Category;
  products: Product[];
  lang: string;
  onNavigate: (id: number) => void;
  onCategoryClick: (catName: string) => void;
  onPersonalize: (product: Product) => void;
  onAddToCart: (product: Product) => void;
};

function CategoryRow({ cat, products, lang, onNavigate, onCategoryClick, onPersonalize, onAddToCart }: RowProps) {
  const catName = lang === "bs" ? (cat.name_bs || cat.name_en || cat.name) : (cat.name_en || cat.name);
  const catKey = cat.name_en ?? cat.name;
  const now = Date.now();

  return (
    <div className="flex flex-col md:flex-row rounded-2xl overflow-hidden border border-navy/10" style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.07), inset 4px 0 0 0 #c8813a" }}>

      {/* Category image panel — full width on mobile, 220px on desktop */}
      <div
        className="w-full h-[180px] md:w-[220px] md:h-auto flex-shrink-0 relative bg-navy cursor-pointer group overflow-hidden"
        onClick={() => onCategoryClick(catKey)}
      >
        {cat.image_url ? (
          <img
            src={cat.image_url}
            alt={catName}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy/90 to-navy/60 flex items-center justify-center">
            <span className="text-cream/20 text-6xl font-bold select-none">{catName.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/30 to-black/50" />
        <div className="absolute top-0 left-0 right-0 p-4 md:p-5">
          <p className="text-white font-bold text-2xl leading-snug drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">{catName}</p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-copper hover:bg-copper/90 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {lang === "bs" ? "Pogledaj sve" : "View all"}
            <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Product grid — 2 cols on mobile, 3 cols on desktop */}
      <div className="flex-1 bg-gray-50 p-4 md:p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          {products.map((product) => {
            const name = lang === "bs"
              ? (product.name_bs || product.name_en || product.name)
              : (product.name_en || product.name);
            const isNew = (now - new Date(product.created_at).getTime()) < NEW_THRESHOLD_MS;
            const hasDiscount = product.compare_price && product.compare_price > product.price;

            return (
              <div
                key={product.id}
                onClick={() => onNavigate(product.id)}
                className="group cursor-pointer flex flex-col bg-white rounded-xl overflow-hidden border border-navy/[0.07] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Image */}
                <div className="relative aspect-square bg-gray-50">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center min-h-[80px]">
                      <span className="text-navy/20 text-[10px] uppercase tracking-widest">No image</span>
                    </div>
                  )}
                  {isNew && (
                    <span className="absolute top-2 right-2 bg-copper text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">
                      {lang === "bs" ? "Novo" : "New"}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-3 flex flex-col flex-1">
                  <p className="text-xs font-medium text-navy line-clamp-2 leading-snug">{name}</p>
                  <div className={`mt-auto pt-2 gap-2 ${product.requires_personalization ? "flex flex-col sm:flex-row sm:items-center sm:justify-between" : "flex items-center justify-between"}`}>
                    <div className="flex flex-col gap-0.5">
                      {hasDiscount && (
                        <p className="text-[10px] text-gray-400 line-through leading-none">
                          {product.compare_price!.toFixed(2).replace('.', ',')} KM
                        </p>
                      )}
                      <p className={`text-sm font-semibold leading-none ${hasDiscount ? "text-red-500" : "text-navy"}`}>
                        {product.price.toFixed(2).replace('.', ',')} KM
                      </p>
                    </div>
                    {product.requires_personalization ? (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPersonalize(product); }}
                        className="w-full sm:w-auto sm:flex-shrink-0 flex items-center justify-center h-9 px-3 rounded-lg border border-copper text-copper text-xs font-semibold hover:bg-copper hover:text-white transition-colors duration-200"
                      >
                        {lang === "bs" ? "Personalizuj →" : "Personalize →"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border border-copper text-copper bg-white hover:bg-copper hover:text-white transition-colors duration-200"
                      >
                        <ShoppingBag className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Replace this with your Behold.so feed ID (see setup instructions below)
const BEHOLD_FEED_ID = "m2KrCKdTX812TiGr1ROw";

export function Testimonials() {
  const { lang } = useLang();

  useEffect(() => {
    if (document.querySelector('script[src="https://w.behold.so/widget.js"]')) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://w.behold.so/widget.js";
    document.head.appendChild(script);
  }, []);

  return (
    <section id="testimonials" className="flex flex-col items-center gap-8">
      <div className="text-center flex flex-col gap-3">
        <h2 className="text-3xl font-semibold tracking-tight">
          {lang === "bs" ? "Pratite nas na Instagramu" : "Follow us on Instagram"}
        </h2>
        <a
          href="https://www.instagram.com/dekokutaksarajevo"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 text-sm text-navy/50 hover:text-navy transition-colors"
        >
          <Instagram className="w-4 h-4" />
          @dekokutaksarajevo
        </a>
      </div>

      <div className="w-full">
        <behold-widget feed-id={BEHOLD_FEED_ID} />
      </div>

      <a
        href="https://www.instagram.com/dekokutaksarajevo"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-6 py-2.5 border border-navy/20 rounded-full text-sm font-semibold text-navy hover:border-navy/50 hover:bg-navy/5 transition-colors"
      >
        <Instagram className="w-4 h-4" />
        {lang === "bs" ? "Pogledaj sve objave" : "View all posts"}
      </a>
    </section>
  );
}
