import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ShoppingBag } from "lucide-react";
import { supabase, type Product, type Category, localName, localDesc } from "../lib/supabase";
import { useLang } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { PersonalizationModal } from "./PersonalizationModal";

const PAGE_SIZE = 12;

type SortKey = "newest" | "price_asc" | "price_desc" | "name_az";

type ProductGridProps = {
  category?: string | null;
  searchQuery?: string;
  onClearSearch?: () => void;
};

export function ProductGrid({ category, searchQuery = "", onClearSearch }: ProductGridProps) {
  const { tr, lang } = useLang();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset visible count when category or search changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, searchQuery]);

  useEffect(() => {
    supabase.from("categories").select("*").then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    async function fetchProducts() {
      try {
        let query = supabase
          .from("products")
          .select("*")
          .eq("in_stock", true)
          .order("created_at", { ascending: false });

        if (category) query = query.eq("category", category);

        const { data, error } = await query;

        if (error) {
          setError(error.message);
        } else {
          setProducts(data ?? []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not reach the server.");
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [category]);

  // Pipeline: products (category-filtered by server) → search → sort → slice
  const { visibleProducts, filteredCount } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = q
      ? products.filter((p) => {
          const name = localName(p, lang).toLowerCase();
          const desc = (localDesc(p, lang) ?? "").toLowerCase();
          return name.includes(q) || desc.includes(q);
        })
      : products;

    const locale = lang === "bs" ? "bs" : "en";
    const sorted = [...filtered];
    if (sortKey === "price_asc") {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortKey === "price_desc") {
      sorted.sort((a, b) => b.price - a.price);
    } else if (sortKey === "name_az") {
      sorted.sort((a, b) =>
        localName(a, lang).localeCompare(localName(b, lang), locale)
      );
    }

    return {
      visibleProducts: sorted.slice(0, visibleCount),
      filteredCount: filtered.length,
    };
  }, [products, sortKey, lang, searchQuery, visibleCount]);

  const selectedCat = categories.find(c => (c.name_en ?? c.name) === category);
  const headingName = category
    ? (selectedCat ? localName(selectedCat, lang) : category)
    : tr("cat_all");
  const countLabel = !loading
    ? (lang === "bs"
        ? `${filteredCount} ${filteredCount === 1 ? "proizvod" : "proizvoda"}`
        : `${filteredCount} ${filteredCount === 1 ? "product" : "products"}`)
    : null;

  const hasMore = visibleProducts.length < filteredCount;

  const progressText = filteredCount > 0
    ? (lang === "bs"
        ? `Prikazano ${visibleProducts.length} od ${filteredCount} ${filteredCount === 1 ? "proizvoda" : "proizvoda"}`
        : `Showing ${visibleProducts.length} of ${filteredCount} ${filteredCount === 1 ? "product" : "products"}`)
    : null;

  return (
    <div>
      {/* Heading row */}
      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{headingName}</h2>
          {countLabel && (
            <p className="text-sm text-navy/40 mt-0.5">{countLabel}</p>
          )}
        </div>

        {!loading && !error && products.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <label className="text-xs text-navy/50 font-medium whitespace-nowrap">
              {tr("sort_label")}
            </label>
            <select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setVisibleCount(PAGE_SIZE);
              }}
              className="text-sm text-navy border border-navy/15 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy cursor-pointer"
            >
              <option value="newest">{tr("sort_newest")}</option>
              <option value="price_asc">{tr("sort_price_asc")}</option>
              <option value="price_desc">{tr("sort_price_desc")}</option>
              <option value="name_az">{tr("sort_name_az")}</option>
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-navy/[0.07] overflow-hidden animate-pulse">
              <div className="aspect-square bg-gray-100" />
              <div className="p-4 flex flex-col gap-2">
                <div className="h-3 w-16 bg-gray-100 rounded" />
                <div className="h-4 w-3/4 bg-gray-100 rounded" />
                <div className="h-4 w-1/2 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
          <p className="text-lg font-semibold text-navy">Unable to load products</p>
          <p className="text-sm text-navy/50 max-w-xs">Something went wrong connecting to the store. Please try refreshing the page.</p>
        </div>
      )}

      {/* No products in this category (empty from server) */}
      {!loading && !error && products.length === 0 && (
        <p className="text-navy/40 text-sm py-12 text-center">{tr("grid_no_products")}</p>
      )}

      {/* Search returned no matches */}
      {!loading && !error && products.length > 0 && filteredCount === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-base font-semibold text-navy">{tr("search_no_results_title")}</p>
          <p className="text-sm text-navy/50">{tr("search_no_results_sub")}</p>
          {onClearSearch && (
            <button
              type="button"
              onClick={onClearSearch}
              className="mt-1 text-sm text-copper hover:text-copper/80 font-medium transition-colors"
            >
              {tr("search_clear")}
            </button>
          )}
        </div>
      )}

      {!loading && !error && filteredCount > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {visibleProducts.map((product) => {
              const name = localName(product, lang);
              const hasDiscount = product.compare_price && product.compare_price > product.price;

              return (
                <div
                  key={product.id}
                  className="group flex flex-col bg-white rounded-xl overflow-hidden border border-navy/[0.07] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  {/* Image — click navigates */}
                  <div
                    className="relative aspect-square bg-gray-50 cursor-pointer overflow-hidden"
                    onClick={() => navigate(`/products/${product.id}`)}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        alt={name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-navy/20 text-xs uppercase tracking-widest">No image</span>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur border-[0.5px] border-navy/10 rounded-full text-navy/40 hover:text-copper hover:bg-white transition-all z-10"
                    >
                      <Heart className="w-4 h-4" strokeWidth={1.5} />
                    </button>
                  </div>

                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <span className="text-[10px] font-semibold text-copper uppercase tracking-wider mb-1">
                      {product.category}
                    </span>
                    <h3
                      className="text-sm font-semibold text-navy leading-snug line-clamp-2 cursor-pointer hover:text-copper transition-colors mb-auto"
                      onClick={() => navigate(`/products/${product.id}`)}
                    >
                      {name}
                    </h3>
                    <div className="mt-auto pt-3 flex items-center justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        {hasDiscount && (
                          <p className="text-[10px] text-gray-400 line-through leading-none">
                            {product.compare_price!.toFixed(2).replace(".", ",")} KM
                          </p>
                        )}
                        <p className={`text-sm font-semibold leading-none ${hasDiscount ? "text-red-500" : "text-navy"}`}>
                          {product.price.toFixed(2).replace(".", ",")} KM
                        </p>
                      </div>

                      {product.requires_personalization ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setModalProduct(product); }}
                          className="flex-shrink-0 flex items-center h-9 px-3 rounded-lg border border-copper text-copper text-xs font-semibold hover:bg-copper hover:text-white transition-colors duration-200 whitespace-nowrap"
                        >
                          {lang === "bs" ? "Personalizuj →" : "Personalize →"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); addItem(product); }}
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

          {/* Progress + Load More */}
          <div className="mt-10 flex flex-col items-center gap-3">
            {progressText && (
              <p className="text-xs text-navy/40">{progressText}</p>
            )}
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
                className="px-6 py-2.5 bg-copper hover:bg-copper/90 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {tr("load_more")}
              </button>
            )}
          </div>
        </>
      )}

      {modalProduct && (
        <PersonalizationModal
          product={modalProduct}
          onClose={() => setModalProduct(null)}
        />
      )}
    </div>
  );
}
