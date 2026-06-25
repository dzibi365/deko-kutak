import { useEffect, useState } from "react";
import { Heart, ShoppingCart } from "lucide-react";
import { supabase, type Product } from "../lib/supabase";

export function ProductGrid() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("in_stock", true)
        .order("created_at", { ascending: false });

      if (error) {
        setError(error.message);
      } else {
        setProducts(data ?? []);
      }
      setLoading(false);
    }

    fetchProducts();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-semibold tracking-tight">New Arrivals</h2>
        <a href="#" className="text-copper text-sm font-semibold hover:underline">View All</a>
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border-[0.5px] border-navy/20 overflow-hidden animate-pulse">
              <div className="aspect-[4/3] bg-cream/80" />
              <div className="p-5 flex flex-col gap-3">
                <div className="h-3 w-20 bg-cream/80 rounded" />
                <div className="h-5 w-40 bg-cream/80 rounded" />
                <div className="h-8 w-full bg-cream/80 rounded mt-2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm">Failed to load products: {error}</p>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {products.map((product) => (
            <div key={product.id} className="group flex flex-col bg-white rounded-xl border-[0.5px] border-navy/20 overflow-hidden">
              <div className="relative aspect-[4/3] bg-cream/60 flex items-center justify-center border-b-[0.5px] border-navy/10 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                ) : (
                  <span className="text-navy/20 font-semibold tracking-widest uppercase text-sm">Product Image</span>
                )}
                <button className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur border-[0.5px] border-navy/10 rounded-full text-navy/40 hover:text-copper hover:bg-white transition-all z-10">
                  <Heart className="w-5 h-5" strokeWidth={1.5} />
                </button>
              </div>

              <div className="p-5 flex flex-col flex-1">
                <span className="text-xs font-semibold text-copper uppercase tracking-wider mb-2">
                  {product.category}
                </span>
                <h3 className="text-lg font-semibold text-navy leading-tight mb-4 flex-1">
                  {product.name}
                </h3>
                {product.description && (
                  <p className="text-sm text-navy/60 mb-4 leading-relaxed">{product.description}</p>
                )}
                <div className="flex items-center justify-between mt-auto pt-4 border-t-[0.5px] border-navy/10">
                  <span className="text-lg font-semibold text-navy">{product.price.toFixed(2)} KM</span>
                  <button className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors">
                    <ShoppingCart className="w-4 h-4" strokeWidth={2} />
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
