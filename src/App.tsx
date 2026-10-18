import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Navbar, Footer } from "./components/Layout";
import { Hero, PromoBanner, Testimonials, CategoryShowcase } from "./components/HomeSections";
import { CartDrawer } from "./components/CartDrawer";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { CartProvider } from "./context/CartContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import { CustomerAuthProvider } from "./context/CustomerAuthContext";
import { ConsentProvider } from "./context/ConsentContext";
import { AuthModal } from "./components/AuthModal";
import { SiteMeta } from "./components/SiteMeta";
import { AdminLayout } from "./components/admin/AdminLayout";
import { RequireAuth } from "./components/admin/RequireAuth";
import CookieBanner from "./components/CookieBanner";
import Login from "./pages/admin/Login";
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Shop          = lazy(() => import("./pages/Shop"));

// Secondary public pages — loaded on demand, not on the initial storefront path.
const InfoPage          = lazy(() => import("./pages/InfoPage"));
const Account           = lazy(() => import("./pages/Account"));
const Checkout          = lazy(() => import("./pages/Checkout"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const ResetPassword     = lazy(() => import("./pages/ResetPassword"));
const CookiePolicy      = lazy(() => import("./pages/CookiePolicy"));

// Admin pages — loaded only when an authenticated user navigates to /admin/*.
// Keeps the public storefront bundle free of admin code, TipTap and
// the Three.js MeshPickerCanvas used only in the product editor.
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const Products       = lazy(() => import("./pages/admin/Products"));
const Categories     = lazy(() => import("./pages/admin/Categories"));
const HeroConfig     = lazy(() => import("./pages/admin/HeroConfig"));
const Orders         = lazy(() => import("./pages/admin/Orders"));
const StoreSettings  = lazy(() => import("./pages/admin/StoreSettings"));
const AdminReviews   = lazy(() => import("./pages/admin/Reviews"));
const FieldGroups    = lazy(() => import("./pages/admin/FieldGroups"));
const ImageTools     = lazy(() => import("./pages/admin/ImageTools"));
const AdminPages     = lazy(() => import("./pages/admin/Pages"));

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function PageFallback() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-navy/20 border-t-navy rounded-full animate-spin" />
    </div>
  );
}

function StoreFront() {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <SiteMeta />
        <AuthModal />
        <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
          <Navbar />
          <CartDrawer />
          <main className="flex-1 flex flex-col">
            <Hero />
            <div id="shop" className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-8 md:py-12">
              <CategoryShowcase />
            </div>
            <PromoBanner />
            <div id="testimonials" className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16">
              <Testimonials />
            </div>
          </main>
          <Footer />
        </div>
      </CustomerAuthProvider>
    </CartProvider>
  );
}

function ProductPage() {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <Suspense fallback={<PageFallback />}>
          <ProductDetail />
        </Suspense>
      </CustomerAuthProvider>
    </CartProvider>
  );
}

function AccountPage() {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Account />
        </Suspense>
      </CustomerAuthProvider>
    </CartProvider>
  );
}

function CheckoutPage() {
  return (
    <CartProvider>
      <Suspense fallback={<PageFallback />}>
        <Checkout />
      </Suspense>
    </CartProvider>
  );
}

function ConfirmationPage() {
  return (
    <Suspense fallback={<PageFallback />}>
      <OrderConfirmation />
    </Suspense>
  );
}

function InfoPageWrapper({ slug }: { slug?: string }) {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <Suspense fallback={<PageFallback />}>
          <InfoPage slug={slug} />
        </Suspense>
      </CustomerAuthProvider>
    </CartProvider>
  );
}

function CookiePolicyPage() {
  return (
    <CartProvider>
      <CustomerAuthProvider>
        <Suspense fallback={<PageFallback />}>
          <CookiePolicy />
        </Suspense>
      </CustomerAuthProvider>
    </CartProvider>
  );
}

export default function App() {
  return (
    <HelmetProvider>
    <AuthProvider>
      <SiteSettingsProvider>
      <ConsentProvider>
      <LanguageProvider>
      <BrowserRouter>
        <ScrollToTop />
        <CookieBanner />
        <Routes>
          <Route path="/" element={<StoreFront />} />

          <Route path="/shop" element={
            <CartProvider>
              <CustomerAuthProvider>
                <Suspense fallback={<PageFallback />}>
                  <Shop />
                </Suspense>
              </CustomerAuthProvider>
            </CartProvider>
          } />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/reset-password" element={
            <Suspense fallback={<PageFallback />}>
              <ResetPassword />
            </Suspense>
          } />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirmation/:orderNumber" element={<ConfirmationPage />} />

          <Route path="/privacy"       element={<InfoPageWrapper slug="privacy"  />} />
          <Route path="/terms"         element={<InfoPageWrapper slug="terms"    />} />
          <Route path="/faq"           element={<InfoPageWrapper slug="faq"      />} />
          <Route path="/shipping"      element={<InfoPageWrapper slug="shipping" />} />
          <Route path="/page/:slug"    element={<InfoPageWrapper />} />
          <Route path="/cookie-policy" element={<CookiePolicyPage />} />

          <Route path="/admin/login" element={<Login />} />

          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="categories" element={<Categories />} />
            <Route path="homepage" element={<HeroConfig />} />
            <Route path="orders" element={<Orders />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="field-groups" element={<FieldGroups />} />
            <Route path="settings" element={<StoreSettings />} />
            <Route path="image-tools" element={<ImageTools />} />
            <Route path="pages" element={<AdminPages />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </LanguageProvider>
      </ConsentProvider>
      </SiteSettingsProvider>
    </AuthProvider>
    </HelmetProvider>
  );
}
