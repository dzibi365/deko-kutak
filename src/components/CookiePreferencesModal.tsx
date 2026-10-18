import { useState } from "react";
import { useConsent } from "../context/ConsentContext";
import { useLang } from "../context/LanguageContext";
import { t } from "../i18n/translations";

function Toggle({
  checked,
  onChange,
  id,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={[
        "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-copper)]",
        disabled
          ? "bg-[var(--color-copper)] opacity-70 cursor-not-allowed"
          : checked
          ? "bg-[var(--color-copper)] cursor-pointer"
          : "bg-gray-200 cursor-pointer",
      ].join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform",
          checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

export default function CookiePreferencesModal() {
  const { consent, acceptAll, rejectOptional, savePreferences, closePreferences } =
    useConsent();
  const { lang } = useLang();
  const tx = t[lang];

  const [analytics, setAnalytics] = useState(consent.analytics);
  const [marketing, setMarketing] = useState(consent.marketing);

  function handleSave() {
    savePreferences({ analytics, marketing });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tx.cookie_settings_title}
      className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/50"
        onClick={closePreferences}
      />

      <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {tx.cookie_settings_title}
          </h2>
          <button
            type="button"
            onClick={closePreferences}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-copper)] rounded"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Description */}
        <div className="px-6 pt-4 pb-2">
          <p className="text-sm text-gray-600">{tx.cookie_settings_desc}</p>
        </div>

        {/* Categories */}
        <div className="px-6 pb-4 divide-y divide-gray-100">
          {/* Necessary — always on */}
          <div className="py-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{tx.cookie_necessary_title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{tx.cookie_necessary_desc}</p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1">
              <Toggle
                id="toggle-necessary"
                checked={true}
                onChange={() => {}}
                disabled={true}
              />
              <span className="text-xs text-gray-400">{tx.cookie_always_active}</span>
            </div>
          </div>

          {/* Analytics */}
          <div className="py-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{tx.cookie_analytics_title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{tx.cookie_analytics_desc}</p>
            </div>
            <div className="shrink-0">
              <Toggle
                id="toggle-analytics"
                checked={analytics}
                onChange={setAnalytics}
              />
            </div>
          </div>

          {/* Marketing */}
          <div className="py-4 flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{tx.cookie_marketing_title}</p>
              <p className="mt-0.5 text-xs text-gray-500">{tx.cookie_marketing_desc}</p>
            </div>
            <div className="shrink-0">
              <Toggle
                id="toggle-marketing"
                checked={marketing}
                onChange={setMarketing}
              />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-2 sm:flex-row sm:justify-between">
          <button
            type="button"
            onClick={rejectOptional}
            className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-copper)] transition-colors"
          >
            {tx.cookie_reject_optional}
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-copper)] transition-colors"
            >
              {tx.cookie_save_preferences}
            </button>
            <button
              type="button"
              onClick={acceptAll}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-copper)] text-white bg-[var(--color-copper)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-copper)] transition-opacity"
            >
              {tx.cookie_accept_all}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
