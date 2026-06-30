import { useEffect, useRef, useState } from "react";
import { Save, Mail, Info, ImagePlus, X, Instagram, Facebook, Search, Phone, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase";

type Settings = {
  store_name: string;
  logo_url: string | null;
  footer_logo_url: string | null;
  footer_desc_en: string;
  footer_desc_bs: string;
  social_facebook: string;
  social_instagram: string;
  social_email: string;
  bank_name: string;
  bank_account_holder: string;
  bank_iban: string;
  bank_note: string;
  email_enabled: boolean;
  owner_email: string;
  seo_title: string;
  seo_description_en: string;
  seo_description_bs: string;
  og_image: string;
  topbar_enabled: boolean;
  topbar_left_text_en: string;
  topbar_left_text_bs: string;
  topbar_phone: string;
  topbar_email: string;
  topbar_hours_en: string;
  topbar_hours_bs: string;
  topbar_right_text_en: string;
  topbar_right_text_bs: string;
};

const empty: Settings = {
  store_name: "Deko Kutak",
  logo_url: null,
  footer_logo_url: null,
  footer_desc_en: "", footer_desc_bs: "",
  social_facebook: "", social_instagram: "", social_email: "",
  bank_name: "", bank_account_holder: "", bank_iban: "", bank_note: "",
  email_enabled: false, owner_email: "",
  seo_title: "", seo_description_en: "", seo_description_bs: "", og_image: "",
  topbar_enabled: false,
  topbar_left_text_en: "", topbar_left_text_bs: "",
  topbar_phone: "", topbar_email: "",
  topbar_hours_en: "", topbar_hours_bs: "",
  topbar_right_text_en: "", topbar_right_text_bs: "",
};

export default function StoreSettings() {
  const [form, setForm] = useState<Settings>({ ...empty });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFooterLogo, setUploadingFooterLogo] = useState(false);
  const [uploadingOg, setUploadingOg] = useState(false);
  const [footerTab, setFooterTab] = useState<"en" | "bs">("en");
  const [seoDescTab, setSeoDescTab] = useState<"en" | "bs">("en");
  const [topbarTab, setTopbarTab] = useState<"en" | "bs">("en");
  const logoRef = useRef<HTMLInputElement>(null);
  const footerLogoRef = useRef<HTMLInputElement>(null);
  const ogRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from("store_settings").select("*").eq("id", 1).single().then(({ data }) => {
      if (data) {
        setForm({
          store_name: data.store_name ?? "Deko Kutak",
          logo_url: data.logo_url ?? null,
          footer_logo_url: data.footer_logo_url ?? null,
          footer_desc_en: data.footer_desc_en ?? "",
          footer_desc_bs: data.footer_desc_bs ?? "",
          social_facebook: data.social_facebook ?? "",
          social_instagram: data.social_instagram ?? "",
          social_email: data.social_email ?? "",
          bank_name: data.bank_name ?? "",
          bank_account_holder: data.bank_account_holder ?? "",
          bank_iban: data.bank_iban ?? "",
          bank_note: data.bank_note ?? "",
          email_enabled: data.email_enabled ?? false,
          owner_email: data.owner_email ?? "",
          seo_title: data.seo_title ?? "",
          seo_description_en: data.seo_description_en ?? "",
          seo_description_bs: data.seo_description_bs ?? "",
          og_image: data.og_image ?? "",
          topbar_enabled: data.topbar_enabled ?? false,
          topbar_left_text_en: data.topbar_left_text_en ?? "",
          topbar_left_text_bs: data.topbar_left_text_bs ?? "",
          topbar_phone: data.topbar_phone ?? "",
          topbar_email: data.topbar_email ?? "",
          topbar_hours_en: data.topbar_hours_en ?? "",
          topbar_hours_bs: data.topbar_hours_bs ?? "",
          topbar_right_text_en: data.topbar_right_text_en ?? "",
          topbar_right_text_bs: data.topbar_right_text_bs ?? "",
        });
      }
      setLoading(false);
    });
  }, []);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    setError(null);
    const ext = file.name.split(".").pop();
    const path = `brand/logo.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) { setError(uploadErr.message); setUploadingLogo(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    set("logo_url", `${publicUrl}?t=${Date.now()}`);
    setUploadingLogo(false);
  }

  async function handleFooterLogoUpload(file: File) {
    setUploadingFooterLogo(true);
    setError(null);
    const ext = file.name.split(".").pop();
    const path = `brand/footer-logo.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) { setError(uploadErr.message); setUploadingFooterLogo(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    set("footer_logo_url", `${publicUrl}?t=${Date.now()}`);
    setUploadingFooterLogo(false);
  }

  async function handleOgUpload(file: File) {
    setUploadingOg(true);
    setError(null);
    const ext = file.name.split(".").pop();
    const path = `brand/og-image.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (uploadErr) { setError(uploadErr.message); setUploadingOg(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(path);
    set("og_image", `${publicUrl}?t=${Date.now()}`);
    setUploadingOg(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const { error: err } = await supabase.from("store_settings").upsert({
      id: 1,
      store_name: form.store_name || "Deko Kutak",
      logo_url: form.logo_url || null,
      footer_logo_url: form.footer_logo_url || null,
      footer_desc_en: form.footer_desc_en || null,
      footer_desc_bs: form.footer_desc_bs || null,
      social_facebook: form.social_facebook || null,
      social_instagram: form.social_instagram || null,
      social_email: form.social_email || null,
      bank_name: form.bank_name || null,
      bank_account_holder: form.bank_account_holder || null,
      bank_iban: form.bank_iban || null,
      bank_note: form.bank_note || null,
      email_enabled: form.email_enabled,
      owner_email: form.owner_email || null,
      seo_title: form.seo_title || null,
      seo_description_en: form.seo_description_en || null,
      seo_description_bs: form.seo_description_bs || null,
      og_image: form.og_image || null,
      topbar_enabled: form.topbar_enabled,
      topbar_left_text_en: form.topbar_left_text_en || null,
      topbar_left_text_bs: form.topbar_left_text_bs || null,
      topbar_phone: form.topbar_phone || null,
      topbar_email: form.topbar_email || null,
      topbar_hours_en: form.topbar_hours_en || null,
      topbar_hours_bs: form.topbar_hours_bs || null,
      topbar_right_text_en: form.topbar_right_text_en || null,
      topbar_right_text_bs: form.topbar_right_text_bs || null,
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
          <p className="text-sm text-gray-400">Brand, bank details, and email configuration</p>
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

      {/* Brand Identity */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-5">
        <h2 className="font-semibold text-navy text-sm">Brand Identity</h2>

        <Field label="Store Name">
          <input
            value={form.store_name}
            onChange={(e) => set("store_name", e.target.value)}
            placeholder="Deko Kutak"
            className={inputCls}
          />
          <p className="text-xs text-gray-400">Shown in the navbar, footer, and emails.</p>
        </Field>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-navy">Logo</label>

          {form.logo_url ? (
            <div className="flex items-start gap-4">
              <div className="w-32 h-16 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden p-2">
                <img src={form.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => logoRef.current?.click()}
                  disabled={uploadingLogo}
                  className="text-xs font-semibold text-navy border border-navy/30 px-3 py-1.5 rounded-lg hover:bg-navy/5 transition-colors disabled:opacity-50"
                >
                  {uploadingLogo ? "Uploading…" : "Replace"}
                </button>
                <button
                  type="button"
                  onClick={() => set("logo_url", null)}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logoRef.current?.click()}
              disabled={uploadingLogo}
              className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-navy/30 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <ImagePlus className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
              <span className="text-sm text-gray-400">
                {uploadingLogo ? "Uploading…" : "Click to upload logo"}
              </span>
              <span className="text-xs text-gray-300">PNG or SVG recommended · max 2MB</span>
            </button>
          )}

          <input
            ref={logoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Footer logo */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-navy">Footer Logo</label>
          <p className="text-xs text-gray-400">White or light version of your logo shown on the dark footer background. If not set, the main logo above will be inverted automatically.</p>

          {form.footer_logo_url ? (
            <div className="flex items-start gap-4">
              <div className="w-32 h-16 rounded-lg border border-gray-200 bg-navy flex items-center justify-center overflow-hidden p-2">
                <img src={form.footer_logo_url} alt="Footer Logo" className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => footerLogoRef.current?.click()}
                  disabled={uploadingFooterLogo}
                  className="text-xs font-semibold text-navy border border-navy/30 px-3 py-1.5 rounded-lg hover:bg-navy/5 transition-colors disabled:opacity-50"
                >
                  {uploadingFooterLogo ? "Uploading…" : "Replace"}
                </button>
                <button
                  type="button"
                  onClick={() => set("footer_logo_url", null)}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => footerLogoRef.current?.click()}
              disabled={uploadingFooterLogo}
              className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-navy/30 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <ImagePlus className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
              <span className="text-sm text-gray-400">
                {uploadingFooterLogo ? "Uploading…" : "Click to upload footer logo"}
              </span>
              <span className="text-xs text-gray-300">White/light version · PNG or SVG recommended</span>
            </button>
          )}

          <input
            ref={footerLogoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFooterLogoUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Footer description */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-navy">Footer description</label>
            <div className="flex gap-1 p-0.5 bg-gray-100 rounded-md">
              {(["en", "bs"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setFooterTab(l)}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${footerTab === l ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={footerTab === "en" ? form.footer_desc_en : form.footer_desc_bs}
            onChange={(e) => set(footerTab === "en" ? "footer_desc_en" : "footer_desc_bs", e.target.value)}
            rows={3}
            placeholder={footerTab === "en"
              ? "Unique handmade gifts crafted with love…"
              : "Jedinstveni ručno rađeni pokloni izrađeni s ljubavlju…"}
            className={`${inputCls} resize-none`}
          />
          <p className="text-xs text-gray-400">Shown below the logo in the website footer.</p>
        </div>

        {/* Live preview */}
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Navbar preview</p>
          <div className="bg-[#f5f5f0] rounded-lg px-4 py-3 border border-gray-100 flex items-center">
            {form.logo_url ? (
              <img src={form.logo_url} alt={form.store_name} className="h-20 w-auto object-contain" />
            ) : (
              <span className="text-base font-semibold tracking-tight text-navy">{form.store_name || "Deko Kutak"}.</span>
            )}
          </div>
        </div>
      </div>

      {/* Top Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-navy text-sm">Top Bar</h2>
            <p className="text-xs text-gray-400 mt-0.5">Slim info bar above the navbar with contact details and hours.</p>
          </div>
          <button
            type="button"
            onClick={() => set("topbar_enabled", !form.topbar_enabled)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.topbar_enabled ? "bg-navy" : "bg-gray-200"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.topbar_enabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>

        {form.topbar_enabled && (
          <>
            {/* Language tab switcher */}
            <div className="flex gap-1 p-1 bg-gray-100 rounded-lg self-start">
              {(["en", "bs"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setTopbarTab(l)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${topbarTab === l ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="border-t border-gray-100 pt-4 flex flex-col gap-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Left side</p>

              <Field label={`Text (${topbarTab.toUpperCase()})`}>
                <input
                  value={topbarTab === "en" ? form.topbar_left_text_en : form.topbar_left_text_bs}
                  onChange={(e) => set(topbarTab === "en" ? "topbar_left_text_en" : "topbar_left_text_bs", e.target.value)}
                  placeholder={topbarTab === "en" ? "e.g. Free delivery on orders over 100 KM" : "npr. Besplatna dostava za narudžbe iznad 100 KM"}
                  className={inputCls}
                />
              </Field>

              <Field label="Phone number">
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
                  <input
                    value={form.topbar_phone}
                    onChange={(e) => set("topbar_phone", e.target.value)}
                    placeholder="+387 61 123 456"
                    className={`${inputCls} pl-9`}
                  />
                </div>
                <p className="text-xs text-gray-400">Same in both languages.</p>
              </Field>

              <Field label="Email">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
                  <input
                    type="email"
                    value={form.topbar_email}
                    onChange={(e) => set("topbar_email", e.target.value)}
                    placeholder="info@dekokutak.ba"
                    className={`${inputCls} pl-9`}
                  />
                </div>
                <p className="text-xs text-gray-400">Same in both languages.</p>
              </Field>
            </div>

            <div className="border-t border-gray-100 pt-4 flex flex-col gap-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Right side</p>

              <Field label={`Working hours (${topbarTab.toUpperCase()})`}>
                <div className="relative">
                  <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
                  <input
                    value={topbarTab === "en" ? form.topbar_hours_en : form.topbar_hours_bs}
                    onChange={(e) => set(topbarTab === "en" ? "topbar_hours_en" : "topbar_hours_bs", e.target.value)}
                    placeholder={topbarTab === "en" ? "Mon–Fri: 09:00–17:00 · Sat: 10:00–14:00" : "Pon–Pet: 09:00–17:00 · Sub: 10:00–14:00"}
                    className={`${inputCls} pl-9`}
                  />
                </div>
              </Field>

              <Field label={`Additional text (${topbarTab.toUpperCase()})`}>
                <input
                  value={topbarTab === "en" ? form.topbar_right_text_en : form.topbar_right_text_bs}
                  onChange={(e) => set(topbarTab === "en" ? "topbar_right_text_en" : "topbar_right_text_bs", e.target.value)}
                  placeholder={topbarTab === "en" ? "e.g. Orders ship within 24h" : "npr. Narudžbe šaljemo u roku 24h"}
                  className={inputCls}
                />
              </Field>
            </div>

            {/* Live preview */}
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Preview ({topbarTab.toUpperCase()})</p>
              <div className="bg-navy rounded-lg px-4 h-9 flex items-center justify-between text-xs text-cream/80">
                <div className="flex items-center gap-4">
                  {(topbarTab === "en" ? form.topbar_left_text_en : form.topbar_left_text_bs) && (
                    <span>{topbarTab === "en" ? form.topbar_left_text_en : form.topbar_left_text_bs}</span>
                  )}
                  {form.topbar_phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3 h-3" strokeWidth={1.75} />
                      {form.topbar_phone}
                    </span>
                  )}
                  {form.topbar_email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3 h-3" strokeWidth={1.75} />
                      {form.topbar_email}
                    </span>
                  )}
                  {!form.topbar_left_text_en && !form.topbar_left_text_bs && !form.topbar_phone && !form.topbar_email && (
                    <span className="text-cream/30 italic">Left side empty</span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-cream/50">
                  {(topbarTab === "en" ? form.topbar_hours_en : form.topbar_hours_bs) && (
                    <span>{topbarTab === "en" ? form.topbar_hours_en : form.topbar_hours_bs}</span>
                  )}
                  {(topbarTab === "en" ? form.topbar_right_text_en : form.topbar_right_text_bs) && (
                    <span>{topbarTab === "en" ? form.topbar_right_text_en : form.topbar_right_text_bs}</span>
                  )}
                  {!form.topbar_hours_en && !form.topbar_hours_bs && !form.topbar_right_text_en && !form.topbar_right_text_bs && (
                    <span className="text-cream/30 italic">Right side empty</span>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Social Links */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <h2 className="font-semibold text-navy text-sm">Social Links</h2>
        <p className="text-xs text-gray-400 -mt-2">Links appear as icons in the footer. Leave blank to hide an icon.</p>

        <Field label="Instagram">
          <div className="relative">
            <Instagram className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
            <input
              value={form.social_instagram}
              onChange={(e) => set("social_instagram", e.target.value)}
              placeholder="https://instagram.com/yourpage"
              className={`${inputCls} pl-9`}
            />
          </div>
        </Field>

        <Field label="Facebook">
          <div className="relative">
            <Facebook className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
            <input
              value={form.social_facebook}
              onChange={(e) => set("social_facebook", e.target.value)}
              placeholder="https://facebook.com/yourpage"
              className={`${inputCls} pl-9`}
            />
          </div>
        </Field>

        <Field label="Contact Email">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" strokeWidth={1.75} />
            <input
              type="email"
              value={form.social_email}
              onChange={(e) => set("social_email", e.target.value)}
              placeholder="info@dekokutak.ba"
              className={`${inputCls} pl-9`}
            />
          </div>
        </Field>
      </div>

      {/* SEO & Meta Tags */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-navy/50" strokeWidth={1.75} />
          <h2 className="font-semibold text-navy text-sm">SEO & Meta Tags</h2>
        </div>
        <p className="text-xs text-gray-400 -mt-2">Controls what appears in browser tabs, Google search results, and social media previews.</p>

        <Field label="Page Title">
          <input
            value={form.seo_title}
            onChange={(e) => set("seo_title", e.target.value)}
            placeholder={`${form.store_name || "Deko Kutak"} — Handmade Gifts from Bosnia`}
            className={inputCls}
          />
          <p className="text-xs text-gray-400">Shown in the browser tab and as the headline in Google search results. Keep under 60 characters.</p>
        </Field>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-navy">Meta Description</label>
            <div className="flex gap-1 p-0.5 bg-gray-100 rounded-md">
              {(["en", "bs"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setSeoDescTab(l)}
                  className={`px-2.5 py-0.5 rounded text-xs font-semibold transition-colors ${seoDescTab === l ? "bg-white text-navy shadow-sm" : "text-gray-500 hover:text-navy"}`}>
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={seoDescTab === "en" ? form.seo_description_en : form.seo_description_bs}
            onChange={(e) => set(seoDescTab === "en" ? "seo_description_en" : "seo_description_bs", e.target.value)}
            rows={3}
            placeholder={seoDescTab === "en"
              ? "Discover unique handmade gifts and home decor crafted with love in Bosnia…"
              : "Otkrijte jedinstvene ručno rađene poklone i dekoracije za dom izrađene s ljubavlju u Bosni…"}
            className={`${inputCls} resize-none`}
          />
          <p className="text-xs text-gray-400">Shown below the title in search results. Keep under 160 characters.</p>
          {(seoDescTab === "en" ? form.seo_description_en : form.seo_description_bs).length > 0 && (
            <p className={`text-xs ${(seoDescTab === "en" ? form.seo_description_en : form.seo_description_bs).length > 160 ? "text-amber-500" : "text-gray-400"}`}>
              {(seoDescTab === "en" ? form.seo_description_en : form.seo_description_bs).length} / 160
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-navy">Social Share Image (OG Image)</label>
          <p className="text-xs text-gray-400">Shown when your site is shared on Facebook, WhatsApp, etc. Recommended: 1200×630px JPG or PNG.</p>

          {form.og_image ? (
            <div className="flex items-start gap-4">
              <div className="w-40 h-[84px] rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex-shrink-0">
                <img src={form.og_image} alt="OG" className="w-full h-full object-cover" />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => ogRef.current?.click()}
                  disabled={uploadingOg}
                  className="text-xs font-semibold text-navy border border-navy/30 px-3 py-1.5 rounded-lg hover:bg-navy/5 transition-colors disabled:opacity-50"
                >
                  {uploadingOg ? "Uploading…" : "Replace"}
                </button>
                <button
                  type="button"
                  onClick={() => set("og_image", "")}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  <X className="w-3 h-3" /> Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => ogRef.current?.click()}
              disabled={uploadingOg}
              className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-6 hover:border-navy/30 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <ImagePlus className="w-6 h-6 text-gray-300" strokeWidth={1.5} />
              <span className="text-sm text-gray-400">
                {uploadingOg ? "Uploading…" : "Click to upload OG image"}
              </span>
              <span className="text-xs text-gray-300">JPG or PNG · 1200×630px recommended</span>
            </button>
          )}

          <input
            ref={ogRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleOgUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Google preview */}
        {(form.seo_title || form.store_name) && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Google preview</p>
            <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-0.5 bg-gray-50">
              <p className="text-xs text-gray-400">yourdomain.com</p>
              <p className="text-base text-blue-700 font-medium leading-snug">
                {form.seo_title || form.store_name}
              </p>
              {(form.seo_description_en || form.seo_description_bs) && (
                <p className="text-sm text-gray-600 leading-snug line-clamp-2">
                  {form.seo_description_en || form.seo_description_bs}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

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
          <button
            type="button"
            onClick={() => set("email_enabled", !form.email_enabled)}
            className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${form.email_enabled ? "bg-navy" : "bg-gray-200"}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${form.email_enabled ? "translate-x-4" : "translate-x-0"}`} />
          </button>
        </div>

        {form.email_enabled && (
          <Field label="Owner Notification Email">
            <input type="email" value={form.owner_email} onChange={(e) => set("owner_email", e.target.value)}
              placeholder="you@yourdomain.com" className={inputCls} />
            <p className="text-xs text-gray-400">You will receive a copy of every new order at this address.</p>
          </Field>
        )}

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
