import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { CheckCircle, Truck, Building2, Copy, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLang } from "../context/LanguageContext";
import { formatAccountDisplay } from "../lib/bankAccount";
import { trackPurchase, type OrderAnalyticsPayload } from "../lib/analytics";

type BankSettings = {
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_iban: string | null;
  bank_note: string | null;
  bank_transfer_note_bs: string | null;
  bank_transfer_note_en: string | null;
};

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { lang, tr } = useLang();

  // Tier 1: amounts passed directly from Checkout.tsx via router state.
  // Cleared by React Router on page refresh — tiers 2 and 3 cover that case.
  const stateAmounts = (location.state as OrderAnalyticsPayload | null);

  // Tier 2 + 3: recovered after refresh
  const [fetchedAmounts, setFetchedAmounts] = useState<OrderAnalyticsPayload | null>(null);

  const displayAmounts = stateAmounts ?? fetchedAmounts;
  const fmtKm = (n: number) => lang === "bs" ? n.toFixed(2).replace(".", ",") : n.toFixed(2);

  const payment = searchParams.get("payment") as "cod" | "bank_transfer" | null;
  const [bank, setBank] = useState<BankSettings | null>(null);
  const [copied, setCopied] = useState(false);

  // Recover amounts after a page refresh.
  useEffect(() => {
    if (stateAmounts || !orderNumber) return;

    // Tier 2 — sessionStorage (stored by Checkout.tsx on successful submit).
    // Survives F5 refresh within the same browser tab.  Works for both guest
    // and authenticated checkouts.
    try {
      const raw = sessionStorage.getItem(`dk-order-${orderNumber}`);
      if (raw) {
        const parsed = JSON.parse(raw) as OrderAnalyticsPayload;
        if (typeof parsed.subtotal === "number" && typeof parsed.orderTotal === "number") {
          setFetchedAmounts(parsed);
          return;
        }
      }
    } catch { /* ignore — fall through to tier 3 */ }

    // Tier 3 — DB fetch for authenticated users.
    // The "customer read own orders" RLS policy (user_id = auth.uid()) ensures
    // only the order owner can read their row.  Anon users have no SELECT
    // policy and will receive an empty result — no data is exposed.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      supabase
        .from("orders")
        .select("subtotal, shipping_cost, total")
        .eq("order_number", orderNumber)
        .single()
        .then(({ data }) => {
          if (data) {
            setFetchedAmounts({
              subtotal: (data as { subtotal: number }).subtotal,
              shippingCost: (data as { shipping_cost: number }).shipping_cost,
              orderTotal: (data as { total: number }).total,
            });
          }
        });
    });
  }, [stateAmounts, orderNumber]);

  useEffect(() => {
    if (payment === "bank_transfer") {
      supabase
        .from("store_settings")
        .select("bank_name, bank_account_holder, bank_iban, bank_note, bank_transfer_note_bs, bank_transfer_note_en")
        .eq("id", 1)
        .single()
        .then(({ data }) => {
          if (data) setBank(data as BankSettings);
        });
    }
  }, [payment]);

  // Fire purchase event once per order. trackPurchase guards against duplicate
  // calls via sessionStorage, so re-renders and StrictMode double-effects are safe.
  useEffect(() => {
    if (!orderNumber || !displayAmounts) return;
    trackPurchase(
      orderNumber,
      displayAmounts.orderTotal,
      displayAmounts.shippingCost,
      displayAmounts.analyticsItems ?? [],
    );
  }, [orderNumber, displayAmounts]);

  function copyAccount() {
    if (!bank?.bank_iban) return;
    navigator.clipboard.writeText(bank.bank_iban);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col overflow-x-hidden">
      <header className="bg-cream/95 border-b border-navy/10 px-4 py-5">
        <div className="max-w-7xl mx-auto">
          <a href="/" className="text-lg font-semibold tracking-tight text-navy">Deko Kutak.</a>
        </div>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-16">
        <div className="w-full max-w-lg flex flex-col gap-6">
          {/* Success header */}
          <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle className="w-9 h-9 text-green-500" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-navy mb-2">{tr("confirm_title")}</h1>
              <p className="text-gray-500 text-sm">{tr("confirm_sub")}</p>
            </div>
            <div className="bg-gray-50 rounded-xl px-6 py-3 flex flex-col items-center gap-1">
              <span className="text-xs text-gray-400 uppercase tracking-widest font-semibold">{tr("confirm_order_no")}</span>
              <span className="text-xl font-semibold text-navy tracking-wide">{orderNumber}</span>
            </div>
          </div>

          {/* Order totals — fresh navigation, sessionStorage recovery, or DB fetch */}
          {displayAmounts && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col gap-2.5">
              <h3 className="text-sm font-semibold text-navy mb-0.5">{tr("checkout_summary")}</h3>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tr("checkout_subtotal")}</span>
                <span className="text-navy font-medium">{fmtKm(displayAmounts.subtotal)} KM</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{tr("checkout_shipping")}</span>
                <span className={displayAmounts.shippingCost === 0 ? "text-green-600 font-semibold text-sm" : "text-navy font-medium text-sm"}>
                  {displayAmounts.shippingCost === 0 ? tr("shipping_free") : `${fmtKm(displayAmounts.shippingCost)} KM`}
                </span>
              </div>
              <div className="flex justify-between pt-2.5 border-t border-gray-100 mt-0.5">
                <span className="font-semibold text-navy">{tr("checkout_total")}</span>
                <span className="font-semibold text-navy text-lg">{fmtKm(displayAmounts.orderTotal)} KM</span>
              </div>
            </div>
          )}

          {/* Payment info */}
          {payment === "bank_transfer" ? (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-navy/10 rounded-lg">
                  <Building2 className="w-5 h-5 text-navy" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-semibold text-navy">{tr("confirm_bank_title")}</p>
                  <p className="text-xs text-gray-400">{tr("confirm_bank_note")}</p>
                </div>
              </div>

              {bank ? (
                <div className="flex flex-col gap-3">
                  {bank.bank_account_holder && (
                    <Row label={tr("confirm_bank_holder")} value={bank.bank_account_holder} />
                  )}
                  {bank.bank_name && (
                    <Row label={tr("confirm_bank_name")} value={bank.bank_name} />
                  )}
                  {bank.bank_iban && (
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">{tr("confirm_bank_account")}</p>
                        <p className="font-semibold text-navy tracking-wide font-mono">{formatAccountDisplay(bank.bank_iban)}</p>
                      </div>
                      <button onClick={copyAccount}
                        className="p-2 text-gray-400 hover:text-navy hover:bg-gray-200 rounded-lg transition-colors">
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                  )}
                  {orderNumber && (
                    <Row label={tr("confirm_payment_ref")} value={orderNumber} />
                  )}
                  {(() => {
                    const note = lang === "bs" ? bank.bank_transfer_note_bs : bank.bank_transfer_note_en;
                    return note ? (
                      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                        {note}
                      </p>
                    ) : bank.bank_note ? (
                      <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                        {bank.bank_note}
                      </p>
                    ) : null;
                  })()}
                </div>
              ) : (
                <p className="text-sm text-gray-400">Loading bank details…</p>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 border border-gray-100 flex items-center gap-4">
              <div className="p-3 bg-copper/10 rounded-xl">
                <Truck className="w-6 h-6 text-copper" strokeWidth={1.5} />
              </div>
              <div>
                <p className="font-semibold text-navy">{tr("confirm_cod_title")}</p>
                <p className="text-sm text-gray-500 mt-0.5">{tr("confirm_cod_note")}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => navigate("/")}
            className="w-full py-3.5 bg-navy text-white font-semibold rounded-xl hover:bg-navy/90 transition-colors"
          >
            {tr("confirm_continue")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-navy">{value}</span>
    </div>
  );
}
