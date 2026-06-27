import { useEffect, useState } from "react";
import { ArrowRight, Star } from "lucide-react";
import { testimonials } from "../data";
import { useLang } from "../context/LanguageContext";
import { supabase, type Category, localName } from "../lib/supabase";

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
