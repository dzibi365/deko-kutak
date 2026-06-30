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
import { AuthModal } from "./components/AuthModal";
import { SiteMeta } from "./components/SiteMeta";
import { AdminLayout } from "./components/admin/AdminLayout";
import { RequireAuth } from "./components/admin/RequireAuth";
import Login from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import HeroConfig from "./pages/admin/HeroConfig";
import Orders from "./pages/admin/Orders";
import StoreSettings from "./pages/admin/StoreSettings";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import Account from "./pages/Account";
import ResetPassword from "./pages/ResetPassword";
import Shop from "./pages/Shop";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function StoreFront() {
  return (
    <LanguageProvider>
      <CartProvider>
        <CustomerAuthProvider>
          <SiteMeta />
          <AuthModal />
          <div className="min-h-screen bg-cream font-sans text-navy flex flex-col">
            <Navbar />
            <CartDrawer />
            <main className="flex-1 flex flex-col">
              <Hero />
              <div id="shop" className="max-w-5xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-8 md:py-12">
                <CategoryShowcase />
              </div>
              <PromoBanner />
              <div id="testimonials" className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16">
                <Testimonials />
              </div>
            </main>
            <Footer />
          </div>
        </CustomerAuthProvider>
      </CartProvider>
    </LanguageProvider>
  );
}

function ProductPage() {
  return (
    <LanguageProvider>
      <CartProvider>
        <CustomerAuthProvider>
          <ProductDetail />
        </CustomerAuthProvider>
      </CartProvider>
    </LanguageProvider>
  );
}

function AccountPage() {
  return (
    <LanguageProvider>
      <CartProvider>
        <CustomerAuthProvider>
          <Account />
        </CustomerAuthProvider>
      </CartProvider>
    </LanguageProvider>
  );
}

function CheckoutPage() {
  return (
    <LanguageProvider>
      <CartProvider>
        <Checkout />
      </CartProvider>
    </LanguageProvider>
  );
}

function ConfirmationPage() {
  return (
    <LanguageProvider>
      <OrderConfirmation />
    </LanguageProvider>
  );
}

export default function App() {
  return (
    <HelmetProvider>
    <AuthProvider>
      <SiteSettingsProvider>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<StoreFront />} />

          <Route path="/shop" element={
            <LanguageProvider>
              <CartProvider>
                <CustomerAuthProvider>
                  <Shop />
                </CustomerAuthProvider>
              </CartProvider>
            </LanguageProvider>
          } />
          <Route path="/products/:id" element={<ProductPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/reset-password" element={<LanguageProvider><ResetPassword /></LanguageProvider>} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirmation/:orderNumber" element={<ConfirmationPage />} />

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
            <Route path="settings" element={<StoreSettings />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </SiteSettingsProvider>
    </AuthProvider>
    </HelmetProvider>
  );
}
