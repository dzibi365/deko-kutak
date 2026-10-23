import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { CategoryStrip } from "../components/HomeSections";
import { ProductGrid } from "../components/ProductGrid";
import { SiteMeta } from "../components/SiteMeta";
import { useLang } from "../context/LanguageContext";
import { supabase, type ProductTag } from "../lib/supabase";
import { trackSearchResults } from "../lib/analytics";

function ShopContent() {
  const { lang, tr } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get("category")
  );
  const [selectedTagId, setSelectedTagId] = useState<number | null>(
    searchParams.get("tag") ? Number(searchParams.get("tag")) : null
  );
  const [allTags, setAllTags] = useState<ProductTag[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastSearchRef = useRef("");

  useEffect(() => {
    supabase.from("product_tags").select("*").order("name_en").then(({ data }) => {
      setAllTags(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (searchParams.get("focus") === "search") {
      searchInputRef.current?.focus();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("focus");
        return next;
      });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const cat = searchParams.get("category");
    const tag = searchParams.get("tag");
    setSelectedCategory(cat);
    setSelectedTagId(tag ? Number(tag) : null);
  }, [searchParams]);

  // Fire view_search_results 500 ms after the user stops typing.
  // lastSearchRef prevents duplicate events when the same term is typed again
  // without clearing first; it resets to "" when the input is cleared so a
  // repeated search after clearing does fire.
  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) { lastSearchRef.current = ""; return; }
    if (trimmed.length < 2) return; // too short — no timer, no reset
    if (trimmed === lastSearchRef.current) return;
    const timer = setTimeout(() => {
      lastSearchRef.current = trimmed;
      trackSearchResults(trimmed);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function handleSelectCategory(cat: string | null) {
    setSelectedCategory(cat);
    setSelectedTagId(null);
    if (cat) {
      setSearchParams({ category: cat });
    } else {
      setSearchParams({});
    }
  }

  function handleSelectTag(id: number | null) {
    setSelectedTagId(id);
    setSelectedCategory(null);
    if (id) {
      setSearchParams({ tag: String(id) });
    } else {
      setSearchParams({});
    }
  }

  const selectedTag = allTags.find((t) => t.id === selectedTagId) ?? null;
  const tagLabel = selectedTag
    ? (lang === "bs" ? selectedTag.name_bs : selectedTag.name_en)
    : null;

  return (
    <>
      <SiteMeta title={lang === "bs" ? "Prodavnica" : "Shop"} />
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
        <div className="flex flex-col gap-5">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-navy mb-1">
              {lang === "bs" ? "Prodavnica" : "Shop"}
            </h1>
            {(selectedCategory || tagLabel) && (
              <p className="text-navy/50 text-sm">{tagLabel ?? selectedCategory}</p>
            )}
          </div>

          {/* Search */}
          <div className="relative w-full max-w-[450px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy/30 pointer-events-none"
              strokeWidth={1.75}
            />
            <input
              id="shop-search"
              ref={searchInputRef}
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

          <CategoryStrip selected={selectedCategory} onSelect={handleSelectCategory} />

          {/* Tag filter chips — only rendered when tags exist in the DB */}
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => {
                const label = lang === "bs" ? tag.name_bs : tag.name_en;
                const active = selectedTagId === tag.id;
                return (
                  <button
                    key={tag.id}
                    onClick={() => handleSelectTag(active ? null : tag.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                      active
                        ? "bg-copper text-white border-copper"
                        : "bg-transparent text-navy/60 border-navy/20 hover:border-navy/40 hover:text-navy"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <ProductGrid
          category={selectedCategory}
          tagId={selectedTagId}
          tagLabel={tagLabel}
          searchQuery={searchQuery}
          onClearSearch={() => setSearchQuery("")}
        />
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
