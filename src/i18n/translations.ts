export type Lang = "en" | "bs";

export const t = {
  en: {
    // Navbar
    nav_shop: "Shop",
    nav_story: "Our Story",
    nav_journal: "Journal",
    nav_contact: "Contact",

    // Hero
    hero_badge: "Handcrafted in Bosnia",
    hero_heading: "Artisan gifts for meaningful moments.",
    hero_sub: "Discover unique, handmade home decor and personalized gifts crafted with love and natural materials.",
    hero_cta_shop: "Shop Collection",
    hero_cta_story: "Our Story",
    hero_stat_customers: "Happy Customers",
    hero_stat_quality: "Handmade Quality",

    // Category strip
    cat_all: "All Products",
    cat_decor: "Home Decor",
    cat_wooden: "Wooden Gifts",
    cat_ceramics: "Ceramics",
    cat_prints: "Custom Prints",
    cat_seasonal: "Seasonal",

    // Product grid
    grid_heading: "New Arrivals",
    grid_view_all: "View All",
    grid_add: "Add",
    grid_no_products: "No products yet.",

    // Promo banner
    promo_heading: "Free Delivery on orders over 100 KM",
    promo_sub: "Delivered safely to your doorstep anywhere in Bosnia and Herzegovina.",
    promo_btn: "Shop Now",

    // Testimonials
    test_heading: "Loved by our customers",
    test_sub: "Don't just take our word for it. Here is what people are saying about our handmade pieces.",

    // Cart
    cart_title: "Your Cart",
    cart_empty: "Your cart is empty",
    cart_empty_sub: "Add some handmade goods to get started.",
    cart_subtotal: "Subtotal",
    cart_checkout: "Proceed to Checkout",
    cart_continue: "Continue Shopping",
    cart_remove: "Remove",

    // Product detail
    product_back: "Back to Shop",
    product_in_stock: "In Stock",
    product_out_of_stock: "Out of Stock",
    product_add_to_cart: "Add to Cart",
    product_share: "Share",
    product_loading: "Loading product…",
    product_not_found: "Product not found.",

    // Footer
    footer_desc: "Handmade wooden gifts and home decor, crafted with precision and love in Bosnia and Herzegovina.",
    footer_shop: "Shop",
    footer_all: "All Products",
    footer_arrivals: "New Arrivals",
    footer_custom: "Custom Orders",
    footer_gift: "Gift Cards",
    footer_support: "Support",
    footer_faq: "FAQ",
    footer_shipping: "Shipping & Returns",
    footer_care: "Care Instructions",
    footer_contact_us: "Contact Us",
    footer_rights: "All rights reserved.",
    footer_privacy: "Privacy Policy",
    footer_terms: "Terms of Service",
  },
  bs: {
    // Navbar
    nav_shop: "Prodavnica",
    nav_story: "Naša priča",
    nav_journal: "Blog",
    nav_contact: "Kontakt",

    // Hero
    hero_badge: "Ručno rađeno u Bosni",
    hero_heading: "Zanatski pokloni za posebne trenutke.",
    hero_sub: "Otkrijte jedinstvene, ručno rađene ukrase za dom i personalizirane poklone izrađene s ljubavlju od prirodnih materijala.",
    hero_cta_shop: "Pregledaj kolekciju",
    hero_cta_story: "Naša priča",
    hero_stat_customers: "Zadovoljnih kupaca",
    hero_stat_quality: "Ručna izrada",

    // Category strip
    cat_all: "Svi proizvodi",
    cat_decor: "Dekoracija doma",
    cat_wooden: "Drveni pokloni",
    cat_ceramics: "Keramika",
    cat_prints: "Prilagođeni otisci",
    cat_seasonal: "Sezonski",

    // Product grid
    grid_heading: "Novi proizvodi",
    grid_view_all: "Pogledaj sve",
    grid_add: "Dodaj",
    grid_no_products: "Još nema proizvoda.",

    // Promo banner
    promo_heading: "Besplatna dostava za narudžbe iznad 100 KM",
    promo_sub: "Sigurna dostava na vašu adresu širom Bosne i Hercegovine.",
    promo_btn: "Kupuj sada",

    // Testimonials
    test_heading: "Omiljeni kod naših kupaca",
    test_sub: "Ne vjerujte samo nama. Evo šta kažu naši kupci o našim ručno rađenim predmetima.",

    // Cart
    cart_title: "Vaša korpa",
    cart_empty: "Vaša korpa je prazna",
    cart_empty_sub: "Dodajte neke ručno rađene proizvode za početak.",
    cart_subtotal: "Ukupno",
    cart_checkout: "Nastavite na plaćanje",
    cart_continue: "Nastavite kupovinu",
    cart_remove: "Ukloni",

    // Product detail
    product_back: "Nazad na prodavnicu",
    product_in_stock: "Na stanju",
    product_out_of_stock: "Nije na stanju",
    product_add_to_cart: "Dodaj u korpu",
    product_share: "Podijeli",
    product_loading: "Učitavanje proizvoda…",
    product_not_found: "Proizvod nije pronađen.",

    // Footer
    footer_desc: "Ručno rađeni drveni pokloni i dekoracija doma, izrađeni s preciznošću i ljubavlju u Bosni i Hercegovini.",
    footer_shop: "Prodavnica",
    footer_all: "Svi proizvodi",
    footer_arrivals: "Novi proizvodi",
    footer_custom: "Prilagođene narudžbe",
    footer_gift: "Poklon kartice",
    footer_support: "Podrška",
    footer_faq: "Česta pitanja",
    footer_shipping: "Dostava i povrat",
    footer_care: "Upute za njegu",
    footer_contact_us: "Kontaktirajte nas",
    footer_rights: "Sva prava zadržana.",
    footer_privacy: "Politika privatnosti",
    footer_terms: "Uvjeti korištenja",
  },
} satisfies Record<Lang, Record<string, string>>;
