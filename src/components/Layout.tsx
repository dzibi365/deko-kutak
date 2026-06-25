import { Search, User, ShoppingBag, Menu, Instagram, Facebook, Mail } from "lucide-react";
import { useLang } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";

export function Navbar() {
  const { lang, toggleLang, tr } = useLang();
  const { count, openCart } = useCart();

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b-[0.5px] border-navy/10">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex-shrink-0">
          <a href="#" className="text-xl font-semibold tracking-tight text-navy">
            Deko Kutak.
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-semibold text-navy">{tr("nav_shop")}</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">{tr("nav_story")}</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">{tr("nav_journal")}</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">{tr("nav_contact")}</a>
        </nav>

        <div className="flex items-center gap-5 text-navy">
          <button
            onClick={toggleLang}
            className="text-xs font-semibold tracking-wider text-navy/60 hover:text-copper transition-colors border-[0.5px] border-navy/20 rounded px-2 py-1 hover:border-copper"
            aria-label="Toggle language"
          >
            {lang === "en" ? "BS" : "EN"}
          </button>
          <button className="hover:text-copper transition-colors" aria-label="Search">
            <Search className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <button className="hidden sm:block hover:text-copper transition-colors" aria-label="Account">
            <User className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <button onClick={openCart} className="relative hover:text-copper transition-colors" aria-label="Cart">
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-copper text-white text-[10px] font-semibold w-4 h-4 flex items-center justify-center rounded-full">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
          <button className="md:hidden ml-2" aria-label="Menu">
            <Menu className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { tr } = useLang();

  return (
    <footer className="bg-navy text-cream pt-16 pb-8 border-t-[0.5px] border-navy/80">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2 flex flex-col gap-6">
            <span className="text-2xl font-semibold tracking-tight text-white">Deko Kutak.</span>
            <p className="text-cream/70 max-w-sm leading-relaxed">{tr("footer_desc")}</p>
            <div className="flex items-center gap-4 text-cream/70">
              <a href="#" className="hover:text-copper transition-colors" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-copper transition-colors" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="hover:text-copper transition-colors" aria-label="Email">
                <Mail className="w-5 h-5" />
              </a>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-white tracking-wide">{tr("footer_shop")}</h4>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">{tr("footer_all")}</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">{tr("footer_arrivals")}</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">{tr("footer_custom")}</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">{tr("footer_gift")}</a>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-white tracking-wide">{tr("footer_support")}</h4>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">{tr("footer_faq")}</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">{tr("footer_shipping")}</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">{tr("footer_care")}</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">{tr("footer_contact_us")}</a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t-[0.5px] border-cream/10 text-sm text-cream/50 gap-4">
          <p>&copy; {new Date().getFullYear()} Deko Kutak. {tr("footer_rights")}</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-cream transition-colors">{tr("footer_privacy")}</a>
            <a href="#" className="hover:text-cream transition-colors">{tr("footer_terms")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
