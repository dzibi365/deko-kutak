import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, Building2, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { useLang } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { calcShipping, centsToKm } from "../lib/shipping";
import { localName } from "../lib/supabase";
import { CustomerImageDisplay } from "../components/CustomerImageDisplay";
import { classifyImageValue } from "../lib/customerUpload";

type PaymentMethod = "cod" | "bank_transfer";

export default function Checkout() {
  const { items, total, clearCart, closeCart } = useCart();
  const { lang, tr } = useLang();
  const { shipping_cost, free_shipping_threshold } = useSiteSettings();
  const navigate = useNavigate();

  const shipping = calcShipping(total, shipping_cost, free_shipping_threshold);
  const fmtKm = (n: number) => lang === "bs" ? n.toFixed(2).replace(".", ",") : n.toFixed(2);

  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    address: "", city: "", postal: "",
    note: "",
  });
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [expiredPhotos, setExpiredPhotos] = useState<Record<string, boolean>>({});
  const [loadingPhotos, setLoadingPhotos] = useState<Record<string, boolean>>({});

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;

    // Pre-submit validation sweep — block if any photo authorization is still
    // in progress, has failed, or belongs to a legacy (unverified) URL.
    if (Object.values(loadingPhotos).some(Boolean)) return;
    if (Object.values(expiredPhotos).some(Boolean)) return;
    const hasLegacyImage = items.some((item) =>
      Object.values(item.customizations ?? {}).some(
        (v) => classifyImageValue(v) === "legacy-url"
      )
    );
    if (hasLegacyImage) return;

    setError(null);
    setPlacing(true);

    // Strip client-only fields before persisting.
    // uploadTokens: credentials — must never reach the DB.
    // cartKey: local merge key — not meaningful server-side.
    // option_label_*: display-only; the canonical label is injected into customizations below.
    const orderItems = items.map(({
      uploadTokens: _tokens,
      cartKey: _cartKey,
      option_label_en,
      option_label_bs,
      ...rest
    }) => {
      if (rest.option_id && (option_label_en || option_label_bs)) {
        const variantLabel = lang === "bs"
          ? (option_label_bs || option_label_en || "")
          : (option_label_en || option_label_bs || "");
        const labelKey = lang === "bs" ? "Varijanta" : "Variant";
        return {
          ...rest,
          customizations: { [labelKey]: variantLabel, ...(rest.customizations ?? {}) },
        };
      }
      return rest;
    });
    // place_order is a SECURITY DEFINER RPC that inserts the order, generates
    // order_number from a DB sequence, and returns both order_number and email_token.
    // Anon users have no SELECT RLS on orders, so INSERT…RETURNING yields 0 rows
    // for guests via the REST path — the RPC resolves this.
    // The BEFORE INSERT trigger still recalculates all financial amounts server-side.
    const { data: orderRow, error: err } = await supabase
      .rpc("place_order", {
        p_customer_name:    form.name.trim(),
        p_customer_email:   form.email.trim(),
        p_customer_phone:   form.phone.trim() || null,
        p_customer_address: form.address.trim(),
        p_customer_city:    form.city.trim(),
        p_customer_postal:  form.postal.trim() || null,
        p_payment_method:   payment,
        p_items:            orderItems,
        p_subtotal:         total,
        p_note:             form.note.trim() || null,
        p_lang:             lang,
      })
      .single();

    setPlacing(false);
    if (err) {
      setError(
        err.message?.includes("order_rate_limit_exceeded")
          ? tr("checkout_rate_limit_error")
          : err.message,
      );
      return;
    }

    const row = orderRow as { order_number: string; email_token: string } | null;
    const orderNumber = row?.order_number;
    const emailToken  = row?.email_token;
    if (!orderNumber || !emailToken) {
      setError("Order placed but confirmation unavailable. Please contact support.");
      return;
    }

    // Fire invoice emails (non-blocking — don't wait or fail order if this errors).
    supabase.functions.invoke("send-order-email", {
      body: { emailToken, lang },
    }).catch(() => {/* silent — order already placed */});

    // Persist amounts in sessionStorage so the confirmation page can restore
    // them after a page refresh.  Falls back gracefully if sessionStorage is
    // unavailable (private-browsing restrictions, storage quota, etc.).
    const confirmedAmounts = {
      subtotal: total,
      shippingCost: centsToKm(shipping.shippingCents),
      orderTotal: centsToKm(shipping.totalCents),
    };
    try {
      sessionStorage.setItem(`dk-order-${orderNumber}`, JSON.stringify(confirmedAmounts));
    } catch { /* non-fatal */ }

    clearCart();
    closeCart();
    navigate(`/order-confirmation/${orderNumber}?payment=${payment}`, {
      state: confirmedAmounts,
    });
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-navy/50 mb-4">Your cart is empty.</p>
          <button onClick={() => navigate("/")} className="text-sm font-semibold text-navy underline">
            {tr("confirm_continue")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream font-sans text-navy">
      {/* Top bar */}
      <header className="bg-cream/95 backdrop-blur-sm border-b border-navy/10 px-4 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-semibold tracking-tight text-navy">Deko Kutak.</a>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-navy/60 hover:text-navy transition-colors"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={2} />
            {tr("checkout_back_cart")}
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-2xl font-semibold text-navy mb-8">{tr("checkout_title")}</h1>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
            {/* Left — form */}
            <div className="lg:col-span-3 flex flex-col gap-7">
              {error && <p className="text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg">{error}</p>}

              {/* Customer details */}
              <section className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col gap-4">
                <h2 className="font-semibold text-navy">{tr("checkout_details")}</h2>

                <Field label={tr("checkout_name")}>
                  <input required value={form.name} onChange={(e) => set("name", e.target.value)}
                    className={inputCls} placeholder="Amina Karić" />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label={tr("checkout_email")}>
                    <input required type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
                      className={inputCls} placeholder="amina@example.com" />
                  </Field>
                  <Field label={tr("checkout_phone")}>
                    <input value={form.phone} onChange={(e) => set("phone", e.target.value)}
                      className={inputCls} placeholder="+387 61 000 000" />
                  </Field>
                </div>

                <Field label={tr("checkout_address")}>
                  <input required value={form.address} onChange={(e) => set("address", e.target.value)}
                    className={inputCls} placeholder="Maršala Tita 1" />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field label={tr("checkout_city")}>
                    <input required value={form.city} onChange={(e) => set("city", e.target.value)}
                      className={inputCls} placeholder="Sarajevo" />
                  </Field>
                  <Field label={tr("checkout_postal")}>
                    <input value={form.postal} onChange={(e) => set("postal", e.target.value)}
                      className={inputCls} placeholder="71000" />
                  </Field>
                </div>

                <Field label={tr("checkout_note")}>
                  <textarea value={form.note} onChange={(e) => set("note", e.target.value)}
                    rows={2} className={`${inputCls} resize-none`} placeholder="…" />
                </Field>
              </section>

              {/* Payment method */}
              <section className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col gap-4">
                <h2 className="font-semibold text-navy">{tr("checkout_payment")}</h2>

                {(["cod", "bank_transfer"] as PaymentMethod[]).map((method) => {
                  const isSelected = payment === method;
                  const Icon = method === "cod" ? Truck : Building2;
                  const label = method === "cod" ? tr("checkout_cod") : tr("checkout_bank");
                  const desc = method === "cod" ? tr("checkout_cod_desc") : tr("checkout_bank_desc");

                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayment(method)}
                      className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${
                        isSelected ? "border-navy bg-navy/5" : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className={`mt-0.5 p-2 rounded-lg ${isSelected ? "bg-navy text-white" : "bg-gray-100 text-gray-400"}`}>
                        <Icon className="w-4 h-4" strokeWidth={1.75} />
                      </div>
                      <div>
                        <p className={`font-semibold text-sm ${isSelected ? "text-navy" : "text-gray-600"}`}>{label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                      </div>
                      <div className={`ml-auto mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                        isSelected ? "border-navy" : "border-gray-300"
                      }`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-navy" />}
                      </div>
                    </button>
                  );
                })}
              </section>
            </div>

            {/* Right — order summary */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl p-6 border border-gray-100 lg:sticky lg:top-6 flex flex-col gap-5">
                <h2 className="font-semibold text-navy">{tr("checkout_summary")}</h2>

                <ul className="flex flex-col gap-4">
                  {items.map((item) => {
                    const name = localName({ name: item.name, name_en: item.name_en, name_bs: item.name_bs }, lang);
                    const customEntries = item.customizations
                      ? Object.entries(item.customizations).filter(([, v]) => v)
                      : [];
                    const isExpanded = !!expandedItems[item.cartKey];
                    return (
                      <li key={item.cartKey} className="flex flex-col">
                        {/* Product row */}
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-cream/60 border border-gray-100">
                            {item.image_url
                              ? <img src={item.image_url} alt={name} className="w-full h-full object-cover" />
                              : <div className="w-full h-full" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy line-clamp-1">{name}</p>
                            {item.option_id && (item.option_label_bs || item.option_label_en) && (
                              <p className="text-xs text-gray-400 truncate">
                                {lang === "bs"
                                  ? (item.option_label_bs || item.option_label_en)
                                  : (item.option_label_en || item.option_label_bs)}
                              </p>
                            )}
                            <p className="text-xs text-gray-400">× {item.quantity}</p>
                          </div>
                          <span className="text-sm font-semibold text-navy flex-shrink-0">
                            {(item.price * item.quantity).toFixed(2)} KM
                          </span>
                        </div>

                        {/* Personalization toggle — only for personalized items */}
                        {customEntries.length > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => setExpandedItems((prev) => ({ ...prev, [item.cartKey]: !prev[item.cartKey] }))}
                              className="flex items-center gap-1 mt-2 text-xs text-gray-400 hover:text-navy transition-colors self-start"
                            >
                              <ChevronDown
                                className={`w-3 h-3 transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`}
                                strokeWidth={2}
                              />
                              {isExpanded ? tr("checkout_hide_personalization") : tr("checkout_view_personalization")}
                            </button>

                            {/* Animated expand using CSS grid-rows trick */}
                            <div
                              className="grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none"
                              style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                            >
                              <div className="overflow-hidden">
                                <div className="mt-2 pt-2 border-t border-gray-100">
                                  <ul className="flex flex-col gap-1.5">
                                    {customEntries.map(([label, value]) => {
                                      const imageType = classifyImageValue(value);
                                      const isImage = imageType !== "other";
                                      const token = item.uploadTokens?.[label];
                                      const photoKey = `${item.cartKey}:${label}`;
                                      return (
                                        <li key={label} className="text-xs leading-snug">
                                          {isImage ? (
                                            <div className="flex flex-col gap-1">
                                              <span className="font-medium text-gray-500">{label}:</span>
                                              <CustomerImageDisplay
                                                value={value}
                                                token={token}
                                                label={label}
                                                sizeClass="w-20 h-20"
                                                onExpiredChange={(unavailable) =>
                                                  setExpiredPhotos((prev) => ({ ...prev, [photoKey]: unavailable }))
                                                }
                                                onLoadingChange={(loading) =>
                                                  setLoadingPhotos((prev) => ({ ...prev, [photoKey]: loading }))
                                                }
                                              />
                                            </div>
                                          ) : (
                                            <span className="text-gray-500 break-words">
                                              <span className="font-medium">{label}:</span>{" "}
                                              <span className="text-gray-700">{value}</span>
                                            </span>
                                          )}
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{tr("checkout_subtotal")}</span>
                    <span className="text-sm font-medium text-navy">{fmtKm(total)} KM</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{tr("checkout_shipping")}</span>
                    <span className="text-sm font-medium text-navy">
                      {shipping.isFree
                        ? tr("shipping_free")
                        : `${fmtKm(centsToKm(shipping.shippingCents))} KM`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                    <span className="text-sm font-semibold text-navy">{tr("checkout_total")}</span>
                    <span className="text-xl font-semibold text-navy">{fmtKm(centsToKm(shipping.totalCents))} KM</span>
                  </div>
                </div>

                {Object.values(expiredPhotos).some(Boolean) && (
                  <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                    {tr("checkout_expired_photo_warning")}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={
                    placing ||
                    Object.values(expiredPhotos).some(Boolean) ||
                    Object.values(loadingPhotos).some(Boolean)
                  }
                  className="w-full py-3.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-60"
                >
                  {placing ? tr("checkout_placing") : tr("checkout_place_order")}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-navy">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";
