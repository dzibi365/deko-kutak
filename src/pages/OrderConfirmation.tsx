import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Truck, Building2, Copy, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useLang } from "../context/LanguageContext";

type BankSettings = {
  bank_name: string | null;
  bank_account_holder: string | null;
  bank_iban: string | null;
  bank_note: string | null;
};

export default function OrderConfirmation() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { tr } = useLang();

  const payment = searchParams.get("payment") as "cod" | "bank_transfer" | null;
  const [bank, setBank] = useState<BankSettings | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (payment === "bank_transfer") {
      supabase.from("store_settings").select("*").eq("id", 1).single().then(({ data }) => {
        if (data) setBank(data);
      });
    }
  }, [payment]);

  function copyIban() {
    if (!bank?.bank_iban) return;
    navigator.clipboard.writeText(bank.bank_iban);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-cream font-sans text-navy flex flex-col">
      <header className="bg-cream/95 border-b border-navy/10 px-4 py-5">
        <div className="max-w-5xl mx-auto">
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
                    <Row label="Account Holder" value={bank.bank_account_holder} />
                  )}
                  {bank.bank_name && (
                    <Row label="Bank" value={bank.bank_name} />
                  )}
                  {bank.bank_iban && (
                    <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="text-xs text-gray-400 mb-0.5">IBAN</p>
                        <p className="font-semibold text-navy tracking-wide font-mono">{bank.bank_iban}</p>
                      </div>
                      <button onClick={copyIban}
                        className="p-2 text-gray-400 hover:text-navy hover:bg-gray-200 rounded-lg transition-colors">
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" strokeWidth={1.75} />}
                      </button>
                    </div>
                  )}
                  {bank.bank_note && (
                    <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
                      {bank.bank_note}
                    </p>
                  )}
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
