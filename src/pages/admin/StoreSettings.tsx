import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Settings = {
  bank_name: string;
  bank_account_holder: string;
  bank_iban: string;
  bank_note: string;
};

const empty: Settings = { bank_name: "", bank_account_holder: "", bank_iban: "", bank_note: "" };

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
        });
      }
      setLoading(false);
    });
  }, []);

  function set(key: keyof Settings, value: string) {
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
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-navy">Store Settings</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" strokeWidth={2} />
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-8">Bank transfer details shown to customers after placing an order</p>

      {error && <p className="text-sm text-red-500 mb-4 px-4 py-3 bg-red-50 rounded-lg">{error}</p>}

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
