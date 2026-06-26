import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";

type SiteSettings = {
  store_name: string;
  logo_url: string | null;
};

const defaults: SiteSettings = { store_name: "Deko Kutak", logo_url: null };

const SiteSettingsContext = createContext<SiteSettings>(defaults);

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaults);

  useEffect(() => {
    supabase
      .from("store_settings")
      .select("store_name, logo_url")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setSettings({
            store_name: data.store_name ?? "Deko Kutak",
            logo_url: data.logo_url ?? null,
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
