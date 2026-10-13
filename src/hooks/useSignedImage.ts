import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { classifyImageValue } from "../lib/customerUpload";

// Must match SIGNED_URL_EXPIRY_SECONDS in the sign-image-url Edge Function.
const SIGNED_URL_TTL_MS   = 900_000; // 15 min
const REFRESH_AHEAD_MS    = 120_000; // refresh 2 min before expiry = at 13 min mark
const RETRY_DELAY_MS      = 60_000;  // wait 1 min before each refresh retry attempt
const MAX_REFRESH_RETRIES = 2;       // declare expired after this many consecutive refresh failures

export type SignedImageState = {
  url: string | null;
  loading: boolean;
  expired: boolean; // token invalid/revoked/expired — checkout must be blocked
  legacy: boolean;  // pre-secure CDN URL — needs re-upload, checkout must be blocked
};

export function useSignedImage(
  value: string,
  token: string | undefined,
): SignedImageState {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expired, setExpired] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshFailures = useRef(0);

  // Reset all state when the target (value / token) changes, and treat the
  // next fetch as an initial load regardless of what refreshKey was before.
  useEffect(() => {
    setRefreshKey(0);
    setExpired(false);
    setLegacy(false);
    setUrl(null);
    refreshFailures.current = 0;
  }, [value, token]);

  useEffect(() => {
    const type = classifyImageValue(value);

    if (!value || type === "other") {
      setUrl(null);
      setLoading(false);
      setExpired(false);
      setLegacy(false);
      return;
    }

    // Legacy CDN URLs are not verified secure uploads. Flag as needing
    // re-upload rather than displaying the old public URL — the old URL is
    // never treated as proof of a valid, auditable upload session.
    if (type === "legacy-url") {
      setUrl(null);
      setLoading(false);
      setExpired(false);
      setLegacy(true);
      return;
    }

    if (!token) {
      setUrl(null);
      setLoading(false);
      setExpired(true);
      setLegacy(false);
      return;
    }

    const isInitialFetch = refreshKey === 0;
    let cancelled = false;
    let timer: number | null = null;

    // Show loading only on the initial fetch. During a background refresh the
    // existing URL stays visible — no flicker. The old URL is NOT used as proof
    // that the token is still valid; sign-image-url re-validates on every call.
    if (isInitialFetch) {
      setLoading(true);
      setExpired(false);
      setLegacy(false);
    }

    supabase.functions
      .invoke("sign-image-url", { body: { path: value, token } })
      .then(({ data, error }) => {
        if (cancelled) return;
        const signedUrl =
          !error && typeof (data as Record<string, unknown>)?.url === "string"
            ? (data as Record<string, string>).url
            : null;

        if (signedUrl) {
          refreshFailures.current = 0;
          setUrl(signedUrl);
          setExpired(false);
          setLoading(false);
          // Schedule the next refresh before the signed URL expires.
          timer = window.setTimeout(() => {
            if (!cancelled) setRefreshKey((k) => k + 1);
          }, SIGNED_URL_TTL_MS - REFRESH_AHEAD_MS);
        } else if (isInitialFetch) {
          // Initial load failure → token is invalid, revoked, or expired.
          setExpired(true);
          setLoading(false);
        } else {
          // Refresh failure — may be transient (network hiccup, 5xx). Retry
          // up to MAX_REFRESH_RETRIES times before declaring the token expired.
          refreshFailures.current += 1;
          if (refreshFailures.current <= MAX_REFRESH_RETRIES) {
            timer = window.setTimeout(() => {
              if (!cancelled) setRefreshKey((k) => k + 1);
            }, RETRY_DELAY_MS);
          } else {
            refreshFailures.current = 0;
            setExpired(true);
          }
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (isInitialFetch) {
          setExpired(true);
          setLoading(false);
        } else {
          refreshFailures.current += 1;
          if (refreshFailures.current <= MAX_REFRESH_RETRIES) {
            timer = window.setTimeout(() => {
              if (!cancelled) setRefreshKey((k) => k + 1);
            }, RETRY_DELAY_MS);
          } else {
            refreshFailures.current = 0;
            setExpired(true);
          }
        }
      });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [value, token, refreshKey]);

  return { url, loading, expired, legacy };
}
