import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ImageIcon } from "lucide-react";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { SiteMeta } from "../components/SiteMeta";
import { supabase } from "../lib/supabase";
import type { GalleryItem } from "../lib/supabase";
import { useLang } from "../context/LanguageContext";
import { t } from "../i18n/translations";

type GalleryItemWithCat = GalleryItem & {
  gallery_categories: { name_en: string; name_bs: string } | null;
};

function localTitle(item: GalleryItem, lang: string) {
  return lang === "bs" ? (item.title_bs || item.title_en) : (item.title_en || item.title_bs);
}

function localCatName(cat: { name_en: string; name_bs: string } | null, lang: string) {
  if (!cat) return null;
  return lang === "bs" ? (cat.name_bs || cat.name_en) : (cat.name_en || cat.name_bs);
}

export default function GalleryList() {
  const { lang } = useLang();
  const tx = t[lang];

  const [items, setItems] = useState<GalleryItemWithCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  useEffect(() => {
    supabase
      .from("gallery_items")
      .select("*, gallery_categories(name_en, name_bs)")
      .eq("is_published", true)
      .order("display_order")
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setItems((data as GalleryItemWithCat[]) ?? []);
        setLoading(false);
      });
  }, []);

  const categories = Array.from(
    new Map(
      items
        .filter((i) => i.category_id !== null && i.gallery_categories !== null)
        .map((i) => [i.category_id!, i.gallery_categories!])
    ).entries()
  );

  const filtered =
    activeCategory === null
      ? items
      : items.filter((i) => i.category_id === activeCategory);

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <SiteMeta
        title={lang === "bs" ? "Galerija radova — Deko Kutak" : "Gallery — Deko Kutak"}
        description={
          lang === "bs"
            ? "Pregledajte galeriju naših ručno rađenih predmeta iz radionice Deko Kutak."
            : "Browse the gallery of our handmade creations from Deko Kutak workshop."
        }
      />
      <Navbar />
      <CartDrawer />
      <AuthModal />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative bg-navy overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-copper/5 rounded-full -translate-y-1/3 translate-x-1/3 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-copper/5 rounded-full translate-y-1/2 -translate-x-1/4 blur-3xl pointer-events-none" />
          <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-20 lg:py-28">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-[0.5px] border-copper/40 bg-copper/10 text-copper text-xs font-semibold tracking-widest uppercase mb-6">
                {tx.gallery_hero_badge}
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight text-white mb-6">
                {tx.gallery_hero_heading}
              </h1>
              <p className="text-lg text-cream/80 leading-relaxed max-w-xl">
                {tx.gallery_hero_sub}
              </p>
            </div>
          </div>
        </section>

        {/* Grid section */}
        <section className="bg-cream py-16 lg:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Category filter chips */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-10">
                <button
                  onClick={() => setActiveCategory(null)}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                    activeCategory === null
                      ? "bg-navy text-white"
                      : "bg-white border border-gray-200 text-navy/60 hover:text-navy hover:border-navy/30"
                  }`}
                >
                  {tx.gallery_filter_all}
                </button>
                {categories.map(([id, cat]) => (
                  <button
                    key={id}
                    onClick={() => setActiveCategory(id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${
                      activeCategory === id
                        ? "bg-navy text-white"
                        : "bg-white border border-gray-200 text-navy/60 hover:text-navy hover:border-navy/30"
                    }`}
                  >
                    {localCatName(cat, lang)}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-32 text-sm text-red-500">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-32">
                <p className="text-xl font-semibold text-navy mb-2">{tx.gallery_empty_title}</p>
                <p className="text-navy/50">{tx.gallery_empty_sub}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filtered.map((item) => (
                  <Link
                    key={item.id}
                    to={`/gallery/${item.id}`}
                    className="group relative flex flex-col bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-gray-100">
                      {item.cover_image_url ? (
                        <img
                          src={item.cover_image_url}
                          alt={localTitle(item, lang)}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-10 h-10 text-gray-300" strokeWidth={1} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <div className="p-5">
                      <p className="font-semibold text-navy leading-snug">
                        {localTitle(item, lang)}
                      </p>
                      {item.gallery_categories && (
                        <p className="text-sm text-navy/50 mt-1">
                          {localCatName(item.gallery_categories, lang)}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
