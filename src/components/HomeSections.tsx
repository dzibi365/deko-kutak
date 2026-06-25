import { ArrowRight, Star } from "lucide-react";
import { categories, testimonials } from "../data";

export function Hero() {
  return (
    <section className="bg-navy text-cream py-20 lg:py-32 relative overflow-hidden">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className="flex flex-col items-start gap-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border-[0.5px] border-copper/40 bg-copper/10 text-copper text-xs font-semibold tracking-wide uppercase">
              Handcrafted in Bosnia
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold leading-tight tracking-tight text-white">
              Artisan gifts for <br className="hidden sm:block"/> meaningful moments.
            </h1>
            <p className="text-lg text-cream/80 max-w-md leading-relaxed">
              Discover unique, handmade home decor and personalized gifts crafted with love and natural materials.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button className="px-6 py-3 bg-copper text-white font-semibold rounded-lg hover:bg-copper/90 transition-colors">
                Shop Collection
              </button>
              <button className="px-6 py-3 bg-transparent border-[0.5px] border-cream/30 text-cream font-semibold rounded-lg hover:bg-cream/5 transition-colors">
                Our Story
              </button>
            </div>
          </div>

          <div className="relative h-[400px] w-full hidden lg:block">
            <div className="absolute inset-0 bg-cream/5 border-[0.5px] border-cream/10 rounded-2xl flex items-center justify-center overflow-hidden">
                <span className="text-cream/20 font-semibold text-lg tracking-widest uppercase">Hero Imagery</span>
            </div>
            
            <div className="absolute -left-8 top-16 bg-white text-navy p-4 rounded-xl border-[0.5px] border-navy/10 flex flex-col gap-1 shadow-sm">
              <span className="text-2xl font-semibold text-copper">500+</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-navy/60">Happy Customers</span>
            </div>

            <div className="absolute -right-6 bottom-24 bg-white text-navy p-4 rounded-xl border-[0.5px] border-navy/10 flex flex-col gap-1 shadow-sm">
              <span className="text-2xl font-semibold text-copper">100%</span>
              <span className="text-xs font-semibold uppercase tracking-wider text-navy/60">Handmade Quality</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CategoryStrip() {
  return (
    <div className="w-full">
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide pb-2">
        {categories.map((cat, idx) => {
          const isActive = idx === 0;
          return (
            <button
              key={cat}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-semibold transition-colors border-[0.5px] ${
                isActive 
                  ? "bg-navy text-white border-navy" 
                  : "bg-transparent text-navy hover:border-navy/40 border-navy/20"
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PromoBanner() {
  return (
    <section className="bg-navy text-cream py-16 border-y-[0.5px] border-copper/20">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-white">
            Free Delivery on orders over 100 KM
          </h2>
          <p className="text-cream/70 text-lg">
            Delivered safely to your doorstep anywhere in Bosnia and Herzegovina.
          </p>
        </div>
        <button className="shrink-0 flex items-center gap-2 px-6 py-3 bg-copper text-white font-semibold rounded-lg hover:bg-copper/90 transition-colors">
          Shop Now
          <ArrowRight className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section>
      <div className="mb-10 text-center">
        <h2 className="text-3xl font-semibold tracking-tight mb-4">Loved by our customers</h2>
        <p className="text-navy/70 max-w-xl mx-auto">
          Don't just take our word for it. Here is what people are saying about our handmade pieces.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {testimonials.map((t) => (
          <div key={t.id} className="bg-white p-8 rounded-xl border-[0.5px] border-navy/20 flex flex-col gap-6">
            <div className="flex items-center gap-1 text-copper">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" strokeWidth={1} />
              ))}
            </div>
            <p className="text-lg text-navy leading-relaxed flex-1">
              "{t.text}"
            </p>
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
