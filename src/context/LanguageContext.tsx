import { createContext, useContext, useState, type ReactNode } from "react";
import { t, type Lang } from "../i18n/translations";

type LanguageContextType = {
  lang: Lang;
  toggleLang: () => void;
  tr: (key: keyof typeof t.en) => string;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem("lang") as Lang) ?? "bs";
  });

  function toggleLang() {
    const next: Lang = lang === "en" ? "bs" : "en";
    setLang(next);
    localStorage.setItem("lang", next);
  }

  function tr(key: keyof typeof t.en): string {
    return t[lang][key];
  }

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, tr }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used inside LanguageProvider");
  return ctx;
}
