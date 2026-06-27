import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Save } from "lucide-react";
import { supabase } from "../../lib/supabase";

type HeroRow = {
  badge_en: string; badge_bs: string;
  heading_en: string; heading_bs: string;
  subtext_en: string; subtext_bs: string;
  cta_primary_en: string; cta_primary_bs: string;
  cta_secondary_en: string; cta_secondary_bs: string;
  show_cta_primary: boolean;
  show_cta_secondary: boolean;
  image_url: string;
  stat1_value: string; stat1_label_en: string; stat1_label_bs: string;
  stat2_value: string; stat2_label_en: string; stat2_label_bs: string;
};

const defaults: HeroRow = {
  badge_en: "Handcrafted in Bosnia", badge_bs: "Ručno rađeno u Bosni",
  heading_en: "Artisan gifts for meaningful moments.", heading_bs: "Zanatski pokloni za posebne trenutke.",
  subtext_en: "Discover unique, handmade home decor and personalized gifts crafted with love and natural materials.",
  subtext_bs: "Otkrijte jedinstvene, ručno rađene ukrase za dom i personalizirane poklone izrađene s ljubavlju od prirodnih materijala.",
  cta_primary_en: "Shop Collection", cta_primary_bs: "Pregledaj kolekciju",
  cta_secondary_en: "Our Story", cta_secondary_bs: "Naša priča",
  show_cta_primary: true,
  show_cta_secondary: true,
  image_url: "",
  stat1_value: "500+", stat1_label_en: "Happy Customers", stat1_label_bs: "Zadovoljnih kupaca",
  stat2_value: "100%", stat2_label_en: "Handmade Quality", stat2_label_bs: "Ručna izrada",
};

type Tab = "en" | "bs";

