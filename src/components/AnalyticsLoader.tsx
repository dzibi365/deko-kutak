import { useEffect } from "react";
import { useConsent } from "../context/ConsentContext";
import { setAnalyticsConsent } from "../lib/analytics";

const MEASUREMENT_ID: string = import.meta.env.VITE_GA_MEASUREMENT_ID ?? "";

/**
 * Mounts once inside ConsentProvider. Watches consent.analytics and
 * enables/disables GA4 accordingly. GA4 script is never injected when
 * VITE_GA_MEASUREMENT_ID is blank (safe on staging by default).
 */
export function AnalyticsLoader() {
  const { consent } = useConsent();

  useEffect(() => {
    setAnalyticsConsent(consent.analytics, MEASUREMENT_ID);
  }, [consent.analytics]);

  return null;
}
