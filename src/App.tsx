import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useState } from "react";
import { Navbar, Footer } from "./components/Layout";
import { Hero, CategoryStrip, PromoBanner, Testimonials } from "./components/HomeSections";
import { ProductGrid } from "./components/ProductGrid";
import { CartDrawer } from "./components/CartDrawer";
import { AuthProvider } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import { CartProvider } from "./context/CartContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
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

function StoreFront() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  return (
    <LanguageProvider>
      <CartProvider>
        <div className="min-h-screen bg-cream font-sans text-navy flex flex-col">
          <Navbar />
          <CartDrawer />
          <main className="flex-1 flex flex-col">
            <Hero />
            <div id="shop" className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-12 flex flex-col gap-10">
              <CategoryStrip selected={selectedCategory} onSelect={setSelectedCategory} />
              <ProductGrid category={selectedCategory} />
            </div>
            <PromoBanner />
            <div id="testimonials" className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-16">
              <Testimonials />
            </div>
          </main>
          <Footer />
        </div>
      </CartProvider>
    </LanguageProvider>
  );
}

function ProductPage() {
  return (
    <LanguageProvider>
      <CartProvider>
        <ProductDetail />
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
    <AuthProvider>
      <SiteSettingsProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<StoreFront />} />

          <Route path="/products/:id" element={<ProductPage />} />
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
  );
}
