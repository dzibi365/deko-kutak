import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useLang } from "../context/LanguageContext";
import { localName } from "../lib/supabase";

export function CartDrawer() {
  const { items, count, total, isOpen, closeCart, removeItem, updateQty } = useCart();
  const { lang, tr } = useLang();

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 transition-opacity"
          onClick={closeCart}
        />
      )}

      {/* Drawer */}
      <div className={`fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-navy text-lg">{tr("cart_title")}</h2>
            {count > 0 && (
              <span className="bg-navy text-white text-xs font-semibold px-2 py-0.5 rounded-full">{count}</span>
            )}
          </div>
          <button onClick={closeCart} className="p-2 text-gray-400 hover:text-navy hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <ShoppingBag className="w-14 h-14 text-navy/10" strokeWidth={1} />
            <p className="font-semibold text-navy">{tr("cart_empty")}</p>
            <p className="text-sm text-gray-400 max-w-xs">{tr("cart_empty_sub")}</p>
            <button
              onClick={closeCart}
              className="mt-2 px-5 py-2.5 border border-navy/20 rounded-lg text-sm font-semibold text-navy hover:bg-navy hover:text-white transition-colors"
            >
              {tr("cart_continue")}
            </button>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
              {items.map((item) => {
                const name = localName(
                  { name: item.name, name_en: item.name_en, name_bs: item.name_bs },
                  lang
                );
                return (
                  <li key={item.id} className="flex gap-4">
                    {/* Image */}
                    <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-cream/60 border border-gray-100">
                      {item.image_url ? (
                        <img src={item.image_url} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <p className="font-medium text-navy text-sm leading-snug line-clamp-2">{name}</p>
                      <p className="text-sm font-semibold text-copper">{item.price.toFixed(2)} KM</p>

                      {/* Qty controls */}
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          onClick={() => updateQty(item.id, item.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-navy hover:bg-gray-100 transition-colors"
                        >
                          <Minus className="w-3 h-3" strokeWidth={2} />
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-navy">{item.quantity}</span>
                        <button
                          onClick={() => updateQty(item.id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center border border-gray-200 rounded-lg text-navy hover:bg-gray-100 transition-colors"
                        >
                          <Plus className="w-3 h-3" strokeWidth={2} />
                        </button>

                        <button
                          onClick={() => removeItem(item.id)}
                          className="ml-auto p-1.5 text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Footer */}
            <div className="px-6 py-5 border-t border-gray-100 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{tr("cart_subtotal")}</span>
                <span className="text-xl font-semibold text-navy">{total.toFixed(2)} KM</span>
              </div>
              <button className="w-full py-3.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors">
                {tr("cart_checkout")}
              </button>
              <button onClick={closeCart} className="w-full py-2.5 text-sm font-medium text-gray-500 hover:text-navy transition-colors">
                {tr("cart_continue")}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
