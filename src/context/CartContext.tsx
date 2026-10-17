import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Product, PriceOption } from "../lib/supabase";
import {
  addonSelectionCartKey,
  type AddonSelection,
  type AddonSelectionDisplay,
} from "../lib/addonGroups";

export type CartItem = {
  cartKey: string;
  id: number;
  name: string;
  name_en: string | null;
  name_bs: string | null;
  price: number;
  image_url: string | null;
  category: string;
  quantity: number;
  customizations?: Record<string, string>;
  // Tokens are keyed by the same labels as customizations (one token per image field).
  // They are persisted in localStorage to survive page reloads during the cart session
  // but are stripped from the order JSONB before the DB insert in Checkout.tsx.
  uploadTokens?: Record<string, string>;
  // Variant fields — set for products with price_options.
  // option_id is sent as a top-level order item field for server-side price enforcement.
  // option_label_* are client-only display fields stripped at checkout build time.
  option_id?: string;
  option_label_en?: string;
  option_label_bs?: string;
  // Add-on selections.
  // addon_selections: lean payload sent to the server (group_id + option_id + text_value?).
  // addon_display: display snapshots for cart UI — stripped at checkout build time.
  addon_selections?: AddonSelection[];
  addon_display?: AddonSelectionDisplay[];
};

type CartContextType = {
  items: CartItem[];
  count: number;
  total: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  addItem: (
    product: Product,
    customizations?: Record<string, string>,
    uploadTokens?: Record<string, string>,
    variantOption?: PriceOption,
    addonContext?: { selections: AddonSelection[]; display: AddonSelectionDisplay[] },
  ) => void;
  removeItem: (cartKey: string) => void;
  updateQty: (cartKey: string, qty: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("cart") ?? "[]");
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const count = items.reduce((s, i) => s + i.quantity, 0);
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  function addItem(
    product: Product,
    customizations?: Record<string, string>,
    uploadTokens?: Record<string, string>,
    variantOption?: PriceOption,
    addonContext?: { selections: AddonSelection[]; display: AddonSelectionDisplay[] },
  ) {
    setItems((prev) => {
      const hasCustom = customizations && Object.keys(customizations).some((k) => customizations[k]);

      // Cart key encodes the full combination so distinct combos stay separate
      // while identical non-personalized combos merge.
      const addonKey =
        addonContext && addonContext.display.length > 0
          ? addonSelectionCartKey(addonContext.display)
          : "";
      const cartKey = hasCustom
        ? `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`
        : variantOption
        ? addonKey
          ? `${product.id}-${variantOption.id}-${addonKey}`
          : `${product.id}-${variantOption.id}`
        : addonKey
        ? `${product.id}-${addonKey}`
        : String(product.id);

      if (!hasCustom) {
        const existing = prev.find((i) => i.cartKey === cartKey);
        if (existing) {
          return prev.map((i) =>
            i.cartKey === cartKey ? { ...i, quantity: i.quantity + 1 } : i,
          );
        }
      }

      const tokens =
        hasCustom && uploadTokens && Object.keys(uploadTokens).length > 0
          ? uploadTokens
          : undefined;

      const addonSurcharge = addonContext
        ? addonContext.display.reduce((s, d) => s + d.price_adjustment, 0)
        : 0;

      return [
        ...prev,
        {
          cartKey,
          id: product.id,
          name: product.name,
          name_en: product.name_en,
          name_bs: product.name_bs,
          price: (variantOption?.price ?? product.price) + addonSurcharge,
          image_url: product.image_url,
          category: product.category,
          quantity: 1,
          customizations: hasCustom ? customizations : undefined,
          uploadTokens: tokens,
          ...(variantOption
            ? {
                option_id: variantOption.id,
                option_label_en: variantOption.label_en,
                option_label_bs: variantOption.label_bs,
              }
            : {}),
          ...(addonContext && addonContext.selections.length > 0
            ? {
                addon_selections: addonContext.selections,
                addon_display: addonContext.display,
              }
            : {}),
        },
      ];
    });
    setIsOpen(true);
  }

  function removeItem(cartKey: string) {
    setItems((prev) => prev.filter((i) => i.cartKey !== cartKey));
  }

  function updateQty(cartKey: string, qty: number) {
    if (qty < 1) { removeItem(cartKey); return; }
    setItems((prev) => prev.map((i) => i.cartKey === cartKey ? { ...i, quantity: qty } : i));
  }

  function clearCart() { setItems([]); }

  return (
    <CartContext.Provider value={{
      items, count, total, isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      addItem, removeItem, updateQty, clearCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
