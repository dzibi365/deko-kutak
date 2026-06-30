import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

type SiteSettings = {
  store_name: string;
  logo_url: string | null;
  footer_logo_url: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_email: string | null;
  footer_desc_en: string | null;
  footer_desc_bs: string | null;
  seo_title: string | null;
  seo_description_en: string | null;
  seo_description_bs: string | null;
  og_image: string | null;
  topbar_enabled: boolean;
  topbar_left_text_en: string | null;
  topbar_left_text_bs: string | null;
  topbar_phone: string | null;
  topbar_email: string | null;
  topbar_hours_en: string | null;
  topbar_hours_bs: string | null;
  topbar_right_text_en: string | null;
  topbar_right_text_bs: string | null;
};

const defaults: SiteSettings = {
  store_name: "Deko Kutak",
  logo_url: null,
  footer_logo_url: null,
  social_facebook: null,
  social_instagram: null,
  social_email: null,
  footer_desc_en: null,
  footer_desc_bs: null,
  seo_title: null,
  seo_description_en: null,
  seo_description_bs: null,
  og_image: null,
  topbar_enabled: false,
  topbar_left_text_en: null,
  topbar_left_text_bs: null,
  topbar_phone: null,
  topbar_email: null,
  topbar_hours_en: null,
  topbar_hours_bs: null,
  topbar_right_text_en: null,
  topbar_right_text_bs: null,
};

const SiteSettingsContext = createContext<SiteSettings>(defaults);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaults);

  useEffect(() => {
    supabase
      .from("store_settings")
      .select("store_name, logo_url, footer_logo_url, social_facebook, social_instagram, social_email, footer_desc_en, footer_desc_bs, seo_title, seo_description_en, seo_description_bs, og_image, topbar_enabled, topbar_left_text_en, topbar_left_text_bs, topbar_phone, topbar_email, topbar_hours_en, topbar_hours_bs, topbar_right_text_en, topbar_right_text_bs")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettings({
            store_name: data.store_name ?? "Deko Kutak",
            logo_url: data.logo_url ?? null,
            footer_logo_url: data.footer_logo_url ?? null,
            social_facebook: data.social_facebook ?? null,
            social_instagram: data.social_instagram ?? null,
            social_email: data.social_email ?? null,
            footer_desc_en: data.footer_desc_en ?? null,
            footer_desc_bs: data.footer_desc_bs ?? null,
            seo_title: data.seo_title ?? null,
            seo_description_en: data.seo_description_en ?? null,
            seo_description_bs: data.seo_description_bs ?? null,
            og_image: data.og_image ?? null,
            topbar_enabled: data.topbar_enabled ?? false,
            topbar_left_text_en: data.topbar_left_text_en ?? null,
            topbar_left_text_bs: data.topbar_left_text_bs ?? null,
            topbar_phone: data.topbar_phone ?? null,
            topbar_email: data.topbar_email ?? null,
            topbar_hours_en: data.topbar_hours_en ?? null,
            topbar_hours_bs: data.topbar_hours_bs ?? null,
            topbar_right_text_en: data.topbar_right_text_en ?? null,
            topbar_right_text_bs: data.topbar_right_text_bs ?? null,
          });
        }
      });
  }, []);

  return (
    <SiteSettingsContext.Provider value={settings}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
