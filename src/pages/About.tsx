import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { SiteMeta } from "../components/SiteMeta";
import { RichDescription } from "../components/RichDescription";
import { supabase, localName } from "../lib/supabase";
import { useLang } from "../context/LanguageContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { Zap, Cpu, Paintbrush, Layers, ArrowRight } from "lucide-react";
import { t } from "../i18n/translations";

type PageRow = {
  content_en: string | null;
  content_bs: string | null;
  is_published: boolean;
  hero_image_url: string | null;
};

type ShowcaseItem = {
  id: number;
  name: string;
  name_en: string | null;
  name_bs: string | null;
  image_url: string | null;
};

function PageSpinner() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
    </div>
  );
}

export default function About() {
  const { lang } = useLang();
  const { user } = useCustomerAuth();
  const tx = t[lang];

  // undefined = loading, null = not found / unpublished for anon, PageRow = render
  const [pageData, setPageData] = useState<PageRow | null | undefined>(undefined);
  const [showcase, setShowcase] = useState<ShowcaseItem[]>([]);

  const isCustomer = user?.user_metadata?.role === "customer";
  const isAdmin = user && !isCustomer;

  useEffect(() => {
    supabase
      .from("pages")
      .select("content_en, content_bs, is_published, hero_image_url")
      .eq("slug", "about")
      .maybeSingle()
      .then(({ data }) => setPageData(data ?? null));

    supabase
      .from("products")
      .select("id, name, name_en, name_bs, image_url")
      .eq("in_stock", true)
      .not("image_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(4)
      .then(({ data }) => setShowcase((data as ShowcaseItem[]) ?? []));
  }, []);

  if (pageData === undefined) return <PageSpinner />;
  if (pageData === null) return <Navigate to="/" replace />;

  const isDraft = !pageData.is_published;
  const content =
    lang === "bs"
      ? pageData.content_bs || pageData.content_en || ""
      : pageData.content_en || pageData.content_bs || "";

  const techniques = [
    { key: "laser",     title: tx.about_tech_laser,      desc: tx.about_tech_laser_desc,      Icon: Zap      },
    { key: "cnc",       title: tx.about_tech_cnc,        desc: tx.about_tech_cnc_desc,        Icon: Cpu      },
    { key: "paint",     title: tx.about_tech_paint,      desc: tx.about_tech_paint_desc,      Icon: Paintbrush },
    { key: "decoupage", title: tx.about_tech_decoupage,  desc: tx.about_tech_decoupage_desc,  Icon: Layers   },
  ];

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <SiteMeta
        title={lang === "bs" ? "Naša priča — Deko Kutak" : "Our Story — Deko Kutak"}
        description={
          lang === "bs"
            ? "Upoznajte Deko Kutak — ručno rađeni pokloni, dekoracije i personalizirani predmeti iz naše radionice u Sarajevu."
            : "Meet Deko Kutak — handmade gifts, decorations and personalised items from our workshop in Sarajevo."
        }
      />
      <Navbar />
      <CartDrawer />
      <AuthModal />

      {isAdmin && isDraft && (
        <div className="bg-amber-50 border-b border-amber-200 py-2.5 px-4 text-center text-sm text-amber-800 font-medium">
          {tx.about_draft_banner}
        </div>
      )}

      <main className="flex-1">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section className="relative bg-navy overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-copper/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-copper/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className={pageData.hero_image_url
              ? "grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center"
              : ""
            }>
              {/* Text */}
              <div className={pageData.hero_image_url ? "" : "max-w-2xl"}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-[0.5px] border-copper/40 bg-copper/10 text-copper text-xs font-semibold tracking-widest uppercase mb-6">
                  {tx.about_hero_badge}
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight text-white mb-6">
                  {tx.about_hero_heading}
                </h1>
                <p className="text-lg text-cream/80 leading-relaxed mb-10 max-w-xl">
                  {tx.about_hero_sub}
                </p>
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-copper text-white font-semibold rounded-lg hover:bg-copper/90 transition-colors"
                >
                  {tx.about_hero_cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Hero image — only rendered when configured via CMS */}
              {pageData.hero_image_url && (
                <div className="w-full aspect-[4/5] max-h-[520px] rounded-2xl overflow-hidden shadow-2xl">
                  <img
                    src={pageData.hero_image_url}
                    alt={lang === "bs" ? "Deko Kutak radionica" : "Deko Kutak workshop"}
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── STORY ────────────────────────────────────────────────────── */}
        <section className="bg-white py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-copper text-xs font-semibold uppercase tracking-widest mb-3">
                {tx.about_story_label}
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-navy">
                {tx.about_story_heading}
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24 items-start">
              {/* Timeline */}
              <div className="relative">
                <div className="absolute left-[15px] top-4 bottom-4 w-px bg-copper/20" />

                <div className="relative flex gap-8 mb-14">
                  <div className="flex-shrink-0 w-[31px] h-[31px] rounded-full bg-white border-2 border-copper/40 flex items-center justify-center z-10">
                    <div className="w-2.5 h-2.5 rounded-full bg-copper/40" />
                  </div>
                  <div className="pt-1">
                    <span className="text-5xl font-bold text-copper/20 leading-none block mb-2">
                      {tx.about_story_2017_year}
                    </span>
                    <h3 className="text-xl font-semibold text-navy mb-3">
                      {tx.about_story_2017_title}
                    </h3>
                    <p className="text-navy/60 leading-relaxed">{tx.about_story_2017_text}</p>
                  </div>
                </div>

                <div className="relative flex gap-8">
                  <div className="flex-shrink-0 w-[31px] h-[31px] rounded-full bg-copper border-2 border-copper flex items-center justify-center z-10 shadow-sm">
                    <div className="w-2.5 h-2.5 rounded-full bg-white" />
                  </div>
                  <div className="pt-1">
                    <span className="text-5xl font-bold text-copper/50 leading-none block mb-2">
                      {tx.about_story_2020_year}
                    </span>
                    <h3 className="text-xl font-semibold text-navy mb-3">
                      {tx.about_story_2020_title}
                    </h3>
                    <p className="text-navy/60 leading-relaxed">{tx.about_story_2020_text}</p>
                  </div>
                </div>
              </div>

              {/* CMS narrative */}
              <div>
                {content ? (
                  <RichDescription html={content} className="text-navy/70 leading-relaxed" />
                ) : (
                  <p className="text-navy/30 text-sm italic">{tx.about_no_content}</p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ── WORKSHOP ─────────────────────────────────────────────────── */}
        <section className="bg-[#f7f5f2] py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <p className="text-copper text-xs font-semibold uppercase tracking-widest mb-3">
                {tx.about_workshop_label}
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-navy mb-3">
                {tx.about_workshop_heading}
              </h2>
              <p className="text-navy/50 text-sm">
                {tx.about_workshop_materials_label}:{" "}
                <span className="text-navy/70">{tx.about_workshop_materials_list}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {techniques.map(({ key, title, desc, Icon }) => (
                <div
                  key={key}
                  className="flex gap-4 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm"
                >
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-copper/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-copper" strokeWidth={1.75} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-navy mb-1.5">{title}</h3>
                    <p className="text-sm text-navy/60 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── WHAT WE CREATE ───────────────────────────────────────────── */}
        {showcase.length > 0 && (
          <section className="bg-white py-20 lg:py-28">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-12 gap-4 flex-wrap">
                <div>
                  <p className="text-copper text-xs font-semibold uppercase tracking-widest mb-3">
                    {tx.about_create_label}
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-semibold text-navy">
                    {tx.about_create_heading}
                  </h2>
                </div>
                <Link
                  to="/shop"
                  className="flex items-center gap-1.5 text-copper font-semibold text-sm hover:gap-2.5 transition-all"
                >
                  {tx.about_create_shop_link}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {showcase.map((item) => (
                  <Link
                    key={item.id}
                    to={`/products/${item.id}`}
                    className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100"
                  >
                    <img
                      src={item.image_url!}
                      alt={localName(item, lang)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <p className="text-white font-semibold text-sm leading-snug">
                        {localName(item, lang)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── PERSONALIZATION ──────────────────────────────────────────── */}
        <section className="bg-[#f7f5f2] py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto text-center">
              <p className="text-copper text-xs font-semibold uppercase tracking-widest mb-3">
                {tx.about_personal_label}
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold text-navy mb-6">
                {tx.about_personal_heading}
              </h2>
              <p className="text-navy/60 leading-relaxed mb-10">{tx.about_personal_text}</p>
              <a
                href="mailto:info@dekokutak.ba"
                className="inline-flex items-center gap-2 px-6 py-3 bg-navy text-white font-semibold rounded-lg hover:bg-navy/90 transition-colors"
              >
                {tx.about_personal_cta}
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────────────────────────── */}
        <section className="bg-navy py-20 lg:py-28">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-4">
              {tx.about_cta_heading}
            </h2>
            <p className="text-cream/70 max-w-xl mx-auto mb-10 leading-relaxed">
              {tx.about_cta_sub}
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link
                to="/shop"
                className="px-7 py-3.5 bg-copper text-white font-semibold rounded-lg hover:bg-copper/90 transition-colors"
              >
                {tx.about_cta_shop}
              </Link>
              <a
                href="mailto:info@dekokutak.ba"
                className="px-7 py-3.5 bg-transparent border-[0.5px] border-cream/30 text-cream font-semibold rounded-lg hover:bg-cream/5 transition-colors"
              >
                {tx.about_cta_idea}
              </a>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
