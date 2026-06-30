import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";
import { CategoryStrip } from "../components/HomeSections";
import { ProductGrid } from "../components/ProductGrid";
import { SiteMeta } from "../components/SiteMeta";
import { useLang } from "../context/LanguageContext";

function ShopContent() {
  const { lang } = useLang();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    searchParams.get("category")
  );

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
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-navy mb-1">
            {lang === "bs" ? "Prodavnica" : "Shop"}
          </h1>
          {selectedCategory && (
            <p className="text-navy/50 text-sm">{selectedCategory}</p>
          )}
        </div>
        <CategoryStrip selected={selectedCategory} onSelect={handleSelect} />
        <ProductGrid category={selectedCategory} />
      </div>
    </>
  );
}

export default function Shop() {
  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col">
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
