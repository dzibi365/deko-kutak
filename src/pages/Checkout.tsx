import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, Building2, ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { useLang } from "../context/LanguageContext";
import { useSiteSettings } from "../context/SiteSettingsContext";
import { isValidBiHAccountFormat } from "../lib/bankAccount";
import { calcShipping, centsToKm } from "../lib/shipping";
import { localName } from "../lib/supabase";
import { CustomerImageDisplay } from "../components/CustomerImageDisplay";
import { classifyImageValue } from "../lib/customerUpload";
import { buildOrderItems } from "../lib/checkoutUtils";
import { trackBeginCheckout, type GA4Item, type OrderAnalyticsPayload } from "../lib/analytics";

type PaymentMethod = "cod" | "bank_transfer";

const MAX_RETRIES = 3;

export default function Checkout() {
  const { items, total, clearCart, closeCart } = useCart();
  const { lang, tr } = useLang();
  const { shipping_cost, free_shipping_threshold, bank_iban, bank_account_holder } = useSiteSettings();
  const bankTransferAvailable = !!bank_iban && !!bank_account_holder && isValidBiHAccountFormat(bank_iban);
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
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [expiredPhotos, setExpiredPhotos] = useState<Record<string, boolean>>({});
  const [loadingPhotos, setLoadingPhotos] = useState<Record<string, boolean>>({});
  const [priceChanged, setPriceChanged] = useState<{
    subtotal: number; shippingCost: number; total: number;
  } | null>(null);
  const [priceAcknowledged, setPriceAcknowledged] = useState(false);
  const [placeRetries, setPlaceRetries] = useState(0);

  // Fire begin_checkout once per checkout visit.
  // beginCheckoutFiredRef prevents StrictMode double-invocation: React 18 reuses
  // the same component fiber (and its refs) for StrictMode's fake unmount+remount,
  // so the ref stays true on the second effect run. On real navigation away and
  // back, a new component instance creates a fresh ref starting at false.
  const beginCheckoutFiredRef = useRef(false);
  const checkoutItemsRef = useRef(items);
  const checkoutValueRef = useRef(centsToKm(shipping.totalCents));
  useEffect(() => {
    if (beginCheckoutFiredRef.current || checkoutItemsRef.current.length === 0) return;
    beginCheckoutFiredRef.current = true;
    const gaItems: GA4Item[] = checkoutItemsRef.current.map((item) => ({
      item_id: String(item.id),
      item_name: item.name_en ?? item.name,
      item_category: item.category,
      price: item.price,
      quantity: item.quantity,
    }));
    trackBeginCheckout(gaItems, checkoutValueRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function photoCheckFailed() {
    if (Object.values(loadingPhotos).some(Boolean)) return true;
    if (Object.values(expiredPhotos).some(Boolean)) return true;
    return items.some((item) =>
      Object.values(item.customizations ?? {}).some(v => classifyImageValue(v) === "legacy-url")
    );
  }

  async function runVerify(orderItems: Record<string, unknown>[]) {
    setVerifying(true);
    const { data: check, error: verifyErr } = await supabase
      .rpc("verify_order_pricing", { p_items: orderItems })
      .single();
    setVerifying(false);
    return {
      check: check as { subtotal: number; shipping_cost: number; total: number } | null,
      verifyErr,
    };
  }

  async function finishOrder(
    orderRow: unknown,
    serverAmounts?: { subtotal: number; shippingCost: number; total: number },
  ) {
    const row = orderRow as { order_number: string; email_token: string } | null;
    const orderNumber = row?.order_number;
    const emailToken = row?.email_token;
    if (!orderNumber || !emailToken) {
      setError("Order placed but confirmation unavailable. Please contact support.");
      return;
    }

    // Fire invoice emails (non-blocking — don't wait or fail order if this errors).
    supabase.functions.invoke("send-order-email", {
      body: { emailToken, lang },
    }).catch(() => {});

    // Build GA4 items from cart BEFORE clearCart() removes them.
    const analyticsItems: GA4Item[] = items.map((item) => ({
      item_id: String(item.id),
      item_name: item.name_en ?? item.name,
      item_category: item.category,
      price: item.price,
      quantity: item.quantity,
    }));

    // Use server-confirmed amounts when available (price-changed flow); otherwise
    // fall back to client-computed totals (normal flow where they match server).
    const confirmedAmounts: OrderAnalyticsPayload = serverAmounts
      ? {
          subtotal: serverAmounts.subtotal,
          shippingCost: serverAmounts.shippingCost,
          orderTotal: serverAmounts.total,
          analyticsItems,
        }
      : {
          subtotal: total,
          shippingCost: centsToKm(shipping.shippingCents),
          orderTotal: centsToKm(shipping.totalCents),
          analyticsItems,
        };

    // Persist amounts in sessionStorage so the confirmation page can restore
    // them after a page refresh. Falls back gracefully if sessionStorage is
    // unavailable (private-browsing restrictions, storage quota, etc.).
    try {
      sessionStorage.setItem(`dk-order-${orderNumber}`, JSON.stringify(confirmedAmounts));
    } catch {}

    clearCart();
    closeCart();
    navigate(`/order-confirmation/${orderNumber}?payment=${payment}`, {
      state: confirmedAmounts,
    });
  }

  async function runPlace(
    orderItems: Record<string, unknown>[],
    expectedTotal: number,
    retries: number,
    serverAmounts?: { subtotal: number; shippingCost: number; total: number },
  ) {
    setPlacing(true);
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
        p_expected_total:   expectedTotal,
      })
      .single();
    setPlacing(false);

    if (err) {
      // TOCTOU guard: price changed between verify and place (check_violation)
      if (err.code === "23514") {
        if (retries >= MAX_RETRIES) {
          setError(tr("checkout_price_changed_retry_limit"));
          return;
        }
        const { check: recheck, verifyErr } = await runVerify(orderItems);
        if (verifyErr || !recheck) {
          setError(verifyErr?.message ?? "Price verification failed");
          return;
        }
        setPriceChanged({ subtotal: recheck.subtotal, shippingCost: recheck.shipping_cost, total: recheck.total });
        setPriceAcknowledged(false);
        setPlaceRetries(retries + 1);
        return;
      }
      setError(
        err.message?.includes("order_rate_limit_exceeded")
          ? tr("checkout_rate_limit_error")
          : err.message,
      );
      return;
    }

    await finishOrder(orderRow, serverAmounts);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0 || priceChanged || photoCheckFailed()) return;

    setError(null);
    const orderItems = buildOrderItems(items, lang);

    const { check, verifyErr } = await runVerify(orderItems);
    if (verifyErr || !check) {
      setError(verifyErr?.message ?? "Price verification failed");
      return;
    }

    const serverTotalCents = Math.round(check.total * 100);
    if (serverTotalCents !== shipping.totalCents) {
      setPriceChanged({ subtotal: check.subtotal, shippingCost: check.shipping_cost, total: check.total });
      setPriceAcknowledged(false);
      return;
    }

    await runPlace(orderItems, check.total, placeRetries);
  }

  async function handleAcknowledgedPlace() {
    if (!priceChanged || !priceAcknowledged || placing || verifying) return;
    setError(null);
    const orderItems = buildOrderItems(items, lang);
    await runPlace(orderItems, priceChanged.total, placeRetries, priceChanged);
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 pb-28 lg:pb-10">
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
                  const disabled = method === "bank_transfer" && !bankTransferAvailable;
                  const isSelected = payment === method;
                  const Icon = method === "cod" ? Truck : Building2;
                  const label = method === "cod" ? tr("checkout_cod") : tr("checkout_bank");
                  const desc = method === "cod" ? tr("checkout_cod_desc") : tr("checkout_bank_desc");

                  return (
                    <div key={method} className="flex flex-col gap-1">
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && setPayment(method)}
                        className={`flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-colors ${
                          disabled
                            ? "border-gray-100 opacity-50 cursor-not-allowed"
                            : isSelected ? "border-navy bg-navy/5" : "border-gray-100 hover:border-gray-200"
                        }`}
                      >
                        <div className={`mt-0.5 p-2 rounded-lg ${isSelected && !disabled ? "bg-navy text-white" : "bg-gray-100 text-gray-400"}`}>
                          <Icon className="w-4 h-4" strokeWidth={1.75} />
                        </div>
                        <div>
                          <p className={`font-semibold text-sm ${isSelected && !disabled ? "text-navy" : "text-gray-600"}`}>{label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                        </div>
                        <div className={`ml-auto mt-1 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          isSelected && !disabled ? "border-navy" : "border-gray-300"
                        }`}>
                          {isSelected && !disabled && <div className="w-2 h-2 rounded-full bg-navy" />}
                        </div>
                      </button>
                      {disabled && (
                        <p className="text-xs text-gray-400 px-1">{tr("checkout_bank_unavailable")}</p>
                      )}
                    </div>
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
                            {item.addon_display && item.addon_display.length > 0 && (
                              <div className="flex flex-col gap-0.5">
                                {item.addon_display.map((s) => {
                                  const gLabel = lang === "bs" ? s.group_label_bs || s.group_label_en : s.group_label_en || s.group_label_bs;
                                  const oLabel = lang === "bs" ? s.option_label_bs || s.option_label_en : s.option_label_en || s.option_label_bs;
                                  const adj = s.price_adjustment > 0 ? ` (+${s.price_adjustment.toFixed(2)} KM)` : "";
                                  const txt = s.text_value ? `: ${s.text_value}` : "";
                                  return (
                                    <p key={s.option_id} className="text-xs text-gray-400 truncate">
                                      {gLabel}: {oLabel}{adj}{txt}
                                    </p>
                                  );
                                })}
                              </div>
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

                {/* Price changed acknowledgment banner */}
                {priceChanged && (
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex flex-col gap-3">
                    <p className="text-sm font-semibold text-amber-800">{tr("checkout_price_changed_title")}</p>
                    <p className="text-xs text-amber-700">{tr("checkout_price_changed_body")}</p>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{tr("checkout_subtotal")}</span>
                        <span className="font-medium text-navy">{fmtKm(priceChanged.subtotal)} KM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{tr("checkout_shipping")}</span>
                        <span className="font-medium text-navy">
                          {priceChanged.shippingCost === 0
                            ? tr("shipping_free")
                            : `${fmtKm(priceChanged.shippingCost)} KM`}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-amber-200 mt-1">
                        <span className="font-semibold text-navy">{tr("checkout_total")}</span>
                        <span className="font-semibold text-navy">{fmtKm(priceChanged.total)} KM</span>
                      </div>
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={priceAcknowledged}
                        onChange={(e) => setPriceAcknowledged(e.target.checked)}
                        className="mt-0.5 accent-navy"
                      />
                      <span className="text-xs text-amber-700">{tr("checkout_price_changed_ack")}</span>
                    </label>
                    <button
                      type="button"
                      onClick={handleAcknowledgedPlace}
                      disabled={!priceAcknowledged || placing || verifying}
                      className="w-full py-3 bg-navy text-white text-sm font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-60"
                    >
                      {placing ? tr("checkout_placing") : tr("checkout_price_changed_place")}
                    </button>
                  </div>
                )}

                {!priceChanged && (
                  <button
                    type="submit"
                    disabled={
                      placing ||
                      verifying ||
                      Object.values(expiredPhotos).some(Boolean) ||
                      Object.values(loadingPhotos).some(Boolean)
                    }
                    className="w-full py-3.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors disabled:opacity-60"
                  >
                    {verifying
                      ? tr("checkout_verifying")
                      : placing
                      ? tr("checkout_placing")
                      : tr("checkout_place_order")}
                  </button>
                )}
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
