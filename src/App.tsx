import { Navbar, Footer } from "./components/Layout";
import { Hero, CategoryStrip, PromoBanner, Testimonials } from "./components/HomeSections";
import { ProductGrid } from "./components/ProductGrid";

export default function App() {
  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col">
        <Hero />
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex flex-col gap-10">
          <CategoryStrip />
          <ProductGrid />
        </div>
        <PromoBanner />
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16">
          <Testimonials />
        </div>
      </main>
      <Footer />
    </div>
  );
}
