import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, Building2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useCart } from "../context/CartContext";
import { useLang } from "../context/LanguageContext";
import { localName } from "../lib/supabase";

type PaymentMethod = "cod" | "bank_transfer";

function generateOrderNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `DK-${year}-${rand}`;
}

export default function Checkout() {
  const { items, total, clearCart, closeCart } = useCart();
  const { lang, tr } = useLang();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "", email: "", phone: "",
    address: "", city: "", postal: "",
    note: "",
  });
  const [payment, setPayment] = useState<PaymentMethod>("cod");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (items.length === 0) return;
    setError(null);
    setPlacing(true);

    const orderNumber = generateOrderNumber();
    const { error: err } = await supabase.from("orders").insert({
      order_number: orderNumber,
      customer_name: form.name.trim(),
      customer_email: form.email.trim(),
      customer_phone: form.phone.trim() || null,
      customer_address: form.address.trim(),
      customer_city: form.city.trim(),
      customer_postal: form.postal.trim() || null,
      payment_method: payment,
      items: items,
      subtotal: total,
      note: form.note.trim() || null,
      status: "pending",
    });

    setPlacing(false);
    if (err) { setError(err.message); return; }

    // Fire invoice emails (non-blocking — don't wait or fail order if this errors)
    supabase.functions.invoke("send-order-email", {
      body: { orderNumber },
    }).catch(() => {/* silent — order already placed */});

    clearCart();
    closeCart();
    navigate(`/order-confirmation/${orderNumber}?payment=${payment}`);
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
        <div className="max-w-5xl mx-auto flex items-center justify-between">
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
                    return (
                      <li key={item.id} className="flex items-center gap-3">
                        <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-cream/60 border border-gray-100">
                          {item.image_url
                            ? <img src={item.image_url} alt={name} className="w-full h-full object-cover" />
                            : <div className="w-full h-full" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-navy line-clamp-1">{name}</p>
                          <p className="text-xs text-gray-400">× {item.quantity}</p>
                        </div>
                        <span className="text-sm font-semibold text-navy flex-shrink-0">
                          {(item.price * item.quantity).toFixed(2)} KM
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">{tr("checkout_summary")}</span>
                  <span className="text-xl font-semibold text-navy">{total.toFixed(2)} KM</span>
                </div>

                <button
                  type="submit"
                  disabled={placing}
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
