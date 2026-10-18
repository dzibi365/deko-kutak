import { useConsent } from "../context/ConsentContext";
import { useLang } from "../context/LanguageContext";
import { t } from "../i18n/translations";
import CookiePreferencesModal from "./CookiePreferencesModal";

export default function CookieBanner() {
  const { bannerVisible, preferencesOpen, acceptAll, rejectOptional, openPreferences } =
    useConsent();
  const { lang } = useLang();
  const tx = t[lang];

  if (!bannerVisible) return null;

  return (
    <>
      {/* Overlay — does NOT cover the full viewport; sits above content but below the banner */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-black/20 pointer-events-none"
      />

      <div
        role="dialog"
        aria-modal="false"
        aria-label={tx.cookie_banner_title}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg"
      >
        <div className="max-w-screen-xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-6">
            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {tx.cookie_banner_title}
              </p>
              <p className="text-sm text-gray-600 leading-snug">
                {tx.cookie_banner_desc}{" "}
                <a
                  href="/cookie-policy"
                  className="underline text-gray-700 hover:text-gray-900 whitespace-nowrap"
                >
                  {tx.cookie_policy_link}
                </a>
              </p>
            </div>

            {/* Actions — equal visual weight */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:shrink-0">
              <button
                type="button"
                onClick={openPreferences}
                className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-copper)] transition-colors"
              >
                {tx.cookie_preferences}
              </button>
              <button
                type="button"
                onClick={rejectOptional}
                className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-copper)] transition-colors"
              >
                {tx.cookie_reject_optional}
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="px-4 py-2 text-sm font-medium rounded-md border border-[var(--color-copper)] text-white bg-[var(--color-copper)] hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-copper)] transition-opacity"
              >
                {tx.cookie_accept_all}
              </button>
            </div>
          </div>
        </div>
      </div>

      {preferencesOpen && <CookiePreferencesModal />}
    </>
  );
}
