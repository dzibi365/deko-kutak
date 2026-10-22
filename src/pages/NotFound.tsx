import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useLang } from "../context/LanguageContext";
import { Navbar, Footer } from "../components/Layout";
import { CartDrawer } from "../components/CartDrawer";
import { AuthModal } from "../components/AuthModal";

export default function NotFound() {
  const { lang } = useLang();
  const bs = lang === "bs";

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <Helmet>
        <title>{bs ? "Stranica nije pronađena – Deko Kutak" : "Page Not Found – Deko Kutak"}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Navbar />
      <CartDrawer />
      <AuthModal />
      <main className="flex-1 flex items-center justify-center px-4 py-24">
        <div className="text-center max-w-sm">
          <p className="text-8xl font-bold text-navy/10 mb-4 select-none">404</p>
          <h1 className="text-2xl font-semibold text-navy mb-3">
            {bs ? "Stranica nije pronađena" : "Page not found"}
          </h1>
          <p className="text-navy/55 text-sm leading-relaxed mb-8">
            {bs
              ? "Stranica koju tražite ne postoji ili je premještena."
              : "The page you're looking for doesn't exist or has been moved."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center px-6 py-2.5 bg-navy text-cream rounded-full text-sm font-medium hover:bg-navy/90 transition-colors"
            >
              {bs ? "Početna stranica" : "Go home"}
            </Link>
            <Link
              to="/shop"
              className="inline-flex items-center justify-center px-6 py-2.5 border border-navy/20 text-navy rounded-full text-sm font-medium hover:bg-navy/5 transition-colors"
            >
              {bs ? "Pogledaj prodavnicu" : "Browse the shop"}
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
