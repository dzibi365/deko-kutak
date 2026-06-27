import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

type SiteSettings = {
  store_name: string;
  logo_url: string | null;
  social_facebook: string | null;
  social_instagram: string | null;
  social_email: string | null;
  footer_desc_en: string | null;
  footer_desc_bs: string | null;
};

const defaults: SiteSettings = {
  store_name: "Deko Kutak",
  logo_url: null,
  social_facebook: null,
  social_instagram: null,
  social_email: null,
  footer_desc_en: null,
  footer_desc_bs: null,
};

const SiteSettingsContext = createContext<SiteSettings>(defaults);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaults);

  useEffect(() => {
    supabase
      .from("store_settings")
      .select("store_name, logo_url, social_facebook, social_instagram, social_email, footer_desc_en, footer_desc_bs")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettings({
            store_name: data.store_name ?? "Deko Kutak",
            logo_url: data.logo_url ?? null,
            social_facebook: data.social_facebook ?? null,
            social_instagram: data.social_instagram ?? null,
            social_email: data.social_email ?? null,
            footer_desc_en: data.footer_desc_en ?? null,
            footer_desc_bs: data.footer_desc_bs ?? null,
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
