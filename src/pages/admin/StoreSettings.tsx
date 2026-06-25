import { useEffect, useState } from "react";
import { Save, Mail, Info } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Settings = {
  bank_name: string;
  bank_account_holder: string;
  bank_iban: string;
  bank_note: string;
  store_name: string;
  email_enabled: boolean;
  owner_email: string;
};

const empty: Settings = {
  bank_name: "", bank_account_holder: "", bank_iban: "", bank_note: "",
  store_name: "Deko Kutak", email_enabled: false, owner_email: "",
};

export default function StoreSettings() {
  const [form, setForm] = useState<Settings>({ ...empty });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("store_settings").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) {
        setForm({
          bank_name: data.bank_name ?? "",
          bank_account_holder: data.bank_account_holder ?? "",
          bank_iban: data.bank_iban ?? "",
          bank_note: data.bank_note ?? "",
          store_name: data.store_name ?? "Deko Kutak",
          email_enabled: data.email_enabled ?? false,
          owner_email: data.owner_email ?? "",
        });
      }
      setLoading(false);
    });
  }, []);

  function set(key: keyof Settings, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("store_settings").upsert({
      id: 1,
      bank_name: form.bank_name || null,
      bank_account_holder: form.bank_account_holder || null,
      bank_iban: form.bank_iban || null,
      bank_note: form.bank_note || null,
      store_name: form.store_name || "Deko Kutak",
      email_enabled: form.email_enabled,
      owner_email: form.owner_email || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-xl flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-navy mb-1">Store Settings</h1>
          <p className="text-sm text-gray-400">Bank details and email invoice configuration</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" strokeWidth={2} />
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>

      {error && <p className="text-sm text-red-500 px-4 py-3 bg-red-50 rounded-lg">{error}</p>}

      {/* Bank details */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-navy text-sm">Bank Transfer Details</h2>

        <Field label="Account Holder Name">
          <input value={form.bank_account_holder} onChange={(e) => set("bank_account_holder", e.target.value)}
            placeholder="e.g. Deko Kutak d.o.o." className={inputCls} />
        </Field>
        <Field label="Bank Name">
          <input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)}
            placeholder="e.g. Raiffeisen Bank" className={inputCls} />
        </Field>
        <Field label="IBAN">
          <input value={form.bank_iban} onChange={(e) => set("bank_iban", e.target.value)}
            placeholder="BA39 1234 5678 9012 3456" className={`${inputCls} font-mono`} />
        </Field>
        <Field label="Additional Note (optional)">
          <textarea value={form.bank_note} onChange={(e) => set("bank_note", e.target.value)}
            rows={2} placeholder="e.g. Use your order number as the payment reference."
            className={`${inputCls} resize-none`} />
        </Field>
      </div>

      {/* Email invoices */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-navy/50" strokeWidth={1.75} />
            <h2 className="font-semibold text-navy text-sm">Email Invoices</h2>
          </div>
          {/* Toggle */}
          <button
            type="button"
            onClick={() => set("email_enabled", !form.email_enabled)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.email_enabled ? "bg-navy" : "bg-gray-200"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.email_enabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>

        {form.email_enabled && (
          <>
            <Field label="Store Name (shown in emails)">
              <input value={form.store_name} onChange={(e) => set("store_name", e.target.value)}
                placeholder="Deko Kutak" className={inputCls} />
            </Field>
            <Field label="Owner Notification Email">
              <input type="email" value={form.owner_email} onChange={(e) => set("owner_email", e.target.value)}
                placeholder="you@yourdomain.com" className={inputCls} />
              <p className="text-xs text-gray-400">You will receive a copy of every new order at this address.</p>
            </Field>
          </>
        )}

        {/* SMTP setup instructions */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex gap-3">
          <Info className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" strokeWidth={1.75} />
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-600">SMTP Setup (one-time via terminal)</p>
            <p className="text-xs text-gray-400">Your SMTP credentials are stored as secure Supabase secrets — not in the database. Run these commands once:</p>
            <pre className="text-[11px] bg-gray-900 text-green-400 rounded-lg p-3 overflow-x-auto leading-relaxed">{`supabase secrets set SMTP_HOST=your.smtp.host
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=your@email.com
supabase secrets set SMTP_PASS=yourpassword
supabase secrets set SMTP_FROM_EMAIL=noreply@yourdomain.com
supabase secrets set SMTP_FROM_NAME="Deko Kutak"

supabase functions deploy send-order-email`}</pre>
          </div>
        </div>
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

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full";
