import { useRef, useEffect, useState } from "react";
import { Search, User, ShoppingBag, Instagram, Facebook, Mail, LayoutDashboard, LogOut, Phone, ChevronDown, Check, MessageCircle } from "lucide-react";
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
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8">

        {/* Mobile: phone, email, hours only — no promo text */}
        <div className="sm:hidden py-2 flex flex-wrap items-center gap-x-4 gap-y-1">
          {topbar_phone && (
            <a href={`tel:${topbar_phone.replace(/\s/g, "")}`}
              className="flex items-center gap-1 hover:text-white transition-colors">
              <Phone className="w-3 h-3" strokeWidth={1.75} />
              {topbar_phone}
            </a>
          )}
          {topbar_email && (
            <a href={`mailto:${topbar_email}`}
              className="flex items-center gap-1 hover:text-white transition-colors">
              <Mail className="w-3 h-3" strokeWidth={1.75} />
              {topbar_email}
            </a>
          )}
          {hours && <span className="text-cream/60">{hours}</span>}
        </div>

        {/* Desktop: single row */}
        <div className="hidden sm:flex items-center justify-between gap-4 h-9">
          <div className="flex items-center gap-4 min-w-0">
            {leftText && <span className="truncate">{leftText}</span>}
            {topbar_phone && (
              <a href={`tel:${topbar_phone.replace(/\s/g, "")}`}
                className="flex items-center gap-1.5 hover:text-white transition-colors flex-shrink-0">
                <Phone className="w-3 h-3" strokeWidth={1.75} />
                {topbar_phone}
              </a>
            )}
            {topbar_email && (
              <a href={`mailto:${topbar_email}`}
                className="flex items-center gap-1.5 hover:text-white transition-colors flex-shrink-0">
                <Mail className="w-3 h-3" strokeWidth={1.75} />
                {topbar_email}
              </a>
            )}
          </div>
          {hasRight && (
            <div className="flex items-center gap-4 flex-shrink-0 text-cream/60">
              {hours && <span>{hours}</span>}
              {rightText && <span>{rightText}</span>}
            </div>
          )}
        </div>

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
    <>
    {/* Viber */}
    <a
      href="viber://chat?number=38761498340"
      aria-label="Chat on Viber"
      className="fixed bottom-[88px] right-6 z-50 w-14 h-14 bg-[#7360F2] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200"
    >
      <MessageCircle className="w-7 h-7" strokeWidth={1.75} />
    </a>
    {/* WhatsApp */}
    <a
      href="https://wa.me/38761498340?text=Zdravo%2C%20zanima%20me%20vi%C5%A1e%20informacija%20o%20va%C5%A1im%20proizvodima!"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform duration-200"
    >
      <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
      </svg>
    </a>
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
          {/* Language dropdown — desktop only */}
          <div className="relative hidden md:block" ref={langRef}>
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
          {/* Search — desktop only */}
          <button className="hidden md:block hover:text-copper transition-colors" aria-label="Search">
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
            className="md:hidden ml-2 relative w-6 h-6 flex flex-col justify-center items-center gap-[5px]"
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className={`block h-[1.5px] w-5 bg-navy rounded-full transition-all duration-300 origin-center ${menuOpen ? "rotate-45 translate-y-[6.5px]" : ""}`} />
            <span className={`block h-[1.5px] w-5 bg-navy rounded-full transition-all duration-300 ${menuOpen ? "opacity-0 scale-x-0" : ""}`} />
            <span className={`block h-[1.5px] w-5 bg-navy rounded-full transition-all duration-300 origin-center ${menuOpen ? "-rotate-45 -translate-y-[6.5px]" : ""}`} />
          </button>
        </div>
      </div>

      {/* Mobile menu — grid-rows trick for smooth natural-height animation */}
      <div
        className="md:hidden"
        style={{
          display: "grid",
          gridTemplateRows: menuOpen ? "1fr" : "0fr",
          transition: "grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div className="border-t border-navy/10 bg-cream/98 backdrop-blur-sm">
            <nav className="max-w-5xl mx-auto px-4 py-4 flex flex-col gap-1">
              {[
                { label: tr("nav_shop"),    bold: true,  delay: 60  },
                { label: tr("nav_story"),   bold: false, delay: 100 },
                { label: tr("nav_journal"), bold: false, delay: 140 },
                { label: tr("nav_contact"), bold: false, delay: 180 },
              ].map(({ label, bold, delay }) => (
                <a
                  key={label}
                  href="#"
                  onClick={() => setMenuOpen(false)}
                  className={`px-3 py-3 text-sm rounded-lg hover:bg-navy/5 transition-all duration-200 ${bold ? "font-semibold text-navy" : "text-navy/70"} ${menuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}
                  style={{ transitionDelay: menuOpen ? `${delay}ms` : "0ms" }}
                >
                  {label}
                </a>
              ))}

              {/* Language selector */}
              <div
                className={`border-t border-navy/10 mt-2 pt-3 flex gap-2 px-3 transition-all duration-200 ${menuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}
                style={{ transitionDelay: menuOpen ? "220ms" : "0ms" }}
              >
                {[
                  { code: "en", flag: "🇬🇧", label: "English" },
                  { code: "bs", flag: "🇧🇦", label: "Bosanski" },
                ].map(({ code, flag, label }) => (
                  <button
                    key={code}
                    onClick={() => { if (lang !== code) toggleLang(); }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors flex-1 justify-center ${
                      lang === code ? "bg-navy text-white font-semibold" : "text-navy/60 hover:bg-navy/5"
                    }`}
                  >
                    <span className="text-base leading-none">{flag}</span>
                    {label}
                  </button>
                ))}
              </div>

              <div
                className={`border-t border-navy/10 mt-2 pt-3 flex flex-col gap-1 transition-all duration-200 ${menuOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"}`}
                style={{ transitionDelay: menuOpen ? "260ms" : "0ms" }}
              >
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
        </div>
      </div>
    </header>
    </>
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
