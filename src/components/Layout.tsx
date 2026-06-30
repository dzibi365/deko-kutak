import { useRef, useEffect, useState } from "react";
import { Search, User, ShoppingBag, Menu, Instagram, Facebook, Mail, LayoutDashboard, LogOut, Phone, ChevronDown, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";

export function TopBar() {
  const { topbar_enabled, topbar_left_text_en, topbar_left_text_bs, topbar_phone, topbar_email, topbar_hours_en, topbar_hours_bs, topbar_right_text_en, topbar_right_text_bs } = useSiteSettings();
  const { lang } = useLang();

  if (!topbar_enabled) return null;

  const leftText   = lang === "bs" ? (topbar_left_text_bs  || topbar_left_text_en)  : (topbar_left_text_en  || topbar_left_text_bs);
  const hours      = lang === "bs" ? (topbar_hours_bs      || topbar_hours_en)      : (topbar_hours_en      || topbar_hours_bs);
  const rightText  = lang === "bs" ? (topbar_right_text_bs || topbar_right_text_en) : (topbar_right_text_en || topbar_right_text_bs);

  const hasLeft  = leftText || topbar_phone || topbar_email;
  const hasRight = hours || rightText;
  if (!hasLeft && !hasRight) return null;

  return (
    <div className="bg-navy text-cream/80 text-xs">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-9 flex items-center justify-between gap-4 overflow-hidden">
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          {leftText && (
            <span className="truncate hidden sm:block">{leftText}</span>
          )}
          {topbar_phone && (
            <a href={`tel:${topbar_phone.replace(/\s/g, "")}`}
              className="flex items-center gap-1.5 hover:text-white transition-colors flex-shrink-0">
              <Phone className="w-3 h-3" strokeWidth={1.75} />
              <span className="hidden sm:inline">{topbar_phone}</span>
            </a>
          )}
          {topbar_email && (
            <a href={`mailto:${topbar_email}`}
              className="hidden sm:flex items-center gap-1.5 hover:text-white transition-colors flex-shrink-0">
              <Mail className="w-3 h-3" strokeWidth={1.75} />
              {topbar_email}
            </a>
          )}
        </div>

        {/* Right */}
        {hasRight && (
          <div className="flex items-center gap-3 flex-shrink-0 text-cream/60">
            {hours && <span className="hidden md:block">{hours}</span>}
            {rightText && <span className="hidden sm:block">{rightText}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

export function Navbar() {
  const { lang, toggleLang, tr } = useLang();
  const { count, openCart } = useCart();
  const { store_name, logo_url } = useSiteSettings();
  const { user, openModal, signOut } = useCustomerAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const isCustomer = user?.user_metadata?.role === "customer";
  const isAdmin = user && !isCustomer;

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  function handleUserClick() {
    if (!user) { openModal(); return; }
    setDropdownOpen((v) => !v);
  }

  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b-[0.5px] border-navy/10">
      <TopBar />
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex-shrink-0">
          <a href="/" className="flex items-center gap-2.5">
            {logo_url ? (
              <img src={logo_url} alt={store_name} className="h-20 w-auto object-contain" />
            ) : (
              <span className="text-xl font-semibold tracking-tight text-navy">{store_name}.</span>
            )}
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-semibold text-navy">{tr("nav_shop")}</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">{tr("nav_story")}</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">{tr("nav_journal")}</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">{tr("nav_contact")}</a>
        </nav>

        <div className="flex items-center gap-5 text-navy">
          {/* Language dropdown */}
          <div className="relative" ref={langRef}>
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
              aria-label="Select language"
            >
              <span className="text-lg leading-none">
                {lang === "en" ? "🇬🇧" : "🇧🇦"}
              </span>
              <ChevronDown className={`w-3 h-3 text-navy/50 transition-transform ${langOpen ? "rotate-180" : ""}`} strokeWidth={2} />
            </button>

            {langOpen && (
              <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg py-1.5 min-w-[140px] z-50">
                {[
                  { code: "en", flag: "🇬🇧", label: "English" },
                  { code: "bs", flag: "🇧🇦", label: "Bosanski" },
                ].map(({ code, flag, label }) => (
                  <button
                    key={code}
                    onClick={() => {
                      if (lang !== code) toggleLang();
                      setLangOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
                  >
                    <span className="text-base leading-none">{flag}</span>
                    <span className="flex-1 text-left">{label}</span>
                    {lang === code && <Check className="w-3.5 h-3.5 text-navy/40" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="hover:text-copper transition-colors" aria-label="Search">
            <Search className="w-5 h-5" strokeWidth={1.5} />
          </button>

          {/* User icon + dropdown */}
          <div className="relative hidden sm:block" ref={dropdownRef}>
            <button
              onClick={handleUserClick}
              className={`hover:text-copper transition-colors ${user ? "text-navy" : ""}`}
              aria-label="Account"
            >
              <User className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {dropdownOpen && user && (
              <div className="absolute right-0 top-8 bg-white border border-gray-100 rounded-xl shadow-lg py-2 min-w-[180px] z-50">
                <div className="px-4 py-2.5 border-b border-gray-50">
                  <p className="text-xs font-semibold text-navy truncate">
                    {user.user_metadata?.full_name || user.email?.split("@")[0]}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>

                {isCustomer && (
                  <button
                    onClick={() => { setDropdownOpen(false); navigate("/account"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-navy hover:bg-gray-50 transition-colors flex items-center gap-2.5"
                  >
                    <User className="w-3.5 h-3.5 text-navy/40" strokeWidth={1.75} />
                    {lang === "bs" ? "Moj račun" : "My Account"}
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => { setDropdownOpen(false); navigate("/admin"); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-navy hover:bg-gray-50 transition-colors flex items-center gap-2.5"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-navy/40" strokeWidth={1.75} />
                    {lang === "bs" ? "Admin panel" : "Admin Panel"}
                  </button>
                )}

                <div className="border-t border-gray-50 mt-1 pt-1">
                  <button
                    onClick={() => { setDropdownOpen(false); signOut(); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2.5"
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {lang === "bs" ? "Odjava" : "Sign out"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <button onClick={openCart} className="relative hover:text-copper transition-colors" aria-label="Cart">
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            {count > 0 && (
              <span className="absolute -top-1 -right-1 bg-copper text-white text-[10px] font-semibold w-4 h-4 flex items-center justify-center rounded-full">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
          <button
            className="md:hidden ml-2"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Menu className="w-6 h-6" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-navy/10 bg-cream/98 backdrop-blur-sm">
          <nav className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-1">
            <a href="#" onClick={() => setMenuOpen(false)}
              className="px-3 py-3 text-sm font-semibold text-navy rounded-lg hover:bg-navy/5 transition-colors">{tr("nav_shop")}</a>
            <a href="#" onClick={() => setMenuOpen(false)}
              className="px-3 py-3 text-sm text-navy/70 rounded-lg hover:bg-navy/5 transition-colors">{tr("nav_story")}</a>
            <a href="#" onClick={() => setMenuOpen(false)}
              className="px-3 py-3 text-sm text-navy/70 rounded-lg hover:bg-navy/5 transition-colors">{tr("nav_journal")}</a>
            <a href="#" onClick={() => setMenuOpen(false)}
              className="px-3 py-3 text-sm text-navy/70 rounded-lg hover:bg-navy/5 transition-colors">{tr("nav_contact")}</a>

            <div className="border-t border-navy/10 mt-2 pt-3 flex flex-col gap-1">
              {!user && (
                <button
                  onClick={() => { setMenuOpen(false); openModal(); }}
                  className="px-3 py-3 text-sm text-left text-navy/70 rounded-lg hover:bg-navy/5 transition-colors"
                >
                  {lang === "bs" ? "Prijava / Registracija" : "Sign in / Register"}
                </button>
              )}
              {isCustomer && (
                <button
                  onClick={() => { setMenuOpen(false); navigate("/account"); }}
                  className="px-3 py-3 text-sm text-left text-navy/70 rounded-lg hover:bg-navy/5 transition-colors"
                >
                  {lang === "bs" ? "Moj račun" : "My Account"}
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => { setMenuOpen(false); navigate("/admin"); }}
                  className="px-3 py-3 text-sm text-left text-navy/70 rounded-lg hover:bg-navy/5 transition-colors"
                >
                  {lang === "bs" ? "Admin panel" : "Admin Panel"}
                </button>
              )}
              {user && (
                <button
                  onClick={() => { setMenuOpen(false); signOut(); }}
                  className="px-3 py-3 text-sm text-left text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                >
                  {lang === "bs" ? "Odjava" : "Sign out"}
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { tr, lang } = useLang();
  const { store_name, logo_url, footer_logo_url, social_facebook, social_instagram, social_email, footer_desc_en, footer_desc_bs } = useSiteSettings();
  const footerDesc = lang === "bs" ? (footer_desc_bs || footer_desc_en) : (footer_desc_en || footer_desc_bs);

  return (
    <footer className="bg-navy text-cream pt-16 pb-8 border-t-[0.5px] border-navy/80">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2 flex flex-col gap-6">
            {footer_logo_url ? (
              <img src={footer_logo_url} alt={store_name} className="h-28 w-auto object-contain" />
            ) : logo_url ? (
              <img src={logo_url} alt={store_name} className="h-28 w-auto object-contain brightness-0 invert" />
            ) : (
              <span className="text-2xl font-semibold tracking-tight text-white">{store_name}.</span>
            )}
            <p className="text-cream/70 max-w-sm leading-relaxed">{footerDesc || tr("footer_desc")}</p>
            <div className="flex items-center gap-4 text-cream/70">
              {social_instagram && (
                <a href={social_instagram} target="_blank" rel="noopener noreferrer" className="hover:text-copper transition-colors" aria-label="Instagram">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {social_facebook && (
                <a href={social_facebook} target="_blank" rel="noopener noreferrer" className="hover:text-copper transition-colors" aria-label="Facebook">
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {social_email && (
                <a href={`mailto:${social_email}`} className="hover:text-copper transition-colors" aria-label="Email">
                  <Mail className="w-5 h-5" />
                </a>
              )}
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
          <p>&copy; {new Date().getFullYear()} {store_name}. {tr("footer_rights")}</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-cream transition-colors">{tr("footer_privacy")}</a>
            <a href="#" className="hover:text-cream transition-colors">{tr("footer_terms")}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
