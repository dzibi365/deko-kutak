import { Search, User, ShoppingBag, Menu, Instagram, Facebook, Mail } from "lucide-react";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 bg-cream/95 backdrop-blur-sm border-b-[0.5px] border-navy/10">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <div className="flex-shrink-0">
          <a href="#" className="text-xl font-semibold tracking-tight text-navy">
            Deko Kutak.
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#" className="text-sm font-semibold text-navy">Shop</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">Our Story</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">Journal</a>
          <a href="#" className="text-sm text-navy/70 hover:text-navy transition-colors">Contact</a>
        </nav>

        <div className="flex items-center gap-5 text-navy">
          <button className="hover:text-copper transition-colors" aria-label="Search">
            <Search className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <button className="hidden sm:block hover:text-copper transition-colors" aria-label="Account">
            <User className="w-5 h-5" strokeWidth={1.5} />
          </button>
          <button className="relative hover:text-copper transition-colors" aria-label="Cart">
            <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            <span className="absolute -top-1 -right-1 bg-copper text-white text-[10px] font-semibold w-4 h-4 flex items-center justify-center rounded-full">
              2
            </span>
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
  return (
    <footer className="bg-navy text-cream pt-16 pb-8 border-t-[0.5px] border-navy/80">
      <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2 flex flex-col gap-6">
            <span className="text-2xl font-semibold tracking-tight text-white">Deko Kutak.</span>
            <p className="text-cream/70 max-w-sm leading-relaxed">
              Handmade wooden gifts and home decor, crafted with precision and love in Bosnia and Herzegovina.
            </p>
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
            <h4 className="font-semibold text-white tracking-wide">Shop</h4>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">All Products</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">New Arrivals</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">Custom Orders</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">Gift Cards</a>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="font-semibold text-white tracking-wide">Support</h4>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">FAQ</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">Shipping & Returns</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">Care Instructions</a>
            <a href="#" className="text-cream/70 hover:text-white transition-colors">Contact Us</a>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t-[0.5px] border-cream/10 text-sm text-cream/50 gap-4">
          <p>&copy; {new Date().getFullYear()} Deko Kutak. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-cream transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-cream transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
