import { useEffect, useState } from "react";
import { ArrowRight, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { testimonials } from "../data";
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
    <section className="bg-navy text-cream py-20 lg:py-32 relative overflow-hidden">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className="flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-[0.5px] border-copper/40 bg-copper/10 text-copper text-xs font-semibold tracking-wide uppercase">
              {badge}
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight text-white">
              {heading}
            </h1>
            <p className="text-lg text-cream/80 max-w-md leading-relaxed">
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
            <div className="absolute inset-0 rounded-2xl overflow-hidden border-[0.5px] border-cream/10">
              {cfg?.image_url ? (
                <img src={cfg.image_url} alt="hero" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-cream/5 flex items-center justify-center">
                  <span className="text-cream/20 font-semibold text-lg tracking-widest uppercase">Hero Imagery</span>
                </div>
              )}
            </div>

            <div className="absolute -left-8 top-16 bg-white text-navy p-4 rounded-xl border-[0.5px] border-navy/10 flex flex-col gap-1 shadow-sm">
              <span className="text-2xl font-semibold text-copper">{stat1Val}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-navy/60">{stat1Lbl}</span>
            </div>

            <div className="absolute -right-6 bottom-24 bg-white text-navy p-4 rounded-xl border-[0.5px] border-navy/10 flex flex-col gap-1 shadow-sm">
              <span className="text-2xl font-semibold text-copper">{stat2Val}</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-navy/60">{stat2Lbl}</span>
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
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2">
        {/* All button */}
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
    <section className="bg-navy text-cream py-16 border-y-[0.5px] border-copper/20">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
            {tr("promo_heading")}
          </h2>
          <p className="text-cream/70 text-lg">{tr("promo_sub")}</p>
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

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
    <section className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight text-navy">
        {lang === "bs" ? "Kupuj po kategorijama" : "Shop by Category"}
      </h2>
      <div className="flex flex-col gap-4">
        {rows.map(({ cat, products: catProducts }) => (
          <CategoryRow
            key={cat.id}
            cat={cat}
            products={catProducts.slice(0, 6)}
            lang={lang}
            onNavigate={(id) => navigate(`/products/${id}`)}
          />
        ))}
      </div>
    </section>
  );
}

type RowProps = {
  cat: Category;
  products: Product[];
  lang: string;
  onNavigate: (id: number) => void;
};

function CategoryRow({ cat, products, lang, onNavigate }: RowProps) {
  const catName = lang === "bs" ? (cat.name_bs || cat.name_en || cat.name) : (cat.name_en || cat.name);
  const now = Date.now();

  return (
    <div className="flex rounded-2xl overflow-hidden border border-gray-100 shadow-sm min-h-[460px]">

      {/* Left: fixed 220px category image panel */}
      <div className="w-[220px] flex-shrink-0 relative bg-navy">
        {cat.image_url ? (
          <img
            src={cat.image_url}
            alt={catName}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-navy/90 to-navy/60 flex items-center justify-center">
            <span className="text-cream/20 text-6xl font-bold select-none">{catName.charAt(0)}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <p className="text-white font-semibold text-lg leading-snug">{catName}</p>
          <p className="text-white/50 text-xs mt-1">
            {products.length} {products.length === 1
              ? (lang === "bs" ? "proizvod" : "product")
              : (lang === "bs" ? "proizvoda" : "products")}
          </p>
        </div>
      </div>

      {/* Right: 3×2 product grid */}
      <div className="flex-1 bg-white p-5">
        <div className="grid grid-cols-3 grid-rows-2 gap-4 h-full">
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
                className="group cursor-pointer flex flex-col"
              >
                {/* Image */}
                <div className="relative flex-1 rounded-xl overflow-hidden bg-cream/60 border-[0.5px] border-navy/8">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center min-h-[100px]">
                      <span className="text-navy/20 text-[10px] uppercase tracking-widest">No image</span>
                    </div>
                  )}
                  {isNew && (
                    <span className="absolute top-2 right-2 bg-copper text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-widest uppercase">
                      New
                    </span>
                  )}
                </div>

                {/* Name + price */}
                <div className="mt-2 px-0.5 flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-navy line-clamp-2 leading-snug">{name}</p>
                  {hasDiscount && (
                    <p className="text-[11px] text-gray-400 line-through leading-none">
                      {product.compare_price!.toFixed(2)} KM
                    </p>
                  )}
                  <p className={`text-xs font-semibold leading-none ${hasDiscount ? "text-red-500" : "text-navy"}`}>
                    {product.price.toFixed(2)} KM
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function Testimonials() {
  const { tr } = useLang();

  return (
    <section>
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">{tr("test_heading")}</h2>
        <p className="text-navy/70 max-w-xl mx-auto">{tr("test_sub")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testimonials.map((t) => (
          <div key={t.id} className="bg-white p-8 rounded-xl border-[0.5px] border-navy/20 flex flex-col gap-6">
            <div className="flex items-center gap-1 text-copper">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" strokeWidth={1} />
              ))}
            </div>
            <p className="text-lg text-navy leading-relaxed flex-1">"{t.text}"</p>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-cream border-[0.5px] border-navy/20 flex items-center justify-center font-semibold text-navy/50">
                {t.name.charAt(0)}
              </div>
              <span className="font-semibold">{t.name}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