export default function HeroConfig() {
  const [form, setForm] = useState<HeroRow>({ ...defaults });
  const [tab, setTab] = useState<Tab>("en");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("hero_config").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) {
        setForm({
          badge_en: data.badge_en ?? defaults.badge_en,
          badge_bs: data.badge_bs ?? defaults.badge_bs,
          heading_en: data.heading_en ?? defaults.heading_en,
          heading_bs: data.heading_bs ?? defaults.heading_bs,
          subtext_en: data.subtext_en ?? defaults.subtext_en,
          subtext_bs: data.subtext_bs ?? defaults.subtext_bs,
          cta_primary_en: data.cta_primary_en ?? defaults.cta_primary_en,
          cta_primary_bs: data.cta_primary_bs ?? defaults.cta_primary_bs,
          cta_secondary_en: data.cta_secondary_en ?? defaults.cta_secondary_en,
          cta_secondary_bs: data.cta_secondary_bs ?? defaults.cta_secondary_bs,
          show_cta_primary: data.show_cta_primary ?? true,
          show_cta_secondary: data.show_cta_secondary ?? true,
          image_url: data.image_url ?? "",
          stat1_value: data.stat1_value ?? defaults.stat1_value,
          stat1_label_en: data.stat1_label_en ?? defaults.stat1_label_en,
          stat1_label_bs: data.stat1_label_bs ?? defaults.stat1_label_bs,
          stat2_value: data.stat2_value ?? defaults.stat2_value,
          stat2_label_en: data.stat2_label_en ?? defaults.stat2_label_en,
          stat2_label_bs: data.stat2_label_bs ?? defaults.stat2_label_bs,
        });
      }
      setLoading(false);
    });
  }, []);

  function set(key: keyof HeroRow, value: string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const ext = file.name.split(".").pop();
    const path = `hero-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: true });
    if (uploadErr) { setError(uploadErr.message); setUploading(false); return; }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    set("image_url", data.publicUrl);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase
      .from("hero_config")
      .upsert({ id: 1, ...form, updated_at: new Date().toISOString() });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>;

  return (
    <div className="p-8 max-w-2xl">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold text-navy">Homepage — Hero</h1>
        <button
          onClick={handleSave}
          disabled={saving || uploading}
          className="flex items-center gap-2 px-4 py-2 bg-navy text-white text-sm font-semibold rounded-lg hover:bg-navy/90 transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" strokeWidth={2} />
          {saving ? "Saving…" : saved ? "Saved!" : "Save"}
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-8">Edit the hero section that appears at the top of the homepage</p>

      {error && <p className="text-sm text-red-500 mb-4 px-4 py-3 bg-red-50 rounded-lg">{error}</p>}

      {/* Language tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit mb-6">
        {(["en", "bs"] as Tab[]).map((l) => (
          <button key={l} onClick={() => setTab(l)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${tab === l ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`}>
            {l === "en" ? "English" : "Bosanski"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {/* Badge */}
        <Section title="Badge text">
          <input value={tab === "en" ? form.badge_en : form.badge_bs}
            onChange={(e) => set(tab === "en" ? "badge_en" : "badge_bs", e.target.value)}
            placeholder={tab === "en" ? "Handcrafted in Bosnia" : "Ručno rađeno u Bosni"}
            className={inputCls} />
        </Section>

        {/* Heading */}
        <Section title="Main heading">
          <textarea value={tab === "en" ? form.heading_en : form.heading_bs}
            onChange={(e) => set(tab === "en" ? "heading_en" : "heading_bs", e.target.value)}
            rows={2} className={`${inputCls} resize-none`}
            placeholder={tab === "en" ? "Artisan gifts for meaningful moments." : "Zanatski pokloni za posebne trenutke."} />
        </Section>

        {/* Subtext */}
        <Section title="Subtext / description">
          <textarea value={tab === "en" ? form.subtext_en : form.subtext_bs}
            onChange={(e) => set(tab === "en" ? "subtext_en" : "subtext_bs", e.target.value)}
            rows={3} className={`${inputCls} resize-none`}
            placeholder={tab === "en" ? "Discover unique, handmade…" : "Otkrijte jedinstvene…"} />
        </Section>

        {/* CTA buttons */}
        <Section title="Buttons">
          <div className="flex flex-col gap-3">
            {/* Primary */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <button
                type="button"
                onClick={() => set("show_cta_primary", !form.show_cta_primary)}
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${form.show_cta_primary ? "bg-navy" : "bg-gray-300"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.show_cta_primary ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-xs font-semibold text-gray-500">Primary button {!form.show_cta_primary && <span className="text-gray-400 font-normal">(hidden)</span>}</span>
                <input
                  value={tab === "en" ? form.cta_primary_en : form.cta_primary_bs}
                  onChange={(e) => set(tab === "en" ? "cta_primary_en" : "cta_primary_bs", e.target.value)}
                  placeholder={tab === "en" ? "Shop Collection" : "Pregledaj kolekciju"}
                  disabled={!form.show_cta_primary}
                  className={`${inputCls} disabled:opacity-40`}
                />
              </div>
            </div>
            {/* Secondary */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <button
                type="button"
                onClick={() => set("show_cta_secondary", !form.show_cta_secondary)}
                className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 flex-shrink-0 ${form.show_cta_secondary ? "bg-navy" : "bg-gray-300"}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.show_cta_secondary ? "translate-x-4" : "translate-x-0"}`} />
              </button>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-xs font-semibold text-gray-500">Secondary button {!form.show_cta_secondary && <span className="text-gray-400 font-normal">(hidden)</span>}</span>
                <input
                  value={tab === "en" ? form.cta_secondary_en : form.cta_secondary_bs}
                  onChange={(e) => set(tab === "en" ? "cta_secondary_en" : "cta_secondary_bs", e.target.value)}
                  placeholder={tab === "en" ? "Our Story" : "Naša priča"}
                  disabled={!form.show_cta_secondary}
                  className={`${inputCls} disabled:opacity-40`}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* Stats */}
        <Section title="Stats">
          <div className="grid grid-cols-2 gap-4">
            {/* Stat 1 */}
            <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stat 1</p>
              <input value={form.stat1_value} onChange={(e) => set("stat1_value", e.target.value)}
                placeholder="500+" className={inputCls} />
              <input value={tab === "en" ? form.stat1_label_en : form.stat1_label_bs}
                onChange={(e) => set(tab === "en" ? "stat1_label_en" : "stat1_label_bs", e.target.value)}
                placeholder={tab === "en" ? "Happy Customers" : "Zadovoljnih kupaca"}
                className={inputCls} />
            </div>
            {/* Stat 2 */}
            <div className="flex flex-col gap-2 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Stat 2</p>
              <input value={form.stat2_value} onChange={(e) => set("stat2_value", e.target.value)}
                placeholder="100%" className={inputCls} />
              <input value={tab === "en" ? form.stat2_label_en : form.stat2_label_bs}
                onChange={(e) => set(tab === "en" ? "stat2_label_en" : "stat2_label_bs", e.target.value)}
                placeholder={tab === "en" ? "Handmade Quality" : "Ručna izrada"}
                className={inputCls} />
            </div>
          </div>
        </Section>

        {/* Hero image */}
        <Section title="Hero image">
          {form.image_url ? (
            <div className="relative">
              <img src={form.image_url} alt="hero" className="w-full h-52 object-cover rounded-xl border border-gray-200" />
              <button onClick={() => set("image_url", "")}
                className="absolute top-2 right-2 p-1.5 bg-white/90 border border-gray-200 rounded-lg text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors shadow-sm">
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex flex-col items-center justify-center gap-2 w-full h-40 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-navy/40 hover:text-navy transition-colors disabled:opacity-60">
              {uploading
                ? <><div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" /><span className="text-sm">Uploading…</span></>
                : <><Upload className="w-6 h-6" strokeWidth={1.5} /><span className="text-sm font-medium">Upload hero image</span><span className="text-xs">JPG, PNG, WEBP — recommended 1600×900</span></>
              }
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageUpload} />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-navy">{title}</p>
      {children}
    </div>
  );
}

const inputCls = "px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy transition w-full bg-white";
