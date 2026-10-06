import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { CategoryStrip } from "../components/HomeSections";
import { ProductGrid } from "../components/ProductGrid";
import { SiteMeta } from "../components/SiteMeta";
import { useLang } from "../context/LanguageContext";

function ShopContent() {
  const { lang, tr } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get("category")
  );
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const cat = searchParams.get("category");
    setSelectedCategory(cat);
  }, [searchParams]);

  function handleSelect(cat: string | null) {
    setSelectedCategory(cat);
    if (cat) {
      setSearchParams({ category: cat });
    } else {
      setSearchParams({});
    }
  }

  return (
    <>
      <SiteMeta title={lang === "bs" ? "Prodavnica" : "Shop"} />
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-navy mb-1">
              {lang === "bs" ? "Prodavnica" : "Shop"}
            </h1>
            {selectedCategory && (
              <p className="text-navy/50 text-sm">{selectedCategory}</p>
            )}
          </div>

          {/* Search field */}
          <div className="relative w-full max-w-[450px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/30 pointer-events-none"
              strokeWidth={1.75}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={tr("search_placeholder")}
              aria-label={tr("search_label")}
              className="w-full pl-9 pr-9 py-2.5 text-sm text-navy placeholder-navy/30 bg-white border border-navy/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label={tr("search_clear")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-navy/30 hover:text-navy transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          <CategoryStrip selected={selectedCategory} onSelect={handleSelect} />
        </div>

        <ProductGrid category={selectedCategory} searchQuery={searchQuery} onClearSearch={() => setSearchQuery("")} />
      </div>
    </>
  );
}

export default function Shop() {
  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <Navbar />
      <CartDrawer />
      <AuthModal />
      <main className="flex-1">
        <ShopContent />
      </main>
      <Footer />
    </div>
  );
}
